# Chapter 70 — CRUD & Query Operators

## 📖 Definition

MongoDB stores **documents** (BSON — binary JSON with extra types like `ObjectId`, `Date`, `Decimal128`) inside **collections**, inside **databases**. CRUD = **C**reate (`insertOne/insertMany`), **R**ead (`find/findOne`), **U**pdate (`updateOne/updateMany/replaceOne/findOneAndUpdate`), **D**elete (`deleteOne/deleteMany`).

Interviewers test whether you can write queries **without** an ORM — filters, projections, update operators and array handling — so this chapter uses plain `mongosh` syntax (the Node.js driver uses the same objects).

## 🔍 Terminology Map (SQL → MongoDB)

| SQL | MongoDB |
|-----|---------|
| database | database |
| table | collection |
| row | document |
| column | field |
| primary key | `_id` (auto `ObjectId` if not given) |
| `JOIN` | embedding, `$lookup` |
| `GROUP BY` | `$group` (aggregation) |
| `WHERE` | query filter `{ … }` |
| `SELECT a, b` | projection `{ a: 1, b: 1 }` |

**ObjectId** = 12 bytes: 4-byte timestamp + 5-byte random value + 3-byte counter. So `_id` is roughly sortable by creation time and `ObjectId.getTimestamp()` returns when it was created.

## 💻 Create

```js
db.users.insertOne({ name: "Asha", email: "asha@x.com", age: 27, tags: ["admin"], createdAt: new Date() });
// { acknowledged: true, insertedId: ObjectId("…") }

db.users.insertMany(
  [{ name: "Ravi", age: 31 }, { name: "Meera", age: 24 }],
  { ordered: false },   // keep inserting after a failure (e.g. duplicate key); default is ordered: true
);
```

## 💻 Read — Filters & Projection

```js
db.users.find({ age: 27 });                              // equality
db.users.find({ age: 27 }, { name: 1, email: 1 });       // projection: name, email, _id
db.users.find({}, { name: 1, _id: 0 });                  // exclude _id
db.users.find({}, { password: 0 });                      // all fields except password
// You can't mix include and exclude (except _id).

db.users.findOne({ email: "asha@x.com" });               // first match or null
db.users.find().sort({ createdAt: -1 }).skip(20).limit(10);
db.users.countDocuments({ age: { $gte: 18 } });          // accurate count with filter
db.users.estimatedDocumentCount();                       // fast, uses metadata, no filter
db.users.distinct("city");                               // unique values
```

## 📊 Query Operators

| Group | Operators | Example |
|-------|-----------|---------|
| Comparison | `$eq $ne $gt $gte $lt $lte $in $nin` | `{ age: { $gte: 18, $lt: 30 } }` |
| Logical | `$and $or $nor $not` | `{ $or: [{ city: "Pune" }, { age: { $lt: 25 } }] }` |
| Element | `$exists $type` | `{ phone: { $exists: false } }` |
| Evaluation | `$regex $expr $mod $text $jsonSchema` | `{ $expr: { $gt: ["$spent", "$budget"] } }` |
| Array | `$all $elemMatch $size` | `{ tags: { $all: ["a", "b"] } }` |

```js
// Implicit AND — multiple fields in one object
db.orders.find({ status: "paid", total: { $gt: 1000 } });

// Explicit $and needed when the SAME field appears twice with different operators objects
db.items.find({ $and: [{ price: { $ne: 1.99 } }, { price: { $exists: true } }] });

// $in — like SQL IN
db.orders.find({ status: { $in: ["paid", "shipped"] } });

// $expr — compare two fields of the same document
db.accounts.find({ $expr: { $gt: ["$spent", "$budget"] } });

// $regex — anchored prefix can use an index; case-insensitive cannot use it efficiently
db.users.find({ name: { $regex: "^As" } });
db.users.find({ name: /sha$/i });   // full scan of the index/collection

// null matches BOTH missing fields and explicit null
db.users.find({ phone: null });
db.users.find({ phone: { $exists: true, $eq: null } });   // only explicit null
```

## 💻 Querying Arrays (Very Common in Interviews)

```js
// Sample: { name: "Asha", tags: ["js", "mongo"], scores: [72, 95], 
//           orders: [{ sku: "A1", qty: 2 }, { sku: "B2", qty: 10 }] }

db.users.find({ tags: "mongo" });                       // array CONTAINS "mongo"
db.users.find({ tags: ["js", "mongo"] });               // EXACT array, same order
db.users.find({ tags: { $all: ["mongo", "js"] } });     // contains all, any order
db.users.find({ tags: { $size: 2 } });                  // exact length (no ranges; store a count field for that)
db.users.find({ "tags.0": "js" });                      // first element is "js"

// ⚠️ Without $elemMatch, conditions can be satisfied by DIFFERENT elements
db.users.find({ scores: { $gt: 80, $lt: 85 } });        // matches [72, 95]! (95 > 80, 72 < 85)
db.users.find({ scores: { $elemMatch: { $gt: 80, $lt: 85 } } });   // one element must satisfy both

// Arrays of objects
db.users.find({ "orders.sku": "A1", "orders.qty": { $gte: 5 } });            // ⚠️ may match across elements
db.users.find({ orders: { $elemMatch: { sku: "A1", qty: { $gte: 5 } } } });  // same element

// Return only the matching array element
db.users.find({ "orders.sku": "B2" }, { "orders.$": 1 });
db.users.find({}, { orders: { $elemMatch: { qty: { $gt: 5 } } } });
db.users.find({}, { scores: { $slice: -1 } });           // last element only
```

## 💻 Update Operators

```js
db.users.updateOne(
  { _id: id },
  {
    $set:   { city: "Pune", "address.zip": "411001" },   // set / create fields (dot notation for nested)
    $unset: { tempToken: "" },                           // remove a field
    $inc:   { loginCount: 1, balance: -50 },             // atomic increment/decrement
    $mul:   { price: 1.1 },
    $min:   { lowestScore: 40 },                         // only if new value is lower
    $max:   { highScore: 99 },
    $currentDate: { updatedAt: true },
    $rename: { fullname: "fullName" },
  },
);
```

⚠️ `updateOne({ _id }, { name: "x" })` without an operator is an error in modern drivers; to replace a whole document use `replaceOne`.

## 💻 Array Update Operators

```js
db.users.updateOne({ _id }, { $push: { tags: "react" } });                     // append (allows duplicates)
db.users.updateOne({ _id }, { $addToSet: { tags: "react" } });                 // append if not present
db.users.updateOne({ _id }, { $push: { tags: { $each: ["a", "b"] } } });       // append many
db.users.updateOne({ _id }, { $pull: { tags: "old" } });                       // remove matching values
db.users.updateOne({ _id }, { $pull: { orders: { qty: { $lt: 1 } } } });       // remove by condition
db.users.updateOne({ _id }, { $pop: { tags: 1 } });                            // remove last (-1 = first)

// Keep only the latest 50 notifications (bounded array pattern)
db.users.updateOne({ _id }, {
  $push: { notifications: { $each: [newNote], $sort: { at: -1 }, $slice: 50 } },
});

// Positional operators
db.users.updateOne({ _id, "orders.sku": "A1" }, { $inc: { "orders.$.qty": 1 } });   // FIRST matching element
db.users.updateOne({ _id }, { $set: { "orders.$[].shipped": true } });               // ALL elements
db.users.updateOne(                                                                 // elements matching a filter
  { _id },
  { $set: { "orders.$[o].status": "flagged" } },
  { arrayFilters: [{ "o.qty": { $gt: 5 } }] },
);
```

## 💻 Upsert, findOneAndUpdate, replaceOne

```js
// Upsert: update if found, insert if not — classic "create or increment counter"
db.pageViews.updateOne(
  { page: "/home", day: "2026-10-22" },
  { $inc: { views: 1 }, $setOnInsert: { createdAt: new Date() } },   // $setOnInsert only on insert
  { upsert: true },
);

// Atomically update and RETURN the document (e.g. claim a job from a queue)
const job = db.jobs.findOneAndUpdate(
  { status: "queued" },
  { $set: { status: "running", startedAt: new Date() } },
  { sort: { priority: -1, createdAt: 1 }, returnDocument: "after" },
);

db.users.replaceOne({ _id }, { name: "Asha", email: "asha@x.com" });   // whole document replaced (except _id)
```

**Upsert race condition:** two concurrent upserts on the same filter can both insert. A **unique index** on the filter fields prevents the duplicate: since 4.2 the server retries the losing upsert as an update automatically when the filter is an equality match on that unique index; otherwise you get a duplicate-key error (code 11000) and retry once in your code.

## 💻 Delete

```js
db.sessions.deleteOne({ token });
db.sessions.deleteMany({ expiresAt: { $lt: new Date() } });   // better: TTL index (Indexing chapter)
db.users.findOneAndDelete({ email });                          // returns the deleted document

// Soft delete — common in real apps for audit/undo
db.users.updateOne({ _id }, { $set: { deletedAt: new Date() } });
db.users.find({ deletedAt: null });   // every read must filter (use a partial index)
```

## 💻 Bulk Writes

```js
db.products.bulkWrite(
  [
    { insertOne: { document: { sku: "C3", stock: 5 } } },
    { updateOne: { filter: { sku: "A1" }, update: { $inc: { stock: -1 } } } },
    { updateOne: { filter: { sku: "Z9" }, update: { $set: { stock: 0 } }, upsert: true } },
    { deleteOne: { filter: { sku: "OLD" } } },
  ],
  { ordered: false },   // run in parallel; continue on errors
);
```

One network round trip instead of N — essential for imports and sync jobs.

## 💻 Node.js Driver with TypeScript

```ts
import { MongoClient, ObjectId, type Filter, type UpdateFilter } from "mongodb";

interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  tags: string[];
  loginCount: number;
}

const client = new MongoClient(process.env.MONGO_URI!);
const users = client.db("app").collection<UserDoc>("users");

const filter: Filter<UserDoc> = { tags: "admin", loginCount: { $gte: 1 } };   // typo in a field = compile error
const update: UpdateFilter<UserDoc> = { $inc: { loginCount: 1 }, $addToSet: { tags: "active" } };

await users.updateOne(filter, update);
const admin = await users.findOne({ _id: new ObjectId(id) }, { projection: { name: 1, email: 1 } });

// Cursors stream results in batches (default 101 docs first, then up to 16MB per batch)
for await (const u of users.find({}).batchSize(500)) {
  /* process without loading the whole collection into memory */
}
```

## 🌍 Real-World Impact

- `$inc`, `$addToSet` and `findOneAndUpdate` are **atomic on a single document** — counters, likes and job queues need no transactions.
- Misusing array queries without `$elemMatch` is a classic source of "wrong results" bugs.
- `bulkWrite` turns a 10-minute import loop into seconds.

## 🎯 Likely Interview Questions

1. **What is BSON and why not plain JSON?** — Binary, faster to traverse, and has more types (`ObjectId`, `Date`, `Decimal128`, `Int64`, binary).
2. **What is an ObjectId made of?** — Timestamp (4 bytes) + random (5) + counter (3); roughly time-ordered.
3. **`find` vs `findOne`?** — Cursor of all matches vs first document or `null`.
4. **`countDocuments` vs `estimatedDocumentCount`?** — Exact count with a filter vs fast metadata estimate of the whole collection.
5. **When do you need `$elemMatch`?** — When multiple conditions must be satisfied by the **same** array element.
6. **`$push` vs `$addToSet`?** — Push allows duplicates; addToSet adds only if absent.
7. **What does the positional `$` operator do?** — Updates the first array element matched by the query; `$[]` updates all; `$[id]` + `arrayFilters` updates matching ones.
8. **What is an upsert?** — Update if a match exists, otherwise insert; use `$setOnInsert` for insert-only fields; protect with a unique index.
9. **`updateOne` vs `replaceOne`?** — Operators modify fields vs replacing the whole document.
10. **How do you return the updated document?** — `findOneAndUpdate` with `returnDocument: "after"` (Mongoose: `new: true`).
11. **Does `{ phone: null }` match missing fields?** — Yes, both missing and null. Use `$exists` to distinguish.
12. **Is a single-document update atomic?** — Yes, always, including embedded arrays and sub-documents.
13. **How do you insert many docs and skip duplicates?** — `insertMany(docs, { ordered: false })` with a unique index; catch the bulk write error.

---

[← SQL vs NoSQL](05-sql-vs-nosql.md) | [Index](../README.md) | [Next: Data Modelling & Schema Patterns →](07-data-modeling-patterns.md)
