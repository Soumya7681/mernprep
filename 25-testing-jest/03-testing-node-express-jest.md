# Chapter 99 — Testing Node.js & Express with Jest

## 📖 Definition

Node/Express code is tested with **Jest** at three levels:

- **Unit tests**: one function (service, util, middleware, controller) with its dependencies **mocked**.
- **Integration tests**: real HTTP requests through the Express app with **Supertest**, hitting a real test database (**`mongodb-memory-server`**).
- **Contract checks**: status codes, response shapes and error formats that the React client depends on.

## 🔍 Explanation

### What to Test Where

| Code | Test type | Mock |
|------|-----------|------|
| Pure helpers (validators, price calculation) | Unit | Nothing |
| Services (business rules) | Unit | Models / repositories, external APIs, email |
| Middleware (auth, validation, error handler) | Unit | `req`, `res`, `next` |
| Controllers | Unit (optional) | Services |
| Routes + middleware + DB | Integration (Supertest) | Only third-party services (Stripe, S3, SMTP) |

### Project Layout

```
src/
  app.js              ← builds and exports the Express app (no listen)
  server.js           ← imports app, connects DB, calls listen()
  services/
    user.service.js
    user.service.test.js
  middleware/
    auth.js
    auth.test.js
tests/
  setup-db.js
  users.int.test.js
```

## 💻 Setup

```bash
npm i -D jest supertest mongodb-memory-server
# if you write ESM `import` syntax:
npm i -D babel-jest @babel/core @babel/preset-env
```

```js
// jest.config.js
module.exports = {
  testEnvironment: "node",              // ❗ never jsdom for Mongoose / Express
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/env.js"],
  testTimeout: 20000,                   // first run downloads a MongoDB binary
};
```

```js
// tests/env.js — runs before each test file
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
```

Mongoose's docs warn against the `jsdom` environment: it breaks Mongoose in subtle ways. Use `testEnvironment: "node"`, or a `/** @jest-environment node */` docblock in the test file for mixed repos.

## 💻 Code Example — Make the App Importable

```js
// src/app.js
const express = require("express");
const userRoutes = require("./routes/user.routes");
const { errorHandler } = require("./middleware/error");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRoutes);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
```

```js
// src/server.js — not imported by tests
const mongoose = require("mongoose");
const { createApp } = require("./app");

mongoose.connect(process.env.MONGO_URI).then(() => {
  createApp().listen(process.env.PORT || 5000);
});
```

Supertest binds the app to an ephemeral port itself, so tests never fight over port 5000 and nothing is left listening.

## 💻 Code Example — Unit Testing a Service (Mock the Model)

```js
// src/services/user.service.js
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendWelcomeEmail } = require("./email.service");
const { AppError } = require("../utils/AppError");

async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError("Email already registered", 409);

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hash });
  await sendWelcomeEmail(user.email);

  return { id: user._id.toString(), name: user.name, email: user.email };
}

module.exports = { registerUser };
```

```js
// src/services/user.service.test.js
const User = require("../models/User");
const { sendWelcomeEmail } = require("./email.service");
const bcrypt = require("bcryptjs");
const { registerUser } = require("./user.service");

jest.mock("../models/User");
jest.mock("./email.service");
jest.mock("bcryptjs");

describe("registerUser", () => {
  const input = { name: "Asha", email: "asha@test.com", password: "pass1234" };

  test("creates a user with a hashed password and sends a welcome email", async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed");
    User.create.mockResolvedValue({ _id: { toString: () => "u1" }, name: "Asha", email: input.email });

    const result = await registerUser(input);

    expect(User.create).toHaveBeenCalledWith({ name: "Asha", email: input.email, password: "hashed" });
    expect(sendWelcomeEmail).toHaveBeenCalledWith(input.email);
    expect(result).toEqual({ id: "u1", name: "Asha", email: input.email });
    expect(result).not.toHaveProperty("password");
  });

  test("throws 409 when the email exists", async () => {
    User.findOne.mockResolvedValue({ _id: "existing" });

    await expect(registerUser(input)).rejects.toMatchObject({
      message: "Email already registered",
      statusCode: 409,
    });
    expect(User.create).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
```

### Mocking Chained Mongoose Queries

```js
// Code under test: await Product.find({ active: true }).sort({ price: 1 }).limit(10).lean();
Product.find.mockReturnValue({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue([{ name: "Pen", price: 10 }]),
});
```

If you need many of these, it's a sign the logic belongs in an integration test against a real in-memory DB.

## 💻 Code Example — Unit Testing Middleware

```js
// src/middleware/auth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "Forbidden" });

module.exports = { requireAuth, requireRole };
```

```js
// src/middleware/auth.test.js
const jwt = require("jsonwebtoken");
const { requireAuth, requireRole } = require("./auth");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);   // allow res.status(401).json(...)
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("requireAuth", () => {
  test("401 when no token", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("attaches the user and calls next for a valid token", () => {
    const token = jwt.sign({ id: "u1", role: "admin" }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(req.user).toMatchObject({ id: "u1", role: "admin" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("401 for a tampered token", () => {
    const req = { headers: { authorization: "Bearer not.a.jwt" } };
    const res = mockRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireRole", () => {
  test("403 when the role is not allowed", () => {
    const res = mockRes();
    const next = jest.fn();
    requireRole("admin")({ user: { role: "user" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### Testing the Error-Handling Middleware

```js
const { errorHandler } = require("./error");

test("formats AppError with its status code", () => {
  const res = mockRes();
  const err = Object.assign(new Error("Not found"), { statusCode: 404 });

  errorHandler(err, {}, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Not found" }));
});

test("hides internal details for unknown errors", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const res = mockRes();
  errorHandler(new Error("DB password is hunter2"), {}, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Internal server error" }));
});
```

## 💻 Code Example — Integration Tests with Supertest + In-Memory MongoDB

```js
// tests/setup-db.js
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongo;

async function connect() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

async function clear() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
  await mongo.stop();
}

module.exports = { connect, clear, close };
```

```js
// tests/users.int.test.js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const db = require("./setup-db");
const { createApp } = require("../src/app");
const User = require("../src/models/User");

jest.mock("../src/services/email.service");     // don't send real emails

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe("POST /api/users/register", () => {
  test("201 and returns the user without the password", async () => {
    const res = await request(app)
      .post("/api/users/register")
      .send({ name: "Asha", email: "asha@test.com", password: "pass1234" })
      .expect("Content-Type", /json/)
      .expect(201);

    expect(res.body).toEqual({ id: expect.any(String), name: "Asha", email: "asha@test.com" });
    expect(res.body.password).toBeUndefined();

    const saved = await User.findOne({ email: "asha@test.com" });
    expect(saved.password).not.toBe("pass1234");         // hashed in the DB
  });

  test("400 for an invalid body", async () => {
    const res = await request(app).post("/api/users/register").send({ email: "bad" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  test("409 for a duplicate email", async () => {
    await User.create({ name: "A", email: "dup@test.com", password: "x" });
    await request(app)
      .post("/api/users/register")
      .send({ name: "B", email: "dup@test.com", password: "pass1234" })
      .expect(409);
  });
});

describe("GET /api/users/me", () => {
  const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);

  test("401 without a token", () => request(app).get("/api/users/me").expect(401));

  test("200 with a valid token", async () => {
    const user = await User.create({ name: "Asha", email: "a@test.com", password: "x" });
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .expect(200);
    expect(res.body.email).toBe("a@test.com");
  });
});
```

### Cookie-Based Auth with `request.agent`

```js
test("login sets an httpOnly cookie that authenticates later requests", async () => {
  const agent = request.agent(app);            // keeps cookies between requests
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  await agent.get("/api/users/me").expect(200);
});
```

## 💻 Code Example — Mocking External HTTP (axios)

```js
// src/services/weather.service.js
const axios = require("axios");
async function getTemperature(city) {
  const { data } = await axios.get("https://api.weather.example/current", { params: { city } });
  return Math.round(data.temp_c);
}
module.exports = { getTemperature };
```

```js
const axios = require("axios");
const { getTemperature } = require("./weather.service");
jest.mock("axios");

test("rounds the temperature", async () => {
  axios.get.mockResolvedValue({ data: { temp_c: 31.6 } });
  await expect(getTemperature("Bhubaneswar")).resolves.toBe(32);
  expect(axios.get).toHaveBeenCalledWith(expect.any(String), { params: { city: "Bhubaneswar" } });
});

test("propagates API failures", async () => {
  axios.get.mockRejectedValue(new Error("timeout"));
  await expect(getTemperature("X")).rejects.toThrow("timeout");
});
```

For realistic network mocking in integration tests, `nock` or MSW's `setupServer` intercept outgoing requests without mocking axios itself.

## 💻 Code Example — Time-Dependent Logic

```js
// token expiry, cron-like jobs, "created today" checks
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T10:00:00Z"));
});
afterEach(() => jest.useRealTimers());

test("marks an OTP as expired after 5 minutes", () => {
  const otp = createOtp();                    // stores Date.now()
  jest.advanceTimersByTime(5 * 60 * 1000 + 1);
  expect(isOtpValid(otp)).toBe(false);
});
```

Fake timers can break code that relies on real timers internally (DB drivers, Supertest). Enable them only in pure unit tests.

## ⚠️ Common Pitfalls

| Problem | Fix |
|---------|-----|
| "Jest did not exit one second after the test run has completed" | Close Mongoose, Redis, servers and queues in `afterAll`. Find leaks with `--detectOpenHandles` |
| Tests interfere with each other | Clear collections in `afterEach`. Don't depend on test order |
| Parallel test files share one DB | Each file gets its own `MongoMemoryServer` (as above), or run `--runInBand` |
| Mongoose behaves strangely | `testEnvironment: "node"` |
| Real emails or payments triggered | `jest.mock` the email/payment service in integration tests |
| Slow first run | `mongodb-memory-server` downloads a binary once. Cache it in CI |
| Asserting on the whole error stack | Assert on `status` and `message`, not internals |

## 🌍 Real-World Impact

- A Supertest suite over your main routes catches broken auth, wrong status codes and validation gaps before the React team does.
- Unit tests on services keep business rules (pricing, permissions, stock checks) safe during refactors.
- Run tests in CI on every pull request, with a MongoDB service container or `mongodb-memory-server`.

## 🎯 Likely Interview Questions

1. **How do you test an Express API?** — Export the app without `listen`, call routes with Supertest, use an in-memory or containerised MongoDB, and mock only external services.
2. **Unit vs integration tests for a backend?** — Unit: a service or middleware with mocks, very fast. Integration: real routes, middleware and DB together, with higher confidence.
3. **How do you unit-test middleware?** — Pass fake `req` and a chainable `res` (`status` returns `res`), plus `next = jest.fn()`, then assert on the calls.
4. **How do you mock Mongoose models?** — `jest.mock("../models/User")` and `mockResolvedValue` on static methods. Chained queries return objects with `mockReturnThis()`. Prefer an in-memory DB for query logic.
5. **What is `mongodb-memory-server`?** — It starts a real `mongod` in memory for tests, so there's no shared DB and no cleanup across machines.
6. **Why does Jest hang after tests finish?** — Open handles: an unclosed DB connection, server, timer or Redis client. Close them in `afterAll` and use `--detectOpenHandles`.
7. **How do you test protected routes?** — Sign a JWT with the test secret and send it in the `Authorization` header, or log in with `request.agent` for cookies.
8. **How do you avoid sending real emails or charging cards in tests?** — Mock those service modules or intercept their HTTP calls with `nock`/MSW.

---

[← Testing React with Jest & RTL](02-testing-react-jest.md) | [Index](../README.md) | [Next: Testing Redux with Jest →](04-testing-redux-jest.md)
