# Chapter 31 — Custom Hooks

## 📖 Definition

A **custom hook** is a JavaScript function whose name starts with `use` and that may call other hooks. It encapsulates reusable stateful logic.

## 🔍 Explanation

Rules of hooks (apply to custom hooks too):
1. Only call at the **top level** of a component or another hook — never inside loops, conditions, or nested functions.
2. Only call from **React function components or custom hooks**.
3. Name must start with `use` — this tells React (and the linter) it's a hook.

Custom hooks let you share *logic*, not UI. Instead of a Higher-Order Component, you extract behavior.

## 💻 Code Example — `useDebounce`

```jsx
import { useState, useEffect } from "react";

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Usage
function Search() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 400);
  // ...fetch when `debounced` changes
}
```

## 💻 Code Example — `useFetch`

```jsx
export function useFetch(url) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// Usage
function UserCard({ id }) {
  const { data, loading, error } = useFetch(`/api/users/${id}`);
  if (loading) return <p>Loading…</p>;
  if (error)   return <p>Error: {error.message}</p>;
  return <h2>{data.name}</h2>;
}
```

## 💻 Code Example — `useLocalStorage`

```jsx
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

// Usage — exactly like useState, but persists
const [theme, setTheme] = useLocalStorage("theme", "light");
```

## 💻 Code Example — `useToggle`

```jsx
export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(o => !o), []);
  return [on, toggle];
}

// Usage
const [isOpen, toggleOpen] = useToggle();
<button onClick={toggleOpen}>{isOpen ? "Close" : "Open"}</button>
```

## 💻 Code Example — `useOnClickOutside`

```jsx
import { useEffect } from "react";

export function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

// Usage — close a dropdown when clicking outside
function Dropdown() {
  const ref = useRef();
  const [open, setOpen] = useState(false);
  useOnClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref}>
      <button onClick={() => setOpen(!open)}>Menu</button>
      {open && <ul>...</ul>}
    </div>
  );
}
```

## 💻 Code Example — `useWindowSize`

```jsx
export function useWindowSize() {
  const [size, setSize] = useState({
    width:  window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () => setSize({
      width:  window.innerWidth,
      height: window.innerHeight,
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

// Usage
const { width } = useWindowSize();
return width < 768 ? <MobileNav /> : <DesktopNav />;
```

## 💻 Code Example — `usePrevious`

```jsx
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

// Usage
function Counter({ count }) {
  const prev = usePrevious(count);
  return <p>Was {prev}, now {count}</p>;
}
```

## 💻 Code Example — `useAsync` (Combined)

```jsx
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });
    asyncFn()
      .then(data => active && setState({ data, loading: false, error: null }))
      .catch(err => active && setState({ data: null, loading: false, error: err }));
    return () => { active = false; };
  }, deps);

  return state;
}

// Usage
const { data, loading, error } = useAsync(
  () => fetch(`/api/users/${id}`).then(r => r.json()),
  [id]
);
```

## 🌍 Real-World Impact

- Replace HOCs and render props with cleaner hooks.
- Share data fetching, auth state, debouncing, theming logic across the app.
- Libraries like **TanStack Query** are essentially highly-engineered `useFetch` hooks.

## 🎯 Likely Interview Questions

1. **What is a custom hook?**
2. **What are the rules of hooks?**
3. **Why must custom hook names start with `use`?** — ESLint plugin (`react-hooks/rules-of-hooks`) uses the prefix to enforce the rules of hooks; React itself uses it for the dev-only check that calls happen in a consistent order.
4. **Write a `useDebounce` hook.**
5. **Difference between custom hooks and HOCs?** — Hooks share *logic* without wrapping the tree; HOCs nest the component inside a wrapper.

---

[← Context API](07-context-api.md) | [Index](../README.md) | [Next: Virtual DOM, Reconciliation & Fiber →](09-virtual-dom-reconciliation.md)
