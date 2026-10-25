# Chapter 84 — Advanced Features: Change Streams, Validation, Time Series & More

## 📖 Overview

Beyond CRUD and aggregation, MongoDB has built-in features that replace extra infrastructure. Interviewers ask about them to see if you know **when not to build something yourself**.

| Feature | Replaces / solves |
|---------|-------------------|
| Change streams | Polling the DB, custom event buses for "something changed" |
| Schema validation (`$jsonSchema`) | DB-level guarantees beyond app code |
| TTL indexes | Cron jobs deleting expired data |
| Capped collections | Fixed-size logs/queues |
| Time series collections | Hand-built bucket pattern |
| Text / Atlas Search | Separate Elasticsearch cluster (for many use cases) |
| Atlas Vector Search | Separate vector DB for RAG/semantic search |
| Geospatial queries | "Find nearby" logic |
| GridFS | Storing files > 16 MB |
| Window functions (`$setWindowFields`) | Running totals, rankings in app code |

## 💻 Change Streams (Real-Time Events)

Change streams let an application subscribe to inserts/updates/deletes on a collection, database or cluster. They read from the oplog, so they need a **replica set**.

```ts
import { MongoClient, type ChangeStreamDocument } from "mongodb";

const orders = client.db("shop").collection<Order>("orders");

const stream = orders.watch(
  [{ $match: { operationType: { $in: ["insert", "update"] }, "fullDocument.status": "paid" } }],
  { fullDocument: "updateLookup" },          // include the whole document on updates
);

stream.on("change", async (change: ChangeStreamDocument<Order>) => {
  if (change.operationType === "insert" || change.operationType === "update") {
    await notifyWarehouse(change.fullDocument!);
    await saveResumeToken(change._id);        // persist so we can resume after a crash
  }
});

// Resume where we left off after a restart — no events missed (within the oplog window)
const token = await loadResumeToken();
orders.watch([], { resumeAfter: token });
```

Use cases: push updates via WebSockets, sync to Elasticsearch/cache, audit logs, invalidate Redis keys, trigger workflows (outbox pattern).

## 💻 Schema Validation (`$jsonSchema`)

Enforce rules in the database itself, so scripts, other services or a bug can't insert bad data.

```js
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name", "createdAt"],
      properties: {
        email: { bsonType: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
        name: { bsonType: "string", minLength: 2, maxLength: 80 },
        age: { bsonType: "int", minimum: 0, maximum: 130 },
        role: { enum: ["admin", "user"] },
        createdAt: { bsonType: "date" },
      },
      additionalProperties: true,
    },
  },
  validationLevel: "strict",      // "moderate" = only validate docs that are already valid
  validationAction: "error",      // "warn" = log only (good for rolling out)
});

// Add/change validation on an existing collection
db.runCommand({ collMod: "users", validator: { /* … */ }, validationLevel: "moderate" });
```

Mongoose validation runs **only in your app**; `$jsonSchema` protects the data from every client.

## 💻 TTL Indexes (Auto-Expire)

```js
// Delete sessions 1 hour after createdAt
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

// Expire at an exact time stored in the doc
db.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

The TTL monitor runs about every **60 seconds**, so deletion isn't instant — still check expiry in code for security-sensitive data like OTPs.

## 💻 Capped Collections

```js
db.createCollection("recentLogs", { capped: true, size: 50 * 1024 * 1024, max: 100_000 });
// Fixed size, insertion order preserved, oldest docs overwritten automatically.
// Tailable cursors can stream new docs like `tail -f`.
```

Limits: you can't delete individual documents or grow documents. Since MongoDB 5.0, TTL indexes or time series collections are usually better.

## 💻 Time Series Collections (5.0+)

```js
db.createCollection("metrics", {
  timeseries: { timeField: "ts", metaField: "meta", granularity: "seconds" },
  expireAfterSeconds: 60 * 60 * 24 * 30,      // keep 30 days
});

db.metrics.insertOne({ ts: new Date(), meta: { deviceId: "d1", region: "ap-south-1" }, cpu: 0.72, mem: 0.41 });

db.metrics.aggregate([
  { $match: { "meta.deviceId": "d1", ts: { $gte: ISODate("2026-10-22") } } },
  { $group: { _id: { $dateTrunc: { date: "$ts", unit: "minute" } }, avgCpu: { $avg: "$cpu" } } },
  { $sort: { _id: 1 } },
]);
```

Stores data in compressed internal buckets (the bucket pattern, done for you) — much smaller storage and faster time-range queries.

## 💻 Text Search vs Atlas Search

```js
// Built-in text index: one per collection, stemming, stop words, $text operator
db.articles.createIndex({ title: "text", body: "text" }, { weights: { title: 10, body: 1 } });
db.articles.find(
  { $text: { $search: "mongodb indexing -mysql" } },
  { score: { $meta: "textScore" } },
).sort({ score: { $meta: "textScore" } });
```

| | `$text` index | Atlas Search (`$search`, Lucene) |
|---|---------------|----------------------------------|
| Fuzzy / typo tolerance | No | Yes |
| Autocomplete | No | Yes |
| Facets, highlighting | No | Yes |
| Relevance tuning | Basic weights | Rich scoring |
| Availability | Any deployment | Atlas (and newer self-managed versions) |

## 💻 Vector Search (AI / RAG)

```js
// Atlas Vector Search index on an "embedding" field, then:
db.docs.aggregate([
  {
    $vectorSearch: {
      index: "embedding_index",
      path: "embedding",
      queryVector: queryEmbedding,       // number[] from an embedding model
      numCandidates: 200,
      limit: 5,
      filter: { tenantId: "t1" },
    },
  },
  { $project: { text: 1, score: { $meta: "vectorSearchScore" } } },
]);
```

Lets you keep application data and embeddings in one database for RAG (see the AI / LLM Engineering section).

## 💻 Geospatial Queries

```js
// GeoJSON: [longitude, latitude] — longitude FIRST
db.restaurants.insertOne({ name: "Cafe", location: { type: "Point", coordinates: [73.8567, 18.5204] } });
db.restaurants.createIndex({ location: "2dsphere" });

// Nearest within 2 km, sorted by distance
db.restaurants.find({
  location: { $near: { $geometry: { type: "Point", coordinates: [73.85, 18.52] }, $maxDistance: 2000 } },
});

// Inside a delivery zone polygon
db.restaurants.find({ location: { $geoWithin: { $geometry: deliveryZonePolygon } } });

// With distance in the output
db.restaurants.aggregate([
  { $geoNear: { near: { type: "Point", coordinates: [73.85, 18.52] }, distanceField: "meters", maxDistance: 2000 } },
]);
```

## 💻 GridFS (Files > 16 MB)

```ts
import { GridFSBucket } from "mongodb";
import fs from "node:fs";

const bucket = new GridFSBucket(client.db("media"), { bucketName: "videos" });
fs.createReadStream("intro.mp4").pipe(bucket.openUploadStream("intro.mp4", { metadata: { userId } }));
bucket.openDownloadStreamByName("intro.mp4").pipe(res);
```

Splits files into 255 KB chunks (`fs.files` + `fs.chunks`). In most web apps **S3 + a URL in MongoDB** is cheaper and faster; use GridFS when you need files inside the DB's backup/replication.

## 💻 Window Functions (`$setWindowFields`, 5.0+)

```js
// Running total and rank of daily revenue per store
db.sales.aggregate([
  {
    $setWindowFields: {
      partitionBy: "$storeId",
      sortBy: { day: 1 },
      output: {
        runningTotal: { $sum: "$revenue", window: { documents: ["unbounded", "current"] } },
        movingAvg7d: { $avg: "$revenue", window: { documents: [-6, 0] } },
        rank: { $rank: {} },
      },
    },
  },
]);
```

## 💻 Views & On-Demand Materialised Views

```js
// Read-only view (computed on every query)
db.createView("activeUsers", "users", [{ $match: { active: true } }, { $project: { password: 0 } }]);

// Materialised view: store results with $merge, refresh on a schedule
db.orders.aggregate([ /* group by month */ { $merge: { into: "monthlySales", whenMatched: "replace" } }]);
```

## 💻 Security Features (Quick Reference)

```js
// Role-based access control
db.createUser({ user: "appUser", pwd: passwordPrompt(), roles: [{ role: "readWrite", db: "shop" }] });
```

- **Authentication**: SCRAM, x.509, LDAP/OIDC (enterprise/Atlas).
- **Authorization**: built-in & custom roles, least privilege per service.
- **Encryption**: TLS in transit, encryption at rest, Client-Side Field Level Encryption and **Queryable Encryption** (7.0+) for sensitive fields.
- **Auditing**: Atlas / Enterprise audit logs.
- Never expose `mongod` to the internet; bind to private IPs / IP allow-list.

## 🌍 Real-World Impact

- Change streams replaced a polling job that hit the DB every second and still delivered events late.
- TTL indexes removed a nightly cleanup cron for sessions and password-reset tokens.
- Time series collections cut IoT metrics storage by ~70% versus one-document-per-reading.

## 🎯 Likely Interview Questions

1. **What are change streams and what do they require?** — Real-time change events from the oplog; need a replica set or sharded cluster.
2. **How do you avoid missing events after a crash?** — Store the resume token and use `resumeAfter`/`startAfter`.
3. **What is `$jsonSchema` validation and why use it if you have Mongoose?** — DB-level rules that protect against every client, not just your app.
4. **How does a TTL index work?** — Background task (~every 60s) deletes docs whose date field + `expireAfterSeconds` has passed.
5. **What are capped collections?** — Fixed-size, insertion-ordered collections that overwrite the oldest docs.
6. **What are time series collections?** — Optimised storage for time-stamped measurements with automatic bucketing and compression.
7. **`$text` vs Atlas Search?** — Basic stemming search vs Lucene-based fuzzy, autocomplete, facets.
8. **How do you find nearby places?** — `2dsphere` index + `$near` / `$geoNear` with GeoJSON (longitude first).
9. **When would you use GridFS?** — Files > 16 MB that must live in MongoDB; otherwise S3 + metadata.
10. **How do you compute running totals or rankings?** — `$setWindowFields`.
11. **What is a view vs a materialised view?** — Computed on read vs stored results refreshed with `$merge`.
12. **How do you secure a MongoDB deployment?** — Auth + least-privilege roles, TLS, network isolation, encryption at rest, field-level encryption for sensitive data.

---

[← Replication & Sharding](09-replication-sharding.md) | [Index](../README.md) | [Next: Query Practice Problems →](12-query-practice.md)
