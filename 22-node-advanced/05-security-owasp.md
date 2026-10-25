# Chapter 65 — Node Security (OWASP)

## 📖 Definition

The **OWASP Top 10** is the industry list of the most critical web application security risks. For a Node/Express/MongoDB backend, securing the API means: correct **authentication and authorisation**, **input validation**, protection against **injection**, safe **secrets and configuration**, **secure headers**, **rate limiting**, and keeping **dependencies** patched.

## 🔍 OWASP Top 10 Mapped to a MERN API

| Risk | What it looks like in MERN | Defence |
|---|---|---|
| **Broken access control** | `GET /api/orders/:id` returns anyone's order | Check ownership/role on every request |
| **Cryptographic failures** | Plain-text passwords, HTTP, weak JWT secret | bcrypt/argon2, HTTPS, strong secrets, `HttpOnly` cookies |
| **Injection** | NoSQL injection `{ "$gt": "" }`, command injection | Validate types, sanitise, never build queries from raw input |
| **Insecure design** | No limits on password reset attempts | Threat model; rate limits; idempotency |
| **Security misconfiguration** | Stack traces in responses, `cors({ origin: "*" })` with credentials | Helmet, strict CORS, generic errors in prod |
| **Vulnerable components** | Old packages with known CVEs | `npm audit`, Dependabot, lockfile |
| **Identification & auth failures** | No brute-force protection, long-lived tokens | Rate limits, MFA, short access tokens + rotation |
| **Software & data integrity** | Unsigned webhooks accepted | Verify signatures (Stripe, Razorpay) |
| **Logging & monitoring failures** | Breach unnoticed for months | Audit logs, alerts on suspicious activity |
| **SSRF** | `POST /fetch-url` lets attackers hit `169.254.169.254` | Allow-list hosts, block private IP ranges |

## 💻 Code Example — Broken Access Control (IDOR) and the Fix

```js
// ❌ Any logged-in user can read any order by guessing IDs
app.get("/api/orders/:id", auth, async (req, res) => {
  res.json(await Order.findById(req.params.id));
});

// ✅ Scope the query to the owner (admins bypass explicitly)
app.get("/api/orders/:id", auth, async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== "admin") filter.userId = req.user.id;
  const order = await Order.findOne(filter);
  if (!order) return res.status(404).json({ message: "Order not found" }); // 404, not 403: do not reveal existence
  res.json(order);
});
```

## 💻 Code Example — NoSQL Injection

```js
// ❌ Attacker sends: { "email": "admin@x.com", "password": { "$ne": null } }
const user = await User.findOne({ email: req.body.email, password: req.body.password });

// ✅ 1. Validate types with a schema
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const { email, password } = loginSchema.parse(req.body);

// ✅ 2. Never compare passwords in the query — hash comparison in code
const user = await User.findOne({ email }).select("+password");
const ok = user && (await bcrypt.compare(password, user.password));

// ✅ 3. Defence in depth: strip keys starting with $ or containing "."
//    Mongoose's sanitizeFilter option: mongoose.set("sanitizeFilter", true);
```

Also never pass user input to `$where`, `$function` or `$expr` with JavaScript, and whitelist sort/filter fields:

```js
const SORTABLE = new Set(["price", "createdAt", "rating"]);
const sortField = SORTABLE.has(req.query.sort) ? req.query.sort : "createdAt";
```

## 💻 Code Example — Mass Assignment

```js
// ❌ User sends { "name": "x", "role": "admin", "isVerified": true }
await User.findByIdAndUpdate(req.user.id, req.body);

// ✅ Pick allowed fields explicitly
const { name, avatar, bio } = profileSchema.parse(req.body);
await User.findByIdAndUpdate(req.user.id, { name, avatar, bio }, { runValidators: true });
```

## 💻 Code Example — Security Baseline for Express

```js
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import hpp from "hpp";

app.disable("x-powered-by");
app.set("trust proxy", 1);                         // behind a load balancer, for correct req.ip
app.use(helmet());                                 // CSP, HSTS, X-Frame-Options, noSniff…
app.use(cors({ origin: process.env.ALLOWED_ORIGINS.split(","), credentials: true }));
app.use(express.json({ limit: "100kb" }));         // stop huge payload DoS
app.use(hpp());                                    // HTTP parameter pollution (?role=a&role=b)
app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 10 }));

// Generic errors in production — log details, return no stack traces
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path });
  const status = err.status ?? 500;
  res.status(status).json({ message: status < 500 ? err.message : "Internal server error" });
});
```

## 💻 Code Example — Passwords and Tokens

```js
import bcrypt from "bcrypt";
const hash = await bcrypt.hash(password, 12);            // cost factor 12+

// JWT: short expiry, explicit algorithm, strong secret from env
const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
  expiresIn: "15m",
  algorithm: "HS256",
});
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }); // prevents "alg: none"

// Password reset tokens: random, single-use, hashed in DB, short expiry
const raw = crypto.randomBytes(32).toString("hex");
user.resetTokenHash = crypto.createHash("sha256").update(raw).digest("hex");
user.resetTokenExpires = Date.now() + 15 * 60_000;
// Respond the same way whether or not the email exists (prevents user enumeration)
```

## 💻 Code Example — Verifying a Webhook Signature

```js
app.post("/webhooks/payment", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.get("X-Signature");
  const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(req.body).digest("hex");

  const valid =
    signature &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); // constant-time compare
  if (!valid) return res.status(400).end();

  const event = JSON.parse(req.body);
  // process idempotently using event.id
  res.sendStatus(200);
});
```

## 💻 Code Example — Safe File Uploads

```js
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    cb(null, ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)),
});
// Also: check magic bytes (file-type package), rename files (never trust the original name),
// store outside the web root or in S3, and scan for malware if users share files.
```

## 🔍 Other Must-Knows

- **Path traversal:** `path.join(UPLOAD_DIR, req.params.name)` with `../../etc/passwd` → resolve and verify the result stays inside `UPLOAD_DIR`.
- **Command injection:** never `exec(\`convert ${userFile}\`)`; use `execFile` with an argument array.
- **ReDoS:** catastrophic-backtracking regexes on user input freeze the event loop; use tested libraries (validator.js) and limit input length.
- **Secrets:** in env vars or a secrets manager, never in Git; rotate after leaks; different secrets per environment.
- **Prototype pollution:** avoid deep-merging untrusted JSON into objects; validate with schemas.

## 🌍 Real-World Use

Most real breaches in small MERN apps are **IDOR** (missing ownership checks), **leaked secrets** in public repos, and **unprotected admin routes** — not exotic exploits. A checklist review of every route catches most of them.

## 🎯 Likely Interview Questions

1. **What is the OWASP Top 10? Give three examples relevant to Node.**
2. **What is NoSQL injection and how do you prevent it?**
3. **What is IDOR / broken access control? How do you prevent it?**
4. **How do you store passwords? Why bcrypt and not SHA-256?**
5. **What does Helmet do?**
6. **How do you secure file uploads?**
7. **How do you verify a payment webhook is genuine?**
8. **What is mass assignment?**
9. **How do you manage secrets across environments?**

---

[← Redis Caching & Job Queues](04-redis-caching-queues.md) | [Index](../README.md) | [Next: Logging, Observability & Graceful Shutdown →](06-logging-observability-shutdown.md)
