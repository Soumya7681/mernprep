# Chapter 109 — MongoDB Scenarios

## 📖 Definition

MongoDB scenario questions test whether you can **design schemas, choose indexes, and diagnose database problems** in a real application. The interviewer usually gives a feature or a symptom and expects you to reason about access patterns, document size, indexes, consistency and scale.

## 🧠 Two Rules That Answer Most Questions

1. **Model for your queries** (access patterns), not for normalisation. Data that is read together should be stored together.
2. **Every frequent query needs an index that supports both its filter and its sort.** Check with `explain("executionStats")`.

---

### Scenario 1 — "Design the schema for an e-commerce app: users, products, orders, reviews."

```js
// users
{ _id, name, email /* unique */, passwordHash, role, addresses: [{ label, line1, city, pin }] } // few, bounded → embed

// products
{ _id, name, slug /* unique */, price, category, stock, attributes: { color, size },
  ratingAvg, ratingCount }                                         // computed pattern: store aggregates

// orders — SNAPSHOT product data at purchase time
{ _id, userId, status, createdAt,
  items: [{ productId, name, price, qty }],                       // embed: price must not change later
  shippingAddress: { line1, city, pin },                          // copy, not a reference
  total, payment: { provider, paymentId, status } }

// reviews — separate collection (unbounded, paginated independently)
{ _id, productId, userId, rating, text, createdAt }
```

**Indexes:** `users.email` unique; `products.slug` unique; `products { category: 1, price: 1 }`; `orders { userId: 1, createdAt: -1 }`; `reviews { productId: 1, createdAt: -1 }`; a unique `{ productId: 1, userId: 1 }` on reviews (one review per user).

**Why:** order items are embedded and copied so history is accurate even if the product's price changes; reviews are referenced because they can grow without bound (16 MB document limit).

---

### Scenario 2 — "The orders page is slow for users with many orders."

**Verify**
```js
db.orders.find({ userId: uid, status: "delivered" }).sort({ createdAt: -1 }).limit(20)
  .explain("executionStats");
// Look at: winningPlan stage (COLLSCAN vs IXSCAN), SORT stage in memory,
// totalKeysExamined / totalDocsExamined vs nReturned
```

**Fix:** a compound index following **ESR — Equality, Sort, Range**:
```js
db.orders.createIndex({ userId: 1, status: 1, createdAt: -1 });
```
Also project only needed fields and use cursor-based pagination instead of large `skip` values.

---

### Scenario 3 — "Pagination gets slower the deeper you go (page 5,000 takes seconds)."

**Cause:** `skip(n)` still walks through `n` index entries/documents.

**Fix:** keyset (cursor) pagination on an indexed, unique sort key:
```js
db.posts.find({ createdAt: { $lt: lastSeenCreatedAt } }).sort({ createdAt: -1 }).limit(20);
// with a tie-breaker on _id when timestamps can repeat
```
Trade-off: no "jump to page 5,000" — usually fine for feeds and infinite scroll. For admin tables, limit max page depth or use filters.

---

### Scenario 4 — "A document keeps growing and we hit the 16 MB limit (e.g. chat messages inside a room document)."

**Cause:** an **unbounded array** embedded in one document.

**Fix:** move messages to their own collection referencing the room (`{ roomId, senderId, text, createdAt }` with index `{ roomId: 1, createdAt: -1 }`). If you need the latest messages with the room, use the **subset pattern**: keep the last 20 embedded, the rest in the collection. For time-series-like data, the **bucket pattern** (one document per room per hour/day) reduces document count.

---

### Scenario 5 — "We need a dashboard: revenue per day and top 5 products for the last 30 days."

```js
const since = new Date(Date.now() - 30 * 86400_000);

db.orders.aggregate([
  { $match: { status: "paid", createdAt: { $gte: since } } },          // use an index; filter early
  {
    $facet: {
      revenuePerDay: [
        { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "Asia/Kolkata" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      topProducts: [
        { $unwind: "$items" },
        { $group: { _id: "$items.productId", name: { $first: "$items.name" }, units: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ],
    },
  },
]);
```

**At scale:** precompute with a scheduled job into a `daily_sales` collection (`$merge`) or use a materialised view, so the dashboard reads a few small documents instead of scanning orders.

---

### Scenario 6 — "Transfer wallet balance between users safely."

**Answer:** use a multi-document **transaction** (replica set required) with a conditional update so the balance cannot go negative, plus a ledger entry. Retry on `TransientTransactionError` (`session.withTransaction` does this). Keep transactions short; do not call external APIs inside them.

Alternatively, design so a **single-document atomic update** is enough (e.g. store balance and recent transactions together) — single-document operations are always atomic and much cheaper.

---

### Scenario 7 — "Product search with filters (category, price range, brand) and text search."

**Options**
- Small/medium catalogue: compound indexes for common filter combinations + a `text` index for keywords.
- Better relevance, typo tolerance, facets, autocomplete: **Atlas Search** (Lucene-based `$search` stage) or Elasticsearch/OpenSearch.

```js
db.products.createIndex({ category: 1, brand: 1, price: 1 });
db.products.find({ category: "shoes", brand: { $in: ["Nike", "Puma"] }, price: { $gte: 1000, $lte: 5000 } })
  .sort({ price: 1 });
```

Avoid unanchored `$regex: /term/i` on large collections — it cannot use an index efficiently.

---

### Scenario 8 — "MongoDB CPU is at 100% after a release."

**Verify:** Atlas Performance Advisor / `db.currentOp()` / the profiler (`db.setProfilingLevel(1, { slowms: 100 })`) to find the new slow query shape; check `explain`.

**Common causes:** a new query without an index; a `$lookup` on an unindexed foreign field; `$regex` searches; a missing filter causing full scans; a cron job running a heavy aggregation at peak time.

**Fix:** add the index (build it in a rolling/background way on large collections), rewrite the query, schedule heavy jobs off-peak or on a secondary/analytics node, cache hot reads.

---

### Scenario 9 — "We deleted a field from the schema but old documents still have it; some documents have different shapes."

**Answer:** MongoDB is schema-flexible, so **schema evolution** must be planned:
- Add a `schemaVersion` field; code handles old and new versions (**schema versioning pattern**).
- Migrate lazily (on read/write) or with a background script using `updateMany` in batches.
- Use Mongoose schemas and MongoDB **`$jsonSchema` validation** to stop bad shapes being written.
- Write migrations as code (e.g. `migrate-mongo`) and run them in CI/CD.

---

### Scenario 10 — "Reads right after a write sometimes return old data."

**Cause:** reading from a **secondary** (read preference `secondaryPreferred`) that has not replicated the write yet; or a cache in front.

**Fix:** read from the primary for read-after-write flows; use **causally consistent sessions**; or `writeConcern: "majority"` + `readConcern: "majority"` where consistency matters. Keep secondary reads for analytics and tolerant views.

---

### Scenario 11 — "Old sessions/OTP/logs pile up and the collection keeps growing."

**Fix:** a **TTL index** — MongoDB deletes expired documents automatically (background task about every 60 s).
```js
db.otps.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });   // expire at the stored date
```
For logs/metrics, consider **time-series collections** or archiving to cheaper storage (Atlas Online Archive, S3).

---

### Scenario 12 — "The collection has 2 billion documents. How would you scale?"

**Answer outline**
- First exhaust vertical options: indexes, archiving old data, better schema, bigger instance.
- **Sharding**: choose a shard key with **high cardinality, even distribution, and that matches the main query** (e.g. `{ tenantId: 1, _id: 1 }` or a hashed key for even writes). Avoid monotonically increasing keys (timestamps, ObjectId) as a ranged shard key — all inserts go to one shard.
- Queries that include the shard key are routed to one shard (targeted); others scatter-gather across all shards.
- Changing a shard key later is possible (resharding) but expensive — decide carefully.

---

### Scenario 13 — "`populate()` makes our API slow."

**Causes:** populating large arrays, nested populates, populating fields not needed, missing index on the referenced field (for `match`/virtual populate).

**Fixes:** select only needed fields (`populate("author", "name avatar")`), limit populated arrays, denormalise read-heavy small fields (store `authorName` alongside `authorId` — **extended reference pattern**), or use a single `$lookup` aggregation with a `pipeline` and projection.

---

## 🎯 What Interviewers Are Scoring

- **Embed vs reference** decisions justified by access pattern, growth and update frequency.
- Index design using **ESR** and verified with **`explain`**.
- Awareness of **limits** (16 MB documents, `skip` cost, unanchored regex) and **consistency** (atomic single-document updates, transactions, replica lag).
- Knowing when to **precompute** instead of aggregating on every request.

---

[← Node & Express Scenarios](03-node-express-scenarios.md) | [Index](../README.md) | [Next: Production Incident Scenarios →](05-production-incident-scenarios.md)
