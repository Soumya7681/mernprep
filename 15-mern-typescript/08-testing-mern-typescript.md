# Chapter 89 — Testing a MERN + TypeScript App

## 📖 Definition

A MERN test suite usually has three layers:

| Layer | What it tests | Tools |
|-------|---------------|-------|
| **Unit** | Pure functions: services with mocked deps, reducers, selectors, utils | Vitest / Jest |
| **Integration** | Express routes + real (in-memory) MongoDB; React components + real Redux store + mocked network | Supertest, mongodb-memory-server, React Testing Library, MSW |
| **End-to-end** | The real app in a browser | Playwright / Cypress |

The **testing trophy**: most value comes from integration tests; keep a few E2E tests for critical flows (login, checkout).

## 💻 Setup — Vitest for the Server

```ts
// apps/server/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    hookTimeout: 60_000,          // first run downloads a MongoDB binary
  },
});
```

Jest works the same way with `ts-jest` or `@swc/jest`; Vitest is faster and needs no extra TS transform config.

## 💻 Setup — In-Memory MongoDB

```ts
// apps/server/test/setup.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongo: MongoMemoryServer;

// env.ts validates on import → provide test values first
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "a".repeat(32);
process.env.JWT_REFRESH_SECRET = "b".repeat(32);
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.MONGO_URI = "mongodb://placeholder";

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  // Clean every collection so tests don't depend on each other
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
```

Use `MongoMemoryReplSet` instead if the code under test uses transactions.

## 💻 Code Example — API Integration Tests with Supertest

```ts
// apps/server/test/tasks.test.ts
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/modules/users/user.model.js";
import { signAccess } from "../src/modules/auth/tokens.js";
import { Task } from "../src/modules/tasks/task.model.js";

const app = createApp();   // no listen(), no port

async function loginAs(role: "user" | "admin" = "user") {
  const user = await User.create({ email: `${role}${Date.now()}@x.com`, name: "Test", password: "Passw0rd!", role });
  return { user, token: signAccess({ sub: user.id, role }) };
}

describe("Tasks API", () => {
  it("401 without a token", async () => {
    await request(app).get("/api/tasks").expect(401);
  });

  it("creates and lists my tasks", async () => {
    const { token } = await loginAs();

    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Write tests", priority: "high" })
      .expect(201);

    expect(created.body.data).toMatchObject({ title: "Write tests", priority: "high", done: false });

    const list = await request(app).get("/api/tasks").set("Authorization", `Bearer ${token}`).expect(200);
    expect(list.body.data.total).toBe(1);
  });

  it("400 on invalid input with field details", async () => {
    const { token } = await loginAs();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "", priority: "urgent" })
      .expect(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(expect.arrayContaining(["title", "priority"]));
  });

  it("cannot update another user's task (404, not 403)", async () => {
    const alice = await loginAs();
    const bob = await loginAs();
    const task = await Task.create({ title: "Alice's", owner: alice.user._id });

    await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ done: true })
      .expect(404);

    expect((await Task.findById(task.id))!.done).toBe(false);
  });

  it("admin sees all tasks", async () => {
    const alice = await loginAs();
    await Task.create({ title: "x", owner: alice.user._id });
    const admin = await loginAs("admin");
    const res = await request(app).get("/api/tasks").set("Authorization", `Bearer ${admin.token}`).expect(200);
    expect(res.body.data.total).toBe(1);
  });
});
```

## 💻 Code Example — Auth Flow Test (Cookies)

```ts
it("refresh rotates the token and the old one stops working", async () => {
  await request(app).post("/api/auth/register")
    .send({ email: "a@x.com", name: "Asha", password: "Passw0rd!" }).expect(201);

  const login = await request(app).post("/api/auth/login")
    .send({ email: "a@x.com", password: "Passw0rd!" }).expect(200);

  const oldCookie = login.headers["set-cookie"]!;
  expect(oldCookie[0]).toMatch(/HttpOnly/);

  await request(app).post("/api/auth/refresh").set("Cookie", oldCookie).expect(200);
  await request(app).post("/api/auth/refresh").set("Cookie", oldCookie).expect(401);   // reused → rejected
});
```

## 💻 Code Example — Unit Testing a Service with Mocks

```ts
import { vi } from "vitest";
import { authService } from "../src/modules/auth/auth.service.js";
import { User } from "../src/modules/users/user.model.js";

vi.mock("../src/modules/users/user.model.js", () => ({
  User: { findByEmail: vi.fn(), exists: vi.fn(), create: vi.fn() },
}));

it("rejects wrong password with a generic message", async () => {
  vi.mocked(User.findByEmail).mockResolvedValue({
    comparePassword: vi.fn().mockResolvedValue(false),
  } as never);

  await expect(authService.login("a@x.com", "wrong")).rejects.toMatchObject({
    statusCode: 401,
    message: "Invalid credentials",
  });
});
```

`vi.mocked()` / `jest.mocked()` gives the mock the right TypeScript type so `.mockResolvedValue` is typed.

## 💻 Code Example — React Component Test with Redux + MSW

```tsx
// apps/web/src/features/tasks/TasksPage.test.tsx
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test-utils";   // real store via setupStore (Redux testing chapter)
import { TasksPage } from "./TasksPage";
import type { TaskDto } from "@app/shared";

let tasks: TaskDto[] = [];
const server = setupServer(
  http.get("/api/tasks", () => HttpResponse.json({ success: true, data: { items: tasks, total: tasks.length, page: 1, limit: 20 } })),
  http.post("/api/tasks", async ({ request }) => {
    const body = (await request.json()) as { title: string };
    const t: TaskDto = {
      id: String(tasks.length + 1), title: body.title, description: "", priority: "medium", done: false,
      dueDate: null, ownerId: "u1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    tasks = [t, ...tasks];
    return HttpResponse.json({ success: true, data: t }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); tasks = []; });
afterAll(() => server.close());

const authed = { auth: { user: null, accessToken: "t", status: "authenticated" as const } };

test("adds a task and shows it in the list", async () => {
  const user = userEvent.setup();
  renderWithProviders(<TasksPage />, { preloadedState: authed });

  await user.type(screen.getByPlaceholderText(/what needs doing/i), "Buy milk");
  await user.click(screen.getByRole("button", { name: /add/i }));

  const list = await screen.findByRole("list");
  expect(await within(list).findByText("Buy milk")).toBeInTheDocument();   // appears after tag invalidation refetch
});
```

Queries priority in React Testing Library: `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByTestId`. Testing by role also checks accessibility.

## 💻 Code Example — E2E with Playwright

```ts
// e2e/login.spec.ts
import { test, expect } from "@playwright/test";

test("user can log in and create a task", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@x.com");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await page.goto("/tasks");
  await page.getByPlaceholder("What needs doing?").fill("E2E task");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("E2E task")).toBeVisible();
});
```

## 💻 CI — Type-check, Lint, Test

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc -b              # type errors fail the build
      - run: npm run lint --workspaces --if-present
      - run: npm test --workspaces --if-present -- --coverage
```

## 🌍 Real-World Impact

- In-memory Mongo + Supertest tests catch real bugs (missing index, wrong filter, validation gaps) that mocked tests miss, and still run in seconds.
- An explicit "cannot touch another user's data" test protects against the most common API security bug.
- `onUnhandledRequest: "error"` in MSW makes forgotten network mocks fail loudly instead of silently.

## 🎯 Likely Interview Questions

1. **How do you test an Express API?** — `createApp()` + Supertest + mongodb-memory-server; assert status and body.
2. **Mocking the DB vs an in-memory DB?** — In-memory gives realistic queries/indexes/validation; mocks are for pure unit tests of logic.
3. **How do you test protected routes?** — Sign a test JWT with the test secret, or log in through the API and reuse the token/cookie.
4. **How do you test React components that use Redux?** — Render with a real store (`setupStore` + `preloadedState`), mock network with MSW.
5. **What is MSW and why use it?** — Intercepts requests at the network layer; same mocks work in tests and the browser; no need to mock fetch/axios.
6. **Unit vs integration vs E2E?** — Scope and cost; most tests should be integration.
7. **How do you type mocks in TypeScript?** — `vi.mocked(fn)` / `jest.mocked(fn)`.
8. **What runs in CI for a TS project?** — `tsc --noEmit`/`tsc -b`, lint, tests with coverage, build.

---

[← Full-Stack Feature Walkthrough](07-fullstack-feature-walkthrough.md) | [Index](../README.md) | [Next: Production & Deployment →](09-production-deployment.md)
