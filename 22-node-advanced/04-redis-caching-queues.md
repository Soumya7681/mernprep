# Chapter 59 — Redis Caching & Job Queues

## 📖 Definition

**Redis** is an in-memory key-value data store with rich data types (strings, hashes, lists, sets, sorted sets, streams). In MERN apps it is used as a **cache**, a **session/rate-limit store**, a **pub/sub** bus and the backend for **job queues** such as **BullMQ**. A **job queue** moves slow or unreliable work (emails, PDFs, webhooks, video processing) out of the request cycle into background workers.

## 🔍 Caching Strategies

| Strategy | How | Use |
|---|---|---|
| **Cache-aside (lazy loading)** | App reads cache → miss → reads DB → writes cache | Most common; read-heavy data |
| **Write-through** | App writes DB and cache together | Data read right after write |
| **Write-behind** | Write cache now, DB later (async) | Counters, analytics; risk of loss |
| **TTL expiry** | Every key expires | Data that can be slightly stale |

**The two hard problems:** *invalidation* (when do we delete stale data?) and *stampede* (1,000 requests miss at once and all hit the DB).

## 💻 Code Example — Cache-Aside With TTL

```js
import { createClient } from "redis";
export const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

async function cached(key, ttlSeconds, loader) {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const value = await loader();
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  return value;
}

app.get("/api/products/:id", async (req, res) => {
  const product = await cached(`product:${req.params.id}`, 300, () =>
    Product.findById(req.params.id).lean(),
  );
  if (!product) return res.status(404).end();
  res.json(product);
});

// Invalidate on write
app.put("/api/products/:id", auth, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await redis.del(`product:${req.params.id}`);
  res.json(product);
});
```

## 💻 Code Example — Preventing a Cache Stampede

```js
const pending = new Map();   // per-instance request coalescing

async function cachedOnce(key, ttl, loader) {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      try {
        const value = await loader();
        // add random jitter so many keys do not expire at the same second
        await redis.set(key, JSON.stringify(value), { EX: ttl + Math.floor(Math.random() * 30) });
        return value;
      } finally {
        pending.delete(key);
      }
    })());
  }
  return pending.get(key);
}
```

Across many instances, use a short Redis lock (`SET lock:key 1 NX EX 10`) so only one instance rebuilds the value.

## 💻 Code Example — Other Everyday Redis Uses

```js
// Counter (page views, likes)
await redis.incr(`views:${postId}`);

// Leaderboard with a sorted set
await redis.zIncrBy("leaderboard", 10, `user:${userId}`);
const top10 = await redis.zRangeWithScores("leaderboard", 0, 9, { REV: true });

// Fixed-window rate limit
const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > 100) return res.status(429).end();

// OTP with expiry
await redis.set(`otp:${phone}`, code, { EX: 300 });

// Token blacklist on logout (until the JWT's own expiry)
await redis.set(`bl:${jti}`, "1", { EXAT: decoded.exp });

// Pub/Sub between services
await publisher.publish("order:created", JSON.stringify(order));
await subscriber.subscribe("order:created", (msg) => handle(JSON.parse(msg)));
```

## 💻 Code Example — BullMQ Job Queue

```js
// queues.js
import { Queue } from "bullmq";
const connection = { url: process.env.REDIS_URL };
export const emailQueue = new Queue("email", { connection });

// In the API — respond immediately, work happens later
app.post("/api/orders", auth, async (req, res) => {
  const order = await Order.create({ ...req.body, userId: req.user.id });
  await emailQueue.add(
    "order-confirmation",
    { orderId: order._id.toString() },
    {
      jobId: `confirm-${order._id}`,           // de-duplicates if added twice
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
  res.status(201).json(order);
});
```

```js
// worker.js — runs as a separate process
import { Worker } from "bullmq";

const worker = new Worker(
  "email",
  async (job) => {
    const order = await Order.findById(job.data.orderId).populate("userId");
    await mailer.send({ to: order.userId.email, template: "order-confirmation", data: order });
  },
  { connection: { url: process.env.REDIS_URL }, concurrency: 10, limiter: { max: 50, duration: 1000 } },
);

worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "email job failed"));
```

Other features: **delayed jobs** (`delay: 24 * 3600 * 1000` for a reminder), **repeatable jobs** (cron), **priorities**, **flows** (parent/child jobs), and a dashboard (Bull Board).

## 🔍 Queue Design Rules

- **Jobs must be idempotent** — they *will* sometimes run twice (retry after a crash). Check "already sent?" before sending.
- Pass **IDs**, not whole documents; load fresh data in the worker.
- Set `attempts` + `backoff`, and alert on jobs in the *failed* set (a dead-letter queue).
- Workers should shut down gracefully (`await worker.close()`) so in-progress jobs finish.

## 🔍 Redis vs Kafka vs RabbitMQ

| | Redis + BullMQ | RabbitMQ | Kafka |
|---|---|---|---|
| Model | Job queue | Message broker (queues, routing) | Distributed log (replayable) |
| Best for | Background jobs in a Node app | Service-to-service messaging | Event streaming at large scale, analytics |
| Ops effort | Low | Medium | High |

## 🌍 Real-World Use

- Product and category pages cached for 5 minutes; cache deleted on admin edit.
- Order confirmation emails, invoice PDFs, image thumbnails, webhook delivery → BullMQ.
- Session store, rate limiting and Socket.IO adapter → the same Redis cluster.

## 🎯 Likely Interview Questions

1. **What is Redis and why is it fast?** — In memory, single-threaded command execution, efficient data structures.
2. **Explain cache-aside. How do you invalidate the cache?**
3. **What is a cache stampede and how do you prevent it?**
4. **What would you never cache?** — Highly personalised, rapidly changing, or security-critical data without care.
5. **Why use a job queue for sending emails?**
6. **What happens if a worker crashes mid-job? How do you avoid sending an email twice?**
7. **Redis pub/sub vs a job queue?** — Pub/sub is fire-and-forget; queues persist and retry.
8. **When would you choose Kafka over BullMQ?**

---

[← WebSockets & Real-Time](03-websockets-realtime.md) | [Index](../README.md) | [Next: Node Security (OWASP) →](05-security-owasp.md)
