# Chapter 123 — Testing React with Jest & React Testing Library

## 📖 Definition

React components are unit-tested with **Jest** (runner, assertions, mocks) plus **React Testing Library (RTL)**, which renders components into a simulated browser DOM (**jsdom**) and lets you query and interact with them **the way a user would**: by role, label and text, not by internal state or class names.

> "The more your tests resemble the way your software is used, the more confidence they can give you." — the RTL guiding principle

## 🔍 Explanation

### What to Test in a Component

| ✅ Test | ❌ Don't test |
|--------|--------------|
| What the user sees (text, roles, enabled/disabled) | Internal state values (`useState` contents) |
| What happens on click / type / submit | Which hooks a component uses |
| Calls to props like `onSubmit` with the right data | Class names or DOM structure details |
| Loading, error and empty states | Third-party library internals |
| Accessibility (labels, roles) | Implementation details that change in refactors |

### Packages

| Package | Role |
|---------|------|
| `jest` + `jest-environment-jsdom` | Runner + browser-like DOM (separate package since Jest 28) |
| `@testing-library/react` + `@testing-library/dom` | `render`, `screen`, `renderHook` |
| `@testing-library/user-event` | Realistic typing, clicking, tabbing |
| `@testing-library/jest-dom` | DOM matchers: `toBeInTheDocument`, `toHaveValue`, `toBeDisabled` |
| `babel-jest` + presets, or `ts-jest` / `@swc/jest` | Transform JSX/TS |
| `identity-obj-proxy` | Stub CSS module imports |

## 💻 Setup (Vite or CRA-Style Project)

```bash
npm i -D jest jest-environment-jsdom babel-jest @babel/core @babel/preset-env \
  @babel/preset-react @testing-library/react @testing-library/dom \
  @testing-library/user-event @testing-library/jest-dom identity-obj-proxy
```

```js
// babel.config.cjs
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],   // no `import React` needed
  ],
};
```

```js
// jest.config.cjs
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "\\.(css|less|scss)$": "identity-obj-proxy",                 // CSS modules
    "\\.(png|jpg|svg)$": "<rootDir>/test/fileMock.js",          // static assets
    "^@/(.*)$": "<rootDir>/src/$1",                              // path alias
  },
  clearMocks: true,
};
```

```js
// jest.setup.js
import "@testing-library/jest-dom";
```

**Next.js** projects use the built-in helper instead of Babel config:

```js
// jest.config.js
const nextJest = require("next/jest");
const createJestConfig = nextJest({ dir: "./" });
module.exports = createJestConfig({
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
});
```

Async Server Components can't be rendered by RTL yet. Test them with E2E tests, and unit-test client components and plain functions.

## 💻 Code Example — Rendering and Querying

```jsx
// Greeting.jsx
export function Greeting({ name }) {
  return name ? <h1>Hello, {name}!</h1> : <p>Please log in</p>;
}
```

```jsx
// Greeting.test.jsx
import { render, screen } from "@testing-library/react";
import { Greeting } from "./Greeting";

test("greets the user by name", () => {
  render(<Greeting name="Soumya" />);
  expect(screen.getByRole("heading", { name: "Hello, Soumya!" })).toBeInTheDocument();
});

test("asks guests to log in", () => {
  render(<Greeting />);
  expect(screen.getByText(/please log in/i)).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
```

### Query Types

| Prefix | No match | 1 match | >1 match | Async | Use for |
|--------|----------|---------|----------|-------|---------|
| `getBy…` | throws | element | throws | ❌ | Element that should be there now |
| `queryBy…` | `null` | element | throws | ❌ | Asserting something is **absent** |
| `findBy…` | rejects | element | rejects | ✅ (retries up to 1 s) | Element that **appears later** |
| `getAllBy…` / `queryAllBy…` / `findAllBy…` | — | array | array | — | Lists |

### Query Priority (Most to Least Preferred)

1. `getByRole("button", { name: /save/i })`: what screen readers see
2. `getByLabelText("Email")`: form fields
3. `getByPlaceholderText`, `getByText`, `getByDisplayValue`
4. `getByAltText`, `getByTitle`
5. `getByTestId("cart-total")`: last resort (`data-testid`)

If you can't find an element by role or label, that is often an accessibility bug in the component.

Debug helpers: `screen.debug()` prints the DOM, and `screen.logTestingPlaygroundURL()` suggests the best query.

## 💻 Code Example — User Interaction with `user-event`

```jsx
// Counter.jsx
import { useState } from "react";
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </>
  );
}
```

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Counter } from "./Counter";

test("increments when clicked", async () => {
  const user = userEvent.setup();             // create before render
  render(<Counter />);

  await user.click(screen.getByRole("button", { name: /increment/i }));
  await user.click(screen.getByRole("button", { name: /increment/i }));

  expect(screen.getByText("Count: 2")).toBeInTheDocument();
});
```

`user-event` fires the full event sequence a real user triggers (pointerdown, mousedown, focus, mouseup, click). `fireEvent.click` dispatches a single event. Prefer `user-event`, and remember every call is **async**.

## 💻 Code Example — Testing a Form

```jsx
// LoginForm.jsx
import { useState } from "react";

export function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email");
    onSubmit({ email, password });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Email <input value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!password}>Log in</button>
    </form>
  );
}
```

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  test("submits email and password", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", password: "secret" });
  });

  test("shows a validation error for a bad email", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "x");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("disables submit until a password is entered", () => {
    render(<LoginForm onSubmit={jest.fn()} />);
    expect(screen.getByRole("button", { name: /log in/i })).toBeDisabled();
  });
});
```

## 💻 Code Example — Async Data Fetching (Mocking `fetch`)

```jsx
// UserList.jsx
import { useEffect, useState } from "react";

export function UserList() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/users")
      .then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); })
      .then(setUsers)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!users) return <p>Loading…</p>;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

```jsx
import { render, screen } from "@testing-library/react";
import { UserList } from "./UserList";

beforeEach(() => {
  global.fetch = jest.fn();                   // jsdom has no fetch of its own
});

test("renders users after loading", async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => [{ id: 1, name: "Asha" }, { id: 2, name: "Ravi" }],
  });

  render(<UserList />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  expect(await screen.findByText("Asha")).toBeInTheDocument();   // waits for it to appear
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(fetch).toHaveBeenCalledWith("/api/users");
});

test("shows an error when the request fails", async () => {
  fetch.mockResolvedValue({ ok: false });
  render(<UserList />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Request failed");
});
```

### `findBy` vs `waitFor`

```jsx
// Wait for something to appear
await screen.findByText("Asha");

// Wait for something to disappear or for any assertion to pass
await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));
```

Put **one assertion** inside `waitFor`, and never side effects (clicks), because the callback is retried many times.

### Mocking an API Module Instead of `fetch`

Cleaner when components call an `api` layer:

```jsx
import * as api from "../api/users";
jest.mock("../api/users");

api.fetchUsers.mockResolvedValue([{ id: 1, name: "Asha" }]);
```

### MSW (Mock Service Worker) with Jest

MSW intercepts real network requests, so your component, `fetch`/axios and response parsing all run for real. It is the most realistic option. With Jest's jsdom environment you need the Fetch API globals: MSW recommends the `jest-fixed-jsdom` environment.

```js
// jest.config.cjs
testEnvironment: "jest-fixed-jsdom",
```

```js
// test/server.js
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const server = setupServer(
  http.get("/api/users", () => HttpResponse.json([{ id: 1, name: "Asha" }]))
);
```

```js
// jest.setup.js
import "@testing-library/jest-dom";
import { server } from "./test/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```jsx
// Override for one test
server.use(http.get("/api/users", () => new HttpResponse(null, { status: 500 })));
```

## 💻 Code Example — Testing a Custom Hook

```jsx
// useCounter.js
import { useState, useCallback } from "react";
export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount(c => c + 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, increment, reset };
}
```

```jsx
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "./useCounter";

test("increments and resets", () => {
  const { result } = renderHook(() => useCounter(5));

  act(() => result.current.increment());
  expect(result.current.count).toBe(6);

  act(() => result.current.reset());
  expect(result.current.count).toBe(5);
});

test("reacts to new props", () => {
  const { result, rerender } = renderHook(({ initial }) => useCounter(initial), {
    initialProps: { initial: 1 },
  });
  rerender({ initial: 10 });
  act(() => result.current.reset());
  expect(result.current.count).toBe(10);
});
```

Wrap direct state updates in `act()`. `render`, `user-event` and `findBy` already do that for you.

## 💻 Code Example — Components That Need Providers

```jsx
// test/renderWithProviders.jsx
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../src/theme";

export function renderWithProviders(ui, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}
```

```jsx
test("shows the profile page", () => {
  renderWithProviders(<App />, { route: "/profile" });
  expect(screen.getByRole("heading", { name: /profile/i })).toBeInTheDocument();
});
```

The Redux version of this helper is in the next-but-one chapter.

## 💻 Code Example — Debounced Search with Fake Timers

```jsx
test("searches after the user stops typing", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const onSearch = jest.fn();
  render(<SearchBox onSearch={onSearch} delay={300} />);

  await user.type(screen.getByRole("searchbox"), "react");
  expect(onSearch).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(300));
  expect(onSearch).toHaveBeenCalledWith("react");

  jest.useRealTimers();
});
```

Without the `advanceTimers` option, `user-event`'s internal delays wait on frozen timers and the test hangs.

## 💻 Code Example — Mocking a Child Component or Module

```jsx
// Heavy chart library isn't needed to test the dashboard logic
jest.mock("./RevenueChart", () => ({
  RevenueChart: ({ data }) => <div data-testid="chart">{data.length} points</div>,
}));

// Mock react-router's navigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,         // name starts with "mock" → allowed in the factory
}));
```

## 💻 Code Example — Error Boundary

```jsx
function Bomb() { throw new Error("💥"); }

test("shows the fallback when a child throws", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});   // React logs the error; keep output clean
  render(
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <Bomb />
    </ErrorBoundary>
  );
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  console.error.mockRestore();
});
```

## ⚠️ Common Pitfalls

| Problem | Cause / Fix |
|---------|-------------|
| `Warning: An update … was not wrapped in act(...)` | A state update happened after the test finished. Await the UI change with `findBy`/`waitFor` |
| `ReferenceError: fetch is not defined` / `TextEncoder is not defined` | jsdom lacks these. Mock `fetch` or use `jest-fixed-jsdom` |
| `SyntaxError: Cannot use import statement outside a module` (from `node_modules`) | The package ships ESM only. Add it to `transformIgnorePatterns` exceptions or mock it |
| `window.matchMedia is not a function` | Not in jsdom. Define a mock in `jest.setup.js` |
| Tests pass alone but fail together | Shared state: reset mocks, MSW handlers and stores in `afterEach` |
| Using `getBy` to assert something is absent | It throws. Use `queryBy` + `.not.toBeInTheDocument()` |

## 🌍 Real-World Impact

- Test critical flows: login, checkout, form validation, role-based UI and error states.
- Write tests that survive refactors: switching from `useState` to `useReducer` shouldn't break any test.
- Querying by role and label doubles as an accessibility check.

## 🎯 Likely Interview Questions

1. **Why React Testing Library over Enzyme?** — RTL tests behaviour through the DOM like a user does. Enzyme encouraged testing internals (state, instance methods) and isn't maintained for modern React.
2. **`getBy` vs `queryBy` vs `findBy`?** — Throws if missing; returns `null` (for absence checks); async and retries until the element appears.
3. **`fireEvent` vs `userEvent`?** — A single synthetic event vs a full, realistic interaction sequence. Prefer `userEvent`.
4. **How do you test a component that fetches data?** — Mock `fetch`, the API module or the network (MSW), then `await screen.findBy…` for the loaded state. Test loading and error states too.
5. **What is `act()` and when do you need it?** — It flushes React updates and effects before assertions. RTL wraps most things already. You need it for direct hook calls and manual timer advances.
6. **How do you test a custom hook?** — `renderHook` from `@testing-library/react`, then `act` around updates, and read `result.current`.
7. **Why prefer `getByRole`?** — It matches how assistive technology finds elements and fails when markup is inaccessible.
8. **Should you use snapshot tests for components?** — Sparingly. They are brittle and rarely reviewed. Explicit assertions document intent.
9. **How do you test components that use Router or Context?** — A `renderWithProviders` helper that wraps them in `MemoryRouter`, providers and a test store.

---

[← Jest Fundamentals](01-jest-fundamentals.md) | [Index](../README.md) | [Next: Testing Node & Express with Jest →](03-testing-node-express-jest.md)
