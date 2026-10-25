# Chapter 100 — Testing Redux with Jest

## 📖 Definition

Redux logic is easy to test because most of it is **pure functions**. With Jest you test:

- **Reducers / slices**: `reducer(state, action)` returns the expected next state.
- **Selectors**: `selector(state)` returns the right derived data (and memoises).
- **Thunks**: `createAsyncThunk` dispatches `pending` → `fulfilled`/`rejected` and the slice updates.
- **Middleware**: it passes actions on and performs its side effect.
- **Connected components**: rendered with a **real store** using a `renderWithProviders` helper.
- **RTK Query**: endpoints through the store, with the network mocked.

The Redux team recommends **integration-style tests with a real store** for most logic, plus focused unit tests for complex reducers and selectors. Avoid mocking the store or `useSelector`.

## 🔍 Explanation

| Unit | Test type | Mock |
|------|-----------|------|
| Slice reducer | Pure unit | Nothing |
| Selector (incl. `createSelector`) | Pure unit | Nothing |
| Async thunk | Real store (preferred) or call the thunk directly | API module / network |
| Custom middleware | Unit with fake `store` and `next` | Side-effect target (logger, analytics) |
| Component + store | Integration | Network only |
| RTK Query endpoint | Integration with a real store | Network (MSW / `fetch`) |

## 💻 The Slice Under Test

```js
// features/cart/cartSlice.js
import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import { api } from "../../api/client";

export const fetchCart = createAsyncThunk("cart/fetch", async (userId, { rejectWithValue }) => {
  try {
    return await api.getCart(userId);          // resolves to [{ id, name, price, qty }]
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const initialState = { items: [], status: "idle", error: null };

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    itemAdded(state, action) {
      const existing = state.items.find(i => i.id === action.payload.id);
      if (existing) existing.qty += 1;
      else state.items.push({ ...action.payload, qty: 1 });
    },
    itemRemoved(state, action) {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    cartCleared() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(fetchCart.fulfilled, (state, action) => { state.status = "succeeded"; state.items = action.payload; })
      .addCase(fetchCart.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; });
  },
});

export const { itemAdded, itemRemoved, cartCleared } = cartSlice.actions;
export default cartSlice.reducer;

// Selectors
export const selectCartItems = (state) => state.cart.items;
export const selectCartTotal = createSelector([selectCartItems], (items) =>
  items.reduce((sum, i) => sum + i.price * i.qty, 0)
);
export const selectCartCount = createSelector([selectCartItems], (items) =>
  items.reduce((n, i) => n + i.qty, 0)
);
```

## 💻 Code Example — Testing the Reducer

```js
// features/cart/cartSlice.test.js
import reducer, { itemAdded, itemRemoved, cartCleared } from "./cartSlice";

const pen = { id: "p1", name: "Pen", price: 10 };

describe("cart reducer", () => {
  test("returns the initial state", () => {
    expect(reducer(undefined, { type: "@@INIT" })).toEqual({ items: [], status: "idle", error: null });
  });

  test("adds a new item with qty 1", () => {
    const state = reducer(undefined, itemAdded(pen));
    expect(state.items).toEqual([{ ...pen, qty: 1 }]);
  });

  test("increments qty for an existing item", () => {
    let state = reducer(undefined, itemAdded(pen));
    state = reducer(state, itemAdded(pen));
    expect(state.items[0].qty).toBe(2);
  });

  test("removes an item", () => {
    const start = { items: [{ ...pen, qty: 1 }], status: "idle", error: null };
    expect(reducer(start, itemRemoved("p1")).items).toEqual([]);
  });

  test("does not mutate the previous state", () => {
    const start = Object.freeze({ items: Object.freeze([]), status: "idle", error: null });
    expect(() => reducer(start, itemAdded(pen))).not.toThrow();   // Immer produces a copy
  });

  test("clears the cart", () => {
    const start = { items: [{ ...pen, qty: 3 }], status: "succeeded", error: null };
    expect(reducer(start, cartCleared())).toEqual({ items: [], status: "idle", error: null });
  });
});
```

### Testing Action Creators

RTK generates them, so there is little to test, but checking the shape documents the contract:

```js
expect(itemAdded(pen)).toEqual({ type: "cart/itemAdded", payload: pen });
```

## 💻 Code Example — Testing Async Thunk State Transitions in the Reducer

You don't need to run the thunk to test how the slice reacts to it. Dispatch the generated action types directly:

```js
import reducer, { fetchCart } from "./cartSlice";

test("pending sets loading", () => {
  const state = reducer(undefined, { type: fetchCart.pending.type });
  expect(state.status).toBe("loading");
});

test("fulfilled stores items", () => {
  const items = [{ id: "p1", name: "Pen", price: 10, qty: 2 }];
  const state = reducer(undefined, { type: fetchCart.fulfilled.type, payload: items });
  expect(state).toMatchObject({ status: "succeeded", items });
});

test("rejected stores the error", () => {
  const state = reducer(undefined, { type: fetchCart.rejected.type, payload: "Network down" });
  expect(state).toMatchObject({ status: "failed", error: "Network down" });
});
```

## 💻 Code Example — Testing the Thunk with a Real Store (Preferred)

```js
// test/makeStore.js
import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "../features/cart/cartSlice";

export function makeStore(preloadedState) {
  return configureStore({ reducer: { cart: cartReducer }, preloadedState });
}
```

```js
import { makeStore } from "../../test/makeStore";
import { fetchCart } from "./cartSlice";
import { api } from "../../api/client";

jest.mock("../../api/client");

test("loads the cart into the store", async () => {
  api.getCart.mockResolvedValue([{ id: "p1", name: "Pen", price: 10, qty: 2 }]);
  const store = makeStore();

  const result = await store.dispatch(fetchCart("u1"));

  expect(api.getCart).toHaveBeenCalledWith("u1");
  expect(fetchCart.fulfilled.match(result)).toBe(true);
  expect(store.getState().cart).toMatchObject({ status: "succeeded", items: [{ id: "p1", qty: 2 }] });
});

test("stores the error when the API fails", async () => {
  api.getCart.mockRejectedValue(new Error("Network down"));
  const store = makeStore();

  const result = await store.dispatch(fetchCart("u1"));

  expect(fetchCart.rejected.match(result)).toBe(true);
  expect(result.payload).toBe("Network down");
  expect(store.getState().cart.status).toBe("failed");
});
```

`await store.dispatch(thunk())` returns the final action. `fetchCart.fulfilled.match(action)` is a type guard. `.unwrap()` instead returns the payload, or throws on rejection.

### Alternative — Calling the Thunk Directly

Useful for checking exactly which actions a thunk dispatches:

```js
test("dispatches pending then fulfilled", async () => {
  api.getCart.mockResolvedValue([]);
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({ cart: { items: [] } }));

  await fetchCart("u1")(dispatch, getState, undefined);

  const types = dispatch.mock.calls.map(([action]) => action.type);
  expect(types).toEqual(["cart/fetch/pending", "cart/fetch/fulfilled"]);
});
```

### Thunk That Reads State and Dispatches Others

```js
export const checkout = () => async (dispatch, getState) => {
  const items = selectCartItems(getState());
  if (items.length === 0) throw new Error("Cart is empty");
  await api.placeOrder(items);
  dispatch(cartCleared());
};

test("checkout places the order and clears the cart", async () => {
  api.placeOrder.mockResolvedValue({ orderId: "o1" });
  const store = makeStore({ cart: { items: [{ id: "p1", price: 10, qty: 1 }], status: "idle", error: null } });

  await store.dispatch(checkout());

  expect(api.placeOrder).toHaveBeenCalledWith([{ id: "p1", price: 10, qty: 1 }]);
  expect(store.getState().cart.items).toEqual([]);
});

test("checkout rejects for an empty cart", async () => {
  const store = makeStore();
  await expect(store.dispatch(checkout())).rejects.toThrow("Cart is empty");
  expect(api.placeOrder).not.toHaveBeenCalled();
});
```

## 💻 Code Example — Testing Selectors and Memoisation

```js
import { selectCartTotal, selectCartCount } from "./cartSlice";

const state = {
  cart: {
    items: [
      { id: "p1", price: 10, qty: 2 },
      { id: "p2", price: 5.5, qty: 1 },
    ],
  },
};

test("computes total and count", () => {
  expect(selectCartTotal(state)).toBe(25.5);
  expect(selectCartCount(state)).toBe(3);
});

test("handles an empty cart", () => {
  expect(selectCartTotal({ cart: { items: [] } })).toBe(0);
});

test("memoises: does not recompute for the same input", () => {
  selectCartTotal.resetRecomputations();
  selectCartTotal(state);
  selectCartTotal(state);
  expect(selectCartTotal.recomputations()).toBe(1);

  selectCartTotal({ cart: { items: [...state.cart.items] } });   // new array reference
  expect(selectCartTotal.recomputations()).toBe(2);
});
```

`recomputations()` and `resetRecomputations()` are built into selectors made with Reselect's `createSelector`.

## 💻 Code Example — Testing Custom Middleware

```js
// middleware/analytics.js
export const analyticsMiddleware = (track) => (store) => (next) => (action) => {
  const result = next(action);
  if (action.type === "cart/itemAdded") {
    track("add_to_cart", { id: action.payload.id, count: store.getState().cart.items.length });
  }
  return result;
};
```

```js
import { analyticsMiddleware } from "./analytics";

function run(action, state = { cart: { items: [{ id: "p1" }] } }) {
  const track = jest.fn();
  const store = { getState: jest.fn(() => state), dispatch: jest.fn() };
  const next = jest.fn((a) => a);
  const result = analyticsMiddleware(track)(store)(next)(action);
  return { track, next, result };
}

test("passes every action to next", () => {
  const action = { type: "anything" };
  const { next, result } = run(action);
  expect(next).toHaveBeenCalledWith(action);
  expect(result).toBe(action);
});

test("tracks add-to-cart", () => {
  const { track } = run({ type: "cart/itemAdded", payload: { id: "p1" } });
  expect(track).toHaveBeenCalledWith("add_to_cart", { id: "p1", count: 1 });
});

test("ignores other actions", () => {
  const { track } = run({ type: "cart/itemRemoved", payload: "p1" });
  expect(track).not.toHaveBeenCalled();
});
```

## 💻 Code Example — Connected Components with `renderWithProviders`

```jsx
// test/renderWithProviders.jsx
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "./makeStore";

export function renderWithProviders(ui, { preloadedState, store = makeStore(preloadedState) } = {}) {
  function Wrapper({ children }) {
    return <Provider store={store}>{children}</Provider>;
  }
  return { store, ...render(ui, { wrapper: Wrapper }) };
}
```

```jsx
// features/cart/CartSummary.jsx
import { useDispatch, useSelector } from "react-redux";
import { itemRemoved, selectCartItems, selectCartTotal } from "./cartSlice";

export function CartSummary() {
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);
  const dispatch = useDispatch();

  if (items.length === 0) return <p>Your cart is empty</p>;
  return (
    <>
      <ul>
        {items.map(i => (
          <li key={i.id}>
            {i.name} × {i.qty}
            <button onClick={() => dispatch(itemRemoved(i.id))} aria-label={`Remove ${i.name}`}>×</button>
          </li>
        ))}
      </ul>
      <p>Total: ₹{total}</p>
    </>
  );
}
```

```jsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import { CartSummary } from "./CartSummary";

const preloadedState = {
  cart: {
    items: [{ id: "p1", name: "Pen", price: 10, qty: 2 }, { id: "p2", name: "Book", price: 100, qty: 1 }],
    status: "succeeded",
    error: null,
  },
};

test("shows items and total from the store", () => {
  renderWithProviders(<CartSummary />, { preloadedState });
  expect(screen.getByText("Pen × 2")).toBeInTheDocument();
  expect(screen.getByText("Total: ₹120")).toBeInTheDocument();
});

test("removing an item updates the UI and the store", async () => {
  const user = userEvent.setup();
  const { store } = renderWithProviders(<CartSummary />, { preloadedState });

  await user.click(screen.getByRole("button", { name: "Remove Pen" }));

  expect(screen.queryByText("Pen × 2")).not.toBeInTheDocument();
  expect(screen.getByText("Total: ₹100")).toBeInTheDocument();
  expect(store.getState().cart.items).toHaveLength(1);
});

test("shows the empty state", () => {
  renderWithProviders(<CartSummary />);
  expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
});
```

A new store per test means no state leaks between tests. Don't share one store across a test file.

## 💻 Code Example — Testing RTK Query

```js
// services/productsApi.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const productsApi = createApi({
  reducerPath: "productsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "http://localhost/api" }),
  endpoints: (b) => ({
    getProduct: b.query({ query: (id) => `products/${id}` }),
  }),
});

export const { useGetProductQuery } = productsApi;
```

```js
// productsApi.test.js — environment: jest-fixed-jsdom or node (needs fetch/Request globals)
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { productsApi } from "./productsApi";

const server = setupServer(
  http.get("http://localhost/api/products/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Pen" }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeApiStore() {
  return configureStore({
    reducer: { [productsApi.reducerPath]: productsApi.reducer },
    middleware: (gDM) => gDM().concat(productsApi.middleware),
  });
}

test("fetches and caches a product", async () => {
  const store = makeApiStore();

  const result = await store.dispatch(productsApi.endpoints.getProduct.initiate("p1"));

  expect(result.data).toEqual({ id: "p1", name: "Pen" });
  expect(productsApi.endpoints.getProduct.select("p1")(store.getState()).status).toBe("fulfilled");
});

test("surfaces server errors", async () => {
  server.use(http.get("http://localhost/api/products/:id", () => new HttpResponse(null, { status: 500 })));
  const store = makeApiStore();

  const result = await store.dispatch(productsApi.endpoints.getProduct.initiate("p1"));

  expect(result.isError).toBe(true);
  expect(result.error.status).toBe(500);
});
```

Component tests using `useGetProductQuery` follow the same pattern: add the API reducer and middleware to `makeStore`, render with `renderWithProviders`, and `await screen.findByText("Pen")`. Use an absolute `baseUrl` in tests, because Node's `fetch` can't resolve relative URLs.

## ⚠️ Common Pitfalls

| Mistake | Better |
|---------|--------|
| Mocking `useSelector` / `useDispatch` | Render with a real store via `renderWithProviders` |
| `redux-mock-store` for everything | Deprecated approach. A real store tests reducers and thunks together |
| One shared store for all tests | `makeStore()` in each test |
| Asserting the exact list of dispatched actions everywhere | Assert the resulting **state** or UI; check action sequences only when that is the behaviour |
| Forgetting `await` on `store.dispatch(thunk())` | Always await async thunks before asserting |
| RTK Query cache leaking between tests | New store per test, or `store.dispatch(api.util.resetApiState())` |

## 🌍 Real-World Impact

- Reducer and selector tests are the cheapest high-value tests in a frontend codebase: pure, fast and stable.
- Thunk tests with a real store catch the classic bugs: forgotten `rejected` handling, wrong payload shape, missing loading state.
- `renderWithProviders` keeps component tests short and consistent across the team.

## 🎯 Likely Interview Questions

1. **How do you test a Redux reducer?** — Call it with a state and an action, and assert on the returned state. Also test the initial state and that the input isn't mutated.
2. **How do you test `createAsyncThunk`?** — Mock the API, `await store.dispatch(thunk(arg))` on a real store, then assert on the state and `thunk.fulfilled.match(result)`. Test rejection too.
3. **Should you mock the Redux store in component tests?** — No. Use a real store with `preloadedState` through a `renderWithProviders` helper. That's the Redux team's recommendation.
4. **How do you test memoised selectors?** — Check the outputs, then `recomputations()` to confirm the same input doesn't recompute.
5. **How do you test middleware?** — Call `middleware(store)(next)(action)` with a fake `store` and `next = jest.fn()`, and assert on `next` and the side effect.
6. **How do you test RTK Query?** — A real store with the API reducer and middleware, the network mocked with MSW, then `dispatch(endpoint.initiate(arg))` or render the component and wait for data.
7. **How do you avoid state leaking between tests?** — A new store per test, `clearMocks`, `server.resetHandlers()`, and resetting the RTK Query API state.

---

[← Testing Node & Express with Jest](03-testing-node-express-jest.md) | [Index](../README.md) | [Next: JS Predict-the-Output →](../23-coding-questions/01-js-output-questions.md)
