# Chapter 36 — Performance Optimization

## 📖 Definition

Performance optimization in React is the practice of minimizing the cost of re-renders, large lists, heavy computations, and bundle size.

## 🔍 The Checklist

| Technique | What it does |
|-----------|--------------|
| `React.memo` | Skip re-render if props are shallow-equal |
| `useMemo` / `useCallback` | Stabilize derived values and callbacks |
| Code splitting (`React.lazy`) | Load components on demand |
| Lazy images | `<img loading="lazy">` or IntersectionObserver |
| Virtualization (`react-window`) | Render only visible list items |
| Debounce / throttle | Reduce frequency of expensive work |
| Stable references | Avoid inline objects/functions to memoized children |
| Proper `key` props | Avoid React re-creating DOM nodes |
| Split context | Reduce blast radius of context updates |
| `startTransition` | Mark slow updates as non-urgent |

## 💻 Code Example — `React.memo`

```jsx
const Avatar = React.memo(function Avatar({ url, size }) {
  console.log("Avatar render");
  return <img src={url} width={size} />;
});

// Only re-renders when `url` or `size` changes (shallow compare).
```

## 💻 Code Example — Code Splitting with `React.lazy`

```jsx
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./Dashboard"));
const Reports   = lazy(() => import("./Reports"));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Router>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports"   element={<Reports />} />
      </Router>
    </Suspense>
  );
}
```

Each route becomes a separate chunk — users only download what they navigate to.

## 💻 Code Example — Bundle Splitting at Library Level

```jsx
// ❌ Imports whole library
import _ from "lodash";

// ✅ Tree-shakes
import debounce from "lodash/debounce";

// or use es-toolkit / remeda for already tree-shakeable libs
```

## 💻 Code Example — List Virtualization

```jsx
import { FixedSizeList as List } from "react-window";

function Leaderboard({ rows }) {
  return (
    <List
      height={600}
      itemCount={rows.length}
      itemSize={48}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style} className="row">
          {rows[index].name}: {rows[index].score}
        </div>
      )}
    </List>
  );
}
```

Renders only the ~12 visible rows out of 50,000. Initial render goes from seconds to milliseconds.

## 💻 Code Example — Memoize Filter/Sort

```jsx
function Table({ rows, query, sortBy }) {
  const visible = useMemo(() => {
    return rows
      .filter(r => r.name.includes(query))
      .sort((a, b) => a[sortBy] - b[sortBy]);
  }, [rows, query, sortBy]);

  return visible.map(r => <Row key={r.id} {...r} />);
}
```

## 💻 Code Example — Stable Function References

```jsx
const Row = React.memo(function Row({ item, onSelect }) {
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;
});

function List({ items }) {
  // ❌ new function every render → all Rows re-render
  // const onSelect = (id) => console.log(id);

  // ✅ stable
  const onSelect = useCallback((id) => console.log(id), []);

  return items.map(i => <Row key={i.id} item={i} onSelect={onSelect} />);
}
```

## 💻 Code Example — Avoid Inline Objects

```jsx
// ❌ new object literal → child can't bail out
<Header style={{ marginTop: 10 }} />

// ✅ extract or memoize
const headerStyle = { marginTop: 10 };
<Header style={headerStyle} />
```

## 💻 Code Example — `startTransition` and `useDeferredValue`

```jsx
import { useState, useDeferredValue } from "react";

function Search({ items }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => items.filter(i => i.includes(deferredQuery)),
    [items, deferredQuery]
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>{results.map(r => <li key={r}>{r}</li>)}</ul>
    </>
  );
}
```

The input updates immediately; the heavy list lags behind, giving a responsive feel.

## 💻 Code Example — Image Lazy Loading

```jsx
<img src="/large.jpg" loading="lazy" alt="..." />
```

Or use IntersectionObserver for fine control:

```jsx
function LazyImage({ src, alt }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return <img ref={ref} src={visible ? src : ""} alt={alt} />;
}
```

## 💻 Code Example — Production Build Checklist

```bash
# Use production builds
NODE_ENV=production npm run build

# Analyze bundle
npx source-map-explorer build/static/js/*.js
# or vite-plugin-visualizer / webpack-bundle-analyzer

# Compress
gzip / brotli at CDN level
```

## 🌍 Real-World Interview Story

> "On a dashboard with ~5,000 rows, the initial render was sluggish. I introduced `react-window` for the table, lazy-loaded the analytics chart with `React.lazy`, used `useMemo` for derived aggregates, and wrapped heavy props in `useCallback`. First contentful paint dropped from ~2.4s to ~900ms. I verified each change with the React DevTools Profiler before merging."

## 🎯 Likely Interview Questions

1. **How would you optimize a slow React app?**
2. **What does `React.memo` do?**
3. **When should you NOT use `useMemo`?**
4. **How would you handle a list of 10,000 items?** — Virtualization.
5. **What is code splitting?** — Splitting the bundle so each route/feature loads on demand.
6. **What's the React DevTools Profiler?** — A tool that records render timings and shows which components are slow and why.

---

[← Virtual DOM, Reconciliation & Fiber](09-virtual-dom-reconciliation.md) | [Index](../README.md) | [Next: React 19: Actions, use & Server Components →](../21-react-advanced/01-react-19-features.md)
