# Chapter 81 — MongoDB Query Practice Problems (with Solutions)

## 📖 How to Use This Chapter

Many interviews include a live "write this query" round. Try each problem yourself in `mongosh` (or [MongoDB Playground](https://mongoplayground.net/)) before reading the solution. Problems go from easy to hard.

## 🗂️ Sample Data

```js
// users
{ _id: 1, name: "Asha",  city: "Pune",   age: 27, skills: ["js", "mongo"],          joinedAt: ISODate("2024-01-10") }
{ _id: 2, name: "Ravi",  city: "Mumbai", age: 34, skills: ["java"],                 joinedAt: ISODate("2023-06-02") }
{ _id: 3, name: "Meera", city: "Pune",   age: 22, skills: ["js", "react", "mongo"], joinedAt: ISODate("2025-03-15") }

// products
{ _id: "P1", name: "Pen",    category: "stationery",  price: 20 }
{ _id: "P2", name: "Phone",  category: "electronics", price: 15000 }
{ _id: "P3", name: "Laptop", category: "electronics", price: 60000 }

// orders
{ _id: 101, userId: 1, status: "delivered", createdAt: ISODate("2026-09-01"),
  items: [ { productId: "P1", qty: 10, price: 20 }, { productId: "P2", qty: 1, price: 15000 } ] }
{ _id: 102, userId: 3, status: "cancelled", createdAt: ISODate("2026-09-05"),
  items: [ { productId: "P3", qty: 1, price: 60000 } ] }
{ _id: 103, userId: 1, status: "delivered", createdAt: ISODate("2026-10-02"),
  items: [ { productId: "P3", qty: 1, price: 58000 } ] }

// employees
{ _id: 1, name: "A", dept: "eng",   salary: 120000, managerId: null }
{ _id: 2, name: "B", dept: "eng",   salary: 90000,  managerId: 1 }
{ _id: 3, name: "C", dept: "sales", salary: 70000,  managerId: 1 }
{ _id: 4, name: "D", dept: "eng",   salary: 90000,  managerId: 2 }
```

---

## 🟢 Easy

### 1. Users from Pune older than 25, only name and age

```js
db.users.find({ city: "Pune", age: { $gt: 25 } }, { _id: 0, name: 1, age: 1 });
```

### 2. Users who know BOTH js and mongo

```js
db.users.find({ skills: { $all: ["js", "mongo"] } });
```

### 3. Users who know js OR java, newest first

```js
db.users.find({ skills: { $in: ["js", "java"] } }).sort({ joinedAt: -1 });
```

### 4. Add "node" to Asha's skills without duplicates

```js
db.users.updateOne({ name: "Asha" }, { $addToSet: { skills: "node" } });
```

### 5. Count users per city

```js
db.users.aggregate([
  { $group: { _id: "$city", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);
```

### 6. Increase every electronics price by 10%

```js
db.products.updateMany({ category: "electronics" }, { $mul: { price: 1.1 } });
```

---

## 🟡 Medium

### 7. Total revenue of delivered orders

```js
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $unwind: "$items" },
  { $group: { _id: null, revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } } } },
]);
// → { _id: null, revenue: 73200 }   (200 + 15000 + 58000)
```

Alternative without `$unwind` (faster — no document explosion):

```js
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $project: { orderTotal: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.qty", "$$i.price"] } } } } } },
  { $group: { _id: null, revenue: { $sum: "$orderTotal" } } },
]);
```

### 8. Monthly revenue for 2026

```js
db.orders.aggregate([
  { $match: { status: "delivered", createdAt: { $gte: ISODate("2026-01-01"), $lt: ISODate("2027-01-01") } } },
  { $unwind: "$items" },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
      revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
      orders: { $addToSet: "$_id" },
    },
  },
  { $project: { revenue: 1, orderCount: { $size: "$orders" } } },
  { $sort: { _id: 1 } },
]);
```

### 9. Orders with customer name (join)

```js
db.orders.aggregate([
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
  { $unwind: "$user" },
  { $project: { status: 1, createdAt: 1, customer: "$user.name" } },
]);
```

### 10. Users who have never placed an order

```js
db.users.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "userId", as: "orders" } },
  { $match: { orders: { $size: 0 } } },
  { $project: { name: 1 } },
]);
// → Ravi
```

### 11. Top 2 customers by total spend (delivered only)

```js
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $unwind: "$items" },
  { $group: { _id: "$userId", spent: { $sum: { $multiply: ["$items.qty", "$items.price"] } } } },
  { $sort: { spent: -1 } },
  { $limit: 2 },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
  { $project: { _id: 0, name: { $first: "$u.name" }, spent: 1 } },
]);
```

### 12. Most popular skills across users

```js
db.users.aggregate([
  { $unwind: "$skills" },
  { $group: { _id: "$skills", users: { $sum: 1 } } },
  { $sort: { users: -1, _id: 1 } },
]);
```

### 13. Find duplicate emails (data cleanup)

```js
db.users.aggregate([
  { $group: { _id: { $toLower: "$email" }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
]);
```

### 14. Increase qty of product P1 inside order 101 by 5

```js
db.orders.updateOne({ _id: 101, "items.productId": "P1" }, { $inc: { "items.$.qty": 5 } });
```

### 15. Mark every item with qty > 5 as "bulk" in all orders

```js
db.orders.updateMany(
  {},
  { $set: { "items.$[it].bulk": true } },
  { arrayFilters: [{ "it.qty": { $gt: 5 } }] },
);
```

---

## 🔴 Hard

### 16. Second-highest salary (classic SQL question, MongoDB style)

```js
db.employees.aggregate([
  { $group: { _id: "$salary" } },          // distinct salaries
  { $sort: { _id: -1 } },
  { $skip: 1 },
  { $limit: 1 },
]);
// → 90000
```

### 17. Highest-paid employee(s) per department

```js
db.employees.aggregate([
  {
    $setWindowFields: {
      partitionBy: "$dept",
      sortBy: { salary: -1 },
      output: { rnk: { $denseRank: {} } },
    },
  },
  { $match: { rnk: 1 } },
  { $project: { _id: 0, dept: 1, name: 1, salary: 1 } },
]);
```

Older approach (pre-5.0):

```js
db.employees.aggregate([
  { $sort: { dept: 1, salary: -1 } },
  { $group: { _id: "$dept", top: { $first: "$$ROOT" } } },   // only one per dept on ties
]);
```

### 18. Top 2 products per category by price

```js
db.products.aggregate([
  { $sort: { category: 1, price: -1 } },
  { $group: { _id: "$category", products: { $push: { name: "$name", price: "$price" } } } },
  { $project: { top2: { $slice: ["$products", 2] } } },
]);
// 5.2+: { $group: { _id: "$category", top2: { $topN: { n: 2, sortBy: { price: -1 }, output: "$name" } } } }
```

### 19. Employee hierarchy — everyone under manager A (recursive)

```js
db.employees.aggregate([
  { $match: { _id: 1 } },
  {
    $graphLookup: {
      from: "employees",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "managerId",
      as: "reports",
      depthField: "level",
    },
  },
  { $project: { name: 1, reports: { name: 1, level: 1 } } },
]);
// → B (level 0), C (level 0), D (level 1)
```

### 20. Dashboard in one query: totals by status + 5 latest orders + count

```js
db.orders.aggregate([
  {
    $facet: {
      byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
      latest: [{ $sort: { createdAt: -1 } }, { $limit: 5 }, { $project: { status: 1, createdAt: 1 } }],
      total: [{ $count: "n" }],
    },
  },
]);
```

### 21. Customers who bought a laptop AND a phone (in any orders)

```js
db.orders.aggregate([
  { $match: { status: { $ne: "cancelled" } } },
  { $unwind: "$items" },
  { $group: { _id: "$userId", products: { $addToSet: "$items.productId" } } },
  { $match: { products: { $all: ["P2", "P3"] } } },
]);
// → userId 1
```

### 22. Retention: users who ordered in both September and October 2026

```js
db.orders.aggregate([
  { $match: { createdAt: { $gte: ISODate("2026-09-01"), $lt: ISODate("2026-11-01") } } },
  { $group: { _id: "$userId", months: { $addToSet: { $month: "$createdAt" } } } },
  { $match: { months: { $all: [9, 10] } } },
]);
```

### 23. Running total of revenue by day

```js
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $unwind: "$items" },
  {
    $group: {
      _id: { $dateTrunc: { date: "$createdAt", unit: "day" } },
      revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
    },
  },
  { $setWindowFields: { sortBy: { _id: 1 }, output: { cumulative: { $sum: "$revenue", window: { documents: ["unbounded", "current"] } } } } },
]);
```

### 24. Which index would you create for this query?

```js
db.orders.find({ userId: 1, status: "delivered", createdAt: { $gte: ISODate("2026-01-01") } }).sort({ createdAt: -1 });
```

**Answer:** `{ userId: 1, status: 1, createdAt: -1 }` — two equality fields, then the sort field (which also serves the range on the same field). Verify with `explain("executionStats")`: `IXSCAN`, no `SORT` stage.

### 25. Paginate orders of user 1 by newest, 20 per page, without `skip`

```js
// first page
db.orders.find({ userId: 1 }).sort({ createdAt: -1, _id: -1 }).limit(20);

// next page: pass the last item's createdAt and _id
db.orders.find({
  userId: 1,
  $or: [
    { createdAt: { $lt: lastCreatedAt } },
    { createdAt: lastCreatedAt, _id: { $lt: lastId } },
  ],
}).sort({ createdAt: -1, _id: -1 }).limit(20);
// index: { userId: 1, createdAt: -1, _id: -1 }
```

---

## 🧠 Tips for Live Query Rounds

1. **Say the pipeline out loud first:** "filter → unwind items → group by user → sort → limit → join names".
2. **`$match` first, `$lookup` last** (after you've reduced the documents).
3. Know `$unwind`'s cost and the `$map`/`$reduce` alternatives.
4. Mention the **index** that would support your query — interviewers love it.
5. Edge cases: missing fields (`$ifNull`), empty arrays (`preserveNullAndEmptyArrays: true`), ties in rankings (`$denseRank`).

---

[← Advanced Features](11-advanced-features.md) | [Index](../README.md) | [Next: MongoDB Rapid-Fire Q&A →](13-mongodb-interview-questions.md)
