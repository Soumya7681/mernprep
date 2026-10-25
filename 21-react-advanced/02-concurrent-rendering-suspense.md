# Chapter 35 — Concurrent Rendering & Suspense

## 📖 Definition

**Concurrent rendering** (React 18+) lets React prepare multiple versions of the UI at once and **interrupt** a slow, low-priority render to handle an urgent update such as typing. **Suspense** lets a component "wait" for something (code or data) and show a fallback in the meantime, declaratively.

## 🔍 Explanation

Before React 18, rendering was synchronous: once a render started, the main thread was blocked until it finished. With the concurrent renderer:

- Updates are split into **urgent** (typing, clicking, hovering) and **transition** (non-urgent: filtering a big list, switching tabs).
- React renders transitions in small chunks, yielding to the browser between them, and **throws away** a stale render if newer input arrives.
- This is opt-in per update via `startTransition` / `useTransition` / `useDeferredValue`.

**Automatic batching:** since React 18, multiple `setState` calls inside promises, timeouts and native handlers are batched into one render, not only inside React event handlers.

## 💻 Code Example — `useTransition`

```jsx
import { useState, useTransition } from "react";

function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(products);
  const [isPending, startTransition] = useTransition();

  function onChange(e) {
    const value = e.target.value;
    setQuery(value);                                // urgent: input stays responsive
    startTransition(() => {
      setFiltered(products.filter((p) => p.name.toLowerCase().includes(value.toLowerCase())));
    });                                             // non-urgent: can be interrupted
  }

  return (
    <>
      <input value={query} onChange={onChange} />
      {isPending && <span>Updating…</span>}
      <ProductList items={filtered} />
    </>
  );
}
```

## 💻 Code Example — `useDeferredValue`

Use it when you receive a value as a prop and cannot wrap the setter.

```jsx
import { useDeferredValue, memo } from "react";

function Results({ query }) {
  const deferredQuery = useDeferredValue(query);   // lags behind during fast typing
  const isStale = query !== deferredQuery;
  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <SlowList query={deferredQuery} />
    </div>
  );
}

const SlowList = memo(function SlowList({ query }) {
  /* expensive rendering */
});
```

`SlowList` must be memoised — otherwise it re-renders with the parent anyway.

### `useTransition` vs `useDeferredValue` vs debounce

| | `useTransition` | `useDeferredValue` | Debounce |
|---|---|---|---|
| You control | The state update | A value | When a function runs |
| Delay | None — interruptible | None — interruptible | Fixed (e.g. 300 ms) |
| Best for | Expensive **rendering** | Expensive rendering from a prop | Expensive **network calls** |

## 💻 Code Example — Suspense for Code Splitting

```jsx
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Reports = lazy(() => import("./pages/Reports"));

export function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}
```

## 💻 Code Example — Suspense for Data (With TanStack Query)

```jsx
import { useSuspenseQuery } from "@tanstack/react-query";

function UserProfile({ id }) {
  const { data: user } = useSuspenseQuery({ queryKey: ["user", id], queryFn: () => fetchUser(id) });
  return <h2>{user.name}</h2>;               // no isLoading check needed
}

<ErrorBoundary fallback={<p>Could not load profile</p>}>
  <Suspense fallback={<Spinner />}>
    <UserProfile id={42} />
  </Suspense>
</ErrorBoundary>;
```

## 💻 Code Example — Nested Boundaries for Progressive Loading

```jsx
<Suspense fallback={<HeaderSkeleton />}>
  <Header />
  <Suspense fallback={<FeedSkeleton />}>
    <Feed />
    <Suspense fallback={<CommentsSkeleton />}>
      <Comments />
    </Suspense>
  </Suspense>
</Suspense>
```

Each boundary reveals its content as soon as it is ready, instead of the whole page waiting for the slowest request.

## 💻 Code Example — Transitions Keep Old UI Visible

```jsx
function Tabs() {
  const [tab, setTab] = useState("home");
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <nav style={{ opacity: isPending ? 0.6 : 1 }}>
        {["home", "orders", "reports"].map((t) => (
          <button key={t} onClick={() => startTransition(() => setTab(t))}>{t}</button>
        ))}
      </nav>
      <Suspense fallback={<Spinner />}>
        {tab === "orders" ? <Orders /> : tab === "reports" ? <Reports /> : <Home />}
      </Suspense>
    </>
  );
}
```

Without the transition, clicking a tab whose component suspends would replace the current page with the spinner. With it, React keeps showing the old tab until the new one is ready.

## 🔍 Streaming SSR

With `renderToPipeableStream` (or Next.js), the server sends HTML in chunks: the shell first, then each Suspense boundary's content as its data resolves. Combined with **selective hydration**, React hydrates the part the user interacts with first.

## 🌍 Real-World Use

- Filtering a 5,000-row table on every keystroke → `useTransition` or `useDeferredValue`.
- Large admin panels → `lazy` + Suspense per route to cut the initial bundle.
- Dashboards with independent widgets → one Suspense + Error Boundary per widget.

## 🎯 Likely Interview Questions

1. **What is concurrent rendering? Is React multi-threaded?** — No; it is interruptible scheduling on one thread.
2. **Difference between `useTransition` and `useDeferredValue`?**
3. **When would you use debounce instead of a transition?**
4. **What is automatic batching in React 18?**
5. **How does Suspense work with `React.lazy`?**
6. **How do Suspense and Error Boundaries work together?**
7. **Why does wrapping a tab switch in `startTransition` prevent a flash of the fallback?**
8. **What is streaming SSR and selective hydration?**

---

[← React 19: Actions, use & Server Components](01-react-19-features.md) | [Index](../README.md) | [Next: Advanced Component Patterns →](03-advanced-patterns.md)
