# Chapter 46 — Middleware, Persistence, Testing & When to Use Redux

## 📖 Definitions

- **Listener middleware** — RTK's built-in way to run side effects *in response to* actions ("when the user logs in, load their settings"). A lighter replacement for most sagas/epics.
- **Persistence** — saving part of the store (e.g. cart, theme) to `localStorage` and restoring it on load.
- **Integration testing** — testing components with a **real** store and mocked network, rather than mocking Redux itself.

## 💻 Code Example — Typed Listener Middleware

```ts
// app/listenerMiddleware.ts
import { createListenerMiddleware, addListener, isAnyOf } from "@reduxjs/toolkit";
import type { RootState, AppDispatch } from "./store";

export const listenerMiddleware = createListenerMiddleware();

export const startAppListening = listenerMiddleware.startListening.withTypes<RootState, AppDispatch>();
export const addAppListener = addListener.withTypes<RootState, AppDispatch>();
```

```ts
// features/cart/cartListeners.ts
import { startAppListening } from "../../app/listenerMiddleware";
import { itemAdded, itemRemoved, qtyChanged, cartCleared } from "./cartSlice";
import { loggedIn } from "../auth/authSlice";
import { toastShown } from "../ui/uiSlice";
import { api } from "../../services/api";

// 1. Save the cart whenever it changes (debounced)
startAppListening({
  matcher: isAnyOf(itemAdded, itemRemoved, qtyChanged, cartCleared),
  effect: async (_action, listenerApi) => {
    listenerApi.cancelActiveListeners();          // keep only the latest run (debounce)
    await listenerApi.delay(500);
    const { items } = listenerApi.getState().cart;
    localStorage.setItem("cart", JSON.stringify(items));
  },
});

// 2. After login, prefetch the user's tasks and show a toast
startAppListening({
  actionCreator: loggedIn,
  effect: async (action, { dispatch }) => {
    dispatch(api.util.prefetch("getTasks", { page: 1 }, { force: true }));
    dispatch(toastShown({ message: `Welcome back, ${action.payload.user.name}`, kind: "info" }));
  },
});

// 3. Wait for a condition (e.g. onboarding flow)
startAppListening({
  actionCreator: itemAdded,
  effect: async (_a, { condition, dispatch, unsubscribe }) => {
    unsubscribe();                                  // run once
    if (await condition((_, state) => state.cart.items.length >= 3, 60_000)) {
      dispatch(toastShown({ message: "Free shipping unlocked!", kind: "info" }));
    }
  },
});
```

```ts
// app/store.ts
middleware: (getDefault) =>
  getDefault().prepend(listenerMiddleware.middleware).concat(api.middleware),
```

## 💻 Code Example — Custom Middleware (Analytics / Error Reporting)

```ts
import { isRejectedWithValue, type Middleware } from "@reduxjs/toolkit";
import { toastShown } from "../features/ui/uiSlice";

// Show a toast for every failed RTK Query / thunk request, in one place
export const rtkErrorLogger: Middleware = (api) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const msg = (action.payload as { data?: { message?: string } })?.data?.message ?? "Request failed";
    api.dispatch(toastShown({ message: msg, kind: "error" }));
  }
  return next(action);
};
```

## 💻 Code Example — Simple, Typed Persistence (No Library)

```ts
// app/persist.ts
import type { RootState } from "./store";

const KEY = "app-state:v1";            // bump the version when the shape changes

type Persisted = Pick<RootState, "cart" | "ui">;

export function loadState(): Partial<Persisted> | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : undefined;
  } catch {
    return undefined;                   // private mode / corrupted JSON
  }
}

export function saveState(state: RootState) {
  try {
    const toSave: Persisted = { cart: state.cart, ui: state.ui };
    localStorage.setItem(KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded — ignore */ }
}
```

```ts
// app/store.ts
export const store = configureStore({ reducer: rootReducer, preloadedState: loadState() });

let timer: ReturnType<typeof setTimeout>;
store.subscribe(() => {
  clearTimeout(timer);
  timer = setTimeout(() => saveState(store.getState()), 300);   // throttle writes
});
```

> **Never persist the access token to `localStorage`** — any XSS can read it. Keep it in memory and use an httpOnly refresh cookie (MERN + TypeScript: Authentication chapter). For bigger needs, `redux-persist` handles migrations and storage engines.

## 💻 Code Example — A Store Factory for Tests

```ts
// app/store.ts
import { combineReducers, configureStore } from "@reduxjs/toolkit";

const rootReducer = combineReducers({
  cart: cartReducer,
  auth: authReducer,
  todos: todosReducer,
  [api.reducerPath]: api.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (gDM) => gDM().prepend(listenerMiddleware.middleware).concat(api.middleware),
  });
}

export const store = setupStore();
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore["dispatch"];
```

## 💻 Code Example — Unit Testing Reducers & Selectors

```ts
// cartSlice.test.ts  (Vitest or Jest)
import reducer, { itemAdded, itemRemoved } from "./cartSlice";
import { selectCartTotal } from "./cartSelectors";

const pen = { id: "1", name: "Pen", price: 20, qty: 1 };

test("adds a new item", () => {
  const state = reducer(undefined, itemAdded(pen));
  expect(state.items).toEqual([pen]);
});

test("increments qty for an existing item", () => {
  const state = reducer({ items: [pen], couponCode: null }, itemAdded({ ...pen, qty: 2 }));
  expect(state.items[0]?.qty).toBe(3);
});

test("removes an item", () => {
  expect(reducer({ items: [pen], couponCode: null }, itemRemoved("1")).items).toHaveLength(0);
});

test("applies coupon in total", () => {
  const state = { cart: { items: [{ ...pen, price: 100 }], couponCode: "SAVE10" } } as RootState;
  expect(selectCartTotal(state)).toBe(90);
});
```

## 💻 Code Example — Integration Test with a Real Store + MSW

```tsx
// test-utils.tsx
import { render, type RenderOptions } from "@testing-library/react";
import { Provider } from "react-redux";
import type { ReactElement } from "react";
import { setupStore, type AppStore, type RootState } from "./app/store";

interface Options extends Omit<RenderOptions, "queries"> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

export function renderWithProviders(ui: ReactElement, { preloadedState, store = setupStore(preloadedState), ...opts }: Options = {}) {
  return { store, ...render(<Provider store={store}>{ui}</Provider>, opts) };
}
```

```tsx
// UserList.test.tsx
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test-utils";
import { UserList } from "./UserList";

const server = setupServer(
  http.get("/api/users", () =>
    HttpResponse.json({ items: [{ id: "u1", name: "Asha", email: "a@x.com", role: "user" }], total: 1, page: 1, limit: 20 }),
  ),
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("renders users from the API", async () => {
  renderWithProviders(<UserList />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(await screen.findByText("Asha")).toBeInTheDocument();
});

test("shows an error", async () => {
  server.use(http.get("/api/users", () => HttpResponse.json({ message: "Boom" }, { status: 500 })));
  renderWithProviders(<UserList />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
});
```

The Redux docs recommend this style: test **behaviour through the UI** with a real store, mock only the network.

## 📊 Redux vs Context vs Zustand vs TanStack Query

| | Context API | Redux Toolkit | Zustand | TanStack Query |
|---|-------------|---------------|---------|----------------|
| Type of state | Low-frequency global values (theme, locale, current user) | Complex shared client state + server cache (RTK Query) | Simple/medium client state | Server state only |
| Re-render granularity | All consumers re-render on value change | Per-selector | Per-selector | Per-query |
| DevTools / time travel | No | Yes | Via middleware | Own devtools |
| Middleware / side effects | No | Thunks, listeners | Middleware | Query lifecycle callbacks |
| Boilerplate | Very low | Medium (low with RTK) | Very low | Low |
| Best for | Small apps, dependency injection | Large apps, big teams, strict patterns | Small/medium apps | Any app fetching API data |

**A common modern MERN combo:** RTK (client state) + RTK Query (server state), *or* Zustand + TanStack Query. Using Redux to store fetched data by hand with thunks is now the least recommended option.

## 🌍 Real-World Impact

- Listener middleware replaced hundreds of lines of saga code with plain async/await in several large codebases.
- A `setupStore()` factory gives each test a fresh store — no leaked state between tests.
- Choosing the right tool per kind of state avoids the "everything in Redux" bloat of older apps.

## 🎯 Likely Interview Questions

1. **What is listener middleware and when would you use it?** — Side effects reacting to actions (debounced saves, analytics, cross-feature flows); simpler than sagas.
2. **How do you persist Redux state?** — Subscribe + throttle save to storage, `preloadedState` on load; or `redux-persist`. Don't persist secrets.
3. **How do you test Redux code?** — Reducers/selectors as pure functions; components with a real store + MSW for the network.
4. **Why create a `setupStore` function?** — Fresh, optionally preloaded store per test or per SSR request.
5. **Redux vs Context?** — Context is dependency injection, re-renders every consumer; Redux has selector-level subscriptions, devtools, middleware.
6. **Redux vs Zustand?** — Zustand is smaller, less structure; Redux has stronger conventions, tooling and RTK Query.
7. **Would you use Redux for a new project?** — Depends: large team/complex client state → RTK; mostly server data → TanStack Query/RTK Query + local state.
8. **What is redux-saga?** — Middleware using generator functions for complex async flows; mostly replaced by thunks/listeners/RTK Query now.

---

[← Selectors & Normalised State](05-selectors-normalization.md) | [Index](../README.md) | [Next: Event Loop →](../03-nodejs/01-event-loop.md)
