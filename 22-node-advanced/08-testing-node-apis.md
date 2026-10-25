# Chapter 64 — Testing Node APIs

## 📖 Definition

Testing a Node API means verifying that services and HTTP endpoints behave correctly. **Unit tests** check one function in isolation (dependencies mocked). **Integration tests** call real HTTP routes through **Supertest** against a real (in-memory or containerised) **MongoDB**. Common runners are **Jest**, **Vitest** and Node's built-in `node:test`.

## 🔍 What to Test Where

| Layer | Test type | Mock what? |
|---|---|---|
| Pure helpers (price calc, validators) | Unit | Nothing |
| Services (business rules) | Unit | Repositories / external APIs |
| Routes + middleware + DB | Integration (Supertest) | Only external services (payments, email) |
| Whole system | E2E | Nothing (staging environment) |

Integration tests give the most confidence per test for APIs — they catch wrong status codes, missing auth, validation gaps and query bugs.

## 💻 Code Example — Make the App Testable

Export the app separately from `listen()` so tests can import it without opening a port:

```js
// app.js
import express from "express";
export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use(errorHandler);
  return app;
}

// server.js
import { createApp } from "./app.js";
await mongoose.connect(process.env.MONGO_URI);
createApp().listen(3000);
```

## 💻 Code Example — Test Database With `mongodb-memory-server`

```js
// test/setup.js
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  // clean data between tests so they are independent
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
```

For transactions you need a replica set: `MongoMemoryReplSet.create({ replSet: { count: 1 } })`. Many teams use Testcontainers with a real MongoDB image instead.

## 💻 Code Example — Integration Tests With Supertest

```js
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

async function loginAs(role = "user") {
  await request(app).post("/api/auth/register").send({ email: `${role}@t.com`, password: "secret123", role });
  const res = await request(app).post("/api/auth/login").send({ email: `${role}@t.com`, password: "secret123" });
  return res.body.accessToken;
}

describe("POST /api/products", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/products").send({ name: "Pen", price: 10 });
    expect(res.status).toBe(401);
  });

  it("forbids non-admin users", async () => {
    const token = await loginAs("user");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pen", price: 10 });
    expect(res.status).toBe(403);
  });

  it("validates the body", async () => {
    const token = await loginAs("admin");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "", price: -5 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "price" })]),
    );
  });

  it("creates a product", async () => {
    const token = await loginAs("admin");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pen", price: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Pen", price: 10 });
    expect(await Product.countDocuments()).toBe(1);
  });
});
```

## 💻 Code Example — Unit Test a Service With a Mock

```js
// order.service.js
export class OrderService {
  constructor({ orderRepo, paymentGateway, emailQueue }) {
    Object.assign(this, { orderRepo, paymentGateway, emailQueue });
  }
  async checkout(userId, cart) {
    if (!cart.items.length) throw new BadRequestError("Cart is empty");
    const total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
    const payment = await this.paymentGateway.charge(userId, total);
    const order = await this.orderRepo.create({ userId, items: cart.items, total, paymentId: payment.id });
    await this.emailQueue.add("order-confirmation", { orderId: order.id });
    return order;
  }
}
```

```js
// order.service.test.js
import { vi } from "vitest";

it("charges the total and queues a confirmation email", async () => {
  const deps = {
    orderRepo: { create: vi.fn(async (o) => ({ id: "o1", ...o })) },
    paymentGateway: { charge: vi.fn(async () => ({ id: "pay_1" })) },
    emailQueue: { add: vi.fn() },
  };
  const service = new OrderService(deps);

  const order = await service.checkout("u1", { items: [{ price: 100, qty: 2 }] });

  expect(deps.paymentGateway.charge).toHaveBeenCalledWith("u1", 200);
  expect(order.paymentId).toBe("pay_1");
  expect(deps.emailQueue.add).toHaveBeenCalledWith("order-confirmation", { orderId: "o1" });
});

it("does not charge when the cart is empty", async () => {
  const deps = { orderRepo: {}, paymentGateway: { charge: vi.fn() }, emailQueue: {} };
  await expect(new OrderService(deps).checkout("u1", { items: [] })).rejects.toThrow("Cart is empty");
  expect(deps.paymentGateway.charge).not.toHaveBeenCalled();
});
```

Constructor injection makes mocking trivial — no `jest.mock` module hacks needed.

## 💻 Code Example — Mocking External HTTP Calls

```js
import nock from "nock";

nock("https://api.payments.com")
  .post("/v1/charges")
  .reply(200, { id: "ch_123", status: "succeeded" });

// or simulate a failure
nock("https://api.payments.com").post("/v1/charges").reply(503);
```

## 💻 Code Example — Node's Built-In Test Runner

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("calculates GST", () => {
  assert.equal(withGst(100), 118);
});
// node --test
```

## 🔍 Good Practices

- Each test **sets up its own data** and does not depend on test order.
- Test **unhappy paths**: 400, 401, 403, 404, 409, 500.
- Use factories (`makeUser({ role: "admin" })`) instead of copy-pasted objects.
- Run tests in CI on every PR with a coverage report; fail the build on failure.
- Do not mock what you own heavily (Mongoose) in integration tests — use a real test DB.

## 🌍 Real-World Use

A typical MERN CI pipeline: `lint → type-check → unit tests → integration tests (in-memory Mongo) → build → deploy to staging → E2E smoke tests → production`.

## 🎯 Likely Interview Questions

1. **How do you test an Express API?** — Supertest + test DB.
2. **Unit vs integration tests for a backend — which do you write more of?**
3. **How do you avoid hitting the real database or payment gateway in tests?**
4. **Why separate `app` from `app.listen()`?**
5. **How do you test authentication and role-based routes?**
6. **How do you keep tests independent of each other?**
7. **How does dependency injection make testing easier?**

---

[← Performance & Memory Leaks](07-performance-memory-leaks.md) | [Index](../README.md) | [Next: Express vs NestJS →](../04-express-nestjs/01-express-vs-nestjs.md)
