# Chapter 84 — Building a Typed Express Server

## 📖 Definition

Express's type definitions (`@types/express`) make `Request`, `Response` and `RequestHandler` **generic**. By filling in those generics, adding a custom error class and a central error handler, you get an API where params, body, query and response bodies are all checked by the compiler.

## 🔍 The Generics on `Request`

```ts
Request<Params, ResBody, ReqBody, ReqQuery>
Response<ResBody>
RequestHandler<Params, ResBody, ReqBody, ReqQuery>
```

| Generic | What it types | Default |
|---------|---------------|---------|
| `Params` | `req.params` (`/users/:id`) | `ParamsDictionary` (`Record<string, string>`) |
| `ResBody` | `res.json(...)` argument | `any` |
| `ReqBody` | `req.body` | `any` |
| `ReqQuery` | `req.query` | `ParsedQs` |

> `req.body` is `any` by default — this is the biggest hole in an untyped Express app. Pair the generic with runtime validation (see *Request Validation* below) so the type is actually *true*.

## 💻 Code Example — A Fully Typed Handler

```ts
import type { Request, Response } from "express";
import type { ApiResponse, PublicUser } from "@app/shared";
import { userService } from "./user.service.js";

type Params = { id: string };

export async function getUser(
  req: Request<Params>,
  res: Response<ApiResponse<PublicUser>>,
): Promise<void> {
  const user = await userService.findById(req.params.id);  // req.params.id: string
  res.json({ success: true, data: user });                 // checked against ApiResponse<PublicUser>
  // res.json({ success: true, data: user, password: "x" }) ❌ excess property error
}
```

```ts
// Body + query typing
type CreateUserBody = { email: string; name: string; password: string };
type ListQuery = { page?: string; limit?: string; search?: string };  // query values arrive as strings

export async function createUser(
  req: Request<{}, ApiResponse<PublicUser>, CreateUserBody>,
  res: Response<ApiResponse<PublicUser>>,
) {
  const user = await userService.create(req.body);
  res.status(201).json({ success: true, data: user });
}

export async function listUsers(
  req: Request<{}, unknown, unknown, ListQuery>,
  res: Response,
) {
  const page = Number(req.query.page ?? 1);
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  res.json(await userService.list({ page, limit, search: req.query.search }));
}
```

## 💻 Code Example — Custom Error Class

```ts
// utils/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype); // keeps instanceof working when targeting ES5
  }

  static badRequest(msg: string, details?: unknown) { return new AppError(400, msg, "BAD_REQUEST", details); }
  static unauthorized(msg = "Unauthorized")          { return new AppError(401, msg, "UNAUTHORIZED"); }
  static forbidden(msg = "Forbidden")                { return new AppError(403, msg, "FORBIDDEN"); }
  static notFound(entity = "Resource")               { return new AppError(404, `${entity} not found`, "NOT_FOUND"); }
  static conflict(msg: string)                        { return new AppError(409, msg, "CONFLICT"); }
}
```

## 💻 Code Example — Async Errors: Express 4 vs Express 5

```ts
// Express 4: a rejected promise in a handler is NOT caught → unhandled rejection, request hangs.
// Fix with a typed wrapper:
import type { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  <P, ResB, ReqB, Q>(
    fn: (req: Request<P, ResB, ReqB, Q>, res: Response<ResB>, next: NextFunction) => Promise<unknown>,
  ): RequestHandler<P, ResB, ReqB, Q> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

router.get("/:id", asyncHandler(getUser));
```

**Express 5** (stable since 2024) forwards rejected promises from handlers to `next(err)` automatically — so `asyncHandler` is no longer required. Interviewers love asking about this difference.

Other Express 5 changes worth knowing: `req.query` is a getter (read-only), path syntax changed (`/*splat` instead of `/*`, no `?` optional chars — use `{/:optional}`), `res.status()` only accepts valid codes, and `req.body` is `undefined` (not `{}`) when no body parser ran.

## 💻 Code Example — Central Error Handler

```ts
// middleware/error.ts
import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: { success: false; code: string; message: string; details?: unknown } = {
    success: false,
    code: "INTERNAL",
    message: "Something went wrong",
  };

  if (err instanceof AppError) {
    status = err.statusCode;
    body = { success: false, code: err.code, message: err.message, details: err.details };
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    body = { success: false, code: "VALIDATION", message: err.message };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    body = { success: false, code: "BAD_ID", message: `Invalid ${err.path}` };
  } else if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
    status = 409;
    body = { success: false, code: "DUPLICATE", message: "Resource already exists" };
  }

  if (status >= 500) console.error(err);                       // log real bugs, not 4xx noise
  if (env.NODE_ENV !== "production" && status >= 500 && err instanceof Error) {
    body.details = err.stack;                                  // never leak stacks in prod
  }
  res.status(status).json(body);
};
```

Error middleware is recognised by having **four parameters** — typing it as `ErrorRequestHandler` keeps the arity and gives you `err: any`, which you then narrow.

## 💻 Code Example — Augmenting `Request` (e.g. `req.user`)

```ts
// src/types/express.d.ts
import type { Role } from "@app/shared";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
      requestId?: string;
    }
  }
}

export {};   // makes this file a module so `declare global` is allowed
```

Make sure the file is covered by `include` in `tsconfig.json`. Now every handler sees `req.user` without casting.

## 💻 Code Example — Request Validation with express-validator

TypeScript types disappear at runtime, so the server must check every incoming body. **express-validator** is the most common choice in Express apps; it declares rules as middleware chains.

```ts
// middleware/validate.ts
import type { RequestHandler } from "express";
import { validationResult, type ValidationChain } from "express-validator";
import { AppError } from "../utils/AppError.js";

// Runs every rule, then fails with one 400 containing all field errors
export const validate =
  (rules: ValidationChain[]): RequestHandler =>
  async (req, _res, next) => {
    await Promise.all(rules.map((rule) => rule.run(req)));
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const details = result.array().map((e) => ({
      field: e.type === "field" ? e.path : e.type,
      message: e.msg as string,
    }));
    next(AppError.badRequest("Invalid input", details));
  };
```

```ts
// modules/users/user.validators.ts
import { body, param } from "express-validator";
import { ROLES } from "@app/shared";

export const idParam = [param("id").isMongoId().withMessage("Invalid id")];

export const createUserRules = [
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
  body("name").trim().isLength({ min: 2, max: 80 }),
  body("password").isStrongPassword({ minLength: 8, minSymbols: 0 })
    .withMessage("Min 8 chars with upper, lower and a number"),
  body("role").optional().isIn(ROLES),
];

export const updateUserRules = [
  ...idParam,
  body("name").optional().trim().isLength({ min: 2, max: 80 }),
  body("role").optional().isIn(ROLES),
  body(["password", "email"]).not().exists().withMessage("Use the dedicated endpoint"),
];
```

Reading only validated fields with `matchedData` — anything the client sent that has no rule (like `isAdmin: true`) is dropped, which blocks **mass-assignment** attacks:

```ts
import { matchedData } from "express-validator";
import type { CreateUserDto } from "@app/shared";

export async function createUser(req: Request, res: Response<ApiResponse<PublicUser>>) {
  const dto = matchedData(req, { locations: ["body"] }) as CreateUserDto;
  const user = await userService.create(dto);
  res.status(201).json({ success: true, data: user });
}
```

### Without a library — a hand-written type guard

For small payloads a type guard is enough, and it shows interviewers you understand that the *guard* is what makes the type true:

```ts
import type { CreateUserDto } from "@app/shared";

export function isCreateUserDto(v: unknown): v is CreateUserDto {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.email === "string" && /^\S+@\S+\.\S+$/.test(o.email) &&
    typeof o.name === "string" && o.name.trim().length >= 2 &&
    typeof o.password === "string" && o.password.length >= 8
  );
}

// in a handler
if (!isCreateUserDto(req.body)) throw AppError.badRequest("Invalid user payload");
req.body.email;   // narrowed to string here
```

| Option | Good for |
|--------|----------|
| express-validator | Express APIs, field-level messages, sanitisers (`trim`, `normalizeEmail`) |
| class-validator + DTO classes | NestJS (`ValidationPipe`) |
| Mongoose schema validators | Last line of defence at the DB layer — not a replacement for request validation |
| Hand-written type guards | Small payloads, no extra dependency |

## 💻 Code Example — Typed Router

```ts
// modules/users/user.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createUserRules, updateUserRules, idParam } from "./user.validators.js";
import * as ctrl from "./user.controller.js";

export const userRouter = Router();

userRouter.get("/", requireAuth, ctrl.listUsers);
userRouter.get("/:id", requireAuth, validate(idParam), ctrl.getUser);
userRouter.post("/", requireAuth, requireRole("admin"), validate(createUserRules), ctrl.createUser);
userRouter.patch("/:id", requireAuth, validate(updateUserRules), ctrl.updateUser);
userRouter.delete("/:id", requireAuth, requireRole("admin"), validate(idParam), ctrl.deleteUser);
```

## 💻 Code Example — Typed Request-ID & Logging Middleware

```ts
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};

export const timing: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};
```

## 🌍 Real-World Impact

- A consistent error envelope `{ success, code, message, details }` lets the React client handle every failure with one function.
- Typed `res.json` prevents leaking fields like `password` — the compiler rejects them.
- Request IDs let you trace one user's failing call across logs from multiple services.

## 🎯 Likely Interview Questions

1. **How do you type `req.body` in Express?** — Use the `Request<P, ResBody, ReqBody, Query>` generics **and** validate at runtime (express-validator / type guard); generics alone are just a promise.
2. **What is mass assignment and how do you prevent it?** — Client sends extra fields (`role: "admin"`) that get written straight to the DB. Whitelist with `matchedData()` or explicit DTO mapping.
3. **How do you add `req.user` with TypeScript?** — Global declaration merging on `Express.Request`.
4. **How are async errors handled in Express 4 vs 5?** — 4 needs try/catch or an `asyncHandler` wrapper; 5 forwards rejected promises to `next` automatically.
5. **How does Express know a middleware is an error handler?** — It has 4 arguments `(err, req, res, next)`.
6. **Why a custom `AppError` class?** — Distinguishes expected (operational) errors with status codes from unexpected bugs; drives the central handler.
7. **How do you handle Mongo duplicate key errors?** — Detect `code === 11000` and return 409.
8. **What's wrong with `res.json(user)` straight from Mongoose?** — May leak hidden fields, includes `__v`, `_id` vs `id` mismatch; map to a DTO.

---

[← Project Setup & Architecture](02-project-setup-architecture.md) | [Index](../README.md) | [Next: Mongoose with TypeScript →](04-mongoose-typescript.md)
