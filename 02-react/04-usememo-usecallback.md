# Chapter 29 — `useMemo` vs `useCallback`

## 📖 Definition

- **`useMemo(fn, deps)`** — memoizes a **value** (the result of `fn()`).
- **`useCallback(fn, deps)`** — memoizes a **function reference** itself.

`useCallback(fn, deps)` is equivalent to `useMemo(() => fn, deps)`.

## 🔍 Explanation

Both hooks help avoid unnecessary work when components re-render:
- `useMemo` — skip an **expensive computation** if its inputs haven't changed.
- `useCallback` — keep a **stable function identity** so child components wrapped in `React.memo` don't re-render unnecessarily.

> ⚠️ **Don't over-memoize.** Memoization has its own cost. Use only when there's a measurable performance issue or a memoized child relies on stable references.

## 💻 Code Example — `useMemo` for Expensive Computation

```jsx
function ProductList({ products, query }) {
  // Without useMemo, filter runs on every render — even when typing in an unrelated input.
  const filtered = useMemo(
    () => products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase())
    ),
    [products, query]
  );

  return (
    <ul>
      {filtered.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

## 💻 Code Example — `useCallback` with `React.memo`

```jsx
const Child = React.memo(function Child({ onClick }) {
  console.log("Child rendered");
  return <button onClick={onClick}>Click</button>;
});

function Parent() {
  const [count, setCount] = useState(0);

  // ❌ Without useCallback: new handler reference each render → Child re-renders
  // const handleClick = () => console.log("clicked");

  // ✅ With useCallback: stable reference → Child stays memoized
  const handleClick = useCallback(() => console.log("clicked"), []);

  return (
    <>
      <button onClick={() => setCount(count + 1)}>Re-render ({count})</button>
      <Child onClick={handleClick} />
    </>
  );
}
```

## 💻 Code Example — When NOT to Use `useMemo`

```jsx
// ❌ Useless — wrapping a simple expression adds overhead
const total = useMemo(() => a + b, [a, b]);

// ✅ Just compute it
const total = a + b;
```

Memoize only when:
1. The computation is **expensive** (heavy filter, sort, parse).
2. The result is passed to a **memoized child** as a prop.
3. The result is used as a **dependency** in another hook.

## 💻 Code Example — Memoizing a Derived Object

```jsx
function Map({ lat, lng }) {
  // Object literal is recreated each render → effect re-runs forever.
  const coords = useMemo(() => ({ lat, lng }), [lat, lng]);

  useEffect(() => {
    initMap(coords);
  }, [coords]);
}
```

## 💻 Code Example — `useCallback` as Dependency

```jsx
function Searchbar({ onSearch }) {
  const [query, setQuery] = useState("");

  // onSearch is a prop function — wrap it in callback so the effect is stable
  useEffect(() => {
    const id = setTimeout(() => onSearch(query), 400);
    return () => clearTimeout(id);
  }, [query, onSearch]);

  // Parent should wrap onSearch with useCallback to keep this effect stable.
}
```

## 💻 Code Example — Heavy Sort

```jsx
function LeaderBoard({ players, sortBy }) {
  const sorted = useMemo(() => {
    console.log("Sorting…");
    return [...players].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [players, sortBy]);

  return <Table rows={sorted} />;
}
```

## 💻 Code Example — Combined Use

```jsx
const FilteredList = React.memo(function FilteredList({ items, predicate }) {
  console.log("FilteredList render");
  const filtered = useMemo(() => items.filter(predicate), [items, predicate]);
  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
});

function App() {
  const [items] = useState([
    { id: 1, name: "Apple",  active: true  },
    { id: 2, name: "Banana", active: false },
    { id: 3, name: "Cherry", active: true  },
  ]);

  const predicate = useCallback((i) => i.active, []);

  return <FilteredList items={items} predicate={predicate} />;
}
```

Without `useCallback`, every render of `App` would create a fresh `predicate`, defeating `React.memo`.

## 🌍 Real-World Impact

- Dashboards with heavy aggregations → wrap in `useMemo`.
- Large lists with memoized item components → wrap row props in `useCallback`.
- Be pragmatic: profile first with React DevTools' Profiler before sprinkling memoization.

## 🎯 Likely Interview Questions

1. **Difference between `useMemo` and `useCallback`?**
2. **When should you use them?**
3. **Why might `React.memo` not work as expected?** — Because a parent passes a new object/function reference on every render. Stabilize with `useMemo`/`useCallback`.
4. **Are they free?** — No, both store the previous deps and result, and run shallow comparisons each render. Overusing them hurts performance.

---

[← useEffect](03-useeffect.md) | [Index](../README.md) | [Next: useRef →](05-useref.md)
