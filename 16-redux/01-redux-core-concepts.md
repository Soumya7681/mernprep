# Chapter 40 — Redux Core Concepts

## 📖 Definition

**Redux** is a predictable state container for JavaScript apps. All global state lives in **one store**; the only way to change it is to **dispatch an action**; and the new state is computed by **pure reducer functions**. Redux Toolkit (next chapter) is how you write Redux today, but interviewers still test the core ideas underneath it.

## 🔍 The Three Principles

| Principle | Meaning | Why it matters |
|-----------|---------|----------------|
| **Single source of truth** | Whole app state is one object tree in one store | Easy to inspect, persist, hydrate from the server |
| **State is read-only** | Change only by dispatching an action (`{ type, payload }`) | Every change is visible, loggable, replayable |
| **Changes via pure functions** | Reducers: `(state, action) => newState`, no side effects | Predictable, testable, enables time-travel debugging |

## 🔍 One-Way Data Flow

```text
        ┌──────────────── UI (React component) ────────────────┐
        │                                                       │
        │  user clicks "Add to cart"                            │  re-render with
        ▼                                                       │  new state
  dispatch({ type: "cart/added", payload: item })               │
        │                                                       │
        ▼                                                       │
   Middleware (logger, thunk, …)  ── side effects live here     │
        │                                                       │
        ▼                                                       │
   Reducer(state, action) → new state   (pure)                  │
        │                                                       │
        ▼                                                       │
     Store  ──── notifies subscribers ── useSelector ───────────┘
```

## 💻 Code Example — Actions with TypeScript

```ts
// An action is a plain object with a `type`. Use a discriminated union so
// reducers know exactly which payload goes with which type.
interface CartItem { id: string; name: string; price: number; qty: number }

type CartAction =
  | { type: "cart/added"; payload: CartItem }
  | { type: "cart/removed"; payload: { id: string } }
  | { type: "cart/cleared" };

// Action creators — functions that build actions (avoid typos in `type`)
const added   = (item: CartItem): CartAction => ({ type: "cart/added", payload: item });
const removed = (id: string): CartAction     => ({ type: "cart/removed", payload: { id } });
const cleared = (): CartAction               => ({ type: "cart/cleared" });
```

Naming convention: `"domain/eventName"` in past tense — an action describes **what happened**, not a command ("cart/added", not "ADD_TO_CART_NOW").

## 💻 Code Example — A Pure, Immutable Reducer (No Toolkit)

```ts
interface CartState { items: CartItem[]; total: number }
const initialState: CartState = { items: [], total: 0 };

function cartReducer(state: CartState = initialState, action: CartAction): CartState {
  switch (action.type) {
    case "cart/added": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      const items = existing
        ? state.items.map((i) =>
            i.id === action.payload.id ? { ...i, qty: i.qty + action.payload.qty } : i,
          )
        : [...state.items, action.payload];
      return { items, total: sum(items) };          // new object, never mutate
    }
    case "cart/removed": {
      const items = state.items.filter((i) => i.id !== action.payload.id);
      return { items, total: sum(items) };
    }
    case "cart/cleared":
      return initialState;
    default:
      return state;                                 // unknown action → same reference
  }
}

const sum = (items: CartItem[]) => items.reduce((t, i) => t + i.price * i.qty, 0);
```

**Reducer rules** (very common interview question):

1. Compute new state only from `state` and `action`.
2. Never mutate `state` — return new objects/arrays (`...spread`, `map`, `filter`).
3. No side effects: no API calls, no `Math.random()`, no `Date.now()`, no `localStorage`.

Why immutability? React-Redux decides whether to re-render by comparing references (`prev !== next`). If you mutate, the reference doesn't change → **the UI doesn't update**.

## 💻 Code Example — Build Redux Yourself (Classic Interview Task)

Writing a mini `createStore` proves you understand Redux is just ~30 lines of pattern.

```ts
type Reducer<S, A> = (state: S | undefined, action: A) => S;
type Listener = () => void;

interface Store<S, A> {
  getState(): S;
  dispatch(action: A): A;
  subscribe(listener: Listener): () => void;   // returns unsubscribe
}

export function createStore<S, A extends { type: string }>(reducer: Reducer<S, A>): Store<S, A> {
  let state = reducer(undefined, { type: "@@INIT" } as A);   // let reducer set initial state
  let listeners: Listener[] = [];

  return {
    getState: () => state,
    dispatch(action) {
      state = reducer(state, action);
      listeners.forEach((l) => l());
      return action;
    },
    subscribe(listener) {
      listeners.push(listener);
      return () => { listeners = listeners.filter((l) => l !== listener); };
    },
  };
}

// Usage
const store = createStore(cartReducer);
const unsubscribe = store.subscribe(() => console.log(store.getState()));
store.dispatch(added({ id: "b1", name: "Book", price: 250, qty: 1 }));
unsubscribe();
```

## 💻 Code Example — `combineReducers` Yourself

```ts
type ReducersMap<S> = { [K in keyof S]: (state: S[K] | undefined, action: { type: string }) => S[K] };

export function combineReducers<S>(reducers: ReducersMap<S>) {
  return (state: S | undefined, action: { type: string }): S => {
    const next = {} as S;
    let changed = false;
    for (const key in reducers) {
      const prevSlice = state?.[key];
      const nextSlice = reducers[key](prevSlice, action);
      next[key] = nextSlice;
      changed ||= nextSlice !== prevSlice;
    }
    return changed || !state ? next : state;   // keep reference if nothing changed
  };
}

const rootReducer = combineReducers({ cart: cartReducer, user: userReducer });
type RootState = ReturnType<typeof rootReducer>;   // { cart: CartState; user: UserState }
```

## 💻 Code Example — Middleware Signature

Middleware sits between `dispatch` and the reducer. It's a curried function: `store => next => action => result`.

```ts
import type { Middleware } from "@reduxjs/toolkit";

// Logger
export const logger: Middleware = (store) => (next) => (action) => {
  console.group((action as { type: string }).type);
  console.log("prev", store.getState());
  const result = next(action);                      // pass to next middleware / reducer
  console.log("next", store.getState());
  console.groupEnd();
  return result;
};

// What redux-thunk does, in 4 lines: if the action is a function, call it
export const thunk: Middleware = ({ dispatch, getState }) => (next) => (action) =>
  typeof action === "function" ? action(dispatch, getState) : next(action);
```

That second example is the whole reason "async logic goes in thunks": reducers must stay pure, so side effects run in middleware **before** a plain action reaches the reducer.

## 💻 Code Example — Connecting to React (the Idea Behind `react-redux`)

```tsx
import { useSyncExternalStore } from "react";

// react-redux's useSelector is built on this React 18+ hook
function useStoreSelector<S, T>(store: Store<S, unknown & { type: string }>, selector: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
```

A component re-renders only when **its selected value** changes (by `===`), not when any part of the store changes. That's the key performance difference from React Context.

## 📊 Redux Vocabulary Cheat Sheet

| Term | One-liner |
|------|-----------|
| Store | Holds state; exposes `getState`, `dispatch`, `subscribe` |
| Action | Plain object `{ type, payload? }` describing an event |
| Action creator | Function returning an action |
| Reducer | Pure `(state, action) => newState` |
| Dispatch | Send an action to the store |
| Selector | `(state) => derivedValue` |
| Middleware | Intercepts actions for side effects / logging |
| Thunk | A function action that can dispatch & read state (async) |
| Slice | Reducer + actions for one feature (Redux Toolkit) |

## 🌍 Real-World Impact

- Redux DevTools shows every action and state diff — a production bug report becomes "replay these 7 actions".
- Pure reducers are trivially unit-testable: input state + action → expected output, no mocks.
- Centralised state makes features like undo/redo, offline persistence and SSR hydration straightforward.

## 🎯 Likely Interview Questions

1. **What are the three principles of Redux?** — Single source of truth, read-only state, changes via pure reducers.
2. **Explain the Redux data flow.** — UI dispatches action → middleware → reducer computes new state → store notifies subscribers → UI re-renders.
3. **Why must reducers be pure and immutable?** — Predictability, testability, time-travel, and React-Redux's reference-equality change detection.
4. **Where do API calls go in Redux?** — Middleware: thunks, RTK Query, listener middleware, or sagas — never in reducers.
5. **Implement `createStore`.** — Write the version above (getState / dispatch / subscribe).
6. **What does middleware look like?** — `store => next => action => {}`; must call `next(action)` to continue the chain.
7. **What is the difference between an action and an action creator?** — Object vs function that returns that object.
8. **Is Redux still relevant?** — Yes for large apps with complex shared client state and many contributors; for server data, RTK Query/TanStack Query; for small apps, Context/Zustand may be enough.

---

[← Frontend Security & Accessibility](../21-react-advanced/07-security-accessibility.md) | [Index](../README.md) | [Next: Redux Toolkit with TypeScript →](02-redux-toolkit-typescript.md)
