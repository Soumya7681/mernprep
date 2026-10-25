# Chapter 121 — Backend Machine Coding Tasks

## 📖 What Interviewers Are Testing

- **API design** — RESTful URLs, correct status codes.
- **Folder layering** — routes / controllers / services / models.
- **Auth handling** — JWT, role-based.
- **Validation & errors** — DTO or schema validation, consistent error format.
- **Async correctness** — `try/catch`, `Promise.all` where appropriate.

---

## Task — JWT-Protected CRUD API for an Items Resource

### Spec
- `POST /auth/register` (email, password)
- `POST /auth/login` → `{ accessToken }`
- `GET    /items` (auth)
- `POST   /items` (auth, body validation)
- `GET    /items/:id` (auth)
- `PATCH  /items/:id` (auth, only owner)
- `DELETE /items/:id` (auth, admin only)

## 📁 Folder Structure

```
src/
├── app.js
├── server.js
├── config/
│   ├── db.js
│   └── env.js
├── routes/
│   ├── auth.routes.js
│   └── items.routes.js
├── controllers/
│   ├── auth.controller.js
│   └── items.controller.js
├── services/
│   ├── auth.service.js
│   └── items.service.js
├── models/
│   ├── user.model.js
│   └── item.model.js
├── middlewares/
│   ├── auth.middleware.js
│   ├── role.middleware.js
│   ├── validate.middleware.js
│   └── error.middleware.js
├── utils/
│   ├── AppError.js
│   ├── asyncHandler.js
│   └── jwt.js
└── tests/
```

## 💻 Code — Models

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

```js
// models/item.model.js
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  title:    { type: String, required: true, minlength: 2 },
  body:     { type: String, default: "" },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

itemSchema.index({ owner: 1, createdAt: -1 });

export const Item = mongoose.model("Item", itemSchema);
```

## 💻 Code — Utils

```js
// utils/AppError.js
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code, isOperational: true });
  }
}

// utils/asyncHandler.js
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// utils/jwt.js
import jwt from "jsonwebtoken";
export const signAccess  = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });
export const verifyAccess = (token)   => jwt.verify(token, process.env.JWT_SECRET);
```

## 💻 Code — Middleware

```js
// middlewares/auth.middleware.js
import { AppError } from "../utils/AppError.js";
import { verifyAccess } from "../utils/jwt.js";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError(401, "NO_TOKEN", "Missing token");
  try {
    req.user = verifyAccess(header.slice(7));
    next();
  } catch {
    next(new AppError(401, "BAD_TOKEN", "Invalid or expired token"));
  }
}
```

```js
// middlewares/role.middleware.js
import { AppError } from "../utils/AppError.js";

export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return next(new AppError(403, "FORBIDDEN", "Insufficient permissions"));
  }
  next();
};
```

```js
// middlewares/validate.middleware.js
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: { code: "VALIDATION", details: result.error.flatten() } });
  }
  req.body = result.data;
  next();
};
```

```js
// middlewares/error.middleware.js
export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).json({
    error: { code: err.code || "INTERNAL", message: err.message },
  });
}
```

## 💻 Code — Auth Service & Controller

```js
// services/auth.service.js
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { signAccess } from "../utils/jwt.js";

export const AuthService = {
  async register({ email, password }) {
    if (await User.findOne({ email })) {
      throw new AppError(409, "EXISTS", "Email already in use");
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed });
    return { id: user.id, email: user.email };
  },

  async login({ email, password }) {
    const user = await User.findOne({ email }).select("+password");
    if (!user) throw new AppError(401, "BAD_CREDS", "Invalid credentials");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new AppError(401, "BAD_CREDS", "Invalid credentials");

    const accessToken = signAccess({ sub: user.id, role: user.role });
    return { accessToken };
  },
};
```

```js
// controllers/auth.controller.js
import { AuthService } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const AuthController = {
  register: asyncHandler(async (req, res) => {
    const user = await AuthService.register(req.body);
    res.status(201).json(user);
  }),

  login: asyncHandler(async (req, res) => {
    const tokens = await AuthService.login(req.body);
    res.json(tokens);
  }),
};
```

## 💻 Code — Items Service & Controller

```js
// services/items.service.js
import { Item } from "../models/item.model.js";
import { AppError } from "../utils/AppError.js";

export const ItemsService = {
  list({ page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    return Promise.all([
      Item.find().sort("-createdAt").skip(skip).limit(+limit),
      Item.countDocuments(),
    ]).then(([data, total]) => ({ data, meta: { page: +page, limit: +limit, total } }));
  },

  create(userId, dto) {
    return Item.create({ ...dto, owner: userId });
  },

  async get(id) {
    const item = await Item.findById(id);
    if (!item) throw new AppError(404, "NOT_FOUND", "Item not found");
    return item;
  },

  async update(id, userId, patch) {
    const item = await this.get(id);
    if (item.owner.toString() !== userId) {
      throw new AppError(403, "NOT_OWNER", "Only the owner can update");
    }
    Object.assign(item, patch);
    await item.save();
    return item;
  },

  async remove(id) {
    const result = await Item.findByIdAndDelete(id);
    if (!result) throw new AppError(404, "NOT_FOUND", "Item not found");
  },
};
```

```js
// controllers/items.controller.js
import { ItemsService } from "../services/items.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const ItemsController = {
  list:   asyncHandler(async (req, res) => res.json(await ItemsService.list(req.query))),
  create: asyncHandler(async (req, res) => res.status(201).json(await ItemsService.create(req.user.sub, req.body))),
  get:    asyncHandler(async (req, res) => res.json(await ItemsService.get(req.params.id))),
  update: asyncHandler(async (req, res) => res.json(await ItemsService.update(req.params.id, req.user.sub, req.body))),
  remove: asyncHandler(async (req, res) => { await ItemsService.remove(req.params.id); res.status(204).end(); }),
};
```

## 💻 Code — Routes

```js
// routes/auth.routes.js
import { Router } from "express";
import { z } from "zod";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";

const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

const router = Router();
router.post("/register", validate(RegisterSchema), AuthController.register);
router.post("/login",    validate(RegisterSchema), AuthController.login);

export default router;
```

```js
// routes/items.routes.js
import { Router } from "express";
import { z } from "zod";
import { ItemsController } from "../controllers/items.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const CreateItem = z.object({
  title:    z.string().min(2),
  body:     z.string().optional(),
  isPublic: z.boolean().optional(),
});
const UpdateItem = CreateItem.partial();

const router = Router();
router.use(authMiddleware);

router.get   ("/",    ItemsController.list);
router.post  ("/",    validate(CreateItem), ItemsController.create);
router.get   ("/:id", ItemsController.get);
router.patch ("/:id", validate(UpdateItem), ItemsController.update);
router.delete("/:id", requireRole("admin"), ItemsController.remove);

export default router;
```

## 💻 Code — App & Server

```js
// app.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import itemRoutes from "./routes/items.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.use("/api/auth",  authRoutes);
app.use("/api/items", itemRoutes);

app.use(errorHandler);
export default app;
```

```js
// server.js
import "dotenv/config";
import app from "./app.js";
import mongoose from "mongoose";

const port = process.env.PORT || 3000;

await mongoose.connect(process.env.MONGO_URL);
app.listen(port, () => console.log(`API on :${port}`));
```

## 🧪 Quick cURL Tests

```bash
# Register
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret12"}'

# Login → get access token
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret12"}' | jq -r .accessToken)

# Create
curl -X POST localhost:3000/api/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"World"}'

# List
curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/items
```

## 🎯 What to Say While Coding

- "I'll set up the folder structure first so we have a clear separation."
- "All routes go through `authMiddleware`, and admin-only routes layer on a role guard."
- "I'm using Zod for body validation — keeps it close to the route definition."
- "Errors are normalized through a single error middleware so the frontend has a consistent shape."

---

[← Frontend Tasks](01-frontend-tasks.md) | [Index](../README.md) | [Next: Authentication →](../07-system-design/01-authentication.md)
