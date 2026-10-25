# Chapter 126 — API Security

## 📖 Goal

Make APIs robust against the most common attack classes (OWASP Top 10) without sacrificing developer velocity.

## 🛡️ Defense-in-Depth Checklist

| Concern | Defense |
|---------|---------|
| Sniffing | HTTPS everywhere (HSTS) |
| Injection (SQL/NoSQL) | Parameterized queries, ODM/ORM, validation |
| XSS | Escape output, CSP, sanitize HTML |
| CSRF | SameSite cookies + CSRF tokens for non-idempotent requests |
| Mass assignment | Whitelist DTO fields |
| Broken auth | Strong password hashing, MFA, account lockout |
| Sensitive data exposure | TLS, encryption at rest, don't log PII |
| Broken access control | Centralized authorization checks |
| Rate / DoS | Rate limiting, request size limits, circuit breakers |
| Logging gaps | Structured logs without secrets, alerts |
| Misconfiguration | Helmet, CORS allowlist, no default creds |
| Insecure deserialization | Validate JSON shape; avoid `eval`/`Function` on input |
| Vulnerable deps | `npm audit`, Snyk, automated updates |
| Insufficient logging | Audit log for sensitive actions |

## 💻 Code Example — Express Security Baseline

```js
import express from "express";
import helmet  from "helmet";
import cors    from "cors";
import rateLimit from "express-rate-limit";

const app = express();

// HTTP headers
app.use(helmet());

// JSON body cap
app.use(express.json({ limit: "1mb" }));

// CORS allowlist
app.use(cors({
  origin: ["https://app.example.com"],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

// Global rate limit
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Auth-specific limit
app.use("/api/auth", rateLimit({ windowMs: 15*60*1000, max: 5 }));

app.use("/api", apiRoutes);
```

## 💻 Code Example — NoSQL Injection (and Defense)

```js
// ❌ Vulnerable — body is { email: { $ne: null } }
User.findOne({ email: req.body.email });

// ✅ Coerce to string first
User.findOne({ email: String(req.body.email) });

// ✅ Or validate with Zod / DTO
const schema = z.object({ email: z.string().email(), password: z.string() });
const parsed = schema.parse(req.body);
User.findOne({ email: parsed.email });
```

## 💻 Code Example — Mass Assignment Protection

```js
// ❌ Caller could set role: "admin"
User.create(req.body);

// ✅ Whitelist fields
const { email, password, name } = req.body;
User.create({ email, password, name });

// or in Nest:
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

## 💻 Code Example — Password Hashing

```js
import bcrypt from "bcrypt";

const hash = await bcrypt.hash(password, 12);     // cost factor 12
const ok   = await bcrypt.compare(input, user.password);
```

For higher security needs, use **argon2id**:
```js
import argon2 from "argon2";
const hash = await argon2.hash(password, { type: argon2.argon2id });
```

## 💻 Code Example — CSRF Protection (Cookie-Based Auth)

```js
import csrf from "csurf";

app.use(csrf({ cookie: true }));

app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Frontend includes the token in X-CSRF-Token header for POST/PUT/DELETE
```

For JWT-in-Authorization-header auth, CSRF is less of a concern because cookies aren't automatically sent with `Authorization` requests.

## 💻 Code Example — Security Headers (manual)

```js
res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
res.set("X-Content-Type-Options", "nosniff");
res.set("X-Frame-Options", "DENY");
res.set("Referrer-Policy", "strict-origin-when-cross-origin");
res.set("Permissions-Policy", "geolocation=(), camera=()");
res.set(
  "Content-Security-Policy",
  "default-src 'self'; img-src 'self' data:; script-src 'self'"
);
```

`helmet()` adds all of these by default.

## 💻 Code Example — Cookie Hardening

```js
res.cookie("refresh", token, {
  httpOnly: true,            // not accessible via JS — XSS-safe
  secure:   true,            // HTTPS only
  sameSite: "strict",        // CSRF protection
  path:     "/api/auth",     // limit which paths send it
  maxAge:   7 * 24 * 60 * 60 * 1000,
});
```

## 💻 Code Example — Input Limits

```js
// Body size
app.use(express.json({ limit: "100kb" }));

// Param length
app.param("id", (req, res, next, val) => {
  if (val.length > 64) return res.status(400).end();
  next();
});

// File upload size — done by Multer (see Chapter 35)
```

## 💻 Code Example — Logging Without Secrets

```js
import pino from "pino";

const logger = pino({
  redact: {
    paths: ["req.headers.authorization", "req.body.password", "req.body.token"],
    censor: "[redacted]",
  },
});
```

## 💻 Code Example — Audit Log

```js
async function audit(req, action, target) {
  await AuditLog.create({
    actorId: req.user.id,
    action,                    // e.g., "DELETE_USER"
    target,                    // e.g., "user:abc123"
    ip: req.ip,
    userAgent: req.get("user-agent"),
    at: new Date(),
  });
}

router.delete("/users/:id", requireRole("admin"), async (req, res) => {
  await UserService.remove(req.params.id);
  await audit(req, "DELETE_USER", `user:${req.params.id}`);
  res.status(204).end();
});
```

## 💻 Code Example — Dependency Auditing

```bash
npm audit
npm audit fix --force        # only after reviewing breaking changes

# CI integration
npx audit-ci --moderate

# Snyk
npx snyk test
```

## 💻 Code Example — Secrets Management

```js
// ❌ Never
const apiKey = "sk_live_abc123";

// ✅ Environment variable
const apiKey = process.env.STRIPE_API_KEY;

// ✅ Or a secrets manager (AWS Secrets Manager, HashiCorp Vault)
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient();
const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: "stripe" }));
const { apiKey } = JSON.parse(SecretString);
```

Never commit `.env`. Use `.env.example` for templates.

## 💻 Code Example — Login Brute-Force Protection

- Rate-limit `/login` aggressively (5 attempts / 15 min per IP + per email).
- Add **account lockout** after N failed attempts (with a cooldown).
- Use **CAPTCHA** after a few failures.
- Send "suspicious activity" emails on new device logins.

## 🎯 Likely Interview Questions

1. **How do you secure a Node.js API?**
2. **What's CORS, and how do you configure it?** — Browser security model that restricts cross-origin XHR. Set `Access-Control-Allow-Origin` to an allowlist (never `*` with credentials).
3. **How do you prevent SQL/NoSQL injection?**
4. **Where do you store secrets?**
5. **What's the difference between authentication and authorization?**
6. **What's CSRF and how do you prevent it?**

---

[← Monolith vs Microservices](04-monolith-vs-microservices.md) | [Index](../README.md) | [Next: Coding Question Tracker →](../11-dsa-coding-questions.md)
