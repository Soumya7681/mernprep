# Chapter 96 — Node & Express Coding Questions

## 📖 Definition

Backend coding rounds ask you to **write working Node/Express code live**: a CRUD API with validation, an auth middleware, a rate limiter, pagination, file handling, or a utility such as a retry wrapper or event emitter. Interviewers look at structure (routes → controllers → services), error handling, status codes, security and edge cases.

## 🧠 Checklist While Coding

- Validate input; return **400** with field errors.
- Use the right status codes: **201** created, **204** no content, **401** unauthenticated, **403** forbidden, **404** not found, **409** conflict.
- Wrap async handlers so errors reach the error middleware.
- Never trust `req.body` blindly (mass assignment, NoSQL injection).
- Paginate list endpoints; limit `limit`.

## 1. CRUD REST API for Products (Express + Mongoose)

```js
// models/product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, index: true },
    stock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
productSchema.index({ name: "text" });
export const Product = mongoose.model("Product", productSchema);
```

```js
// utils/http.js
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Express 5 forwards rejected promises automatically; this wrapper is needed on Express 4.
```

```js
// middleware/validate.js
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  req.validated = result.data;          // only validated, whitelisted fields
  next();
};
```

```js
// routes/products.js
import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().nonnegative(),
  category: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
});
const updateSchema = createSchema.partial();
const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["price", "-price", "createdAt", "-createdAt"]).default("-createdAt"),
});

const checkId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : next(new HttpError(400, "Invalid id"));

router.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => {
  const { page, limit, category, q, sort } = req.validated;
  const filter = {};
  if (category) filter.category = category;
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}));

router.get("/:id", checkId, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new HttpError(404, "Product not found");
  res.json(product);
}));

router.post("/", requireAuth, requireRole("admin"), validate(createSchema), asyncHandler(async (req, res) => {
  const product = await Product.create(req.validated);
  res.status(201).location(`/api/products/${product._id}`).json(product);
}));

router.patch("/:id", requireAuth, requireRole("admin"), checkId, validate(updateSchema), asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.validated, { new: true, runValidators: true });
  if (!product) throw new HttpError(404, "Product not found");
  res.json(product);
}));

router.delete("/:id", requireAuth, requireRole("admin"), checkId, asyncHandler(async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) throw new HttpError(404, "Product not found");
  res.status(204).end();
}));

export default router;
```

```js
// app.js — error handler goes LAST
app.use("/api/products", productRoutes);
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ message: "Duplicate value", fields: err.keyValue });
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  const status = err.status ?? 500;
  if (status >= 500) req.log?.error(err) ?? console.error(err);
  res.status(status).json({ message: status >= 500 ? "Internal server error" : err.message, details: err.details });
});
```

## 2. JWT Auth: Register, Login, Middleware, Roles

```js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

router.post("/register", validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.validated;
  if (await User.exists({ email })) throw new HttpError(409, "Email already registered");
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
  res.status(201).json({ id: user._id, name: user.name, email: user.email });
}));

router.post("/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.validated;
  const user = await User.findOne({ email }).select("+password");
  // same message for both cases → no user enumeration
  if (!user || !(await bcrypt.compare(password, user.password))) throw new HttpError(401, "Invalid credentials");

  const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ sub: user.id }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

  res
    .cookie("refreshToken", refreshToken, {
      httpOnly: true, secure: true, sameSite: "strict", path: "/api/auth/refresh", maxAge: 7 * 24 * 3600 * 1000,
    })
    .json({ accessToken });
}));

export function requireAuth(req, res, next) {
  const header = req.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(new HttpError(401, "Missing token"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(new HttpError(401, err.name === "TokenExpiredError" ? "Token expired" : "Invalid token"));
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, "Forbidden"));
```

## 3. Rate Limiter Middleware (Sliding Window, In Memory)

```js
export function rateLimiter({ windowMs = 60_000, max = 100, key = (req) => req.ip } = {}) {
  const hits = new Map();                         // key → array of timestamps

  // periodic cleanup so the map does not grow forever
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, times] of hits) {
      const recent = times.filter((t) => t > cutoff);
      recent.length ? hits.set(k, recent) : hits.delete(k);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    const recent = (hits.get(k) ?? []).filter((t) => t > now - windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests" });
    }
    recent.push(now);
    hits.set(k, recent);
    res.set("X-RateLimit-Remaining", String(max - recent.length));
    next();
  };
}

app.use("/api/auth/login", rateLimiter({ windowMs: 15 * 60_000, max: 5 }));
```

**Follow-up:** "What about 3 servers?" → move the counters to Redis (`INCR` + `EXPIRE`, or a sorted set per key for a true sliding window).

## 4. Cursor-Based Pagination

```js
// GET /api/feed?limit=20&cursor=<base64>
router.get("/feed", asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter = {};

  if (req.query.cursor) {
    const { createdAt, id } = JSON.parse(Buffer.from(req.query.cursor, "base64url").toString());
    // tie-breaker on _id so posts with the same timestamp are not skipped
    filter.$or = [
      { createdAt: { $lt: new Date(createdAt) } },
      { createdAt: new Date(createdAt), _id: { $lt: id } },
    ];
  }

  const posts = await Post.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  const last = page.at(-1);

  res.json({
    items: page,
    nextCursor: hasMore
      ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last._id })).toString("base64url")
      : null,
  });
}));
// Index: { createdAt: -1, _id: -1 }
```

Fetching `limit + 1` tells you whether a next page exists without a `countDocuments`.

## 5. File Upload Endpoint (Multer → S3 Pre-Signed URL)

```js
// Option A: upload through the server (small files)
import multer from "multer";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new HttpError(400, "Images only")),
});

router.post("/avatar", requireAuth, upload.single("avatar"), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "No file uploaded");
  const key = `avatars/${req.user.id}-${Date.now()}.webp`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET, Key: key, Body: req.file.buffer, ContentType: req.file.mimetype }));
  await User.findByIdAndUpdate(req.user.id, { avatar: key });
  res.status(201).json({ key });
}));
```

```js
// Option B: browser uploads straight to S3 (large files — server never touches the bytes)
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

router.post("/uploads/presign", requireAuth, asyncHandler(async (req, res) => {
  const { fileName, contentType } = req.body;
  if (!["application/pdf", "image/png", "image/jpeg"].includes(contentType)) throw new HttpError(400, "Type not allowed");
  const key = `docs/${req.user.id}/${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, "_")}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: process.env.BUCKET, Key: key, ContentType: contentType }), { expiresIn: 300 });
  res.json({ url, key });   // client: PUT the file to `url`, then tell the API the `key`
}));
```

## 6. Idempotent Payment / Order Endpoint

```js
// Client sends a unique Idempotency-Key header per checkout attempt.
const idempotencySchema = new mongoose.Schema({
  key: { type: String, unique: true },
  userId: String,
  status: { type: String, enum: ["processing", "done"], default: "processing" },
  response: Object,
  createdAt: { type: Date, default: Date.now, expires: 86400 },  // TTL: auto-delete after 24h
});
const IdempotencyRecord = mongoose.model("IdempotencyRecord", idempotencySchema);

router.post("/orders", requireAuth, asyncHandler(async (req, res) => {
  const key = req.get("Idempotency-Key");
  if (!key) throw new HttpError(400, "Idempotency-Key header required");

  try {
    await IdempotencyRecord.create({ key, userId: req.user.id });       // atomic claim (unique index)
  } catch (err) {
    if (err.code !== 11000) throw err;
    const existing = await IdempotencyRecord.findOne({ key, userId: req.user.id });
    if (existing?.status === "done") return res.status(201).json(existing.response); // replay same result
    throw new HttpError(409, "Request already in progress");
  }

  const order = await createOrderAndCharge(req.user.id, req.body);
  await IdempotencyRecord.updateOne({ key }, { status: "done", response: order });
  res.status(201).json(order);
}));
```

Double-clicks, network retries and mobile reconnects can no longer create duplicate orders.

## 7. Transfer Money With a MongoDB Transaction

```js
async function transfer(fromId, toId, amount) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const from = await Account.findOneAndUpdate(
        { _id: fromId, balance: { $gte: amount } },       // condition prevents negative balance
        { $inc: { balance: -amount } },
        { new: true, session },
      );
      if (!from) throw new HttpError(400, "Insufficient funds");
      await Account.updateOne({ _id: toId }, { $inc: { balance: amount } }, { session });
      await Ledger.create([{ fromId, toId, amount }], { session });
    });                                                    // retries on transient errors automatically
  } finally {
    await session.endSession();
  }
}
```

Requires a replica set (Atlas always has one).

## 8. Retry Wrapper With Exponential Backoff and Timeout

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callWithRetry(fn, { retries = 3, baseMs = 200, timeoutMs = 3000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(AbortSignal.timeout(timeoutMs));
    } catch (err) {
      lastError = err;
      const retryable = err.name === "TimeoutError" || err.status >= 500 || err.code === "ECONNRESET";
      if (!retryable || attempt === retries) break;
      await sleep(baseMs * 2 ** attempt + Math.random() * 100);
    }
  }
  throw lastError;
}

const rates = await callWithRetry(async (signal) => {
  const res = await fetch("https://api.exchange.example/rates", { signal });
  if (!res.ok) throw Object.assign(new Error("Upstream error"), { status: res.status });
  return res.json();
});
```

## 9. Stream a Large File / CSV Export

```js
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

router.get("/reports/users.csv", requireAuth, requireRole("admin"), async (req, res, next) => {
  res.attachment("users.csv");
  res.write("name,email,createdAt\n");
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;   // CSV escaping
  try {
    await pipeline(
      User.find().select("name email createdAt").lean().cursor(),
      new Transform({
        objectMode: true,
        transform(u, _e, cb) { cb(null, `${escape(u.name)},${escape(u.email)},${u.createdAt.toISOString()}\n`); },
      }),
      res,
    );
  } catch (err) { next(err); }
});
```

## 10. Simple In-Memory Cache Middleware With TTL

```js
export function cacheResponse(ttlMs = 60_000) {
  const store = new Map();
  return (req, res, next) => {
    if (req.method !== "GET") return next();
    const key = req.originalUrl;
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
      res.set("X-Cache", "HIT");
      return res.json(hit.body);
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) store.set(key, { body, expires: Date.now() + ttlMs });
      res.set("X-Cache", "MISS");
      return originalJson(body);
    };
    next();
  };
}

router.get("/categories", cacheResponse(5 * 60_000), listCategories);
```

**Follow-up:** in-memory caches are per-instance and lost on restart → Redis for multi-instance; and invalidate on writes.

## 11. Webhook Receiver With Signature Check and Deduplication

```js
router.post("/webhooks/razorpay", express.raw({ type: "*/*" }), asyncHandler(async (req, res) => {
  const signature = req.get("X-Razorpay-Signature") ?? "";
  const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(req.body).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(400).end();
  }
  const event = JSON.parse(req.body);

  // Providers retry → process each event id exactly once
  const firstTime = await ProcessedEvent.updateOne({ _id: event.id }, { $setOnInsert: { at: new Date() } }, { upsert: true });
  if (firstTime.upsertedCount === 0) return res.sendStatus(200);

  await jobs.add("payment-event", event);  // acknowledge fast, process in a worker
  res.sendStatus(200);
}));
```

## 12. Implement a Tiny Express (Middleware Chain)

A favourite "how does Express work?" question.

```js
import http from "node:http";

function tinyExpress() {
  const stack = [];
  const app = (req, res) => {
    let i = 0;
    const next = (err) => {
      const layer = stack[i++];
      if (!layer) {
        res.statusCode = err ? 500 : 404;
        return res.end(err ? "Internal error" : "Not found");
      }
      const { method, path, handler } = layer;
      const matches = (!method || method === req.method) && (!path || req.url.split("?")[0] === path);
      if (!matches) return next(err);
      try {
        if (err) return handler.length === 4 ? handler(err, req, res, next) : next(err); // error middleware
        if (handler.length === 4) return next();
        handler(req, res, next);
      } catch (e) {
        next(e);
      }
    };
    res.json = (data) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
    next();
  };
  app.use = (handler) => stack.push({ handler });
  app.get = (path, handler) => stack.push({ method: "GET", path, handler });
  app.post = (path, handler) => stack.push({ method: "POST", path, handler });
  app.listen = (...args) => http.createServer(app).listen(...args);
  return app;
}

const app = tinyExpress();
app.use((req, res, next) => { console.log(req.method, req.url); next(); });
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/boom", () => { throw new Error("boom"); });
app.use((err, req, res, next) => { res.statusCode = 500; res.json({ error: err.message }); });
app.listen(3000);
```

## 13. Event-Driven Order Flow With `EventEmitter`

```js
import { EventEmitter } from "node:events";
export const events = new EventEmitter();

// order.service.js
export async function placeOrder(userId, items) {
  const order = await Order.create({ userId, items, status: "placed" });
  events.emit("order.placed", order);      // the service does not know who listens
  return order;
}

// listeners/
events.on("order.placed", (order) => inventory.reserve(order.items).catch(logError));
events.on("order.placed", (order) => emailQueue.add("confirmation", { orderId: order.id }));
events.on("error", logError);              // an unhandled "error" event would crash the process
```

**Limits:** in-process only — lost on crash and not shared between instances. For reliability, publish to a queue (BullMQ, RabbitMQ, Kafka) instead.

## 🎯 Likely Interview Questions

1. **Write a CRUD API with validation and proper status codes.**
2. **Write an auth middleware and a role-check middleware.**
3. **Implement a rate limiter. How would it work across multiple servers?**
4. **Implement cursor pagination. Why is it better than `skip` for large collections?**
5. **How do you make a payment endpoint idempotent?**
6. **How would you export 1 million rows without running out of memory?**
7. **How does Express's `next()` chain work? Implement a mini version.**
8. **How do you handle errors in async route handlers in Express 4 vs 5?**

---

[← React Coding Questions](04-react-coding-questions.md) | [Index](../README.md) | [Next: JavaScript Scenarios →](../24-scenario-questions/01-javascript-scenarios.md)
