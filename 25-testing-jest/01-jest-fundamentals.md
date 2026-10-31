# Chapter 122 — Jest Fundamentals

## 📖 Definition

**Jest** is a JavaScript testing framework from Meta. It bundles everything a test suite needs in one package: a **test runner** (finds and runs `*.test.js` files in parallel), an **assertion library** (`expect`), **mocking** (`jest.fn`, `jest.mock`, `jest.spyOn`), **fake timers**, **snapshot testing** and **code coverage**. It works for React (with the `jsdom` environment), Node/Express, and Redux.

## 🔍 Explanation

### The Testing Pyramid (Where Unit Tests Fit)

| Level | What it checks | Speed | Tool |
|-------|----------------|-------|------|
| **Unit** | One function, component or reducer in isolation | ms | Jest |
| **Integration** | Several units together (route + middleware + DB, component + store) | 10–100 ms | Jest + Supertest / React Testing Library |
| **E2E** | The whole app in a real browser | seconds | Playwright / Cypress |

Unit tests are cheap, fast and pinpoint failures. Integration tests give more confidence per test. A healthy MERN project has lots of both and a few E2E tests.

### Jest vs Vitest (Common Interview Question)

| | Jest | Vitest |
|---|---|---|
| API | `describe`, `it`, `expect`, `jest.fn` | Almost identical (`vi.fn` instead of `jest.fn`) |
| Transform | Babel / `ts-jest` / `@swc/jest` | Uses Vite: TS and JSX out of the box |
| ESM | Experimental (`--experimental-vm-modules`) | Native |
| Ecosystem | Largest, default in many companies, `next/jest` | Growing, default for Vite projects |
| Speed | Good | Usually faster, especially in watch mode |

Everything in this section transfers to Vitest by renaming `jest.` to `vi.`.

## 💻 Setup

```bash
npm i -D jest
# For ES module syntax / JSX / TypeScript via Babel:
npm i -D babel-jest @babel/core @babel/preset-env
```

```js
// babel.config.js — lets Jest understand `import`/`export`
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
```

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

```js
// jest.config.js
module.exports = {
  testEnvironment: "node",            // "jsdom" for React (see next chapter)
  clearMocks: true,                   // reset mock call history before every test
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/index.js"],
};
```

Jest finds files named `*.test.js`, `*.spec.js` or anything inside `__tests__/`.

Generate a starter config interactively with `npx jest --init`.

## 💻 Code Example — First Test

```js
// src/utils/price.js
export function applyDiscount(price, percent) {
  if (percent < 0 || percent > 100) throw new RangeError("Invalid discount");
  return Math.round(price * (1 - percent / 100) * 100) / 100;
}
```

```js
// src/utils/price.test.js
import { applyDiscount } from "./price";

describe("applyDiscount", () => {
  it("applies a percentage discount", () => {
    expect(applyDiscount(200, 10)).toBe(180);
  });

  it("rounds to 2 decimal places", () => {
    expect(applyDiscount(9.99, 33)).toBe(6.69);
  });

  it("throws on an invalid percentage", () => {
    expect(() => applyDiscount(100, 120)).toThrow(RangeError);
    expect(() => applyDiscount(100, -1)).toThrow("Invalid discount");
  });
});
```

Structure each test as **Arrange → Act → Assert** (AAA): set up inputs, call the code, check the result.

## 💻 Code Example — Table-Driven Tests with `test.each`

```js
test.each([
  [100, 0, 100],
  [100, 50, 50],
  [80, 25, 60],
  [100, 100, 0],
])("applyDiscount(%d, %d) → %d", (price, pct, expected) => {
  expect(applyDiscount(price, pct)).toBe(expected);
});
```

## 📊 Common Matchers

| Matcher | Use for |
|---------|---------|
| `toBe(x)` | Primitives and same reference (`Object.is`) |
| `toEqual(obj)` | Deep equality (ignores `undefined` properties) |
| `toStrictEqual(obj)` | Deep equality that also checks `undefined` props and class types |
| `toBeTruthy()` / `toBeFalsy()` | Truthiness |
| `toBeNull()` / `toBeUndefined()` / `toBeDefined()` | Exact null/undefined checks |
| `toBeGreaterThan(n)` / `toBeCloseTo(0.3)` | Numbers (use `toBeCloseTo` for floats: `0.1 + 0.2`) |
| `toMatch(/regex/)` | Strings |
| `toContain(item)` / `toHaveLength(n)` | Arrays and strings |
| `toHaveProperty("a.b", value)` | Nested object properties |
| `toMatchObject(partial)` | Object contains at least these fields |
| `toThrow(ErrorOrMessage)` | Function throws (wrap the call in `() => …`) |
| `.not.toBe(...)` | Negate any matcher |
| `expect.any(Number)`, `expect.objectContaining({...})`, `expect.stringContaining("x")` | Loose matching inside other matchers |

```js
expect(user).toEqual({
  id: expect.any(String),
  email: "a@b.com",
  createdAt: expect.any(Date),
});
```

## 💻 Code Example — Async Tests

```js
// Promise: return it or use async/await
it("fetches a user", async () => {
  const user = await getUser(1);
  expect(user.name).toBe("Soumya");
});

// Rejections
it("rejects for a missing user", async () => {
  await expect(getUser(999)).rejects.toThrow("Not found");
});

// Resolves shorthand
it("resolves with data", () => {
  return expect(getUser(1)).resolves.toMatchObject({ id: 1 });
});
```

❌ Forgetting `await` (or `return`) on an assertion makes the test pass before the promise settles. Add `expect.assertions(n)` to tests whose assertions run inside callbacks or `catch` blocks, so the test fails if they never run.

## 💻 Code Example — Setup and Teardown

```js
let db;

beforeAll(async () => { db = await connectTestDb(); });   // once per file
afterAll(async () => { await db.close(); });

beforeEach(async () => { await db.seed(); });             // before every test
afterEach(async () => { await db.clear(); });
```

Hooks inside a `describe` apply only to that block. Order: `beforeAll` (outer → inner), then for each test `beforeEach` (outer → inner), the test, `afterEach` (inner → outer).

## 🎭 Mocking

### `jest.fn()` — A Fake Function That Records Calls

```js
const onSave = jest.fn();
saveForm({ name: "A" }, onSave);

expect(onSave).toHaveBeenCalled();
expect(onSave).toHaveBeenCalledTimes(1);
expect(onSave).toHaveBeenCalledWith({ name: "A" });
expect(onSave.mock.calls[0][0]).toEqual({ name: "A" });   // first call, first arg
```

Control what the mock returns:

```js
const fn = jest.fn();
fn.mockReturnValue(42);                    // every call
fn.mockReturnValueOnce(1).mockReturnValueOnce(2);   // next calls in order
fn.mockResolvedValue({ id: 1 });           // returns Promise.resolve(...)
fn.mockRejectedValue(new Error("boom"));   // returns Promise.reject(...)
fn.mockImplementation((a, b) => a + b);    // custom logic
```

### `jest.mock()` — Replace a Whole Module

```js
// src/services/userService.js
import axios from "axios";
export async function getUserName(id) {
  const { data } = await axios.get(`/api/users/${id}`);
  return data.name.toUpperCase();
}
```

```js
// src/services/userService.test.js
import axios from "axios";
import { getUserName } from "./userService";

jest.mock("axios");                         // every export becomes a jest.fn()

it("upper-cases the name", async () => {
  axios.get.mockResolvedValue({ data: { name: "soumya" } });

  await expect(getUserName(1)).resolves.toBe("SOUMYA");
  expect(axios.get).toHaveBeenCalledWith("/api/users/1");
});
```

With a factory to control the fake:

```js
jest.mock("./emailClient", () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
}));
```

**Hoisting:** Babel moves `jest.mock()` calls **above the imports**, so the module is mocked before your code imports it. Because of that, a factory cannot use variables from the outer scope, except ones whose names start with `mock` (for example `mockSend`), which Jest allows deliberately.

### Partial Mock — Keep the Real Exports, Fake One

```js
jest.mock("./utils", () => ({
  ...jest.requireActual("./utils"),
  generateId: jest.fn(() => "fixed-id"),
}));
```

### `jest.spyOn()` — Watch or Override One Method

```js
const spy = jest.spyOn(console, "error").mockImplementation(() => {});   // silence + record
doSomethingNoisy();
expect(spy).toHaveBeenCalledWith(expect.stringContaining("failed"));
spy.mockRestore();                         // put the real console.error back
```

### Resetting Mocks

| Call | Clears call history | Removes fake implementation | Restores original (spies) |
|------|:---:|:---:|:---:|
| `mockClear()` / `jest.clearAllMocks()` | ✅ | ❌ | ❌ |
| `mockReset()` / `jest.resetAllMocks()` | ✅ | ✅ | ❌ |
| `mockRestore()` / `jest.restoreAllMocks()` | ✅ | ✅ | ✅ |

Config equivalents: `clearMocks`, `resetMocks`, `restoreMocks`. Setting `clearMocks: true` prevents one test's calls leaking into the next.

### Mock vs Stub vs Spy (Vocabulary)

- **Stub**: a fake that returns canned data (`mockReturnValue`).
- **Spy**: records how it was called (`toHaveBeenCalledWith`), and may keep the real behaviour.
- **Mock**: a fake with expectations about how it is used. In Jest, `jest.fn()` does all three.

## ⏱️ Fake Timers

```js
// debounce.test.js
import { debounce } from "./debounce";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("calls the function once after the delay", () => {
  const fn = jest.fn();
  const debounced = debounce(fn, 300);

  debounced("a");
  debounced("b");
  debounced("c");
  expect(fn).not.toHaveBeenCalled();

  jest.advanceTimersByTime(300);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith("c");
});
```

| API | Does |
|-----|------|
| `jest.advanceTimersByTime(ms)` | Move the clock forward by `ms` |
| `jest.runAllTimers()` | Run every pending timer (loops forever on `setInterval`) |
| `jest.runOnlyPendingTimers()` | Run timers queued now, not ones they create |
| `jest.setSystemTime(new Date("2026-01-01"))` | Freeze `Date.now()` |
| `jest.advanceTimersByTimeAsync(ms)` | Async version: also flushes promises between timers |

## 📸 Snapshot Testing

```js
it("formats an invoice", () => {
  expect(formatInvoice(sample)).toMatchSnapshot();          // stored in __snapshots__/
  expect(formatCurrency(1234.5)).toMatchInlineSnapshot(`"₹1,234.50"`);   // stored in the test file
});
```

Update after an intended change: `jest -u`. Snapshots are good for serialised output (formatters, error messages). Large component snapshots are brittle and get approved without being reviewed, so prefer explicit assertions for UI.

## 📊 Coverage

```bash
npx jest --coverage
```

| Metric | Meaning |
|--------|---------|
| Statements / Lines | Lines executed at least once |
| Functions | Functions called at least once |
| **Branches** | Every `if`/`else`, `? :`, `&&`, `??` path taken (the most telling one) |

100% coverage does not mean the code is correct. It only means the lines ran. Aim for meaningful tests on critical logic (auth, payments, permissions) and enforce a sensible `coverageThreshold` in CI.

## 💻 Useful CLI Flags

```bash
jest src/utils              # only tests under a path
jest -t "applyDiscount"     # only tests whose name matches
jest --watch                # re-run tests related to changed files (git)
jest --runInBand            # no worker processes (debugging, shared DB)
jest --detectOpenHandles    # find unclosed DB connections / servers
jest --ci                   # no snapshot writing, fail on missing snapshots
```

Focus or skip while debugging: `it.only(...)`, `it.skip(...)`, `describe.only(...)`, `it.todo("...")`. Never commit `.only`.

## 🌍 Real-World Impact

- Run `jest --ci --coverage` in your GitHub Actions / GitLab pipeline and block merges on failures.
- Keep tests **independent**: any test should pass when run alone or in any order.
- Mock at the **boundary** (HTTP, DB, time, randomness), not your own internal functions, so refactors don't break tests.
- Test names should read like requirements: `"returns 401 when the token is expired"`.

## 🎯 Likely Interview Questions

1. **What is Jest and what does it include?** — Runner, assertions, mocks, fake timers, snapshots and coverage in one package.
2. **`toBe` vs `toEqual` vs `toStrictEqual`?** — Reference/primitive equality, deep equality, and deep equality that also checks `undefined` properties and types.
3. **`jest.fn` vs `jest.mock` vs `jest.spyOn`?** — A standalone fake function, replacing a whole module, and wrapping an existing method (restorable).
4. **Why is `jest.mock` hoisted, and what restriction does that cause?** — So the mock is in place before imports run. The factory can't use outer variables unless they are prefixed with `mock`.
5. **`clearAllMocks` vs `resetAllMocks` vs `restoreAllMocks`?** — Clear only the call history; also remove implementations; also restore spied originals.
6. **How do you test code with `setTimeout` or debounce?** — `jest.useFakeTimers()` and `jest.advanceTimersByTime()`.
7. **How do you test async code? What's a common mistake?** — `async/await` with `.resolves`/`.rejects`. The common mistake is forgetting `await` or `return`, so the test passes too early.
8. **What are snapshot tests and their downsides?** — Serialised output compared with a stored file. They are brittle, and big snapshots get approved without being read.
9. **Is 100% coverage the goal?** — No. Coverage shows what ran, not that it was verified. Focus on branches in critical logic.
10. **Jest vs Vitest?** — Same API. Vitest is faster with native ESM/TS via Vite. Jest has the bigger ecosystem and is a common default.

---

[← MERN + TS Rapid-Fire Q&A](../15-mern-typescript/10-mern-interview-questions.md) | [Index](../README.md) | [Next: Testing React with Jest & RTL →](02-testing-react-jest.md)
