# Chapter 42 — Redux Toolkit with TypeScript

## 📖 Definitions

- **Redux Toolkit (RTK)** — the official, recommended way to write Redux. It removes the boilerplate from the previous chapter (action types, switch statements, spread operators, store setup).
- **Slice** — one feature's state + reducers + auto-generated action creators, made with `createSlice`.
- **Immer** — library RTK uses inside reducers so you can write "mutating" code that produces immutable updates.
- **`configureStore`** — creates the store with good defaults: thunk middleware, DevTools, and dev-only checks for mutations and non-serialisable values.

## 🔍 Plain Redux vs Redux Toolkit

| Task | Plain Redux | Redux Toolkit |
|------|-------------|---------------|
| Action types | `const ADD = "cart/added"` by hand | Generated from slice name + reducer key |
| Action creators | Written by hand | `slice.actions.added` generated |
| Immutable update | `{ ...state, items: [...state.items, x] }` | `state.items.push(x)` (Immer) |
| Store setup | `createStore` + `applyMiddleware` + devtools enhancer | `configureStore({ reducer })` |
| Async | Install redux-thunk | Built in + `createAsyncThunk` |
| Data fetching | DIY | RTK Query |

## 💻 Code Example — A Typed Slice with `PayloadAction`

```ts
// features/cart/cartSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
}

const initialState: CartState = { items: [], couponCode: null };   // annotate → state type inferred

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    itemAdded(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) existing.qty += action.payload.qty;   // ✅ Immer: "mutate" the draft
      else state.items.push(action.payload);
    },
    itemRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    qtyChanged(state, action: PayloadAction<{ id: string; qty: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) item.qty = Math.max(1, action.payload.qty);
    },
    couponApplied(state, action: PayloadAction<string>) {
      state.couponCode = action.payload.trim().toUpperCase();
    },
    cartCleared() {
      return initialState;              // returning a new value replaces the state
    },
  },
  // RTK 2: selectors can live on the slice; they receive this slice's state
  selectors: {
    selectCartItems: (cart) => cart.items,
    selectCartCount: (cart) => cart.items.reduce((n, i) => n + i.qty, 0),
  },
});

export const { itemAdded, itemRemoved, qtyChanged, couponApplied, cartCleared } = cartSlice.actions;
export const { selectCartItems, selectCartCount } = cartSlice.selectors;
export default cartSlice.reducer;

// itemAdded({ id: "1", name: "Pen", price: 20, qty: 1 })
// → { type: "cart/itemAdded", payload: { ... } }   fully typed
```

> **Immer gotcha:** inside a reducer either **mutate the draft** *or* **return a new value** — never both. `state.items.push(x); return state;` is fine, but `state.x = 1; return { ...state }` throws.

## 💻 Code Example — Preparing Payloads (`prepare` callback)

```ts
import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

interface Todo { id: string; text: string; done: boolean; createdAt: string }

const todosSlice = createSlice({
  name: "todos",
  initialState: [] as Todo[],
  reducers: {
    todoAdded: {
      reducer(state, action: PayloadAction<Todo>) {
        state.push(action.payload);
      },
      // prepare runs in the action creator — the right place for ids/dates,
      // because reducers must stay pure
      prepare(text: string) {
        return { payload: { id: nanoid(), text, done: false, createdAt: new Date().toISOString() } };
      },
    },
    todoToggled(state, action: PayloadAction<string>) {
      const todo = state.find((t) => t.id === action.payload);
      if (todo) todo.done = !todo.done;
    },
  },
});

todosSlice.actions.todoAdded("Learn RTK");   // caller passes only the text
```

## 💻 Code Example — Store Setup and Inferred Types

```ts
// app/store.ts
import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "../features/cart/cartSlice";
import authReducer from "../features/auth/authSlice";
import { api } from "../services/api";

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    auth: authReducer,
    [api.reducerPath]: api.reducer,          // RTK Query cache (Chapter 25)
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
  devTools: import.meta.env.DEV,
});

// Infer types from the store itself — never write RootState by hand
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## 💻 Code Example — Typed Hooks (Do This Once)

```ts
// app/hooks.ts
import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState } from "./store";

// react-redux 9.1+
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore    = useStore.withTypes<typeof import("./store").store>();

// Older react-redux equivalent:
// export const useAppDispatch: () => AppDispatch = useDispatch;
// export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

Why? Plain `useDispatch()` doesn't know about thunks, so `dispatch(fetchUser(1))` would be a type error; plain `useSelector` gives `state: unknown`.

## 💻 Code Example — Provider & Components

```tsx
// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
```

```tsx
// features/cart/Cart.tsx
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { itemRemoved, qtyChanged, selectCartItems, selectCartCount } from "./cartSlice";
import { selectCartTotal } from "./cartSelectors";

export function Cart() {
  const items = useAppSelector(selectCartItems);
  const count = useAppSelector(selectCartCount);
  const total = useAppSelector(selectCartTotal);
  const dispatch = useAppDispatch();

  if (!items.length) return <p>Your cart is empty</p>;

  return (
    <section>
      <h3>Cart ({count}) — ₹{total}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.name}
            <input
              type="number"
              min={1}
              value={i.qty}
              onChange={(e) => dispatch(qtyChanged({ id: i.id, qty: e.target.valueAsNumber }))}
            />
            <button onClick={() => dispatch(itemRemoved(i.id))} aria-label={`Remove ${i.name}`}>×</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

## 💻 Code Example — Reacting to Other Slices' Actions (`extraReducers`)

```ts
// When the user logs out, every feature should reset itself
import { createSlice } from "@reduxjs/toolkit";
import { loggedOut } from "../auth/authSlice";

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: { /* … */ },
  extraReducers: (builder) => {
    builder.addCase(loggedOut, () => initialState);
  },
});
```

`reducers` = actions this slice **owns**; `extraReducers` = actions defined **elsewhere** (other slices, thunks, RTK Query) that this slice responds to. In RTK 2 the builder callback is the only supported form.

## 💻 Code Example — `createAction` and `createReducer` (Lower-level APIs)

```ts
import { createAction, createReducer } from "@reduxjs/toolkit";

export const themeToggled = createAction("ui/themeToggled");
export const toastShown   = createAction<{ message: string; kind: "info" | "error" }>("ui/toastShown");

interface UiState { theme: "light" | "dark"; toasts: { message: string; kind: string }[] }

export const uiReducer = createReducer<UiState>({ theme: "light", toasts: [] }, (builder) => {
  builder
    .addCase(themeToggled, (s) => { s.theme = s.theme === "light" ? "dark" : "light"; })
    .addCase(toastShown, (s, a) => { s.toasts.push(a.payload); })
    .addMatcher((a) => a.type.endsWith("/rejected"), (s) => {
      s.toasts.push({ message: "Something went wrong", kind: "error" });
    });
});
```

`addMatcher` handles **any** action that matches a predicate — useful for global loading/error handling across all thunks.

## 📊 What Belongs in Redux?

| Put in Redux | Keep out of Redux |
|--------------|-------------------|
| Auth user / tokens metadata | Form input while typing (local `useState`) |
| Cart, filters shared across pages | Modal open/closed for one component |
| Server data — but via RTK Query | Derived values (compute with selectors) |
| UI state many components need (theme, toasts) | Non-serialisable things: Promises, class instances, DOM nodes |

## 🌍 Real-World Impact

- RTK cuts a typical feature from ~4 files (types, actions, constants, reducer) to one slice.
- Inferred `RootState` means adding a slice updates every `useAppSelector` type automatically.
- Dev-mode immutability and serialisability checks catch bugs that used to take hours to find.

## 🎯 Likely Interview Questions

1. **What problems does Redux Toolkit solve?** — Boilerplate, accidental mutation, store setup, async logic, data fetching.
2. **What is a slice?** — `createSlice` bundles name, initial state, reducers and generates action creators + action types.
3. **How can RTK reducers "mutate" state?** — Immer gives you a draft proxy and produces a new immutable state from your changes.
4. **How do you type `RootState` and `AppDispatch`?** — Infer from the store: `ReturnType<typeof store.getState>` and `typeof store.dispatch`.
5. **Why create `useAppDispatch` / `useAppSelector`?** — So dispatch knows about thunks and selectors get typed state without repeating generics.
6. **`reducers` vs `extraReducers`?** — Own actions vs actions defined elsewhere (thunks, other slices, RTK Query).
7. **Where do you generate ids or timestamps?** — In a `prepare` callback or the caller, never inside the reducer.
8. **What should not go in the Redux store?** — Non-serialisable values and purely local UI state.

---

[← Redux Core Concepts](01-redux-core-concepts.md) | [Index](../README.md) | [Next: Async Logic with Thunks →](03-async-thunks.md)
