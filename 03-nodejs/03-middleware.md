# Chapter 48 — Middleware

## 📖 Definition

Middleware is a function that has access to the request, the response, and a `next` callback in the application's request-response cycle. It can perform work, modify req/res, send a response, or pass control onward.

## 🔍 Explanation

Express middleware signature:
```js
function middleware(req, res, next) { … }
```

Error-handling middleware has **four** parameters (Express detects the arity):
```js
function errorHandler(err, req, res, next) { … }
```

Middleware runs **in order** — every `app.use` or route-specific middleware is pushed onto a stack.

## 💻 Code Example — Basic Middleware

```js
import express from "express";
const app = express();

// Built-in
app.use(express.json());                     // parses JSON bodies
app.use(express.urlencoded({ extended: true }));

// Custom — logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();                                     // pass control
});

app.get("/", (req, res) => res.send("Hello"));

app.listen(3000);
```

## 💻 Code Example — Auth Middleware

```js
import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = payload;                       // attach for downstream handlers
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Apply only to /api
app.use("/api", authMiddleware);
```

## 💻 Code Example — Role-Based Authorization

```js
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

app.delete("/api/users/:id", authMiddleware, requireRole("admin"), deleteUser);
```

## 💻 Code Example — Validation Middleware

```js
import { body, validationResult } from "express-validator";

const validateUser = [
  body("email").isEmail(),
  body("password").isLength({ min: 8 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

app.post("/register", validateUser, registerHandler);
```

## 💻 Code Example — Async Middleware (Error Forwarding)

```js
// Wrapper that catches rejected promises and forwards to error handler
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Usage
app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "User not found");
  res.json(user);
}));
```

## 💻 Code Example — Centralized Error Handler

```js
class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
});
```

> The error handler MUST be defined **after** all routes and **with 4 parameters**.

## 💻 Code Example — Conditional Middleware

```js
function corsForApi(req, res, next) {
  if (req.path.startsWith("/api")) {
    res.set("Access-Control-Allow-Origin", "*");
  }
  next();
}

app.use(corsForApi);
```

## 💻 Code Example — Third-Party Middleware Stack

```js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";

const app = express();

app.use(helmet());                            // secure headers
app.use(cors({ origin: ["https://app.example.com"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));                  // access logs
app.use(compression());                       // gzip responses
app.use("/api/auth", rateLimit({ windowMs: 15*60*1000, max: 5 }));

app.use("/api", apiRoutes);
app.use(errorHandler);
```

## 🌍 Real-World Impact

- Middleware separates **cross-cutting concerns** from business logic.
- Order matters — `helmet` and `cors` should come first; error handlers last.
- In NestJS, the same pattern is reinforced via **guards**, **interceptors**, and **pipes** (see Chapter 41).

## 🎯 Likely Interview Questions

1. **What is middleware?**
2. **What is the signature of error-handling middleware in Express?**
3. **How do you handle async errors in Express?**
4. **In what order does middleware run?**
5. **Difference between middleware in Express vs guards in NestJS?**

---

[← async/await](02-async-await.md) | [Index](../README.md) | [Next: JWT Authentication →](04-jwt-auth.md)
