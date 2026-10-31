# Chapter 138 — Node & Express Scenarios

## 📖 Definition

Backend scenario questions describe a production-style problem in a Node/Express API — latency, crashes, duplicates, security holes, scaling limits — and ask how you would approach it. Answer with **clarify → hypothesise → verify → fix → prevent**, and name the tools you would use.

---

### Scenario 1 — "One endpoint takes 5 seconds; everything else is fine."

**Clarify:** always slow or only for some inputs/users? since a deploy? p50 or only p99?

**Verify**
- Add timing logs/spans around each step (DB query, external call, serialisation), or check APM traces.
- Run the MongoDB query with `.explain("executionStats")` → look for `COLLSCAN`, `totalDocsExamined` ≫ `nReturned`.
- Check for N+1 queries (many small queries in a loop) in the MongoDB profiler or logs.

**Common fixes**
- Add the right compound index (Equality → Sort → Range order).
- Replace per-item queries with `$in` / `populate` / `$lookup`.
- `.lean()` + projection; paginate.
- Run independent calls with `Promise.all`.
- Cache stable results in Redis; move slow side work (emails, PDFs) to a queue.

**Prevent:** p95 latency alerts per route; slow-query logging in MongoDB.

---

### Scenario 2 — "When one heavy request runs, every other request becomes slow."

**Cause:** the event loop is blocked by synchronous CPU work (big `JSON.parse`/`stringify`, sorting/aggregating large arrays in JS, `bcrypt.hashSync`, image processing, a catastrophic regex).

**Verify:** event-loop delay metric (`monitorEventLoopDelay`), `clinic doctor`, CPU profile (`--cpu-prof`).

**Fix:** push aggregation into MongoDB; use async versions of crypto/zlib; move CPU work to `worker_threads` (pool with Piscina) or a separate service via a queue; chunk work with `setImmediate`; validate input length to prevent ReDoS.

---

### Scenario 3 — "The API works locally but returns 500 in production."

**Checklist**
1. Read the production logs for the stack trace (structured logs + request ID).
2. **Environment variables** missing or different (`MONGO_URI`, secrets, `NODE_ENV`).
3. **Network/permissions:** DB IP allow-list, VPC/security groups, IAM role for S3.
4. **Differences in data:** a null field that never existed in dev data.
5. **Versions:** Node version, a dependency installed without lockfile (`npm ci` vs `npm install`).
6. **Case-sensitive file paths** (macOS/Windows dev vs Linux server): `import "./Utils"` vs `utils.js`.
7. **Proxy issues:** `app.set("trust proxy", 1)` needed for correct IPs/HTTPS behind a load balancer; cookies with `secure` over HTTP.

**Prevent:** validate env vars at startup and crash early (e.g. with Zod), keep a staging environment identical to prod, Docker for parity.

```js
const env = z.object({
  MONGO_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
}).parse(process.env);            // throws at boot with a clear message
```

---

### Scenario 4 — "Duplicate orders are created when users double-click or the network retries."

**Fix in layers**
1. **Frontend:** disable the button while submitting.
2. **API idempotency key:** client sends `Idempotency-Key`; server stores it with a unique index and replays the stored response for repeats.
3. **Database constraint:** unique index on a natural key (e.g. `{ cartId: 1 }` on orders, or `{ paymentId: 1 }`).
4. **Webhooks:** store processed event IDs; process each once.

```js
await Order.collection.createIndex({ cartId: 1 }, { unique: true });
try {
  const order = await Order.create({ cartId, userId, items });
} catch (e) {
  if (e.code === 11000) return res.status(200).json(await Order.findOne({ cartId })); // already created
  throw e;
}
```

---

### Scenario 5 — "Two users bought the last item in stock at the same time; stock went negative."

**Cause:** read-modify-write race:
```js
const p = await Product.findById(id);    // both requests read stock = 1
if (p.stock > 0) { p.stock -= 1; await p.save(); }   // both write 0… or -1
```

**Fix:** make the check and the update **one atomic operation**.
```js
const updated = await Product.findOneAndUpdate(
  { _id: id, stock: { $gte: qty } },     // condition
  { $inc: { stock: -qty } },             // atomic decrement
  { new: true },
);
if (!updated) throw new HttpError(409, "Out of stock");
```
For multi-document changes (stock + order + payment record), use a transaction. For flash sales, consider a Redis counter (`DECR`) as a gate in front of the database.

---

### Scenario 6 — "Users can see other users' invoices by changing the ID in the URL."

**Cause:** Insecure Direct Object Reference — authentication is checked, authorisation (ownership) is not.

**Fix:** scope every query by the owner, return 404 for others, and add tests.
```js
const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.id });
if (!invoice) throw new HttpError(404, "Invoice not found");
```
**Prevent:** a shared helper/repository that always applies tenant/owner filters; authorisation tests for every resource route; security review checklist.

---

### Scenario 7 — "The Node process crashes with `JavaScript heap out of memory` every few hours."

**Verify:** memory metrics over time (does the *minimum* after GC keep rising?); heap snapshots under load compared over time; look at retainers.

**Common causes:** unbounded in-memory cache/map; per-request listeners not removed; loading whole collections or big files into memory; global arrays.

**Fix:** bounded LRU or Redis; remove listeners; stream large data; paginate.

Raising `--max-old-space-size` only buys time. Run under PM2/Kubernetes so a crash restarts the process while you fix the leak.

---

### Scenario 8 — "We need to send 1 lakh (100,000) notification emails."

**Answer**
- Never in the request handler. Enqueue jobs (BullMQ) — one job per batch of ~100 recipients.
- Workers with controlled **concurrency** and a **rate limiter** matching the provider's limit (SES/SendGrid).
- Retries with backoff; failed jobs to a dead-letter set; **idempotency** (`notificationId + userId`) so retries never send twice.
- Progress tracking in a `campaign` document; unsubscribe handling; bounce/complaint webhooks.
- Use the provider's bulk API where available.

---

### Scenario 9 — "A third-party API (payment/SMS) is slow or sometimes down and it takes our API down with it."

**Fix**
- **Timeouts** on every outbound call (`AbortSignal.timeout(3000)`) — never wait forever.
- **Retries** with exponential backoff + jitter, only for idempotent or keyed requests.
- **Circuit breaker** (e.g. `opossum`): after N failures, fail fast for a cool-down period instead of piling up requests.
- **Fallbacks**: queue the work and confirm later ("payment pending"), cached data, a secondary provider.
- **Bulkheads**: limit concurrent calls to that dependency so it cannot exhaust all sockets/memory.

```js
import CircuitBreaker from "opossum";
const breaker = new CircuitBreaker((body) => smsApi.send(body), { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 30_000 });
breaker.fallback((body) => smsQueue.add("retry-sms", body));
await breaker.fire({ to, text });
```

---

### Scenario 10 — "We deployed and for 30 seconds users got 502 errors."

**Causes:** the old process was killed while handling requests; new instances received traffic before they were ready (DB not connected).

**Fix:** graceful shutdown on `SIGTERM` (stop accepting, finish in-flight, close DB), readiness probes (`/health/ready` only returns 200 after Mongo/Redis connect), rolling deploys with at least one healthy instance, `pm2 reload` instead of `restart`, keep-alive timeout on Node greater than the load balancer's idle timeout.

---

### Scenario 11 — "Login is being brute-forced; we see thousands of attempts from many IPs."

**Fix:** rate limit by IP **and** by account (`email`), with Redis storage; progressive delays or temporary lockout per account; CAPTCHA after N failures; MFA; alerting on spikes; generic error messages; monitor for credential stuffing (breached-password checks).

---

### Scenario 12 — "We need to add API versioning because a mobile app cannot update immediately."

**Answer:** URL versioning (`/api/v1`, `/api/v2`) is the simplest and most visible; keep v1 running while clients migrate; share services, version only controllers/DTOs; document with OpenAPI; add a `Deprecation`/`Sunset` header and track v1 usage before removing it. Prefer **additive, backward-compatible changes** (new optional fields) so most changes do not need a new version.

---

### Scenario 13 — "Our monolithic Express app has 200 routes and is hard to work on. How would you restructure it?"

**Answer outline**
- Move to a **feature-based (modular) structure**: `modules/orders/{routes, controller, service, repository, schema, tests}`.
- Layers: routes (HTTP) → controllers (req/res mapping) → services (business rules) → repositories (DB).
- Central error handling, validation middleware, config module, logger.
- Dependency injection (constructor params or NestJS) to make services testable.
- Clear module boundaries first; only split into microservices where there is a real scaling or team-ownership reason.

---

### Scenario 14 — "File uploads of 500 MB fail or crash the server."

**Causes:** `express.json`/Multer memory storage buffering the whole file; proxy body limits (Nginx `client_max_body_size`); request timeouts.

**Fix:** let the browser upload **directly to S3** using a pre-signed URL (multipart upload for big files); the API only issues the URL and records the key. If it must pass through the server, stream it (`busboy` → S3 `Upload`) with size limits.

---

## 🎯 What Interviewers Are Scoring

- You think in terms of **measurement** (logs, metrics, traces, `explain`).
- You know the classic backend bugs: **blocking the event loop, race conditions, IDOR, N+1, memory leaks, missing timeouts**.
- Your fixes include **prevention**: constraints, tests, alerts, idempotency.

---

[← React Scenarios](02-react-scenarios.md) | [Index](../README.md) | [Next: MongoDB Scenarios →](04-mongodb-scenarios.md)
