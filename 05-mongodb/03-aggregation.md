# Chapter 74 — Aggregation Pipeline

## 📖 Definition

The MongoDB **aggregation pipeline** is a multi-stage data-processing framework. Each stage transforms documents (filtering, reshaping, grouping, joining) and passes them to the next stage.

## 🔍 Common Stages

| Stage | Purpose |
|-------|---------|
| `$match` | Filter — push to the **start** so it can use indexes |
| `$project` | Reshape / pick fields |
| `$addFields` | Add computed fields without removing existing ones |
| `$group` | Aggregate (sum, avg, count) |
| `$sort` | Sort |
| `$limit` / `$skip` | Pagination |
| `$lookup` | SQL-style left outer join |
| `$unwind` | Flatten an array (one doc per element) |
| `$facet` | Run multiple sub-pipelines on the same input |
| `$count` | Count remaining docs |
| `$bucket` / `$bucketAuto` | Histograms |
| `$replaceRoot` | Promote a sub-doc to the top |
| `$out` / `$merge` | Write results to a new collection |

## 💻 Code Example — Filter + Group + Sort

```js
// Orders per status this month
db.orders.aggregate([
  { $match: { createdAt: { $gte: ISODate("2026-05-01") } } },
  { $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } },
  { $sort: { total: -1 } },
]);

// Result:
// [
//   { _id: "paid",     total: 12500, count: 105 },
//   { _id: "pending",  total:  4800, count:  42 },
//   { _id: "refunded", total:   300, count:   3 },
// ]
```

## 💻 Code Example — `$lookup` (Join)

```js
// Top 10 customers by total spend, with name
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 },
  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "user",
    },
  },
  { $unwind: "$user" },
  { $project: { _id: 0, name: "$user.name", email: "$user.email", total: 1 } },
]);
```

## 💻 Code Example — `$lookup` with Pipeline (Filtered Join)

```js
db.orders.aggregate([
  {
    $lookup: {
      from: "products",
      let: { items: "$items" },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$items.productId"] } } },
        { $project: { name: 1, price: 1 } },
      ],
      as: "productDetails",
    },
  },
]);
```

## 💻 Code Example — `$facet` (Multi-Result)

```js
// Get items, count, and aggregates in one query (useful for dashboards)
db.orders.aggregate([
  { $match: { status: "paid" } },
  {
    $facet: {
      items:   [{ $sort: { createdAt: -1 } }, { $limit: 20 }],
      total:   [{ $count: "count" }],
      revenue: [{ $group: { _id: null, sum: { $sum: "$amount" } } }],
    },
  },
]);

// Result:
// {
//   items: [...],
//   total: [{ count: 152 }],
//   revenue: [{ _id: null, sum: 38400 }]
// }
```

## 💻 Code Example — `$unwind` Arrays

```js
// Count tags across all posts
db.posts.aggregate([
  { $unwind: "$tags" },                          // one doc per tag
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 },
]);
```

## 💻 Code Example — `$bucket` (Histogram)

```js
// Distribution of user ages
db.users.aggregate([
  {
    $bucket: {
      groupBy: "$age",
      boundaries: [0, 18, 25, 35, 50, 65, 120],
      default: "Other",
      output: { count: { $sum: 1 } },
    },
  },
]);
```

## 💻 Code Example — `$project` with Computed Fields

```js
db.users.aggregate([
  {
    $project: {
      _id: 0,
      name: 1,
      isAdult: { $gte: ["$age", 18] },
      initials: {
        $concat: [
          { $substrCP: ["$firstName", 0, 1] },
          { $substrCP: ["$lastName", 0, 1] },
        ],
      },
      ageGroup: {
        $switch: {
          branches: [
            { case: { $lt: ["$age", 18] }, then: "minor" },
            { case: { $lt: ["$age", 65] }, then: "adult" },
          ],
          default: "senior",
        },
      },
    },
  },
]);
```

## 💻 Code Example — Pagination with Total Count

```js
db.products.aggregate([
  { $match: { category: "books" } },
  {
    $facet: {
      data: [
        { $sort: { createdAt: -1 } },
        { $skip: 40 },
        { $limit: 20 },
      ],
      meta: [{ $count: "total" }],
    },
  },
  { $unwind: "$meta" },
  { $addFields: { "meta.page": 3, "meta.limit": 20 } },
]);
```

## 💻 Code Example — Mongoose Aggregation

```js
const stats = await Order.aggregate([
  { $match: { status: "paid", createdAt: { $gte: new Date("2026-05-01") } } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 },
]);
```

## 💻 Code Example — NestJS Mongoose Aggregation

```ts
@Injectable()
export class StatsService {
  constructor(@InjectModel(Order.name) private orderModel: Model<Order>) {}

  async topCustomers() {
    return this.orderModel.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$userId", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);
  }
}
```

## ⚡ Performance Tips

- **Always `$match` first.** Filtering early lets the planner use indexes.
- **Index the `$lookup`'s `foreignField`.**
- **`$project` away unused fields early** to reduce memory.
- **Avoid `$lookup` on huge collections** — consider denormalizing.
- `allowDiskUse: true` only if you must — disk spills are slow.

## 🎯 Likely Interview Questions

1. **What is the aggregation pipeline?** — A framework where documents pass through ordered stages, each transforming the stream (filter, reshape, group, join, sort), similar to a Unix pipe or SQL `SELECT … GROUP BY`.
2. **Common stages?** — `$match`, `$project`/`$addFields`, `$group`, `$sort`, `$limit`/`$skip`, `$lookup`, `$unwind`, `$facet`, `$bucket`, `$count`, `$merge`/`$out`, `$setWindowFields`.
3. **`$lookup` vs `populate`?** — `$lookup` is a single-query DB join; `populate` is a separate query issued by Mongoose. Use `$lookup` when you also need to filter/sort by joined fields.
4. **How does `$facet` work?** — Runs several sub-pipelines on the same input documents in one stage and returns one document with a field per sub-pipeline — e.g. page of results + total count + category counts.
5. **How would you optimize a slow aggregation?** — Match first, index relevant fields, project minimally, avoid unwinding huge arrays.
6. **What is `$unwind` and when is it dangerous?** — Outputs one document per array element; on large arrays it multiplies documents and memory — prefer `$filter`/`$map`/`$reduce` when you just need computations on the array.
7. **`$group` accumulators you know?** — `$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`, `$count`, `$top`/`$topN` (5.2+).
8. **What is the memory limit of a stage?** — 100 MB; `allowDiskUse: true` lets stages spill to disk (default on since 6.0).
9. **`$out` vs `$merge`?** — `$out` replaces a whole collection with the results; `$merge` inserts/updates/merges into an existing collection — used for incremental materialised views.
10. **`$project` vs `$addFields`?** — `$project` reshapes and drops unspecified fields; `$addFields`/`$set` adds fields and keeps the rest.
11. **Which stages can use indexes?** — `$match` and `$sort` at the start of the pipeline (and `$geoNear`, which must be first); `$lookup` uses the index on `foreignField` of the joined collection.

---

[← Indexing](02-indexing.md) | [Index](../README.md) | [Next: populate vs $lookup →](04-populate-vs-lookup.md)
