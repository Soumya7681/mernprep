# Chapter 123 — Scalable APIs

## 📖 Definition

A scalable API is one whose throughput and latency degrade gracefully as users, data, or traffic grow.

## 🔍 Layers of Scaling

```
┌──────────────────────────┐
│  Clients (web / mobile)  │
└──────────────┬───────────┘
               ▼
┌──────────────────────────┐
│           CDN            │  ← cache static + cacheable API responses
└──────────────┬───────────┘
               ▼
┌──────────────────────────┐
│      Load Balancer       │  ← round-robin / least-conn
└──────────────┬───────────┘
               ▼
┌──────────────────────────┐
│  API Gateway (optional)  │  ← auth, rate-limit, routing
└──────────────┬───────────┘
               ▼
┌──────────────────────────┐
│  Stateless API Instances │  ← horizontally scalable
└──────┬──────────────┬────┘
       ▼              ▼
 ┌──────────┐   ┌────────────┐
 │  Cache   │   │   Queue    │
 │  (Redis) │   │ (BullMQ)   │
 └─────┬────┘   └────┬───────┘
       ▼             ▼
 ┌──────────────────────────┐
 │     Database (Mongo)     │
 │  Replicas, Sharding      │
 └──────────────────────────┘
```

## 💻 Code Example — Statelessness

Stateless services scale horizontally. Avoid:
- In-process session storage.
- Local file uploads.
- Long-lived WebSocket connections without sticky routing.

```js
// ❌ in-process map — won't survive a restart, not shared across instances
const sessions = new Map();

// ✅ Redis — shared, durable
import { createClient } from "redis";
const redis = createClient();
await redis.connect();
await redis.set(`session:${id}`, JSON.stringify(data), { EX: 3600 });
```

## 🚀 Caching Strategies

| Layer | What to cache | TTL |
|-------|---------------|-----|
| Browser | Static assets, GET responses with `Cache-Control` | hours / days |
| CDN | Same as above; geo-distributed | hours / days |
| App-process (`lru-cache`) | Hot lookups inside one instance | seconds / minutes |
| Redis | Shared cache for multi-instance | seconds / minutes / hours |
| DB query cache | Materialized views, repeated heavy aggregates | hours |

### Cache-Aside (most common)

```js
async function getUser(id) {
  const key = `user:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const user = await User.findById(id).lean();
  if (user) await redis.set(key, JSON.stringify(user), { EX: 300 });
  return user;
}

// Invalidate on writes
async function updateUser(id, patch) {
  const user = await User.findByIdAndUpdate(id, patch, { new: true });
  await redis.del(`user:${id}`);
  return user;
}
```

## 💻 Code Example — Queue / Background Jobs

Anything that's slow, retryable, or doesn't need a sync response → queue it.

```js
// producer (in API)
import { Queue } from "bullmq";
const emailQ = new Queue("email", { connection: { host: "redis" } });

app.post("/users", async (req, res) => {
  const user = await UserService.create(req.body);
  await emailQ.add("welcome", { to: user.email });   // returns immediately
  res.status(201).json(user);
});

// worker (separate process)
import { Worker } from "bullmq";
new Worker("email", async (job) => {
  await sendEmail(job.data.to, "Welcome!");
}, { connection: { host: "redis" } });
```

Common use cases:
- Email / SMS / push notifications.
- Image resizing.
- Bulk imports/exports.
- Webhook delivery (with retries).

## 💻 Code Example — Database Read Replicas

```js
// In mongoose, use readPreference for analytics queries
Order.find({})
  .read("secondaryPreferred")    // read from replica
  .lean();
```

## 💻 Code Example — Pagination & Filtering at Scale

```js
// Cursor pagination (Chapter 36) — required at scale
GET /messages?after=<id>&limit=20
```

Always:
- Index the cursor field.
- Cap `limit` server-side (no `?limit=1000000`).
- Avoid `count` for huge collections (use approximations).

## 💻 Code Example — Connection Pooling

```js
mongoose.connect(url, {
  maxPoolSize: 50,           // tune based on load tests
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
});
```

For Postgres, use `pg-pool` or PgBouncer in front.

## 💻 Code Example — Observability

```js
import pino from "pino";
const logger = pino({ level: "info" });

// Structured logs
logger.info({ userId: user.id, route: req.url }, "Request handled");

// Metrics with prom-client
import client from "prom-client";
const reqDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Request duration in ms",
  labelNames: ["method", "route", "status"],
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () =>
    reqDuration.labels(req.method, req.route?.path || "", res.statusCode)
               .observe(Date.now() - start)
  );
  next();
});

// Expose /metrics for Prometheus scraping
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});
```

Pair with **OpenTelemetry** for distributed tracing across services.

## 💻 Code Example — Graceful Shutdown

```js
const server = app.listen(port);

const shutdown = async () => {
  console.log("Shutting down");
  server.close();                  // stop accepting new requests
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);
```

## 📈 Scaling Patterns Summary

| Symptom | Solution |
|---------|---------|
| One DB row is hot | Cache (Redis), denormalize |
| Same query repeated | Cache results |
| CPU-bound endpoint | Offload to worker thread or queue |
| Slow third-party call | Async queue + webhook callback |
| 10k connections per instance | Add instances behind LB |
| One DB is saturated | Add read replicas / shard |
| Static assets slow | CDN |
| Cold starts | Pre-warm or keep min instances |

## 🎯 Likely Interview Questions

1. **How would you scale this API to 10× traffic?**
2. **Where would you add caching?**
3. **When would you introduce a queue?**
4. **How do you keep services stateless?**
5. **What metrics matter for a healthy API?** — Request rate (RPS), error rate, latency (p50, p95, p99), saturation (CPU, memory, DB connections). The **RED method** (Rate, Errors, Duration).

---

[← Authentication](01-authentication.md) | [Index](../README.md) | [Next: Caching →](03-caching.md)
