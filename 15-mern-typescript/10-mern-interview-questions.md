# Chapter 92 — MERN + TypeScript Interview Questions (Rapid-Fire)

## 📖 How to Use This Chapter

Short answers you can say out loud in 20–40 seconds. Each block links back to the chapter with the full explanation and code. Read it the day before the interview, together with the **Night-Before Revision** sheet.

---

## 🟦 TypeScript

| # | Question | Answer |
|---|----------|--------|
| 1 | Why TypeScript in MERN? | Catches bugs at compile time, safe refactors across client + server, shared contracts, better tooling. |
| 2 | `type` vs `interface`? | Interface: extendable object shapes, declaration merging. Type: unions, tuples, mapped/conditional types. |
| 3 | `any` vs `unknown`? | `any` turns checks off; `unknown` forces narrowing. Use `unknown` for untrusted data. |
| 4 | What is `never`? | A value that can't exist — unreachable code, exhaustive `switch` checks, functions that throw. |
| 5 | Discriminated union? | Union with a common literal field (`status`) TS can narrow on. Models loading/success/error states. |
| 6 | Generics? | Type parameters: `Paginated<T>`, `ApiResponse<T>`, generic components like `DataTable<T>`. |
| 7 | Utility types you use daily? | `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited`, `NonNullable`. |
| 8 | `satisfies`? | Checks a value against a type without widening the inferred type. |
| 9 | Does TS validate at runtime? | No. Types are erased — validate at boundaries (express-validator, type guards). |
| 10 | What's a type guard? | Function returning `v is T` that narrows `unknown` to `T` after a runtime check. |

## 🟩 Node.js + Express (typed)

| # | Question | Answer |
|---|----------|--------|
| 11 | How do you type `req.body`? | `Request<Params, ResBody, ReqBody, Query>` generics + runtime validation. |
| 12 | How do you add `req.user`? | Declaration merging in `types/express.d.ts` on `Express.Request`. |
| 13 | Async errors in Express 4 vs 5? | 4 needs try/catch or `asyncHandler`; 5 forwards rejected promises to `next` automatically. |
| 14 | Central error handling? | `AppError` class with status + code; one 4-arg error middleware maps errors to a consistent JSON envelope. |
| 15 | Controller vs service? | Controller = HTTP in/out; service = business logic, no `req`/`res`, reusable and testable. |
| 16 | Why split `app.ts` and `index.ts`? | Tests import the app without opening a port; clean bootstrap and shutdown. |
| 17 | How do you validate env vars? | Parse once at boot into a typed `env` object; exit with all errors listed. |
| 18 | Mass assignment? | Client sends extra fields like `role`. Whitelist with `matchedData()` / DTO mapping. |
| 19 | Graceful shutdown? | On SIGTERM: `server.close()`, finish in-flight requests, disconnect DB, exit. |
| 20 | How to scale Node? | Stateless instances behind a load balancer, cluster/PM2, Redis, caching, indexes, queues for heavy work. |

## 🟫 MongoDB + Mongoose (typed)

| # | Question | Answer |
|---|----------|--------|
| 21 | How do you type a model? | `Schema<IUser, UserModel, IUserMethods>` + `model<IUser, UserModel>()`, or `InferSchemaType`. |
| 22 | `HydratedDocument`? | The document type returned by queries: fields + `save()` + methods. |
| 23 | What does `.lean()` return? | Plain object — faster, no methods/virtuals/getters. Use for read-only endpoints. |
| 24 | Why aren't validators running on update? | Update validators are opt-in: `runValidators: true`. |
| 25 | Typed `populate`? | `.populate<{ user: IUser }>("user")`. |
| 26 | When do you need transactions? | Atomic multi-document writes (order + stock). Requires a replica set. |
| 27 | Hide the password? | `select: false`, `toJSON` transform, DTO mapper. |
| 28 | Duplicate email error? | Unique index → error code `11000` → map to 409. |
| 29 | Index for "my tasks, newest first"? | `{ owner: 1, done: 1, createdAt: -1 }` (Equality, Sort, Range). |
| 30 | Prevent NoSQL injection? | Validate types, `sanitizeFilter`, `strictQuery`, never pass raw `req.body` into a filter. |

## 🟪 React + TypeScript

| # | Question | Answer |
|---|----------|--------|
| 31 | Type children? | `children: ReactNode`. |
| 32 | `React.FC` or not? | Plain function with typed props — simpler, works with generics. |
| 33 | `useState` with null? | `useState<User \| null>(null)`. |
| 34 | Event types? | `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`, `React.MouseEvent<…>`. |
| 35 | Refs in React 19? | `ref` is a normal prop; `forwardRef` isn't needed. |
| 36 | Type-safe Context? | `createContext<T \| null>(null)` + hook that throws outside the provider. |
| 37 | Extend native props? | `interface Props extends ComponentPropsWithoutRef<"button">`. |
| 38 | Generic component? | `function List<T>(props: { items: T[]; render: (t: T) => ReactNode })`. |

## 🟥 Redux

| # | Question | Answer |
|---|----------|--------|
| 39 | Three principles of Redux? | Single store, read-only state (change via actions), pure reducers. |
| 40 | Data flow? | dispatch(action) → middleware → reducer → new state → subscribers/`useSelector` re-render. |
| 41 | Why immutable updates? | React-Redux compares references; mutation = no re-render, and breaks time-travel. |
| 42 | What does RTK add? | `createSlice`, Immer, `configureStore` defaults, `createAsyncThunk`, RTK Query, entity adapter. |
| 43 | How do RTK reducers "mutate"? | Immer drafts → produces a new immutable state. |
| 44 | `RootState` / `AppDispatch`? | `ReturnType<typeof store.getState>` / `typeof store.dispatch`. |
| 45 | Typed hooks? | `useDispatch.withTypes<AppDispatch>()`, `useSelector.withTypes<RootState>()`. |
| 46 | `reducers` vs `extraReducers`? | Own actions vs actions from thunks / other slices / RTK Query. |
| 47 | `createAsyncThunk` actions? | `pending`, `fulfilled`, `rejected`; `rejectWithValue` for typed errors; `.unwrap()` in components. |
| 48 | RTK Query tags? | `providesTags` labels cached data; `invalidatesTags` on mutations triggers refetch. |
| 49 | `isLoading` vs `isFetching`? | First load vs any in-flight request. |
| 50 | Optimistic update? | `onQueryStarted` → `updateQueryData` → `patch.undo()` on failure. |
| 51 | Why memoize selectors? | Selectors returning new arrays/objects cause re-renders on every action; `createSelector` caches. |
| 52 | Normalised state? | `{ ids, entities }` — one copy per entity, O(1) lookup; `createEntityAdapter`. |
| 53 | Listener middleware? | Run side effects in response to actions (debounced save, analytics); replaces most sagas. |
| 54 | Redux vs Context? | Context = DI, re-renders all consumers; Redux = selector subscriptions, devtools, middleware. |
| 55 | Server vs client state? | Server data → RTK Query/TanStack Query; UI/client data → slices or local state. |

## 🟧 Auth & Security

| # | Question | Answer |
|---|----------|--------|
| 56 | Where to store tokens? | Access token in memory (Redux); refresh token in httpOnly Secure SameSite cookie. |
| 57 | Why access + refresh? | Short exposure window for access token; long session via refresh. |
| 58 | Refresh-token rotation? | New refresh token each refresh; old one invalid; reuse signals theft. |
| 59 | Logging out with JWT? | Short expiry + invalidate refresh server-side (`tokenVersion` / sessions). |
| 60 | Session survives reload? | Call `/auth/refresh` on app start — cookie is sent automatically. |
| 61 | Parallel 401s? | Share one refresh promise, retry queued requests. |
| 62 | RBAC? | `requireRole()` middleware on the server; route guards on the client are UX only. |
| 63 | IDOR? | Accessing other users' records by id — scope every query by owner, return 404. |

## 🟨 Testing & Deployment

| # | Question | Answer |
|---|----------|--------|
| 64 | Test an Express API? | `createApp()` + Supertest + mongodb-memory-server. |
| 65 | Test Redux components? | Real store via `setupStore(preloadedState)` + MSW for network + RTL queries by role. |
| 66 | Unit vs integration vs E2E? | Most tests integration; unit for pure logic; few E2E for critical flows. |
| 67 | TS in production? | Compile with `tsc`, run `node dist/…`; type-check in CI. |
| 68 | Security middleware? | helmet, CORS with exact origin, rate limiting, body limits, validation. |
| 69 | Liveness vs readiness? | Process alive vs can serve traffic (DB connected). |
| 70 | Docker best practices? | Multi-stage, `npm ci --omit=dev`, non-root user, healthcheck. |

---

## 🧩 Scenario Questions (Explain Your Approach)

1. **"Build a task manager with login in 2 hours."** — Monorepo, shared types; Express + Mongoose tasks module scoped by owner; JWT auth with refresh cookie; RTK Query for tasks, slice for filters; tests for auth and ownership. (Full-Stack Walkthrough chapter.)
2. **"The tasks list is slow with 100k documents."** — Check `explain()`; add compound index matching filter + sort; `.lean()`; paginate (cursor-based for deep pages); project only needed fields; cache hot queries in Redis.
3. **"Users see stale data after editing."** — Missing `invalidatesTags` or wrong tag ids; or `providesTags` not covering the list (`LIST` tag).
4. **"Every keypress in the search box re-renders the whole page."** — Local `useState` for input + `useDebounce`; select primitives; memoize selectors; `memo` rows.
5. **"A user can see another user's orders by changing the URL id."** — IDOR. Scope the DB query by `owner`, return 404, add a test.
6. **"Refresh token was stolen."** — Rotation + reuse detection → invalidate all sessions for that user; force re-login; investigate XSS.
7. **"App works locally but cookies don't work in production."** — `secure` cookie on HTTP, missing `trust proxy`, cross-site domains need `SameSite=none; Secure`, CORS missing `credentials: true`.
8. **"How would you add real-time notifications?"** — Socket.IO with JWT auth on handshake; rooms per user; client listener dispatches `api.util.invalidateTags` or updates the cache; Redis adapter when scaling to many instances.

## 🗣️ "Tell Me About a MERN Project" — Answer Template

> "I built **[project]**, a MERN app in TypeScript for **[users / problem]**. The backend is Express with a layered structure — routes, controllers, services and Mongoose models — with shared types between client and server, so API changes break the build instead of production. Auth uses short-lived JWT access tokens kept in Redux memory and rotating refresh tokens in httpOnly cookies. On the frontend I used Redux Toolkit for client state and RTK Query for server data, with tag-based invalidation and optimistic updates. One challenge was **[specific problem — e.g. slow list endpoint]**; I fixed it by **[compound index + lean + pagination]**, which brought p95 latency from **[X]** to **[Y]**. It's tested with Supertest + in-memory Mongo and deployed with Docker on **[platform]** with MongoDB Atlas."

Replace the brackets with **your real numbers** — specifics are what interviewers remember.

---

[← Production & Deployment](09-production-deployment.md) | [Index](../README.md) | [Next: JS Predict-the-Output →](../23-coding-questions/01-js-output-questions.md)
