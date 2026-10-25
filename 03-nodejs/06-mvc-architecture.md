# Chapter 56 — MVC Architecture (and Service Layer)

## 📖 Definition

**MVC** is a separation-of-concerns pattern:
- **Model** — data + business rules.
- **View** — presentation (in APIs, this becomes JSON shaping).
- **Controller** — request handler that orchestrates models and produces a response.

In modern Node apps, a **Service** layer is added between Controller and Model to keep controllers thin and put business logic in services.

## 🔍 Layered Responsibilities

```
Request
   │
   ▼
[ Route ]   — URL → controller
   │
   ▼
[ Middleware ]  — auth, validation, logging
   │
   ▼
[ Controller ]  — parse input, call service, shape response
   │
   ▼
[ Service ]     — business logic, transactions, orchestration
   │
   ▼
[ Repository / Model ]  — DB access
   │
   ▼
[ Database ]
```

## 💻 Folder Structure (Express)

```
src/
├── app.js
├── server.js
├── config/
│   └── db.js
├── routes/
│   └── user.routes.js
├── controllers/
│   └── user.controller.js
├── services/
│   └── user.service.js
├── models/
│   └── user.model.js
├── middlewares/
│   ├── auth.middleware.js
│   ├── error.middleware.js
│   └── validation.middleware.js
├── utils/
│   ├── asyncHandler.js
│   └── logger.js
└── tests/
```

## 💻 Code Example — Model

```js
// models/user.model.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role:     { type: String, enum: ["admin", "user"], default: "user" },
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
```

## 💻 Code Example — Service

```js
// services/user.service.js
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";

export const UserService = {
  async create({ email, password }) {
    const existing = await User.findOne({ email });
    if (existing) throw new AppError(409, "USER_EXISTS", "Email already in use");

    const hashed = await bcrypt.hash(password, 10);
    return User.create({ email, password: hashed });
  },

  async findById(id) {
    const user = await User.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    return user;
  },

  async list({ page = 1, limit = 20 } = {}) {
    const [items, total] = await Promise.all([
      User.find().skip((page - 1) * limit).limit(limit),
      User.countDocuments(),
    ]);
    return { items, total, page, limit };
  },
};
```

## 💻 Code Example — Controller

```js
// controllers/user.controller.js
import { UserService } from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const UserController = {
  create: asyncHandler(async (req, res) => {
    const user = await UserService.create(req.body);
    res.status(201).json({ id: user.id, email: user.email });
  }),

  get: asyncHandler(async (req, res) => {
    const user = await UserService.findById(req.params.id);
    res.json(user);
  }),

  list: asyncHandler(async (req, res) => {
    const result = await UserService.list(req.query);
    res.json(result);
  }),
};
```

## 💻 Code Example — Routes

```js
// routes/user.routes.js
import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/",      UserController.create);
router.get("/",       authMiddleware, UserController.list);
router.get("/:id",    authMiddleware, UserController.get);

export default router;
```

## 💻 Code Example — App Setup

```js
// app.js
import express from "express";
import userRoutes from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(express.json());
app.use("/api/users", userRoutes);
app.use(errorHandler);                 // last

export default app;
```

```js
// server.js
import app from "./app.js";
import { connectDB } from "./config/db.js";

const port = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(port, () => console.log(`API on :${port}`));
});
```

## 💻 Code Example — Async Handler Utility

```js
// utils/asyncHandler.js
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

## 💻 Code Example — Error Class

```js
// utils/AppError.js
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
```

## 🔁 NestJS Equivalent (Same Pattern, Decorators)

```ts
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.userService.findById(id);
  }
}
```

NestJS enforces this layering at the framework level — see Chapter 38+.

## 🌍 Real-World Impact

- Thin controllers + fat services = easy testing.
- Services contain no HTTP concepts → reusable from CLI, cron jobs, GraphQL, etc.
- Single source of truth per concern → maintainable as the team grows.

## 🎯 Likely Interview Questions

1. **What is MVC?**
2. **Why add a service layer?** — Reusable, testable business logic; HTTP-agnostic.
3. **What goes in a controller vs a service?**
4. **How would you structure an Express project?**

---

[← REST Best Practices](05-rest-best-practices.md) | [Index](../README.md) | [Next: Error Handling →](07-error-handling.md)
