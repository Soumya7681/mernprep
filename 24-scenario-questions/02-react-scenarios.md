# Chapter 98 — React Scenarios

## 📖 Definition

React scenario questions describe a symptom in a real app — slowness, flicker, stale data, infinite loops, broken state — and ask how you would find and fix the cause. Use the five-step structure: **clarify → hypothesise → verify → fix → prevent**.

---

### Scenario 1 — "The page is slow; typing in a search box lags."

**Clarify:** which interaction? how many items? production build or dev?

**Verify:** React DevTools **Profiler** → record typing → see which components re-render and how long each takes. Enable "Highlight updates when components render".

**Likely causes and fixes**
| Cause | Fix |
|---|---|
| The whole page re-renders on each keystroke because state lives too high | Move the input's state down into the component that needs it (colocation) |
| Expensive filtering on every render | `useMemo` the filtered list |
| Thousands of DOM rows | Virtualise with `react-window` / `@tanstack/react-virtual` |
| Children re-render with unchanged props | `React.memo` + stable props (`useCallback`) |
| Rendering itself is unavoidable | `useDeferredValue` / `useTransition` so typing stays responsive |

```jsx
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => filterProducts(products, deferredQuery), [products, deferredQuery]);
```

---

### Scenario 2 — "My component is stuck in an infinite render loop / `Maximum update depth exceeded`."

**Causes**
```jsx
// 1. setState during render
function Bad() { const [n, setN] = useState(0); setN(n + 1); /* loop */ }

// 2. Effect updates a dependency it depends on
useEffect(() => { setFilters({ ...filters, page: 1 }); }, [filters]);

// 3. Object/array/function dependency recreated every render
const options = { limit: 10 };                          // new object every render
useEffect(() => { fetchData(options).then(setData); }, [options]);

// 4. Calling instead of passing a handler
<button onClick={setOpen(true)}>Open</button>           // runs during render
```

**Fixes:** never set state unconditionally during render; derive values instead of syncing them with effects; move constants outside the component or `useMemo` them; depend on primitives (`[options.limit]`); pass `() => setOpen(true)`.

---

### Scenario 3 — "After saving, the list still shows old data until I refresh."

**Causes:** the list's cache was not invalidated; the component keeps a copied `useState(props.items)` that never updates; the API response is cached by the browser/CDN.

**Fix**
```jsx
// TanStack Query
const mutation = useMutation({
  mutationFn: updateProduct,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
});

// Do not copy props into state unless it is an "initial value"
function Row({ product }) {
  // ❌ const [p, setP] = useState(product);  — ignores later prop changes
  // ✅ use `product` directly, or reset with a key: <Row key={product.id + product.updatedAt} />
}
```
And send `Cache-Control: no-store` (or proper ETags) for user-specific API responses.

---

### Scenario 4 — "A `setInterval` inside `useEffect` always shows the same stale value."

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);   // `count` captured once = 0
  return () => clearInterval(id);
}, []);
```

**Cause:** stale closure — the callback closed over the first render's `count`.

**Fix:** functional updater, or a ref for values you need to *read*.
```jsx
useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000);
  return () => clearInterval(id);
}, []);

// When the callback must read the latest props/state:
const latest = useRef(onTick);
useEffect(() => { latest.current = onTick; });
useEffect(() => {
  const id = setInterval(() => latest.current(), 1000);
  return () => clearInterval(id);
}, []);
```

---

### Scenario 5 — "Warning: Can't perform a React state update on an unmounted component / data from the previous page flashes."

**Cause:** an async request resolves after the user navigated away or changed the ID.

**Fix:** abort in cleanup, or ignore stale results; better, use a data library.
```jsx
useEffect(() => {
  const controller = new AbortController();
  getOrder(id, { signal: controller.signal }).then(setOrder).catch(() => {});
  return () => controller.abort();
}, [id]);
```

---

### Scenario 6 — "When I delete the second row, the third row's input shows the deleted row's text."

**Cause:** `key={index}`. After deletion, React matches row 3 to the old row 2's component instance, which keeps its internal state (uncontrolled input value, focus).

**Fix:** use a stable unique key from the data (`key={item.id}`). Generate IDs when items are created on the client (`crypto.randomUUID()`), never during render.

---

### Scenario 7 — "The whole app re-renders when the theme or user changes in Context."

**Cause:** every consumer of a context re-renders when its `value` changes; a provider whose value is a new object each render re-renders everything below it.

**Fixes**
```jsx
// 1. Memoise the value
const value = useMemo(() => ({ user, login, logout }), [user]);

// 2. Split contexts by update frequency
<UserContext.Provider value={user}>
  <CartContext.Provider value={cart}>…</CartContext.Provider>
</UserContext.Provider>

// 3. For frequently changing global state, use a store with selectors (Zustand, Redux)
const count = useCartStore((s) => s.items.length);   // re-renders only when count changes
```

---

### Scenario 8 — "The initial bundle is 3 MB and the first load takes 8 seconds on mobile."

**Verify:** `npx vite-bundle-visualizer` or `source-map-explorer`; Lighthouse; Network tab.

**Fixes**
- Route-level code splitting with `React.lazy` + `Suspense`.
- Replace heavy libraries (moment → date-fns/dayjs; full lodash → per-function imports; chart library loaded only on the reports page).
- Ensure tree shaking: ESM imports, `sideEffects: false`.
- Compress (brotli), cache with hashed filenames + long `max-age`, serve from a CDN.
- Optimise images (WebP/AVIF, `srcset`, `loading="lazy"`, explicit dimensions).
- Consider SSR/SSG (Next.js) for content pages to improve LCP.

---

### Scenario 9 — "A form with 40 fields is sluggish."

**Cause:** controlled inputs keep all values in one parent state; every keystroke re-renders all 40 fields and runs validation for each.

**Fix:** React Hook Form (uncontrolled, ref-based), validate on blur/submit, split into memoised sections, or `useReducer` with field components that subscribe only to their slice.

---

### Scenario 10 — "Users are logged out randomly / see a flash of the login page on refresh."

**Causes:** access token expired with no refresh flow; token kept only in memory; auth state initialised as `null` so protected routes redirect before the "who am I?" check finishes; multiple tabs rotating the refresh token concurrently.

**Fix**
- Track an explicit `status: "loading" | "authenticated" | "anonymous"`; render a splash while `loading`.
- Silent refresh using an `HttpOnly` refresh cookie on app start and on 401 (one shared refresh promise — see the security chapter).
- Sync logout/login across tabs with the `storage` event or `BroadcastChannel`.

---

### Scenario 11 — "Our React app shows a blank white screen in production for some users."

**Clarify:** which browsers/devices? any console errors (ask for a screenshot or use Sentry)?

**Likely causes:** an uncaught render error with no Error Boundary (one bad API field like `user.address.city` when `address` is null crashes the tree); a chunk-load error after a deploy (old `index.html` references deleted chunks); unsupported JS syntax for old browsers; wrong `base` path for assets.

**Fixes**
- Error Boundaries per route/widget, with Sentry logging.
- Defensive rendering with optional chaining and API validation (Zod) at the boundary.
- Handle chunk load errors: catch them in `lazy()` and reload the page once; keep old assets for a while after deploy.
- Set the build target / browserslist to match your users.

---

### Scenario 12 — "The UI and the server disagree after an optimistic update fails."

**Fix:** keep a snapshot and roll back on error, then re-sync with the server:
```jsx
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: ["todos"] });
  const previous = queryClient.getQueryData(["todos"]);
  queryClient.setQueryData(["todos"], (old) => applyChange(old, vars));
  return { previous };
},
onError: (_e, _v, ctx) => { queryClient.setQueryData(["todos"], ctx.previous); toast.error("Could not save"); },
onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
```
Use optimistic updates only where failure is rare and easy to explain (likes, toggles), not for payments.

---

### Scenario 13 — "How would you migrate a large class-component codebase to hooks?"

**Answer outline**
- Do not rewrite everything; migrate **incrementally** — classes and hooks interoperate.
- Start with leaf components and new features; write tests first for risky components.
- Extract shared logic (HOCs, render props) into custom hooks.
- Map lifecycles: `componentDidMount/DidUpdate/WillUnmount` → `useEffect` with dependencies and cleanup; `shouldComponentUpdate` → `React.memo`.
- Keep Error Boundaries as classes.
- Track progress, and use ESLint `react-hooks` rules from day one.

---

### Scenario 14 — "Design the state management for an e-commerce frontend."

**Answer outline**
| State | Where |
|---|---|
| Products, orders, user profile (server data) | TanStack Query / RTK Query, keyed by filters |
| Cart | Zustand/Redux slice persisted to `localStorage`, synced to the server for logged-in users |
| Auth status | Context or store, initialised from a `/me` call |
| Filters, sort, page | URL search params |
| Form inputs | React Hook Form, local to the form |
| Modals, dropdowns | Local `useState` |

Explain the principle: **keep server state in a cache, keep URL-worthy state in the URL, keep everything else as local as possible.**

---

## 🎯 What Interviewers Are Scoring

- You **measure** with the Profiler/DevTools before memoising everything.
- You understand **why** React re-renders (state change, parent render, context change).
- You know the classic bugs: stale closures, index keys, effect loops, race conditions.
- You pick the right **kind** of state store for each kind of state.

---

[← JavaScript Scenarios](01-javascript-scenarios.md) | [Index](../README.md) | [Next: Node & Express Scenarios →](03-node-express-scenarios.md)
