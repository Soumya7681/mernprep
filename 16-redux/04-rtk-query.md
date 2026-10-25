# Chapter 48 — RTK Query with TypeScript

## 📖 Definition

**RTK Query** is Redux Toolkit's built-in data-fetching and caching layer. You describe your API endpoints once with `createApi`; it generates typed React hooks (`useGetUsersQuery`, `useCreateUserMutation`) and handles loading state, caching, de-duplication, re-fetching and cache invalidation for you.

## 🔍 Why RTK Query Instead of Thunks for Data Fetching?

| Concern | Hand-written thunk | RTK Query |
|---------|-------------------|-----------|
| Loading / error flags | Write per slice | `isLoading`, `isFetching`, `isError`, `error` |
| Caching | DIY | Automatic, keyed by endpoint + argument |
| Two components need the same data | Two requests (unless you add logic) | One request, shared cache |
| Refetch after a mutation | Manually dispatch again | `invalidatesTags` → auto refetch |
| Polling, refetch on focus/reconnect | DIY | Options |
| Cache cleanup | Never (memory grows) | Unused data removed after 60s (`keepUnusedDataFor`) |

**Server state** (data owned by the backend) ≠ **client state** (cart, theme). RTK Query is for the first; slices are for the second.

## 💻 Code Example — Defining the API

```ts
// services/api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../app/store";
import type { Paginated, PublicUser, CreateUserDto, UpdateUserDto } from "@app/shared";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  ownerId: string;
  createdAt: string;
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    credentials: "include",                             // send the refresh-token cookie
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["User", "Task"],
  endpoints: (builder) => ({
    //               ┌ result type          ┌ argument type
    getUsers: builder.query<Paginated<PublicUser>, { page: number; search?: string }>({
      query: ({ page, search }) => ({ url: "/users", params: { page, search } }),
      providesTags: (result) =>
        result
          ? [...result.items.map((u) => ({ type: "User" as const, id: u.id })), { type: "User", id: "LIST" }]
          : [{ type: "User", id: "LIST" }],
    }),

    getUser: builder.query<PublicUser, string>({
      query: (id) => `/users/${id}`,
      // Unwrap our { success, data } envelope so components get the entity directly
      transformResponse: (res: { success: true; data: PublicUser }) => res.data,
      providesTags: (_r, _e, id) => [{ type: "User", id }],
    }),

    createUser: builder.mutation<PublicUser, CreateUserDto>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: [{ type: "User", id: "LIST" }],   // refetch any user list
    }),

    updateUser: builder.mutation<PublicUser, { id: string } & UpdateUserDto>({
      query: ({ id, ...patch }) => ({ url: `/users/${id}`, method: "PATCH", body: patch }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "User", id }],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [{ type: "User", id }, { type: "User", id: "LIST" }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = api;
```

Register it in the store (Chapter 23): add `[api.reducerPath]: api.reducer` and `.concat(api.middleware)`. Call `setupListeners(store.dispatch)` once to enable `refetchOnFocus` / `refetchOnReconnect`.

## 🔍 How Tags Work

```text
getUsers({page:1})  provides  [User:a, User:b, User:LIST]
getUser("a")        provides  [User:a]

updateUser({id:"a"}) invalidates [User:a]
   → getUser("a") refetches
   → getUsers({page:1}) refetches  (it also provided User:a)

createUser(...)     invalidates [User:LIST]
   → only list queries refetch
```

## 💻 Code Example — Queries in Components

```tsx
import { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetUsersQuery, useGetUserQuery } from "../../services/api";

export function UserList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetUsersQuery(
    { page },
    { refetchOnMountOrArgChange: 30 },   // refetch if cached data is older than 30s
  );

  if (isLoading) return <p>Loading…</p>;                 // first load only
  if (isError) return <ErrorBox error={error} onRetry={refetch} />;

  return (
    <>
      {isFetching && <small>Updating…</small>}           {/* background refetch */}
      <ul>{data?.items.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <button onClick={() => setPage((p) => p + 1)}>Next</button>
    </>
  );
}

export function UserDetails({ id }: { id?: string }) {
  // skipToken: don't run the query until we have an id (typed alternative to { skip: true })
  const { data: user } = useGetUserQuery(id ?? skipToken);
  return user ? <h2>{user.name}</h2> : null;
}
```

`isLoading` = no data yet; `isFetching` = any request in flight (including background refetch). Showing a full spinner on `isFetching` makes pagination flicker.

## 💻 Code Example — Typed Error Handling

```ts
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

export function isFetchBaseQueryError(e: unknown): e is FetchBaseQueryError {
  return typeof e === "object" && e != null && "status" in e;
}

export function errorMessage(e: FetchBaseQueryError | SerializedError | undefined): string {
  if (!e) return "";
  if (isFetchBaseQueryError(e)) {
    // our Express error envelope: { success:false, code, message }
    const data = e.data as { message?: string } | undefined;
    return data?.message ?? `Request failed (${String(e.status)})`;
  }
  return e.message ?? "Unexpected error";
}
```

## 💻 Code Example — Mutations

```tsx
import { useCreateUserMutation } from "../../services/api";
import { errorMessage } from "../../services/errors";   // helper from the previous example

export function NewUserForm() {
  const [createUser, { isLoading, error }] = useCreateUserMutation();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;      // capture now: currentTarget is null after an await
    const form = new FormData(formEl);
    try {
      await createUser({
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      }).unwrap();                       // throws on error
      formEl.reset();
    } catch {
      /* error is also available from the hook state */
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <input name="password" type="password" minLength={8} required />
      <button disabled={isLoading}>{isLoading ? "Saving…" : "Create"}</button>
      {error && <p role="alert">{errorMessage(error)}</p>}
    </form>
  );
}
```

## 💻 Code Example — Optimistic Update (`onQueryStarted`)

```ts
toggleTask: builder.mutation<Task, { id: string; done: boolean; page: number }>({
  query: ({ id, done }) => ({ url: `/tasks/${id}`, method: "PATCH", body: { done } }),
  async onQueryStarted({ id, done, page }, { dispatch, queryFulfilled }) {
    // 1. Patch the cached list immediately
    const patch = dispatch(
      api.util.updateQueryData("getTasks", { page }, (draft) => {
        const task = draft.items.find((t) => t.id === id);
        if (task) task.done = done;
      }),
    );
    try {
      await queryFulfilled;      // 2. Wait for the server
    } catch {
      patch.undo();              // 3. Roll back if it failed
    }
  },
}),
```

## 💻 Code Example — Automatic Token Refresh (`baseQueryWithReauth`)

When the access token expires the API returns 401. Wrap the base query to call `/auth/refresh` once, then retry.

```ts
import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { tokenRefreshed, loggedOut } from "../features/auth/authSlice";

const rawBaseQuery = fetchBaseQuery({ /* same config as above */ baseUrl: "/api", credentials: "include" });

let refreshing: Promise<boolean> | null = null;   // share one refresh between parallel 401s

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> =
  async (args, api, extraOptions) => {
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status === 401) {
      refreshing ??= (async () => {
        const r = await rawBaseQuery({ url: "/auth/refresh", method: "POST" }, api, extraOptions);
        const data = r.data as { accessToken: string } | undefined;
        if (data) api.dispatch(tokenRefreshed(data.accessToken));
        else api.dispatch(loggedOut());
        return Boolean(data);
      })().finally(() => { refreshing = null; });

      if (await refreshing) result = await rawBaseQuery(args, api, extraOptions);   // retry once
    }
    return result;
  };

// createApi({ baseQuery: baseQueryWithReauth, ... })
```

## 💻 Code Example — Splitting a Large API (`injectEndpoints`)

```ts
// features/tasks/tasksApi.ts
import { api } from "../../services/api";

export const tasksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<Paginated<Task>, { page: number }>({
      query: ({ page }) => `/tasks?page=${page}`,
      providesTags: [{ type: "Task", id: "LIST" }],
    }),
  }),
});

export const { useGetTasksQuery } = tasksApi;
```

Each feature folder owns its endpoints, but they share **one** cache, middleware and base query.

## 📊 RTK Query vs TanStack Query

| | RTK Query | TanStack Query |
|---|-----------|----------------|
| Lives in | Redux store (DevTools, same middleware) | Its own QueryClient |
| API definition | Central `createApi`, endpoints declared upfront | Inline `useQuery({ queryKey, queryFn })` per call |
| Invalidation | Tags (`providesTags` / `invalidatesTags`) | Query keys (`invalidateQueries`) |
| Codegen | From OpenAPI (`@rtk-query/codegen-openapi`) | Community tools |
| Pick when | You already use Redux | No Redux, or you want maximum flexibility |

## 🌍 Real-World Impact

- Typical CRUD screens lose 60–80% of their data-fetching code: no slice, no thunks, no loading flags.
- Tag invalidation means "I edited a user but the list still shows the old name" bugs disappear.
- A single shared refresh promise stops a burst of parallel 401s from triggering 10 refresh calls.

## 🎯 Likely Interview Questions

1. **What is RTK Query and when would you use it?** — Data fetching + caching layer in RTK; for server state in Redux apps.
2. **How does caching work?** — Cache entry per endpoint + serialised argument; components subscribe; unused entries are removed after `keepUnusedDataFor` (60s).
3. **Explain `providesTags` and `invalidatesTags`.** — Queries label their data; mutations declare which labels became stale → matching queries refetch.
4. **`isLoading` vs `isFetching`?** — First load without data vs any in-flight request.
5. **How do you do optimistic updates?** — `onQueryStarted` + `api.util.updateQueryData` + `patch.undo()` on failure.
6. **How do you attach a JWT and refresh it?** — `prepareHeaders` for the header; a custom `baseQuery` that catches 401, refreshes once and retries.
7. **How do you conditionally skip a query?** — Pass `skipToken` or `{ skip: true }`.
8. **RTK Query vs TanStack Query?** — See table; same ideas, different home for the cache.

---

[← Async Logic with Thunks](03-async-thunks.md) | [Index](../README.md) | [Next: Selectors & Normalised State →](05-selectors-normalization.md)
