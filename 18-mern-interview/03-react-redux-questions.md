# Chapter 106 — MERN Interview: React & Redux Questions

## 📖 How to Use This Chapter

Practical React and Redux questions asked in MERN interviews, with short answers and code. Deep dives are in the **React** and **Redux** sections.

---

## ⚛️ React

### 1. What is the virtual DOM and reconciliation?

React keeps a lightweight copy of the UI in memory. On state change it builds a new tree, **diffs** it with the old one, and applies only the minimal changes to the real DOM. `key` props help React match list items between renders.

### 2. Why are keys important? Why not use the array index?

Keys tell React which item is which. Using the index breaks when items are inserted, deleted or reordered — React reuses the wrong component, so input values or state appear on the wrong row. Use a stable ID from the data.

### 3. State vs props?

Props are inputs passed from the parent (read-only in the child). State is data a component owns and changes over time, causing a re-render.

### 4. Explain `useEffect` and its dependency array.

```jsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/orders?page=${page}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setOrders)
    .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
  return () => controller.abort();          // cleanup: runs before next effect and on unmount
}, [page]);                                 // re-run only when page changes
```

- No array → runs after every render.
- `[]` → once after mount.
- `[a, b]` → when `a` or `b` change.
- Cleanup avoids memory leaks and race conditions (old responses overwriting new ones).

### 5. Why does my effect run twice in development?

React 18+ **StrictMode** mounts, unmounts and re-mounts components in development to reveal missing cleanups. It doesn't happen in production. Fix the cleanup, don't remove StrictMode.

### 6. `useMemo` vs `useCallback` vs `React.memo`?

| | What it memoizes | Use when |
|---|------------------|----------|
| `useMemo` | A computed **value** | Expensive calculation, or stable object/array passed to a memoized child |
| `useCallback` | A **function** reference | Passing callbacks to `React.memo` children or as effect dependencies |
| `React.memo` | A **component**'s render | Child re-renders often with the same props |

Don't wrap everything — memoization has a cost. Measure with React DevTools Profiler first.

### 7. Controlled vs uncontrolled components?

Controlled: value lives in React state (`value` + `onChange`) — easy validation. Uncontrolled: DOM keeps the value, read with a `ref` or `FormData` — less re-rendering. Form libraries like React Hook Form use uncontrolled inputs for performance.

### 8. How do you share state between components?

1. Lift state up to the nearest common parent.
2. Context for low-frequency global values (theme, current user, language).
3. Redux Toolkit / Zustand for complex, frequently updated shared state.
4. RTK Query / TanStack Query for **server** data (lists, details).

### 9. What is prop drilling and how do you avoid it?

Passing props through many layers that don't use them. Fix with composition (`children`), Context, or a state library.

### 10. What causes unnecessary re-renders and how do you fix them?

Causes: parent re-render, new object/array/function props each render, context value changing, state updates with the same data. Fixes: `React.memo`, `useMemo`/`useCallback`, splitting context, moving state down, selecting minimal data from Redux.

### 11. How do you optimise a slow React page?

- Profile with React DevTools; check bundle size.
- Code splitting with `React.lazy` + `Suspense` for routes.
- Virtualise long lists (`react-window`).
- Debounce search inputs.
- Memoize expensive components/calculations.
- Optimise images (lazy loading, correct sizes).
- Cache API data (RTK Query/TanStack Query).

### 12. Custom hooks — example?

```jsx
function useFetch(url) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    const c = new AbortController();
    fetch(url, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e) => e.name !== "AbortError" && setState({ data: null, loading: false, error: e.message }));
    return () => c.abort();
  }, [url]);
  return state;
}
```

### 13. How do you handle authentication in React?

Store the access token in memory (Redux/context), refresh token in an httpOnly cookie; an Axios/RTK Query layer attaches the token and refreshes on 401; protected routes redirect to login; the server is the real security check.

### 14. How do you implement protected routes (React Router v6)?

```jsx
function RequireAuth({ roles }) {
  const user = useSelector((s) => s.auth.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
```

### 15. Error boundaries?

Class components with `getDerivedStateFromError` / `componentDidCatch` that show a fallback UI when a child **throws during render**. They don't catch errors in event handlers or async code.

### 16. What's new in React 18/19 that you've used?

- Automatic batching of state updates.
- `useTransition` / `useDeferredValue` for responsive UIs during heavy updates.
- React 19: `ref` as a normal prop, Actions and `useActionState` for forms, `use()` hook, Server Components (with frameworks like Next.js).

### 17. SPA vs SSR (Next.js)? When would you use Next.js?

SPA renders in the browser — great for dashboards behind login. SSR/SSG (Next.js) renders HTML on the server — better SEO and first load for public pages (e-commerce, blogs).

---

## 🟣 Redux

### 18. Why Redux? When not to use it?

Use it for complex shared client state many components read and update, when you want predictable updates, DevTools and middleware. Don't use it for simple apps, local UI state, or as a manual cache for API data (use RTK Query instead).

### 19. Explain the Redux flow.

Component **dispatches** an action → middleware (thunks, logging) → **reducer** computes new state (pure, immutable) → store updates → components using `useSelector` re-render if their selected data changed.

### 20. What does Redux Toolkit improve?

`createSlice` generates actions and reducers, Immer lets you write "mutating" code safely, `configureStore` sets up DevTools and thunk, `createAsyncThunk` handles async, RTK Query handles data fetching and caching.

```js
const cartSlice = createSlice({
  name: "cart",
  initialState: { items: [] },
  reducers: {
    itemAdded(state, action) { state.items.push(action.payload); },
    itemRemoved(state, action) { state.items = state.items.filter((i) => i.id !== action.payload); },
  },
});
```

### 21. How do you make API calls in Redux?

- `createAsyncThunk` → handle `pending`/`fulfilled`/`rejected` in `extraReducers`.
- Or **RTK Query** (preferred for CRUD): auto caching, loading flags, refetch after mutations via tags.

### 22. What is RTK Query's tag invalidation?

Queries **provide** tags (e.g. `{ type: "Order", id: "LIST" }`); mutations **invalidate** tags. When you create an order, list queries with the `Order/LIST` tag refetch automatically — no manual refresh.

### 23. Why must reducers be pure?

Same input → same output, no side effects. Makes state predictable, testable, and enables time-travel debugging. API calls belong in thunks/RTK Query.

### 24. What is a selector and why use `createSelector`?

A function that reads data from the store. `createSelector` memoizes derived data (filtered lists, totals) so components don't re-render unnecessarily.

### 25. Redux vs Context API?

Context is for passing values down (re-renders all consumers on change). Redux has selector-based subscriptions (only affected components re-render), DevTools, middleware and structure for large apps.

### 26. How do you persist Redux state (e.g. cart) after refresh?

Save selected slices to `localStorage` (throttled `store.subscribe` or `redux-persist`) and load them as `preloadedState`. Never persist tokens in `localStorage`.

### 27. How do you test React + Redux components?

React Testing Library with a real store (`renderWithProviders`), mock APIs with MSW, test user behaviour (click, type, see text) rather than implementation details.

---

[← JavaScript & TypeScript Questions](02-javascript-typescript-questions.md) | [Index](../README.md) | [Next: Node.js & Express Questions →](04-node-express-questions.md)
