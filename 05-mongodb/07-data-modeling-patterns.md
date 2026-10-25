# Chapter 76 — Data Modelling & Schema Design Patterns

## 📖 Definition

MongoDB data modelling means designing documents around **how the application reads and writes data** (access patterns), not around normalised tables. The golden rule:

> **Data that is accessed together should be stored together.**

This is the topic that separates junior from senior MongoDB answers — most "MongoDB is slow" stories are really modelling mistakes.

## 🔍 The Modelling Process

1. **List the workload** — the most frequent queries and writes, with rough volumes ("show order with items: 5k/s", "add item: 50/s").
2. **Map relationships** — 1-1, 1-few, 1-many, 1-squillions, many-to-many.
3. **Decide embed vs reference** for each relationship.
4. **Apply patterns** (below) for growth, performance and versioning.
5. **Add indexes** that match the queries.

## 📊 Embed vs Reference

| Embed (sub-document / array) when… | Reference (store `_id`) when… |
|------------------------------------|-------------------------------|
| Child is read with the parent almost always | Child is often read on its own |
| Child doesn't make sense alone (address, line items) | Child is shared by many parents (product in many orders) |
| Number of children is small and **bounded** | Number of children is large or **unbounded** |
| Child changes rarely, or only with parent | Child changes often and independently |
| You need atomic updates across parent + child | Document would approach the **16 MB** limit |

## 💻 Relationship Examples

### One-to-One → embed

```js
// users
{ _id: 1, name: "Asha", profile: { bio: "…", avatarUrl: "…", dob: ISODate("1998-04-02") } }
```

### One-to-Few → embed an array

```js
{ _id: 1, name: "Asha", addresses: [ { label: "home", city: "Pune" }, { label: "work", city: "Mumbai" } ] }
```

### One-to-Many → reference from the child (or array of ids in the parent if bounded)

```js
// products
{ _id: "P1", name: "Phone", partIds: ["X1", "X2", "X3"] }        // bounded list of ids in parent

// orders → reference the customer (child holds parent id)
{ _id: "O1", customerId: 1, total: 1200 }
db.orders.createIndex({ customerId: 1, createdAt: -1 });
```

### One-to-Squillions → child references parent, NEVER an array in the parent

```js
// Logs per server: millions → array would hit 16 MB and get slower on every push
{ _id: ObjectId(), serverId: "srv-1", level: "error", msg: "…", at: ISODate() }
db.logs.createIndex({ serverId: 1, at: -1 });
```

### Many-to-Many → array of references on one or both sides

```js
// students ↔ courses
{ _id: "S1", name: "Asha", courseIds: ["C1", "C2"] }
{ _id: "C1", title: "Databases" }        // query students of C1: db.students.find({ courseIds: "C1" }) + index
```

## 💻 Pattern — Extended Reference (Embed the Fields You Need)

```js
// Instead of $lookup on every order list, copy the few customer fields shown in the UI
{
  _id: "O1",
  customer: { _id: 1, name: "Asha", city: "Pune" },   // duplicated, read-mostly fields
  items: [ { sku: "A1", name: "Pen", price: 20, qty: 2 } ],
  total: 40,
}
```

Trade-off: if the customer renames, you update copies (background job / change stream) — or accept the snapshot (an order **should** keep the price and address at the time of purchase).

## 💻 Pattern — Subset (Keep Hot Data Small)

```js
// products: embed only the 10 most recent reviews; full reviews live in their own collection
{ _id: "P1", name: "Phone", reviewCount: 2381, avgRating: 4.4,
  recentReviews: [ /* last 10 */ ] }

db.products.updateOne({ _id: "P1" }, {
  $push: { recentReviews: { $each: [review], $sort: { at: -1 }, $slice: 10 } },
  $inc: { reviewCount: 1 },
});
db.reviews.insertOne({ productId: "P1", ...review });
```

Keeps the working set in RAM small — product pages load one small document.

## 💻 Pattern — Computed (Pre-Aggregate on Write)

```js
// Instead of counting likes on every read:
db.posts.updateOne({ _id: postId }, { $inc: { likeCount: 1 } });
db.likes.insertOne({ postId, userId, at: new Date() });   // unique index { postId, userId }
```

Good when reads vastly outnumber writes (feeds, dashboards, leaderboards).

## 💻 Pattern — Bucket (Time-Series / IoT)

```js
// One document per sensor per hour instead of one per reading
{
  sensorId: "s-42",
  hour: ISODate("2026-10-22T10:00:00Z"),
  count: 3,
  sum: 75.1,
  readings: [ { t: ISODate("…10:00:05Z"), v: 25.0 }, { t: "…", v: 25.1 }, { t: "…", v: 25.0 } ],
}

db.sensorData.updateOne(
  { sensorId: "s-42", hour: hourStart, count: { $lt: 200 } },          // cap bucket size
  { $push: { readings: { t: now, v } }, $inc: { count: 1, sum: v } },
  { upsert: true },
);
```

Fewer documents and index entries, pre-computed sums. Since MongoDB 5.0, **time series collections** apply this pattern automatically (Advanced Features chapter).

## 💻 Pattern — Outlier

```js
// 99.9% of books have < 1000 buyers; a bestseller has millions.
{ _id: "B1", title: "Normal book", buyerIds: [/* ≤ 1000 */] }
{ _id: "B2", title: "Bestseller", buyerIds: [/* first 1000 */], hasOverflow: true }
// overflow docs: { bookId: "B2", page: 2, buyerIds: [/* next 1000 */] }
```

Optimise the model for the common case; handle the rare huge case separately.

## 💻 Pattern — Attribute (Many Similar, Sparse Fields)

```js
// ❌ Needs an index per field, most documents lack most fields
{ name: "Shirt", color: "red", size: "M", sleeve: "half" }

// ✅ One index serves every attribute query
{ name: "Shirt", attrs: [ { k: "color", v: "red" }, { k: "size", v: "M" }, { k: "sleeve", v: "half" } ] }
db.products.createIndex({ "attrs.k": 1, "attrs.v": 1 });
db.products.find({ attrs: { $elemMatch: { k: "color", v: "red" } } });
```

## 💻 Pattern — Polymorphic & Schema Versioning

```js
// Different shapes in one collection, distinguished by a type field (Mongoose: discriminators)
{ _id: 1, type: "card",  last4: "4242", brand: "visa" }
{ _id: 2, type: "upi",   vpa: "asha@bank" }

// Schema versioning: migrate lazily instead of a big-bang migration
{ _id: 1, schemaVersion: 2, name: { first: "Asha", last: "R" } }
{ _id: 2, name: "Ravi K" }               // v1 — app converts on read and rewrites on next save
```

## ⚠️ Anti-Patterns

| Anti-pattern | Why it hurts | Fix |
|--------------|-------------|-----|
| **Unbounded arrays** (comments, followers, logs in parent) | Document grows toward 16 MB; every update rewrites a big doc; index on array grows | Reference from child; subset/bucket |
| **Massive number of collections** (one per user/tenant) | Each collection + index costs files and RAM | One collection with a `tenantId` field + index |
| **Unnecessary indexes** | Slow writes, RAM usage | Remove unused (`$indexStats`) |
| **Bloated documents** (rarely used big fields in hot docs) | Working set doesn't fit RAM | Move cold data to another collection |
| **Separating data accessed together** | Many `$lookup`s / round trips | Embed or extended reference |
| **Case-insensitive regex queries** | Can't use index efficiently | Collation index or store a lowercased field |

## 💻 Worked Example — E-commerce Model

```js
// users      { _id, name, email (unique), addresses: [ {…} ] }                      embed few addresses
// products   { _id, name, price, stock, categoryIds: [], attrs: [ {k,v} ],
//              avgRating, reviewCount, recentReviews: [ ≤10 ] }                     subset + computed
// reviews    { _id, productId, userId, rating, text, at }                             1-to-squillions
// carts      { _id: userId, items: [ { productId, qty, priceAtAdd } ], updatedAt }   one doc per user
// orders     { _id, userId, status, items: [ { productId, name, price, qty } ],
//              shippingAddress: { … }, total, createdAt }                              snapshot (extended reference)

// Indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.orders.createIndex({ userId: 1, createdAt: -1 });
db.reviews.createIndex({ productId: 1, at: -1 });
db.products.createIndex({ categoryIds: 1, price: 1 });
```

Why order items **embed** product name and price: an order must show what the customer paid, even if the product changes or is deleted later.

## 🌍 Real-World Impact

- A chat app that stored messages in an array inside each conversation hit the 16 MB limit and slow writes; moving messages to their own collection with `{ conversationId, createdAt }` index fixed it.
- Extended-reference + computed fields removed 3 `$lookup`s from a product list page, cutting p95 latency by 5x.

## 🎯 Likely Interview Questions

1. **How do you decide between embedding and referencing?** — Access patterns, cardinality (few/many/squillions), independent access, update frequency, 16 MB limit.
2. **What is the document size limit?** — 16 MB per document (use GridFS for files).
3. **Why are unbounded arrays bad?** — Unlimited growth, slow updates, large index entries, 16 MB limit.
4. **How do you model one-to-millions?** — Child documents hold the parent id; index it.
5. **What is denormalisation and its cost?** — Duplicating data for read speed; cost is keeping copies in sync (or accepting snapshots).
6. **Explain the bucket pattern.** — Group many small time-based readings into one doc per time window with counts/sums.
7. **What is the subset pattern?** — Keep the frequently used part (e.g. latest 10 reviews) in the main doc; the rest elsewhere.
8. **How do you handle schema changes in MongoDB?** — `schemaVersion` field + lazy migration on read/write, or background migration scripts.
9. **Design the schema for Twitter/Instagram followers.** — `follows` collection `{ followerId, followeeId, at }` with unique compound index + both-direction indexes; store `followerCount`/`followingCount` as computed fields.
10. **Design a schema for a blog with comments.** — Posts with `commentCount` + latest few comments (subset); comments in their own collection indexed by `{ postId, createdAt }`.
11. **How do you model multi-tenant data?** — Shared collections with `tenantId` in every document, first field in every index, enforced in the data layer.

---

[← CRUD & Query Operators](06-crud-query-operators.md) | [Index](../README.md) | [Next: Mongoose Schemas →](01-mongoose-schemas.md)
