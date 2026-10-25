# Chapter 51 — REST API Best Practices

## 📖 Definition

REST (Representational State Transfer) is an architectural style for APIs that uses HTTP verbs, resource-based URLs, and stateless interactions.

## 🔍 Core Rules

| Principle | Description |
|-----------|-------------|
| Resource-based | URLs name **nouns**, not actions |
| Stateless | Each request carries everything needed |
| Uniform interface | Use standard HTTP verbs + status codes |
| Cacheable | Use `Cache-Control`, `ETag` |
| Layered | Client → CDN → API gateway → service — each layer transparent |

## 🌐 HTTP Verbs → Operations

| Verb | Operation | Idempotent? | Safe? |
|------|-----------|-------------|------|
| `GET`    | Read         | ✅ | ✅ |
| `POST`   | Create / RPC | ❌ | ❌ |
| `PUT`    | Replace      | ✅ | ❌ |
| `PATCH`  | Partial update | ❌ (depends) | ❌ |
| `DELETE` | Remove       | ✅ | ❌ |

## 💻 Code Example — Good vs Bad URL Design

| ❌ Bad | ✅ Good |
|--------|--------|
| `/getUsers` | `GET /users` |
| `/createOrder` | `POST /orders` |
| `/deleteUser?id=5` | `DELETE /users/5` |
| `/users/5/getOrders` | `GET /users/5/orders` |
| `/users-list` | `GET /users` |
| `/UpdateUserStatusToActive` | `PATCH /users/5 { status: "active" }` |

## 📊 Common Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 OK | Success | `GET`, `PUT`, `PATCH`, `DELETE` returning data |
| 201 Created | Resource created | `POST` |
| 204 No Content | Success, empty body | `DELETE`, sometimes `PUT` |
| 301 / 302 | Redirect | Moved |
| 400 Bad Request | Validation failed | Body / params invalid |
| 401 Unauthorized | Missing / invalid auth | No token |
| 403 Forbidden | Authenticated but not allowed | Wrong role |
| 404 Not Found | Resource doesn't exist | Bad id |
| 409 Conflict | State conflict | Email already exists |
| 422 Unprocessable | Semantic validation failed | Some APIs prefer this over 400 |
| 429 Too Many Requests | Rate limit | Throttled |
| 500 Internal Server Error | Unhandled exception | Bug |
| 503 Service Unavailable | Down for maintenance | Deploy / overload |

## 💻 Code Example — Express CRUD Routes

```js
import express from "express";
import { User } from "./models/user.js";

const router = express.Router();

// List with pagination
router.get("/", async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const users = await User.find()
    .skip((page - 1) * limit)
    .limit(+limit);
  res.json(users);
});

// Read one
router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// Create
router.post("/", async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(user);
});

// Partial update
router.patch("/:id", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// Delete
router.delete("/:id", async (req, res) => {
  const result = await User.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
```

## 💻 Code Example — Consistent Error Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Email is required",
    "details": { "field": "email" }
  }
}
```

```js
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: {
      code:    err.code    || "INTERNAL_ERROR",
      message: err.message || "Internal Server Error",
      ...(err.details && { details: err.details }),
    },
  });
});
```

## 💻 Code Example — Pagination Patterns

```js
// Offset
GET /users?page=2&limit=20
// {
//   data: [...],
//   page: 2,
//   limit: 20,
//   total: 152
// }

// Cursor
GET /messages?after=63f0…&limit=20
// {
//   data: [...],
//   nextCursor: "640a…"
// }
```

## 💻 Code Example — Filtering & Sorting

```js
GET /products?category=books&minPrice=100&maxPrice=500&sort=-createdAt
```

```js
router.get("/products", async (req, res) => {
  const { category, minPrice, maxPrice, sort = "-createdAt" } = req.query;
  const query = {};
  if (category) query.category = category;
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = +minPrice;
    if (maxPrice) query.price.$lte = +maxPrice;
  }
  const data = await Product.find(query).sort(sort).limit(50);
  res.json(data);
});
```

## 💻 Code Example — Versioning

```
/api/v1/users
/api/v2/users
```
Or via header:
```
Accept: application/vnd.app.v2+json
```

URL versioning is simpler and more visible — preferred for most REST APIs.

## 💻 Code Example — Idempotency Key (Safe POSTs)

```js
// Client sends a unique key with a POST to avoid duplicate creation on retry
POST /orders
Idempotency-Key: f9d8…
```

```js
async function createOrder(req, res) {
  const key = req.headers["idempotency-key"];
  if (!key) return res.status(400).json({ error: "Missing Idempotency-Key" });

  const cached = await IdempotencyCache.findOne({ key });
  if (cached) return res.json(cached.response);

  const order = await Order.create(req.body);
  await IdempotencyCache.create({ key, response: order });
  res.status(201).json(order);
}
```

## 🌍 Real-World Impact

- Consistent APIs make your frontends faster to build.
- Status codes done right = fewer ambiguous bugs.
- Cursor pagination scales infinitely; offset breaks past page 1000+.

## 🎯 Likely Interview Questions

1. **What is REST?**
2. **Difference between PUT and PATCH?**
3. **Difference between 401 and 403?**
4. **How do you version a REST API?**
5. **What is idempotency? Which methods are idempotent?**

---

[← JWT Authentication](04-jwt-auth.md) | [Index](../README.md) | [Next: MVC Architecture →](06-mvc-architecture.md)
