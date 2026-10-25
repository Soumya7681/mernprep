# Chapter 116 — MERN Interview: Node.js & Express Questions

## 📖 How to Use This Chapter

Backend questions asked in MERN interviews, with answers and code. Deep dives are in the **Node.js**, **Express / NestJS** and **MERN Stack + TypeScript** sections.

---

### 1. What is Node.js and why is it good for APIs?

A JavaScript runtime on Chrome's V8 engine with a **non-blocking, event-driven** I/O model. One thread handles thousands of concurrent connections because it doesn't wait for I/O (DB, network, files) — it registers callbacks and moves on. Great for I/O-heavy APIs, real-time apps and microservices; not ideal for CPU-heavy work on the main thread.

### 2. If Node is single-threaded, how does it handle many requests?

JavaScript runs on one thread, but I/O is handed to the OS or **libuv's thread pool** (file system, DNS, crypto, zlib). When I/O finishes, its callback is queued and run by the event loop. For CPU-heavy tasks use **worker threads**, a separate service, or a job queue; to use all CPU cores run multiple processes (cluster mode, PM2, or multiple containers).

### 3. Event loop phases?

Timers (`setTimeout`) → pending callbacks → poll (I/O) → check (`setImmediate`) → close callbacks. Between each phase, **microtasks** run: `process.nextTick` first, then promise callbacks.

### 4. What is middleware in Express?

A function `(req, res, next)` that runs in order for each request. It can modify `req`/`res`, end the response, or call `next()`.

```js
app.use(express.json());                 // built-in: parse JSON bodies
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(requestLogger);                  // custom
app.use("/api/orders", requireAuth, orderRouter);   // route-level
app.use(errorHandler);                   // error middleware (4 args) — last
```

### 5. How do you handle errors centrally in Express?

```js
class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Express 4: wrap async handlers so rejections reach the error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get("/api/orders/:id", asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError(404, "Order not found");
  res.json(order);
}));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: status >= 500 ? "Internal server error" : err.message });
});
```

Express 5 forwards rejected promises to `next` automatically.

### 6. How does JWT authentication work?

1. User logs in → server checks password (bcrypt) → signs a JWT with user id and role.
2. Client sends it in `Authorization: Bearer <token>`.
3. `requireAuth` middleware verifies the signature and expiry, sets `req.user`.
4. Use a short-lived access token (~15 min) + long-lived refresh token in an **httpOnly, Secure, SameSite** cookie; refresh endpoint issues new tokens.

```js
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
```

### 7. JWT vs session-based auth?

| | JWT | Session |
|---|-----|---------|
| State | Stateless (token holds data) | Server stores session (Redis/DB) |
| Scaling | Easy across servers | Needs shared session store |
| Logout/revoke | Harder (short expiry, denylist, token version) | Easy (delete session) |
| Good for | APIs, mobile, microservices | Traditional web apps |

### 8. How do you implement role-based access control?

```js
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "Forbidden" });

router.delete("/:id", requireAuth, requireRole("admin"), deleteProduct);
```

Also check **ownership** in the service: users can only access their own orders (filter by `userId`).

### 9. How do you store passwords?

Never plain text. Hash with **bcrypt** (or argon2) with a salt and cost factor (10–12). Compare with `bcrypt.compare`. Never return the password field in responses.

### 10. REST API best practices?

- Nouns and plural resources: `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id`.
- Correct status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.
- Consistent response/error format.
- Pagination, filtering, sorting via query params.
- Versioning (`/api/v1`).
- Validate input; never trust the client.
- Idempotency for retries on payments (idempotency keys).

### 11. PUT vs PATCH?

PUT replaces the whole resource; PATCH updates only the given fields. PUT is idempotent; PATCH usually is in practice.

### 12. How do you validate request data?

Use **express-validator** (or Joi), or class-validator DTOs in NestJS. Validate type, format, length and allowed values; whitelist fields to prevent mass assignment (`role: "admin"` in a signup body).

### 13. How do you implement pagination?

- **Offset**: `?page=3&limit=20` → `skip((page-1)*limit).limit(limit)` + total count. Simple, slow for deep pages.
- **Cursor**: `?after=<lastId>` → `find({ _id: { $lt: after } }).sort({ _id: -1 }).limit(20)`. Fast at any depth, good for infinite scroll.

### 14. How do you upload files?

`multer` for multipart parsing (with size and type limits), then store in **S3** (not the server's disk — containers are temporary). Better: generate a **pre-signed URL** so the browser uploads directly to S3, and save only the key in MongoDB.

### 15. What is CORS and how do you fix CORS errors?

A browser rule blocking requests to a different origin unless the server allows it. Configure `cors({ origin: "https://app.example.com", credentials: true })` on the server — never `*` with credentials. In development, a Vite/CRA proxy avoids CORS.

### 16. How do you secure an Express API?

helmet (security headers), strict CORS, rate limiting (express-rate-limit), input validation, parameterised queries / avoid passing raw `req.body` into Mongo filters (NoSQL injection), bcrypt passwords, short-lived JWTs, HTTPS, secrets in env vars, `npm audit`, no stack traces in production errors, logging and monitoring.

### 17. How do you implement rate limiting?

```js
import rateLimit from "express-rate-limit";
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }));
```

With multiple servers, use a shared store (Redis) so limits apply across instances.

### 18. What is `process.nextTick` vs `setImmediate`?

`process.nextTick` runs before other microtasks, right after the current operation. `setImmediate` runs in the check phase, after I/O. Overusing `nextTick` can starve the event loop.

### 19. What are streams? When do you use them?

Process data in chunks instead of loading it all into memory: file downloads/uploads, CSV exports, video, proxying. Types: Readable, Writable, Duplex, Transform. Use `pipeline()` for proper error handling and backpressure.

```js
import { pipeline } from "node:stream/promises";
await pipeline(fs.createReadStream("big.csv"), zlib.createGzip(), res);
```

### 20. How do you scale a Node.js application?

Run multiple instances (cluster/PM2/containers) behind a load balancer, keep servers stateless (sessions in Redis, files in S3), cache hot data in Redis, add DB indexes, move heavy work to background queues (BullMQ), use a CDN for static assets.

### 21. What is a memory leak in Node and how do you find it?

Memory that's never released: global caches without limits, unremoved event listeners, timers, closures holding big objects. Find with `node --inspect` heap snapshots (compare two), `process.memoryUsage()`, and monitoring graphs.

### 22. How do you handle environment variables?

`.env` locally (dotenv), real secrets in the platform's secret manager; validate them at start-up and fail fast; never commit `.env`.

### 23. How do you implement background jobs?

Use a queue like **BullMQ** (Redis): the API adds a job (send email, generate PDF), a worker process handles it with retries and backoff. Keeps API responses fast and survives restarts.

### 24. What is the difference between Express and NestJS?

Express is minimal and unopinionated. NestJS is a framework on top of Express/Fastify with modules, dependency injection, decorators, DTO validation pipes, guards and interceptors — more structure for large teams.

### 25. How do you log and monitor a Node API?

Structured JSON logs (pino/winston) with request IDs, error tracking (Sentry), metrics (response time, error rate, CPU/memory) in CloudWatch/Grafana, health check endpoints, alerts.

### 26. How do you do graceful shutdown?

On `SIGTERM`: stop accepting new requests (`server.close`), finish in-flight requests, close DB connections, then exit — so deployments don't cut off users.

### 27. How do you write tests for APIs?

Jest/Vitest + **Supertest** against the Express app, with an in-memory MongoDB (`mongodb-memory-server`); test status codes, validation errors, auth and ownership rules.

```js
it("returns 401 without token", async () => {
  await request(app).get("/api/orders").expect(401);
});
```

---

[← React & Redux Questions](03-react-redux-questions.md) | [Index](../README.md) | [Next: MongoDB & Mongoose Questions →](05-mongodb-questions.md)
