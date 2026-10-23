# Chapter 52 — Error Handling

## 📖 Definition

Error handling is the strategy for catching, classifying, and responding to errors in a way that keeps the API predictable and the server alive.

## 🔍 Categories

| Category | Examples |
|----------|----------|
| **Operational** (expected) | Bad input, not found, conflict, timeout |
| **Programmer** (bug) | TypeError, ReferenceError, undefined access |
| **System** (host) | Out of memory, disk full |

Operational errors should be **handled gracefully**. Programmer errors should be **fixed** — if a server hits one, it's often safer to **crash and restart** than to keep limping.

## 💻 Code Example — Custom Error Class

```js
// utils/AppError.js
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;        // HTTP status (e.g., 404)
    this.code = code;            // machine code (e.g., "USER_NOT_FOUND")
    this.details = details;      // optional extras
    this.isOperational = true;   // marker so we don't restart on these
    Error.captureStackTrace(this, this.constructor);
  }
}
```

Usage:
```js
if (!user) throw new AppError(404, "USER_NOT_FOUND", "No user with id " + id);
```

## 💻 Code Example — Async Handler Wrapper

```js
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Usage
app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  res.json(user);
}));
```

## 💻 Code Example — Centralized Error Middleware

```js
// middlewares/error.middleware.js
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  // Convert known third-party errors into AppError
  if (err.name === "ValidationError") {
    err = new AppError(400, "VALIDATION_FAILED", err.message, err.errors);
  }
  if (err.name === "JsonWebTokenError") {
    err = new AppError(401, "INVALID_TOKEN", "Invalid token");
  }
  if (err.code === 11000) {  // Mongo duplicate key
    err = new AppError(409, "DUPLICATE", "Duplicate field value");
  }

  // Log
  if (!err.isOperational) {
    logger.error({ err, req: { method: req.method, url: req.url } });
  } else {
    logger.warn({ status: err.status, code: err.code, message: err.message });
  }

  // Respond
  res.status(err.status || 500).json({
    error: {
      code:    err.code    || "INTERNAL_ERROR",
      message: err.message || "Internal Server Error",
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
}
```

## 💻 Code Example — 404 Catch-All

```js
// Add AFTER all routes, BEFORE error handler
app.use((req, res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route ${req.url} not found`));
});

app.use(errorHandler);
```

## 💻 Code Example — Process-Level Handlers

```js
// server.js
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection — shutting down");
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

// SIGTERM for graceful shutdown (e.g., from Kubernetes)
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — closing");
  server.close(() => process.exit(0));
});
```

## 💻 Code Example — Try/Catch Inside async

```js
async function getUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new AppError(res.status, "FETCH_FAILED", "Upstream error");
    return await res.json();
  } catch (err) {
    if (err.isOperational) throw err;     // re-throw expected errors
    throw new AppError(500, "INTERNAL", "Unexpected failure");
  }
}
```

## 💻 Code Example — Validation Errors with Zod

```js
import { z } from "zod";

const CreateUserSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

app.post("/users", asyncHandler(async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_FAILED", "Invalid input", result.error.flatten());
  }
  const user = await UserService.create(result.data);
  res.status(201).json(user);
}));
```

## 💻 Code Example — Express Async Errors Library (alt)

If you don't want to wrap every handler in `asyncHandler`:

```js
import "express-async-errors";    // patches Express to forward async errors

app.get("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
  res.json(user);
});
```

## 🌍 Real-World Impact

- A consistent error format = predictable frontend handling.
- Process-level handlers + log aggregator (Datadog, Sentry) help triage production issues fast.
- Marking errors as "operational" vs "programmer" lets you crash safely only when needed.

## 🎯 Likely Interview Questions

1. **How do you handle errors in Express?**
2. **What's the difference between operational and programmer errors?**
3. **How do you handle async errors in Express?**
4. **What happens on `unhandledRejection`?** — Node defaults to logging and (in newer versions) terminating. Always attach a handler.
5. **How do you do graceful shutdown?**

---

[← MVC Architecture](06-mvc-architecture.md) | [Index](../README.md) | [Next: File Upload (S3) →](08-file-upload-s3.md)
