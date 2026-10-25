# Chapter 78 — Performance Tuning & Query Optimisation

## 📖 Definition

MongoDB performance work is a loop: **find** slow operations (profiler, logs, Atlas Performance Advisor), **explain** them (`explain("executionStats")`), **fix** (index, query shape, schema, pagination), then **measure** again.

## 🔍 Where Time Goes

| Layer | Typical problem |
|-------|-----------------|
| Query shape | No index / wrong index → `COLLSCAN`, in-memory `SORT` |
| Schema | Huge documents, unbounded arrays, many `$lookup`s |
| Working set | Hot data + indexes don't fit in RAM → disk reads |
| Application | N+1 queries, no projection, hydrated Mongoose docs, deep `skip` |
| Infrastructure | Too few connections, network latency, slow disk |

## 💻 Finding Slow Queries

```js
// Database profiler: log operations slower than 100 ms
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty();

// What is running right now (long-running ops)
db.currentOp({ secs_running: { $gt: 5 } });
db.killOp(opid);

// Index usage statistics — find unused indexes
db.orders.aggregate([{ $indexStats: {} }]);

// Collection / index sizes
db.orders.stats();
db.orders.totalIndexSize();
```

`mongod` also logs every operation slower than `slowms` (default 100 ms). In Atlas, the **Performance Advisor** suggests indexes automatically.

## 💻 Reading `explain()` Output

```js
db.orders.find({ status: "paid", customerId: 42 }).sort({ createdAt: -1 }).explain("executionStats");
```

What to look at:

```js
{
  queryPlanner: {
    winningPlan: {
      stage: "FETCH",
      inputStage: { stage: "IXSCAN", indexName: "customerId_1_status_1_createdAt_-1" }   // ✅ index used
    },
    rejectedPlans: [ … ]
  },
  executionStats: {
    nReturned: 20,
    totalKeysExamined: 20,         // index entries read
    totalDocsExamined: 20,         // documents read
    executionTimeMillis: 2
  }
}
```

| Signal | Meaning | Action |
|--------|---------|--------|
| `COLLSCAN` | Full collection scan | Add an index matching the filter |
| `SORT` stage (in-memory) | Index doesn't provide sort order | Put sort fields in the index (ESR) |
| `totalDocsExamined` ≫ `nReturned` | Reading many docs to return few | More selective index / compound index |
| `totalKeysExamined` ≫ `nReturned` | Index not selective enough, or range before equality | Reorder index fields (ESR) |
| `PROJECTION_COVERED`, `totalDocsExamined: 0` | **Covered query** — answered from index only | Ideal |
| `FETCH` + `IXSCAN` | Normal indexed query | Fine |

**Ideal ratio:** `nReturned ≈ totalKeysExamined ≈ totalDocsExamined`.

## 💻 ESR Rule in Practice

```js
// Query: equality on status, range on total, sort by createdAt
db.orders.find({ status: "paid", total: { $gt: 500 } }).sort({ createdAt: -1 });

// ❌ { status: 1, total: 1, createdAt: -1 } → range before sort → in-memory SORT
// ✅ { status: 1, createdAt: -1, total: 1 } → Equality, Sort, Range
db.orders.createIndex({ status: 1, createdAt: -1, total: 1 });
```

Also remember the **prefix rule**: index `{ a: 1, b: 1, c: 1 }` supports queries on `a`, `a+b`, `a+b+c` — not on `b` or `c` alone.

## 💻 Pagination: `skip` vs Range (Keyset/Cursor)

```js
// ❌ skip gets slower the deeper you go: page 5,000 still walks 100,000 index entries
db.posts.find().sort({ _id: -1 }).skip(100_000).limit(20);

// ✅ Range-based: remember the last _id of the previous page
db.posts.find({ _id: { $lt: lastSeenId } }).sort({ _id: -1 }).limit(20);

// With a non-unique sort field, add _id as tie-breaker
db.posts.find({
  $or: [
    { score: { $lt: lastScore } },
    { score: lastScore, _id: { $lt: lastId } },
  ],
}).sort({ score: -1, _id: -1 }).limit(20);
// index: { score: -1, _id: -1 }
```

Range pagination is O(limit) regardless of depth; it's how infinite scroll should work.

## 💻 Projection, Lean & Batch Reads (Node / Mongoose)

```ts
// ❌ Fetch everything, hydrate full Mongoose documents
const users = await User.find({ active: true });

// ✅ Only the fields the UI needs, as plain objects
const users = await User.find({ active: true }, { name: 1, avatar: 1 }).lean();

// ❌ N+1: one query per order
for (const o of orders) o.customer = await User.findById(o.customerId);

// ✅ One query with $in, then map
const ids = [...new Set(orders.map((o) => o.customerId.toString()))];
const customers = await User.find({ _id: { $in: ids } }, { name: 1 }).lean();
const byId = new Map(customers.map((c) => [c._id.toString(), c]));
```

## 💻 Aggregation Optimisation

```js
db.orders.aggregate([
  { $match: { status: "paid", createdAt: { $gte: start } } },   // 1. filter FIRST (uses index)
  { $project: { customerId: 1, total: 1 } },                    // 2. drop unneeded fields early
  { $group: { _id: "$customerId", spent: { $sum: "$total" } } },
  { $sort: { spent: -1 } },
  { $limit: 10 },                                                // $sort + $limit → top-k optimisation
], { allowDiskUse: true });                                      // stages may use >100 MB RAM
```

- Each stage has a **100 MB** memory limit; `allowDiskUse` spills to disk (default on in 6.0+ via `allowDiskUseByDefault`).
- `$lookup` inside a hot path: make sure the foreign field is indexed; consider extended references instead.
- For dashboards, pre-compute with `$merge` into a summary collection on a schedule (materialised view).

```js
db.orders.aggregate([
  { $match: { createdAt: { $gte: yesterday } } },
  { $group: { _id: { day: { $dateTrunc: { date: "$createdAt", unit: "day" } } }, revenue: { $sum: "$total" } } },
  { $merge: { into: "dailyRevenue", whenMatched: "replace" } },
]);
```

## 🔍 Working Set & Memory

- **WiredTiger cache** defaults to **50% of (RAM − 1 GB)** (min 256 MB).
- **Working set** = frequently accessed documents + indexes. If it doesn't fit in RAM, queries hit disk and latency jumps.
- Watch: cache "bytes read into cache", page faults, disk IOPS.
- Fixes: smaller documents (subset pattern), remove unused indexes, more RAM, or shard.

## 🔍 Write Performance

| Tip | Why |
|-----|-----|
| Fewer indexes | Every index is updated on every insert |
| `bulkWrite` / `insertMany` with `ordered: false` | Fewer round trips, parallel |
| Avoid growing documents a lot | Rewrites are larger |
| `w: 1` for non-critical bulk loads | Lower latency (accept risk) |
| Avoid hot documents (single global counter) | All writers contend on one doc → shard the counter |

## 💻 Connection Pooling (Node.js)

```ts
// ✅ Create ONE client/connection per process and reuse it
await mongoose.connect(uri, { maxPoolSize: 20, minPoolSize: 2, serverSelectionTimeoutMS: 5000 });

// ❌ Connecting inside every request handler → connection storms, slow requests
```

In serverless (Lambda/Vercel), cache the client in a module-level variable so warm invocations reuse it.

## 💻 Other Index Tools

```js
// Partial index — index only documents that matter (smaller, faster)
db.orders.createIndex({ createdAt: -1 }, { partialFilterExpression: { status: "pending" } });

// Case-insensitive search with a collation index
db.users.createIndex({ email: 1 }, { collation: { locale: "en", strength: 2 } });
db.users.find({ email: "ASHA@X.COM" }).collation({ locale: "en", strength: 2 });

// Wildcard index for unpredictable fields
db.events.createIndex({ "meta.$**": 1 });

// Hide an index before dropping it (check nothing regresses)
db.orders.hideIndex("status_1");

// Force a plan when the optimiser picks the wrong one (last resort)
db.orders.find(q).hint({ status: 1, createdAt: -1 });
```

## 📊 Performance Checklist

1. Every frequent query has an index matching filter + sort (ESR).
2. `explain` shows `IXSCAN`, no in-memory `SORT`, examined ≈ returned.
3. Projections everywhere; `.lean()` for read-only Mongoose queries.
4. Range pagination for large/deep lists.
5. No N+1; batch with `$in` or `$lookup`.
6. Documents small; arrays bounded.
7. Unused indexes removed (`$indexStats`).
8. Working set fits in RAM.
9. One connection pool per process.
10. Monitor: profiler/slow logs, Atlas metrics, replication lag.

## 🌍 Real-World Impact

- Switching an admin table from `skip` to range pagination took deep pages from 4s to 15ms.
- Adding `{ status: 1, createdAt: -1 }` turned a COLLSCAN over 2M docs into a 20-doc IXSCAN.
- Removing 6 unused indexes cut insert latency by ~40% on a write-heavy events collection.

## 🎯 Likely Interview Questions

1. **How do you find slow queries?** — Profiler (`setProfilingLevel`), slow query logs, `currentOp`, Atlas Performance Advisor.
2. **What do you look for in `explain()`?** — `COLLSCAN` vs `IXSCAN`, in-memory `SORT`, `totalDocsExamined` vs `nReturned`, execution time.
3. **What is a covered query?** — All filter and returned fields are in the index; `totalDocsExamined: 0`. Exclude `_id` unless it's in the index.
4. **Explain the ESR rule.** — Compound index order: Equality fields, then Sort, then Range.
5. **Why is `skip` slow and what's the alternative?** — It still walks skipped entries; use range/keyset pagination on an indexed field.
6. **How do indexes affect writes?** — Each index must be updated on insert/update/delete → slower writes, more RAM.
7. **What is the working set?** — Frequently accessed data + indexes; should fit in RAM (WiredTiger cache).
8. **How do you optimise an aggregation?** — `$match` early, `$project` early, index the match/lookup fields, `$sort`+`$limit`, `allowDiskUse`, pre-aggregate with `$merge`.
9. **How do you fix N+1 queries in Mongoose?** — Batch with `$in`, `populate`, or `$lookup`.
10. **What's the aggregation memory limit?** — 100 MB per stage unless spilling to disk.
11. **How do you do case-insensitive search efficiently?** — Collation index with strength 2, or a lowercased copy of the field.
12. **How do you safely remove an index?** — Check `$indexStats`, `hideIndex`, watch metrics, then drop.

---

[← Transactions & Consistency](08-transactions-consistency.md) | [Index](../README.md) | [Next: Replication & Sharding →](09-replication-sharding.md)
