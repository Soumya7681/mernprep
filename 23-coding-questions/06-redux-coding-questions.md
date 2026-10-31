# Chapter 130 — Redux Coding Questions

## 📖 Definition

Redux coding rounds come in three flavours:

1. **Implement Redux from scratch**: `createStore`, `combineReducers`, `applyMiddleware`, thunk, `useSelector`, `createSelector`. These prove you understand what the library does.
2. **Build a feature with Redux Toolkit**: a todo app, cart, async user list, auth, RTK Query CRUD, usually in 30–45 minutes.
3. **Spot the bug**: mutated state, unstable selectors, wrong middleware order.

## 🧠 What Interviewers Look For

| They check | Show it by |
|---|---|
| Purity | Reducers never mutate (outside Immer), never fetch, never use `Date.now()`/`Math.random()` |
| State shape | Minimal and normalised. Derive totals and filtered lists with selectors |
| Async handling | `idle → loading → succeeded/failed`, errors through `rejectWithValue`, no duplicate requests |
| Re-render awareness | Selectors return stable references, `createSelector` for derived arrays |
| Modern Redux | `configureStore`, `createSlice`, `createAsyncThunk`, RTK Query (not hand-written action constants) |
| Communication | Explain the data flow: UI → dispatch → middleware → reducer → store → subscribers |

---

# Part A — Implement Redux From Scratch

## 1. `createStore`

**Question:** Implement `createStore(reducer, preloadedState?, enhancer?)` returning `getState`, `dispatch` and `subscribe`.

```js
export function createStore(reducer, preloadedState, enhancer) {
  // Allow createStore(reducer, enhancer)
  if (typeof preloadedState === "function" && enhancer === undefined) {
    enhancer = preloadedState;
    preloadedState = undefined;
  }
  if (enhancer) return enhancer(createStore)(reducer, preloadedState);

  let state = preloadedState;
  let listeners = [];
  let isDispatching = false;

  function getState() {
    if (isDispatching) throw new Error("Cannot call getState while the reducer is running");
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") throw new Error("Listener must be a function");
    let subscribed = true;
    listeners = [...listeners, listener];

    return function unsubscribe() {
      if (!subscribed) return;
      subscribed = false;
      listeners = listeners.filter((l) => l !== listener);
    };
  }

  function dispatch(action) {
    if (action === null || typeof action !== "object") {
      throw new Error("Actions must be plain objects. Use middleware for functions.");
    }
    if (typeof action.type === "undefined") throw new Error('Actions need a "type"');
    if (isDispatching) throw new Error("Reducers may not dispatch actions");

    try {
      isDispatching = true;
      state = reducer(state, action);
    } finally {
      isDispatching = false;
    }

    const current = listeners;          // snapshot: (un)subscribing during notify is safe
    current.forEach((l) => l());
    return action;
  }

  dispatch({ type: `@@redux/INIT${Math.random().toString(36).slice(2)}` });   // build initial state

  return { getState, dispatch, subscribe };
}
```

```js
// Usage
const counter = (state = 0, action) =>
  action.type === "inc" ? state + 1 : action.type === "dec" ? state - 1 : state;

const store = createStore(counter);
const unsubscribe = store.subscribe(() => console.log(store.getState()));
store.dispatch({ type: "inc" });   // 1
store.dispatch({ type: "inc" });   // 2
unsubscribe();
store.dispatch({ type: "dec" });   // no log
```

**Talking points:**
- The `INIT` dispatch makes every reducer return its default state.
- Listeners are copied before notifying (the real Redux does the same), so a listener that unsubscribes mid-loop doesn't skip others.
- `isDispatching` stops reducers from dispatching. Reducers must be pure.
- Listeners get no arguments. They call `getState()` themselves.

## 2. `combineReducers`

```js
export function combineReducers(reducers) {
  const keys = Object.keys(reducers);

  return function combination(state = {}, action) {
    let hasChanged = false;
    const nextState = {};

    for (const key of keys) {
      const prev = state[key];
      const next = reducers[key](prev, action);
      if (next === undefined) {
        throw new Error(`Reducer "${key}" returned undefined. Return the previous state instead.`);
      }
      nextState[key] = next;
      hasChanged = hasChanged || next !== prev;
    }

    hasChanged = hasChanged || keys.length !== Object.keys(state).length;
    return hasChanged ? nextState : state;   // same reference if nothing changed
  };
}
```

```js
const root = combineReducers({ counter, todos: todosReducer });
const store = createStore(root);
store.getState();   // { counter: 0, todos: [] }
```

**Talking point:** returning the **same root object** when no slice changed lets `useSelector` and `connect` skip re-renders. Every action goes to every slice reducer, and each slice ignores actions it doesn't handle.

## 3. `compose` and `applyMiddleware`

```js
export const compose = (...fns) =>
  fns.length === 0 ? (x) => x : fns.reduce((a, b) => (...args) => a(b(...args)));

export function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);

    let dispatch = () => {
      throw new Error("Dispatching while constructing middleware is not allowed");
    };

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action, ...args) => dispatch(action, ...args),   // always the final, wrapped dispatch
    };

    const chain = middlewares.map((mw) => mw(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    return { ...store, dispatch };
  };
}
```

**Middleware signature:** `store => next => action => result`.

- `store` (`getState`, `dispatch`) is given once at setup.
- `next` is the next middleware in the chain (the last `next` is the real `store.dispatch`).
- `action` is called for every dispatch.

Why `middlewareAPI.dispatch` is a wrapper: a thunk that dispatches another thunk must go through the **whole chain again**, not just the raw store dispatch.

## 4. Thunk and Logger Middleware

```js
export const thunk = ({ dispatch, getState }) => (next) => (action) =>
  typeof action === "function" ? action(dispatch, getState) : next(action);

export const logger = ({ getState }) => (next) => (action) => {
  console.group(action.type);
  console.log("prev", getState());
  const result = next(action);
  console.log("next", getState());
  console.groupEnd();
  return result;
};
```

```js
const store = createStore(root, applyMiddleware(thunk, logger));

const fetchTodos = () => async (dispatch) => {
  dispatch({ type: "todos/loading" });
  const todos = await fetch("/api/todos").then((r) => r.json());
  dispatch({ type: "todos/loaded", payload: todos });
};

store.dispatch(fetchTodos());
```

**Talking point:** order matters. `thunk` must come before `logger`, otherwise the logger receives functions. Each middleware should `return next(action)` so callers get the result. With thunk, `await dispatch(thunk())` works because the function's return value bubbles back.

### Bonus — Crash Reporter and Action Validator

```js
export const crashReporter = () => (next) => (action) => {
  try {
    return next(action);
  } catch (err) {
    reportError(err, { action });
    throw err;
  }
};

export const requireType = () => (next) => (action) => {
  if (typeof action === "object" && !action.type) throw new Error("Action without type");
  return next(action);
};
```

## 5. `bindActionCreators`

```js
export function bindActionCreators(creators, dispatch) {
  if (typeof creators === "function") return (...args) => dispatch(creators(...args));
  return Object.fromEntries(
    Object.entries(creators).map(([key, ac]) => [key, (...args) => dispatch(ac(...args))])
  );
}

const { increment, addTodo } = bindActionCreators({ increment, addTodo }, store.dispatch);
increment();            // dispatches { type: "inc" }
```

## 6. Mini React-Redux (`Provider`, `useSelector`, `useDispatch`)

```jsx
import { createContext, useContext, useSyncExternalStore } from "react";

const StoreContext = createContext(null);

export function Provider({ store, children }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Wrap your app in <Provider store={store}>");
  return store;
}

export function useSelector(selector) {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())      // server snapshot
  );
}

export const useDispatch = () => useStore().dispatch;
```

```jsx
function Counter() {
  const count = useSelector((s) => s.counter);
  const dispatch = useDispatch();
  return <button onClick={() => dispatch({ type: "inc" })}>{count}</button>;
}
```

**Talking points:**
- The store lives in Context, but **Context doesn't carry the state**. Components subscribe to the store directly, so only those whose selected value changed re-render. That's why Redux scales better than putting state in Context.
- `useSyncExternalStore` prevents tearing under concurrent rendering. The real `react-redux` v8+ uses it.
- The selector must return a stable value. `s => s.todos.filter(...)` returns a new array every time and causes extra renders (or an infinite loop here). See question 7.

## 7. Memoised Selector (`createSelector`)

```js
export function createSelector(inputSelectors, resultFn) {
  let lastArgs = null;
  let lastResult;
  let recomputations = 0;

  const selector = (state, ...params) => {
    const args = inputSelectors.map((sel) => sel(state, ...params));
    if (lastArgs && args.length === lastArgs.length && args.every((a, i) => a === lastArgs[i])) {
      return lastResult;                  // inputs unchanged → same reference
    }
    lastArgs = args;
    lastResult = resultFn(...args);
    recomputations++;
    return lastResult;
  };

  selector.recomputations = () => recomputations;
  return selector;
}
```

```js
const selectTodos = (s) => s.todos;
const selectFilter = (s) => s.filter;

const selectVisibleTodos = createSelector([selectTodos, selectFilter], (todos, filter) =>
  filter === "all" ? todos : todos.filter((t) => (filter === "done" ? t.done : !t.done))
);

selectVisibleTodos(state) === selectVisibleTodos(state);   // true — same array
```

**Talking point:** this cache has size 1, like Reselect's default `lruMemoize`. If two components call the selector with different arguments (for example `selectTodosByUser(state, userId)`), they keep evicting each other's result. The fix is a selector factory (`makeSelectTodosByUser()` per component, created with `useMemo`). Reselect 5 defaults to `weakMapMemoize`, which caches many argument combinations.

## 8. `createSlice` Lite (Without Immer)

```js
export function createSlice({ name, initialState, reducers }) {
  const caseReducers = {};
  const actions = {};

  for (const [key, caseReducer] of Object.entries(reducers)) {
    const type = `${name}/${key}`;
    caseReducers[type] = caseReducer;

    const actionCreator = (payload) => ({ type, payload });
    actionCreator.type = type;
    actionCreator.match = (action) => action.type === type;
    actions[key] = actionCreator;
  }

  function reducer(state = initialState, action) {
    const caseReducer = caseReducers[action.type];
    return caseReducer ? caseReducer(state, action) : state;
  }

  return { name, reducer, actions };
}
```

```js
const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    added: (state, action) => ({ value: state.value + action.payload }),   // must return new state here
    reset: () => ({ value: 0 }),
  },
});

const { added, reset } = counterSlice.actions;
added(5);   // { type: "counter/added", payload: 5 }
```

**Talking point:** the real `createSlice` wraps each case reducer in Immer's `produce`, which is why you can write `state.value += action.payload`. Immer records the mutations on a draft proxy and produces a new immutable object.

---

# Part B — Build Features With Redux Toolkit

## Store Setup Used Below

```js
// app/store.js
import { configureStore } from "@reduxjs/toolkit";
import todosReducer from "../features/todos/todosSlice";
import usersReducer from "../features/users/usersSlice";
import cartReducer from "../features/cart/cartSlice";
import authReducer from "../features/auth/authSlice";
import { api } from "../services/api";
import { persistCart, loadCart } from "./persist";
import { listenerMiddleware } from "./listeners";

export const store = configureStore({
  reducer: {
    todos: todosReducer,
    users: usersReducer,
    cart: cartReducer,
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  preloadedState: { cart: loadCart() },
  middleware: (getDefault) =>
    getDefault()
      .prepend(listenerMiddleware.middleware)
      .concat(api.middleware, persistCart),
});
```

`configureStore` adds thunk, Redux DevTools and dev-only checks for mutation and serializability.

## 9. Todo App With Filters

```js
// features/todos/todosSlice.js
import { createSlice, createSelector, nanoid } from "@reduxjs/toolkit";

const todosSlice = createSlice({
  name: "todos",
  initialState: { items: [], filter: "all" },
  reducers: {
    todoAdded: {
      reducer(state, action) {
        state.items.push(action.payload);
      },
      prepare(text) {                                // keeps the reducer pure: id is made here
        return { payload: { id: nanoid(), text: text.trim(), done: false } };
      },
    },
    todoToggled(state, action) {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) todo.done = !todo.done;
    },
    todoEdited(state, action) {
      const { id, text } = action.payload;
      const todo = state.items.find((t) => t.id === id);
      if (todo) todo.text = text;
    },
    todoDeleted(state, action) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
    completedCleared(state) {
      state.items = state.items.filter((t) => !t.done);
    },
    filterChanged(state, action) {
      state.filter = action.payload;
    },
  },
});

export const { todoAdded, todoToggled, todoEdited, todoDeleted, completedCleared, filterChanged } =
  todosSlice.actions;
export default todosSlice.reducer;

const selectItems = (s) => s.todos.items;
export const selectFilter = (s) => s.todos.filter;

export const selectVisibleTodos = createSelector([selectItems, selectFilter], (items, filter) => {
  if (filter === "active") return items.filter((t) => !t.done);
  if (filter === "done") return items.filter((t) => t.done);
  return items;
});

export const selectRemainingCount = createSelector([selectItems], (items) =>
  items.filter((t) => !t.done).length
);
```

```jsx
// features/todos/TodoApp.jsx
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  todoAdded, todoToggled, todoDeleted, completedCleared, filterChanged,
  selectVisibleTodos, selectRemainingCount, selectFilter,
} from "./todosSlice";

export default function TodoApp() {
  const [text, setText] = useState("");          // input text is local UI state, not Redux
  const todos = useSelector(selectVisibleTodos);
  const remaining = useSelector(selectRemainingCount);
  const filter = useSelector(selectFilter);
  const dispatch = useDispatch();

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch(todoAdded(text));
    setText("");
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="New todo" />
        <button>Add</button>
      </form>

      <ul>
        {todos.map((t) => (
          <li key={t.id}>
            <label>
              <input type="checkbox" checked={t.done} onChange={() => dispatch(todoToggled(t.id))} />
              <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            </label>
            <button onClick={() => dispatch(todoDeleted(t.id))} aria-label={`Delete ${t.text}`}>×</button>
          </li>
        ))}
      </ul>

      <footer>
        <span>{remaining} left</span>
        {["all", "active", "done"].map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => dispatch(filterChanged(f))}>{f}</button>
        ))}
        <button onClick={() => dispatch(completedCleared())}>Clear completed</button>
      </footer>
    </section>
  );
}
```

**Talking points:** `prepare` generates the ID so the reducer stays deterministic. The visible list is **derived** with a memoised selector, not stored. The input text stays in `useState` because not everything belongs in Redux.

## 10. Async User List (Loading, Error, Retry, No Duplicate Requests, Abort)

```js
// features/users/usersSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchUsers = createAsyncThunk(
  "users/fetch",
  async (_, { signal, rejectWithValue }) => {
    const res = await fetch("/api/users", { signal });   // aborts when promise.abort() is called
    if (!res.ok) return rejectWithValue(`Request failed (${res.status})`);
    return res.json();
  },
  {
    // Skip if already loading or loaded: no duplicate requests from two components
    condition: (_, { getState }) => {
      const { status } = getState().users;
      return status !== "loading" && status !== "succeeded";
    },
  }
);

const usersSlice = createSlice({
  name: "users",
  initialState: { list: [], status: "idle", error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.status = "idle";                    // unmounted, not a real error
          return;
        }
        state.status = "failed";
        state.error = action.payload ?? action.error.message;
      });
  },
});

export default usersSlice.reducer;
```

```jsx
// features/users/UserList.jsx
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers } from "./usersSlice";

export default function UserList() {
  const dispatch = useDispatch();
  const { list, status, error } = useSelector((s) => s.users);

  useEffect(() => {
    const promise = dispatch(fetchUsers());
    return () => promise.abort();                  // cancel on unmount (and StrictMode remount)
  }, [dispatch]);

  if (status === "loading" || status === "idle") return <p>Loading…</p>;
  if (status === "failed") {
    return (
      <p role="alert">
        {error} <button onClick={() => dispatch(fetchUsers())}>Retry</button>
      </p>
    );
  }
  if (list.length === 0) return <p>No users yet.</p>;
  return <ul>{list.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

`useSelector((s) => s.users)` is fine here: it returns the same slice object until the slice changes.

**Talking points:**
- `condition` returning `false` means the thunk doesn't run at all and no actions are dispatched.
- `rejectWithValue` gives a clean, serializable error payload. Thrown errors land in `action.error`.
- Use `await dispatch(fetchUsers()).unwrap()` in a handler when you need try/catch, for example to show a toast.

## 11. Shopping Cart (Entity Adapter, Totals, Persistence)

```js
// features/cart/cartSlice.js
import { createSlice, createEntityAdapter, createSelector } from "@reduxjs/toolkit";

const cartAdapter = createEntityAdapter();            // state: { ids: [], entities: {} }

const cartSlice = createSlice({
  name: "cart",
  initialState: cartAdapter.getInitialState(),
  reducers: {
    itemAdded(state, action) {
      const existing = state.entities[action.payload.id];
      if (existing) existing.qty += 1;
      else cartAdapter.addOne(state, { ...action.payload, qty: 1 });
    },
    qtyChanged(state, action) {
      const { id, qty } = action.payload;
      if (qty <= 0) cartAdapter.removeOne(state, id);
      else cartAdapter.updateOne(state, { id, changes: { qty } });
    },
    itemRemoved: cartAdapter.removeOne,
    cartCleared: cartAdapter.removeAll,
  },
});

export const { itemAdded, qtyChanged, itemRemoved, cartCleared } = cartSlice.actions;
export default cartSlice.reducer;

export const { selectAll: selectCartItems, selectById: selectCartItemById } =
  cartAdapter.getSelectors((s) => s.cart);

export const selectCartSummary = createSelector([selectCartItems], (items) => {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const shipping = subtotal >= 500 || subtotal === 0 ? 0 : 50;
  return { subtotal, count, shipping, total: subtotal + shipping };
});
```

```js
// app/persist.js
export function loadCart() {
  try {
    const raw = localStorage.getItem("cart");
    return raw ? JSON.parse(raw) : undefined;          // undefined → slice's initialState
  } catch {
    return undefined;
  }
}

export const persistCart = (store) => (next) => (action) => {
  const result = next(action);
  if (typeof action.type === "string" && action.type.startsWith("cart/")) {
    try {
      localStorage.setItem("cart", JSON.stringify(store.getState().cart));
    } catch {
      /* quota exceeded or private mode: ignore */
    }
  }
  return result;
};
```

```jsx
// features/cart/Cart.jsx
import { memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { qtyChanged, selectCartItemById, selectCartSummary } from "./cartSlice";

const CartLine = memo(function CartLine({ id }) {
  const item = useSelector((s) => selectCartItemById(s, id));   // subscribes to ONE item
  const dispatch = useDispatch();
  return (
    <li>
      {item.name}
      <input
        type="number" min="0" value={item.qty}
        onChange={(e) => dispatch(qtyChanged({ id, qty: Number(e.target.value) }))}
        aria-label={`Quantity of ${item.name}`}
      />
      ₹{item.price * item.qty}
    </li>
  );
});

export function Cart() {
  const ids = useSelector((s) => s.cart.ids);
  const { subtotal, shipping, total, count } = useSelector(selectCartSummary);
  if (count === 0) return <p>Your cart is empty</p>;
  return (
    <>
      <ul>{ids.map((id) => <CartLine key={id} id={id} />)}</ul>
      <p>Subtotal ₹{subtotal} · Shipping ₹{shipping} · <strong>Total ₹{total}</strong></p>
    </>
  );
}
```

**Talking points:**
- Normalised `{ ids, entities }` gives O(1) lookups and updates.
- The parent selects only `ids`, and each row selects its own item, so changing one quantity re-renders one row and the summary.
- Persistence is a middleware, not code in every reducer.
- For a production app, `redux-persist` handles versioning and migrations.

## 12. Auth Slice + Protected Route

```js
// features/auth/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const login = createAsyncThunk("auth/login", async (credentials, { rejectWithValue }) => {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",                       // refresh token in an httpOnly cookie
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.message ?? "Login failed");
  return data;                                    // { user, accessToken }
});

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, accessToken: null, status: "idle", error: null },
  reducers: {
    loggedOut: () => ({ user: null, accessToken: null, status: "idle", error: null }),
    tokenRefreshed(state, action) {
      state.accessToken = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => { s.status = "loading"; s.error = null; })
     .addCase(login.fulfilled, (s, a) => {
       s.status = "succeeded";
       s.user = a.payload.user;
       s.accessToken = a.payload.accessToken;     // in memory only, never localStorage
     })
     .addCase(login.rejected, (s, a) => { s.status = "failed"; s.error = a.payload; });
  },
});

export const { loggedOut, tokenRefreshed } = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentUser = (s) => s.auth.user;
export const selectIsAdmin = (s) => s.auth.user?.role === "admin";
```

```jsx
// routes/ProtectedRoute.jsx
import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { selectCurrentUser } from "../features/auth/authSlice";

export function ProtectedRoute({ roles }) {
  const user = useSelector(selectCurrentUser);
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
```

```jsx
// LoginForm submit handler
async function onSubmit(values) {
  try {
    await dispatch(login(values)).unwrap();
    navigate(location.state?.from?.pathname ?? "/dashboard", { replace: true });
  } catch (message) {
    toast.error(message);
  }
}
```

**Talking point:** reset other slices on logout by listening for `loggedOut` in their `extraReducers`, or wrap the root reducer: `(state, action) => rootReducer(action.type === "auth/loggedOut" ? undefined : state, action)`.

## 13. RTK Query CRUD With Cache Tags and an Optimistic Update

```js
// services/api.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Post"],
  endpoints: (build) => ({
    getPosts: build.query({
      query: ({ page = 1, limit = 10 } = {}) => `posts?page=${page}&limit=${limit}`,
      providesTags: (result) =>
        result
          ? [...result.items.map(({ id }) => ({ type: "Post", id })), { type: "Post", id: "LIST" }]
          : [{ type: "Post", id: "LIST" }],
    }),
    getPost: build.query({
      query: (id) => `posts/${id}`,
      providesTags: (result, error, id) => [{ type: "Post", id }],
    }),
    addPost: build.mutation({
      query: (body) => ({ url: "posts", method: "POST", body }),
      invalidatesTags: [{ type: "Post", id: "LIST" }],         // refetch lists
    }),
    updatePost: build.mutation({
      query: ({ id, ...patch }) => ({ url: `posts/${id}`, method: "PATCH", body: patch }),
      async onQueryStarted({ id, ...patch }, { dispatch, queryFulfilled }) {
        // Optimistic: update the cached post immediately
        const patchResult = dispatch(
          api.util.updateQueryData("getPost", id, (draft) => {
            Object.assign(draft, patch);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();                                   // roll back on failure
        }
      },
      invalidatesTags: (result, error, { id }) => [{ type: "Post", id }],
    }),
    deletePost: build.mutation({
      query: (id) => ({ url: `posts/${id}`, method: "DELETE" }),
      invalidatesTags: (result, error, id) => [{ type: "Post", id }, { type: "Post", id: "LIST" }],
    }),
  }),
});

export const {
  useGetPostsQuery, useGetPostQuery, useAddPostMutation, useUpdatePostMutation, useDeletePostMutation,
} = api;
```

```jsx
// features/posts/PostsPage.jsx
import { useState } from "react";
import { useGetPostsQuery, useDeletePostMutation } from "../../services/api";

export default function PostsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useGetPostsQuery({ page, limit: 10 });
  const [deletePost, { isLoading: deleting }] = useDeletePostMutation();

  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p role="alert">Failed to load. <button onClick={refetch}>Retry</button></p>;

  return (
    <section style={{ opacity: isFetching ? 0.6 : 1 }}>
      <ul>
        {data.items.map((p) => (
          <li key={p.id}>
            {p.title}
            <button disabled={deleting} onClick={() => deletePost(p.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <span> Page {page} of {data.totalPages} </span>
      <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
    </section>
  );
}
```

**Talking points:**
- `isLoading` is only true for the first load. `isFetching` is true for every request, so it's used for the dimmed page change.
- Tags link mutations to queries. The `LIST` tag refetches lists after a create or delete without refetching every post.
- `updateQueryData` + `undo()` is the standard optimistic update pattern.
- Identical queries from several components are **deduplicated** into one request.

## 14. Undo / Redo (Higher-Order Reducer)

```js
export function undoable(reducer, { limit = 50 } = {}) {
  const initialState = {
    past: [],
    present: reducer(undefined, { type: "@@undoable/INIT" }),
    future: [],
  };

  return function undoableReducer(state = initialState, action) {
    const { past, present, future } = state;

    switch (action.type) {
      case "history/undo": {
        if (past.length === 0) return state;
        return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };
      }
      case "history/redo": {
        if (future.length === 0) return state;
        return { past: [...past, present], present: future[0], future: future.slice(1) };
      }
      default: {
        const next = reducer(present, action);
        if (next === present) return state;                 // unrelated action: no history entry
        return { past: [...past, present].slice(-limit), present: next, future: [] };
      }
    }
  };
}
```

```js
const store = configureStore({ reducer: { drawing: undoable(drawingReducer) } });

store.dispatch(shapeAdded({ type: "circle" }));
store.dispatch({ type: "history/undo" });
store.getState().drawing.present;            // state before the circle
```

**Talking point:** this only works because state is immutable. Each history entry is a cheap reference to an old state object, and untouched parts are shared between entries.

## 15. Debounced Search With the Listener Middleware

```js
// app/listeners.js
import { createListenerMiddleware } from "@reduxjs/toolkit";
import { queryChanged, resultsLoaded, searchFailed } from "../features/search/searchSlice";

export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: queryChanged,
  effect: async (action, listenerApi) => {
    listenerApi.cancelActiveListeners();          // cancel the previous run (debounce + no races)
    await listenerApi.delay(300);                 // throws if cancelled during the wait

    const q = action.payload.trim();
    if (!q) return listenerApi.dispatch(resultsLoaded([]));

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: listenerApi.signal });
      listenerApi.dispatch(resultsLoaded(await res.json()));
    } catch (err) {
      if (err.name !== "AbortError") listenerApi.dispatch(searchFailed(err.message));
    }
  },
});
```

```jsx
function SearchBox() {
  const dispatch = useDispatch();
  const { query, results } = useSelector((s) => s.search);
  return (
    <>
      <input value={query} onChange={(e) => dispatch(queryChanged(e.target.value))} />
      <ul>{results.map((r) => <li key={r.id}>{r.title}</li>)}</ul>
    </>
  );
}
```

**Talking point:** typing updates `query` instantly (the input stays controlled), and only the request is debounced. `cancelActiveListeners` gives "take latest" behaviour like `switchMap` in RxJS or `takeLatest` in sagas.

---

# Part C — Spot the Bug

## 16. Mutating State in a Plain Reducer

```js
// ❌ UI doesn't update
function todos(state = [], action) {
  if (action.type === "added") {
    state.push(action.payload);
    return state;                   // same reference → useSelector sees "no change"
  }
  return state;
}

// ✅
if (action.type === "added") return [...state, action.payload];
```

## 17. Mutating AND Returning in `createSlice`

```js
// ❌ Immer throws: "An immer producer returned a new value *and* modified its draft"
todoAdded(state, action) {
  state.items.push(action.payload);
  return state.items;
}

// ✅ Either mutate the draft…
todoAdded(state, action) { state.items.push(action.payload); }
// …or return a brand-new value
reset() { return initialState; }
```

A related bug is an arrow function body that returns the result of an assignment by accident: `toggled: (state) => state.on = !state.on` returns a boolean and replaces the whole slice. Use braces.

## 18. Selector That Returns a New Object Every Time

```jsx
// ❌ Re-renders on EVERY store update (new object each call);
// react-redux also warns in dev: "Selector returned a different result when called with the same parameters"
const { name, email } = useSelector((s) => ({ name: s.user.name, email: s.user.email }));

// ✅ Option 1: select primitives separately
const name = useSelector((s) => s.user.name);
const email = useSelector((s) => s.user.email);

// ✅ Option 2: shallow equality
import { shallowEqual } from "react-redux";
const { name, email } = useSelector((s) => ({ name: s.user.name, email: s.user.email }), shallowEqual);

// ✅ Option 3: for derived arrays, a memoised selector
const done = useSelector(selectDoneTodos);   // createSelector
```

## 19. Non-Serializable Values in State

```js
// ❌ Breaks DevTools, persistence and time travel; RTK warns in dev
state.createdAt = new Date();
state.callback = () => {};
state.file = fileObject;

// ✅ Store serializable data
state.createdAt = new Date().toISOString();
// Keep files, promises, sockets and class instances outside Redux (refs, module scope, RTK Query cache)
```

## 20. Side Effects in a Reducer

```js
// ❌ Impure: runs twice in StrictMode/dev, untestable, breaks time-travel
orderPlaced(state, action) {
  fetch("/api/orders", { method: "POST", body: JSON.stringify(action.payload) });
  localStorage.setItem("lastOrder", action.payload.id);
  state.orders.push({ ...action.payload, id: Date.now() });
}

// ✅ Effects go in a thunk / listener / RTK Query mutation; IDs come from prepare or the server
```

## 21. Storing Derived Data

```js
// ❌ total can drift out of sync with items
itemAdded(state, action) {
  state.items.push(action.payload);
  state.total += action.payload.price;   // forgot to update it in itemRemoved, qtyChanged…
}

// ✅ Store only items; compute total with createSelector
```

## 22. Wrong Middleware Order

```js
// ❌ logger runs before thunk: it logs functions and its "next state" is wrong for thunks
middleware: () => [logger, thunk]

// ✅ Keep RTK's defaults and append
middleware: (getDefault) => getDefault().concat(logger)
```

Also: passing a plain array to `middleware` **drops** RTK's default thunk and dev checks.

---

## 🎯 Likely Interview Questions

1. **Implement `createStore` with `getState`, `dispatch` and `subscribe`.** Why dispatch an `INIT` action?
2. **Implement `combineReducers`.** Why return the same object when nothing changed?
3. **Implement `applyMiddleware` and redux-thunk.** Why does the middleware API's `dispatch` wrap the final dispatch?
4. **What is the middleware signature `store => next => action`, and why curried?** — Setup happens once per store and once per chain link, and then the innermost function runs per action.
5. **Implement a memoised selector.** What is its cache size problem with parameters?
6. **Build a todo app with `createSlice` and filtered views.** Where should the ID be generated?
7. **Build a user list with `createAsyncThunk`.** How do you prevent duplicate requests and cancel on unmount? (`condition`, `promise.abort()`)
8. **Build a cart with totals.** Why use `createEntityAdapter` and selectors instead of storing the total?
9. **How do you do an optimistic update in RTK Query?** (`onQueryStarted` + `updateQueryData` + `undo`)
10. **How does Redux avoid re-rendering every component the way Context does?** — Components subscribe directly to the store and compare their selected value.
11. **Implement undo/redo.** Why is immutability essential?
12. **Spot the bug:** `useSelector(s => ({ a: s.a, b: s.b }))` or `state.items.push(x); return state;`

---

[← React Coding Questions](04-react-coding-questions.md) | [Index](../README.md) | [Next: Node & Express Coding Questions →](05-node-express-coding.md)
