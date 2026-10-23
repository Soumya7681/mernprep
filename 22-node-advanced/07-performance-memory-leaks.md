# Chapter 62 — Performance & Memory Leaks

## 📖 Definition

**Backend performance** is how fast and how efficiently an API serves requests — measured as **latency** (p50/p95/p99), **throughput** (requests per second) and **resource usage** (CPU, memory). A **memory leak** is memory that the application keeps referencing after it no longer needs it, so the garbage collector cannot free it and usage grows until the process crashes.

## 🔍 A Method, Not Guesswork

```text
1. Measure   — reproduce with a load test; capture p95, RPS, CPU, memory, event-loop lag
2. Locate    — is the time in Node (CPU), the database, or a downstream API?
3. Profile   — CPU profile / flame graph, heap snapshots, MongoDB explain(), APM traces
4. Fix       — the single biggest bottleneck first
5. Verify    — re-run the same load test; compare numbers
```

## 💻 Code Example — Load Testing

```bash
npx autocannon -c 100 -d 30 http://localhost:3000/api/products
# -c connections, -d seconds → prints latency percentiles and req/sec
```

k6 (scripted scenarios):

```js
import http from "k6/http";
import { check } from "k6";
export const options = { vus: 50, duration: "1m", thresholds: { http_req_duration: ["p(95)<300"] } };
export default function () {
  const res = http.get("http://localhost:3000/api/products?page=1");
  check(res, { "status 200": (r) => r.status === 200 });
}
```

## 💻 Code Example — CPU Profiling

```bash
node --cpu-prof server.js            # writes a .cpuprofile on exit → open in Chrome DevTools
npx clinic doctor -- node server.js  # diagnoses event-loop, I/O, GC problems
npx clinic flame -- node server.js   # flame graph: the widest bars are where CPU time goes
```

## 🔍 Common Backend Bottlenecks and Fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Slow list endpoint, DB CPU high | Missing index → COLLSCAN | Compound index matching filter + sort; check `explain()` |
| Slow detail page | N+1 queries (query per item in a loop) | `$in` batch query, `populate`, or `$lookup` |
| Huge responses | Returning whole documents | `.select()` fields, `.lean()`, pagination, gzip/brotli |
| High CPU in Node | Sync crypto/JSON/regex in hot path | Async APIs, worker threads, cache results |
| Slow under load only | Connection pool too small | Tune `maxPoolSize`; reuse one Mongoose connection |
| Every request slow | Sequential awaits on independent calls | `Promise.all` |
| Latency spikes | GC pauses from large allocations | Stream data, avoid giant arrays, reduce allocations |
| Slow third-party API | No timeout/cache | Timeouts, caching, circuit breaker, queue |

## 💻 Code Example — N+1 Query Fix

```js
// ❌ 1 query for orders + 1 query per order = 101 queries for 100 orders
const orders = await Order.find({ status: "paid" }).lean();
for (const o of orders) {
  o.user = await User.findById(o.userId).lean();
}

// ✅ 2 queries total
const paid = await Order.find({ status: "paid" }).lean();
const users = await User.find({ _id: { $in: paid.map((o) => o.userId) } }).select("name email").lean();
const byId = new Map(users.map((u) => [String(u._id), u]));
paid.forEach((o) => (o.user = byId.get(String(o.userId))));

// ✅ or let Mongoose do the batching
await Order.find({ status: "paid" }).populate("userId", "name email").lean();
```

## 💻 Code Example — `.lean()` and Projection

```js
// Full Mongoose documents: getters, change tracking, methods — ~3–5× heavier
await Product.find({ category: "shoes" });

// Plain JS objects, only the fields the UI needs
await Product.find({ category: "shoes" }).select("name price image").lean();
```

## 💻 Code Example — Compression and HTTP Caching

```js
import compression from "compression";
app.use(compression());                    // gzip JSON responses (often done by Nginx/CDN instead)

app.get("/api/categories", async (req, res) => {
  res.set("Cache-Control", "public, max-age=300");   // browser/CDN may cache for 5 minutes
  res.json(await getCategories());
});
// Express sends ETags by default → 304 Not Modified when unchanged
```

## 🔍 Memory Leaks in Node — Usual Suspects

```js
// 1. Unbounded in-memory cache / map
const sessions = new Map();               // grows with every user, never cleared

// 2. Event listeners added per request
app.get("/stream", (req, res) => {
  eventBus.on("update", (d) => res.write(d));   // never removed → leak + "MaxListenersExceededWarning"
});

// 3. Timers never cleared
setInterval(() => poll(user), 1000);      // per user, never clearInterval

// 4. Closures capturing large objects
function handler(bigBuffer) {
  return () => console.log("done");       // V8 may retain bigBuffer via shared closure scope
}

// 5. Global arrays used as logs/queues
global.requests.push(req);                // keeps entire request objects alive
```

**Fixes:** LRU caches with a max size (`lru-cache`) or Redis; remove listeners on `req.on("close")`; clear timers; avoid globals; stream instead of accumulating.

## 💻 Code Example — Hunting a Leak With Heap Snapshots

```bash
node --inspect server.js
# Chrome → chrome://inspect → Memory → Take heap snapshot
# Run load for a few minutes → take snapshot 2 → choose "Comparison"
# Sort by "# Delta" / "Size Delta": the constructor that keeps growing is the leak
# Click it → "Retainers" shows what is holding it in memory
```

Programmatically:

```js
import v8 from "node:v8";
app.post("/debug/heap", adminOnly, (req, res) => {
  res.json({ file: v8.writeHeapSnapshot() });   // pauses the process — use carefully in prod
});
```

**Signs of a leak vs normal behaviour:** heap that rises and falls in a sawtooth is normal GC. Heap whose *lowest points* keep rising over hours is a leak.

## 💻 Code Example — Bounded Cache

```js
import { LRUCache } from "lru-cache";
const cache = new LRUCache({ max: 5000, ttl: 5 * 60_000 });   // at most 5,000 entries, 5 min each
```

## 🌍 Real-World Use

- An order listing went from 2.4 s to 80 ms by adding the index `{ userId: 1, createdAt: -1 }` and using `.lean()` with a projection.
- A container restarted every 6 hours with OOM — heap snapshot showed a `Map` of per-request socket listeners never removed.

## 🎯 Likely Interview Questions

1. **An API endpoint is slow. Walk me through how you find the cause.**
2. **What is the N+1 query problem and how do you fix it in Mongoose?**
3. **What does `.lean()` do and when should you not use it?** — When you need document methods, virtuals, or `save()`.
4. **How do you load-test a Node API?**
5. **What are common causes of memory leaks in Node?**
6. **How do you confirm and locate a memory leak in production?**
7. **What is the difference between p50 and p99 latency, and why care about p99?**
8. **When would you add caching, and at which layer (CDN, HTTP, Redis, in-memory)?**

---

[← Logging, Observability & Graceful Shutdown](06-logging-observability-shutdown.md) | [Index](../README.md) | [Next: Testing Node APIs →](08-testing-node-apis.md)
