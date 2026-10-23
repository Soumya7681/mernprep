# Chapter 42 — Async Logic with `createAsyncThunk`

## 📖 Definition

A **thunk** is a function you dispatch instead of an action object; the thunk middleware calls it with `dispatch` and `getState`, so it can do async work and dispatch real actions when it's done.

**`createAsyncThunk`** wraps that pattern: you give it an action type prefix and an async "payload creator", and it automatically dispatches three actions — `pending`, `fulfilled`, `rejected` — that your slice handles in `extraReducers`.

## 🔍 Lifecycle of a Thunk

```text
dispatch(fetchUsers({ page: 1 }))
   │
   ├─► "users/fetch/pending"     meta: { arg, requestId }
   │
   ├─ await payloadCreator(arg, thunkAPI)
   │
   ├─► "users/fetch/fulfilled"   payload: returned value
   │        or
   └─► "users/fetch/rejected"    payload: rejectWithValue(...)  |  error: serialized Error
```

## 💻 Code Example — Typed Thunk with `rejectWithValue`

```ts
// features/users/usersSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Paginated, PublicUser } from "@app/shared";
import { http, HttpError } from "../../services/http";

interface ApiErrorPayload { code: string; message: string }

//                  ┌ return type          ┌ argument type          ┌ thunkAPI config
export const fetchUsers = createAsyncThunk<Paginated<PublicUser>, { page: number; search?: string }, { rejectValue: ApiErrorPayload }>(
  "users/fetch",
  async ({ page, search }, { rejectWithValue, signal }) => {
    try {
      const qs = new URLSearchParams({ page: String(page), ...(search && { search }) });
      return await http.get<Paginated<PublicUser>>(`/api/users?${qs}`, { signal });
    } catch (err) {
      if (err instanceof HttpError) return rejectWithValue({ code: err.code, message: err.message });
      throw err;   // unexpected → lands in action.error
    }
  },
);

type Status = "idle" | "loading" | "succeeded" | "failed";

interface UsersState {
  list: PublicUser[];
  total: number;
  page: number;
  status: Status;
  error: string | null;
}

const initialState: UsersState = { list: [], total: 0, page: 1, status: "idle", error: null };

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.page = action.meta.arg.page;            // the original argument is in meta
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload.items;            // typed as PublicUser[]
        state.total = action.payload.total;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        if (action.meta.aborted) return;              // cancelled, not an error
        state.status = "failed";
        state.error = action.payload?.message ?? action.error.message ?? "Unknown error";
      });
  },
});

export default usersSlice.reducer;
```

`action.payload` on `rejected` is your `rejectValue` (if you called `rejectWithValue`); otherwise `action.error` holds a serialised `Error` (`{ name, message, stack }`).

## 💻 Code Example — Pre-typed `createAppAsyncThunk`

Typing `state` and `dispatch` on every thunk is repetitive. Create a typed version once:

```ts
// app/createAppAsyncThunk.ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState, AppDispatch } from "./store";

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: { code: string; message: string };
}>();
```

```ts
export const saveCart = createAppAsyncThunk("cart/save", async (_: void, { getState }) => {
  const { items } = getState().cart;        // getState() is RootState — fully typed
  return http.put<{ savedAt: string }>("/api/cart", { items });
});
```

## 💻 Code Example — Avoid Duplicate Requests with `condition`

```ts
export const fetchUsers = createAppAsyncThunk(
  "users/fetch",
  async (arg: { page: number }) => http.get<Paginated<PublicUser>>(`/api/users?page=${arg.page}`),
  {
    // Returning false cancels the thunk BEFORE pending is dispatched
    condition: (arg, { getState }) => {
      const { status, page } = getState().users;
      if (status === "loading" && page === arg.page) return false;
    },
  },
);
```

## 💻 Code Example — Using Thunks in Components (`unwrap`, abort)

```tsx
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchUsers } from "./usersSlice";
import { createUser } from "./usersThunks";

export function UsersPage() {
  const dispatch = useAppDispatch();
  const { list, status, error, page } = useAppSelector((s) => s.users);

  useEffect(() => {
    const promise = dispatch(fetchUsers({ page }));
    return () => promise.abort();       // cancels on unmount/page change → aborts fetch via `signal`
  }, [dispatch, page]);

  if (status === "loading") return <p>Loading…</p>;
  if (status === "failed") return <p role="alert">{error}</p>;
  return <ul>{list.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}

function CreateUserForm() {
  const dispatch = useAppDispatch();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(dto: { name: string; email: string; password: string }) {
    try {
      // unwrap() returns the payload or THROWS the rejected value → easy try/catch
      const user = await dispatch(createUser(dto)).unwrap();
      setMsg(`Created ${user.name}`);
    } catch (err) {
      setMsg((err as { message: string }).message);
    }
  }
  /* … form JSX … */
}
```

## 💻 Code Example — Optimistic Update with Rollback

```ts
export const toggleTodo = createAppAsyncThunk(
  "todos/toggle",
  async (id: string, { getState, rejectWithValue }) => {
    const todo = getState().todos.entities[id];
    try {
      return await http.patch<Todo>(`/api/todos/${id}`, { done: !todo?.done });
    } catch {
      return rejectWithValue({ code: "TOGGLE_FAILED", message: "Could not update todo" });
    }
  },
);

// in todosSlice extraReducers
builder
  .addCase(toggleTodo.pending, (state, action) => {
    const t = state.entities[action.meta.arg];
    if (t) t.done = !t.done;                      // flip immediately
  })
  .addCase(toggleTodo.rejected, (state, action) => {
    const t = state.entities[action.meta.arg];
    if (t) t.done = !t.done;                      // flip back on failure
  });
```

## 💻 Code Example — Global Loading/Error with Matchers

```ts
import { isPending, isRejected, isFulfilled, createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { pendingRequests: 0, lastError: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(isPending, (s) => { s.pendingRequests += 1; })
      .addMatcher(isFulfilled, (s) => { s.pendingRequests = Math.max(0, s.pendingRequests - 1); })
      .addMatcher(isRejected, (s, a) => {
        s.pendingRequests = Math.max(0, s.pendingRequests - 1);
        s.lastError = a.error.message ?? "Request failed";
      });
  },
});
// <TopProgressBar visible={pendingRequests > 0} />
```

## 📊 Async Options in Redux

| Approach | Use when |
|----------|----------|
| `createAsyncThunk` | One-off async flows: login, checkout, file upload, anything with custom logic |
| **RTK Query** (next chapter) | Fetching & caching server data (lists, details, CRUD) — preferred for data fetching |
| Listener middleware | "When action X happens, do Y" — side effects reacting to actions (Chapter 27) |
| Redux-Saga | Complex long-running workflows with generators; legacy codebases |

## 🌍 Real-World Impact

- `status` enums with a typed `rejectValue` give every screen consistent loading/error UI.
- `abort()` + `signal` prevents out-of-order responses overwriting newer results (search-as-you-type race).
- `unwrap()` keeps form-submission code readable with plain `try/catch`.

## 🎯 Likely Interview Questions

1. **What is a thunk?** — A function dispatched instead of an action; the middleware calls it with `dispatch` and `getState`.
2. **What actions does `createAsyncThunk` dispatch?** — `pending`, `fulfilled`, `rejected` (with `meta.arg` and `meta.requestId`).
3. **How do you type a thunk?** — `createAsyncThunk<Returned, Arg, { state; rejectValue }>` or a pre-typed `createAsyncThunk.withTypes<…>()`.
4. **What is `rejectWithValue` for?** — Return a typed, serialisable error payload instead of a generic `action.error`.
5. **What does `.unwrap()` do?** — Turns the dispatched thunk's result into a promise that resolves with the payload or throws the error.
6. **How do you cancel a thunk?** — Call `.abort()` on the returned promise; pass `signal` to `fetch`; or use `condition` to skip it.
7. **Thunk vs RTK Query?** — Thunks for custom workflows; RTK Query for server-state caching, dedup, refetching, invalidation.
8. **How do you handle a race condition in search?** — Abort the previous request, or ignore results whose `requestId` isn't the latest.

---

[← Redux Toolkit with TypeScript](02-redux-toolkit-typescript.md) | [Index](../README.md) | [Next: RTK Query →](04-rtk-query.md)
