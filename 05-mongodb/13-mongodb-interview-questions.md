# Chapter 86 — MongoDB Interview Questions (Rapid-Fire)

## 📖 How to Use This Chapter

Short answers to say out loud in 20–40 seconds, grouped by level. Each topic has a full chapter earlier in this section with code and diagrams. Questions marked ⭐ come up most often.

---

## 🟢 Fresher / Junior (0–2 years)

| # | Question | Answer |
|---|----------|--------|
| 1 ⭐ | What is MongoDB? | A document-oriented NoSQL database that stores data as BSON documents in collections, with flexible schemas, rich queries, indexes, aggregation, replication and sharding. |
| 2 ⭐ | Document vs collection vs database? | Document = one record (like a row, but nested); collection = group of documents (like a table); database = group of collections. |
| 3 | What is BSON? | Binary JSON — faster to scan, supports more types (`ObjectId`, `Date`, `Decimal128`, `Int64`, binary). |
| 4 ⭐ | What is `_id`? | Mandatory unique primary key of every document; auto-generated `ObjectId` if not provided; always indexed. |
| 5 | Structure of an ObjectId? | 4-byte timestamp + 5-byte random + 3-byte counter → unique and roughly time-ordered. |
| 6 ⭐ | MongoDB vs SQL databases? | Documents vs rows, flexible vs fixed schema, embedding vs joins, built-in horizontal scaling; SQL is better for highly relational data and complex joins. |
| 7 | Is MongoDB schemaless? | Schema-flexible: no fixed schema by default, but you can enforce one with `$jsonSchema` validation or Mongoose. |
| 8 | `find` vs `findOne`? | Cursor of all matches vs first match or `null`. |
| 9 | What is a projection? | Choosing which fields to return: `{ name: 1, _id: 0 }`. |
| 10 ⭐ | `$set` vs `$inc` vs `$push` vs `$addToSet`? | Set a field; increment numerically; append to array; append only if not present. |
| 11 | What is an upsert? | Update if found, else insert (`upsert: true`). |
| 12 | `deleteOne` vs `deleteMany` vs `drop`? | One doc; all matching docs; remove the whole collection and its indexes. |
| 13 | Max document size? | 16 MB. Use GridFS or S3 for bigger files. |
| 14 ⭐ | What is an index? | A sorted B-tree of field values pointing to documents, so queries avoid scanning the whole collection. |
| 15 | What is Mongoose? | An ODM for Node.js: schemas, validation, middleware (hooks), populate, typed models on top of the MongoDB driver. |
| 16 | `populate()` — what is it? | Mongoose replacing referenced ids with documents by running extra queries. |
| 17 | What is the aggregation pipeline? | A sequence of stages (`$match`, `$group`, `$sort`, `$lookup`…) that transform documents step by step. |
| 18 | `countDocuments` vs `estimatedDocumentCount`? | Exact with filter vs fast metadata estimate. |
| 19 | Default port? | 27017. |
| 20 | What is `mongosh`? | The MongoDB shell to run queries and admin commands. |

## 🟡 Mid-Level (2–5 years)

| # | Question | Answer |
|---|----------|--------|
| 21 ⭐ | Embed vs reference? | Embed data read together, small and bounded; reference large, unbounded, shared or independently accessed data. |
| 22 ⭐ | Compound index & ESR rule? | Index on multiple fields; order Equality → Sort → Range. Prefix rule: `{a,b,c}` serves `a`, `a,b`, `a,b,c`. |
| 23 ⭐ | How do you debug a slow query? | `explain("executionStats")`: `COLLSCAN`? in-memory `SORT`? docs examined vs returned; add/fix index; profiler for finding them. |
| 24 | Covered query? | Answered entirely from the index — filter + projection fields are all in it; `totalDocsExamined: 0`. |
| 25 | Index types? | Single, compound, multikey (arrays), text, 2dsphere, hashed, wildcard, partial, sparse, TTL, unique. |
| 26 | Multikey index? | Index on an array field — one entry per element. A compound index can include at most one array field. |
| 27 | Partial vs sparse index? | Partial indexes docs matching a filter expression; sparse indexes only docs where the field exists. Partial is more flexible. |
| 28 | TTL index? | Auto-deletes documents after a time; background task runs ~every 60s. |
| 29 ⭐ | `$lookup` vs `populate`? | `$lookup` is a server-side join in one aggregation; `populate` issues extra queries from Mongoose. `$lookup` lets you filter/sort on joined data. |
| 30 | `$unwind` — when and its cost? | Turns each array element into its own doc; can explode document counts — filter first or use `$map`/`$reduce`/`$filter`. |
| 31 | `$facet`? | Multiple sub-pipelines on the same input in one pass — data + counts for pagination, dashboards. |
| 32 | When do you need `$elemMatch`? | When several conditions must match the same array element. |
| 33 ⭐ | Are writes atomic? | Single-document writes always are; multi-document needs transactions. |
| 34 ⭐ | Transactions — requirements? | Replica set (4.0) or sharded cluster (4.2); session passed to each op; 60s default limit; keep small. |
| 35 | Write concern? | Number of members that must ack a write: `0`, `1`, `majority` (default since 5.0), plus `j: true` for journal. |
| 36 | Read preference? | Where reads go: primary (default), secondary, nearest… Secondaries may be stale. |
| 37 ⭐ | Why is `skip` pagination slow? | Server still walks skipped entries; use range/keyset pagination on an indexed field. |
| 38 | How to prevent overselling? | Conditional atomic update `{ _id, stock: { $gte: qty } }` with `$inc: { stock: -qty }`. |
| 39 | `lean()` in Mongoose? | Returns plain JS objects — faster, less memory, no document methods. |
| 40 | Why `runValidators` on updates? | Mongoose doesn't run schema validators on update queries by default. |
| 41 | Mongoose `pre` vs `post` hooks? | Run before/after an operation (save, validate, find…); `pre("save")` is typical for hashing passwords. |
| 42 | Duplicate key error? | Error code `11000` from a unique index; map to HTTP 409. |
| 43 | Text search? | Text index + `$text` (stemming, weights); Atlas Search for fuzzy/autocomplete. |
| 44 | Geospatial query? | `2dsphere` index + `$near` / `$geoWithin` with GeoJSON `[lng, lat]`. |
| 45 | Schema validation? | `$jsonSchema` validator on the collection with `validationLevel` / `validationAction`. |

## 🔴 Senior (5+ years)

| # | Question | Answer |
|---|----------|--------|
| 46 ⭐ | Replica set and failover? | Primary + secondaries replicating the oplog; on primary loss an election picks a new primary (~10s); drivers follow it. |
| 47 | Why odd number of voters? | Majority needed to elect; odd sizes maximise fault tolerance and prevent split brain. |
| 48 | What is the oplog? | Capped collection of idempotent operations that secondaries replay; its size defines how long a secondary can be offline. |
| 49 | Rollback? | Unreplicated `w:1` writes on an old primary are undone after failover; `majority` writes never are. |
| 50 ⭐ | Sharding and its components? | Horizontal partitioning: `mongos` routers, config server RS, shard RSs; data split into chunks by shard key. |
| 51 ⭐ | Good shard key? | High cardinality, low frequency, non-monotonic, used in most queries. |
| 52 | Hashed vs ranged sharding? | Even writes vs efficient range queries. |
| 53 | Scatter-gather query? | Query without shard key goes to all shards — latency of the slowest shard. |
| 54 | Jumbo chunk? | Chunk that can't be split because too many docs share a shard-key value. |
| 55 | Read concern levels? | `local`, `available`, `majority`, `linearizable`, `snapshot`. |
| 56 | Causal consistency? | Sessions guaranteeing read-your-own-writes and monotonic reads, even on secondaries. |
| 57 | Optimistic concurrency? | Version field in the update filter; 0 matched = conflict → 409. Mongoose `optimisticConcurrency`. |
| 58 | Working set? | Hot data + indexes; must fit in the WiredTiger cache (≈50% of RAM − 1 GB) for good performance. |
| 59 | WiredTiger features? | Document-level concurrency (MVCC), compression (snappy/zstd), checkpoints + journal for durability. |
| 60 | Schema design patterns you've used? | Extended reference, subset, computed, bucket, outlier, attribute, polymorphic, schema versioning. |
| 61 | Anti-patterns? | Unbounded arrays, too many collections, unnecessary indexes, bloated docs, separating data accessed together. |
| 62 | Change streams? | Subscribe to changes via the oplog; resume tokens for reliability; used for sync, notifications, outbox. |
| 63 | Time series collections? | Optimised, compressed storage for measurements with time + meta fields (5.0+). |
| 64 | Aggregation memory limit? | 100 MB per stage; `allowDiskUse` to spill. |
| 65 | Materialised views? | `$merge`/`$out` aggregation results into a collection on a schedule. |
| 66 | Backup strategies? | Atlas continuous backup / snapshots, `mongodump` for small DBs, filesystem snapshots, delayed secondary for human error. |
| 67 | Zero-downtime index build? | Since 4.2 index builds hold exclusive locks only briefly; for huge collections do rolling builds per replica member. |
| 68 | Multi-tenant design? | `tenantId` on every doc, prefix of every index, enforced in the data layer; shard by `tenantId` + another field at scale. |
| 69 | Securing MongoDB? | Auth + least-privilege roles, TLS, private network/IP allow-list, encryption at rest, CSFLE/Queryable Encryption, auditing. |
| 70 | When NOT to use MongoDB? | Heavy many-to-many relational queries, complex reporting with ad-hoc joins, or strict relational constraints across many entities — use Postgres. |

---

## 🧩 Scenario Questions

1. **"Our product listing API is slow."** — Check `explain`; add compound index matching filter + sort; project only list fields; `.lean()`; range pagination; cache category pages; extended reference instead of `$lookup` per item.
2. **"Design the database for a chat app."** — `conversations { _id, memberIds, lastMessage: {…}, updatedAt }`, `messages { conversationId, senderId, text, createdAt }` with index `{ conversationId: 1, createdAt: -1 }`; never store messages in an array in the conversation; change streams/WebSockets for real time; shard messages by `conversationId` at scale.
3. **"A user's balance went negative under load."** — Read-then-write race. Use a conditional atomic `$inc` with `balance: { $gte: amount }`, or a transaction for multi-document transfers.
4. **"Inserts became slow as the collection grew."** — Too many indexes, a monotonic shard key, or the working set no longer fits RAM. Check `$indexStats`, remove unused indexes, check cache metrics.
5. **"After failover, some recent orders disappeared."** — Writes used `w: 1` and were rolled back. Use `w: "majority"` (default since 5.0) for important data.
6. **"Users report seeing old data right after saving."** — Reads go to secondaries (replication lag). Read from primary for read-after-write flows, or use causally consistent sessions.
7. **"We need to delete user data after 30 days of inactivity."** — `lastActiveAt` + TTL index (`expireAfterSeconds`) or a scheduled job for cascading deletes across collections.
8. **"How would you migrate a field rename on 50M documents?"** — Add `schemaVersion`, make the app read both shapes, run a batched background `updateMany` with `$rename` in chunks by `_id` range, then remove old-code paths.
9. **"Design a leaderboard."** — Computed `score` field with index `{ score: -1 }`; `$setWindowFields` with `$rank` for ranks; cache top N in Redis for very high read rates.
10. **"Show orders with customer names and totals for an admin page with filters."** — Aggregation: `$match` (indexed filters) → `$sort` → `$skip/$limit` or range → `$lookup` users (only the page) → `$project`. Or store customer name as an extended reference.

---

## 🗣️ "How Have You Used MongoDB?" — Answer Template

> "In **[project]** I used MongoDB with Mongoose for **[domain]**. I modelled **[entity]** by embedding **[small bounded data]** and referencing **[large/unbounded data]**, because **[access pattern]**. I added compound indexes following the ESR rule — for example **[index]** for the **[screen/query]**, which took it from **[X ms]** to **[Y ms]** after checking `explain()`. For **[critical flow]** I used **[atomic conditional update / transaction]** to avoid **[race condition]**. In production we run a 3-node Atlas replica set with `w: majority`, and I used **[aggregation / change streams / TTL]** for **[feature]**."

Use your own real numbers — they make the answer believable.

---

[← Query Practice Problems](12-query-practice.md) | [Index](../README.md) | [Next: GraphQL Fundamentals & Schema Design →](../27-graphql/01-graphql-fundamentals.md)
