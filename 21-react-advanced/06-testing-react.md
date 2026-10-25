# Chapter 39 — Testing React Apps

## 📖 Definition

Testing a React app means checking that components behave correctly **from the user's point of view**. The standard toolset is **Vitest** or **Jest** (test runner), **React Testing Library (RTL)** (render and query the DOM like a user), **user-event** (realistic interactions), and **MSW** (Mock Service Worker, to mock the network). End-to-end tests use **Playwright** or **Cypress**.

## 🔍 The Testing Trophy

```text
        ▲  End-to-end   (few)   — Playwright: real browser, real backend
       ███ Integration  (most)  — RTL: several components + mocked network
      ████ Unit         (some)  — pure functions, hooks, reducers
     █████ Static       (all)   — TypeScript + ESLint
```

**Principle (RTL):** *"The more your tests resemble the way your software is used, the more confidence they give you."* Test behaviour, not implementation details (no checking state variables or internal methods).

## 🔍 Query Priority

1. `getByRole` (with `name`) — accessible, most robust
2. `getByLabelText` — form fields
3. `getByPlaceholderText`, `getByText`, `getByDisplayValue`
4. `getByTestId` — last resort

| Variant | No match | Async |
|---|---|---|
| `getBy…` | Throws | No |
| `queryBy…` | Returns `null` (use for "not present") | No |
| `findBy…` | Rejects | Yes — waits (default 1 s) |

## 💻 Code Example — Setup (Vitest)

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test/setup.js" },
});

// src/test/setup.js
import "@testing-library/jest-dom/vitest";
```

## 💻 Code Example — Component Test

```jsx
// Counter.test.jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Counter from "./Counter";

test("increments when the button is clicked", async () => {
  const user = userEvent.setup();
  render(<Counter initial={2} />);

  await user.click(screen.getByRole("button", { name: /increment/i }));

  expect(screen.getByText("Count: 3")).toBeInTheDocument();
});
```

## 💻 Code Example — Form Test

```jsx
test("shows validation errors and submits valid data", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await user.click(screen.getByRole("button", { name: /log in/i }));
  expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText(/email/i), "a@b.com");
  await user.type(screen.getByLabelText(/password/i), "secret123");
  await user.click(screen.getByRole("button", { name: /log in/i }));

  expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", password: "secret123" });
});
```

## 💻 Code Example — Mocking the API With MSW

```js
// src/test/server.js
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users", () => HttpResponse.json([{ id: 1, name: "Asha" }])),
];
export const server = setupServer(...handlers);

// setup.js
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```jsx
test("loads and shows users", async () => {
  render(<UserList />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(await screen.findByText("Asha")).toBeInTheDocument();
});

test("shows an error when the API fails", async () => {
  server.use(http.get("/api/users", () => new HttpResponse(null, { status: 500 })));
  render(<UserList />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
});
```

MSW intercepts at the network level, so the component's real `fetch`/axios code runs — far better than mocking `fetch` by hand.

## 💻 Code Example — Wrapping Providers

```jsx
function renderWithProviders(ui, { route = "/" } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
```

For Redux, create a fresh store per test with `configureStore({ reducer, preloadedState })`.

## 💻 Code Example — Testing a Custom Hook

```jsx
import { renderHook, act } from "@testing-library/react";

test("useCounter increments", () => {
  const { result } = renderHook(() => useCounter(5));
  act(() => result.current.inc());
  expect(result.current.count).toBe(6);
});
```

## 💻 Code Example — Fake Timers (Debounce)

```jsx
test("debounces the search", async () => {
  vi.useFakeTimers();
  const onSearch = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<SearchBox onSearch={onSearch} delay={300} />);

  await user.type(screen.getByRole("searchbox"), "react");
  expect(onSearch).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledWith("react");
  vi.useRealTimers();
});
```

## 💻 Code Example — E2E With Playwright

```js
import { test, expect } from "@playwright/test";

test("user can log in and see orders", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@shop.com");
  await page.getByLabel("Password").fill("demo1234");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
});
```

## 🌍 Real-World Use

- CI runs lint + type-check + unit/integration tests on every PR; E2E smoke tests run on the staging deploy.
- Aim for meaningful coverage of critical flows (login, checkout, payments), not a coverage percentage for its own sake.

## 🎯 Likely Interview Questions

1. **How do you test a React component? Which tools?**
2. **`getBy` vs `queryBy` vs `findBy`?**
3. **Why prefer `getByRole` over `getByTestId`?**
4. **How do you mock API calls in component tests?** — MSW.
5. **How do you test a custom hook?**
6. **How do you test code that uses timers (debounce)?**
7. **What should be unit-tested vs E2E-tested?**
8. **What does "test behaviour, not implementation" mean?**

---

[← Forms & Routing](05-forms-routing.md) | [Index](../README.md) | [Next: Frontend Security & Accessibility →](07-security-accessibility.md)
