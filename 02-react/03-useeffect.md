# Chapter 25 — `useEffect` and the Component Lifecycle

## 📖 Definition

`useEffect(callback, deps?)` runs **side effects** (data fetching, subscriptions, DOM mutations, timers) after the component renders.

## 🔍 Explanation

`useEffect` is React's escape hatch from pure rendering. The callback runs **after the DOM has been updated**.

### Dependency Array
| Form | Runs when… |
|------|-----------|
| `useEffect(fn)` (no array) | After **every** render |
| `useEffect(fn, [])` | **Once**, after first mount |
| `useEffect(fn, [a, b])` | When `a` or `b` changes (by `Object.is`) |
| Returning a function inside | Cleanup — runs before next effect or on unmount |

### Lifecycle Map (class → hooks)
| Class | Functional equivalent |
|-------|----------------------|
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate` | `useEffect(fn, [deps])` |
| `componentWillUnmount` | `return () => {}` inside effect |

## 💻 Code Example — Mount Only (`componentDidMount`)

```jsx
useEffect(() => {
  console.log("Mounted once");
}, []);
```

## 💻 Code Example — Cleanup (Unmount)

```jsx
useEffect(() => {
  const id = setInterval(() => console.log("tick"), 1000);
  return () => clearInterval(id);     // runs on unmount or before next effect
}, []);
```

## 💻 Code Example — Dependent Effect

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setUser(data); });

    return () => { cancelled = true; };   // ignore stale response
  }, [userId]);                            // re-run when userId changes

  return user ? <h2>{user.name}</h2> : <p>Loading…</p>;
}
```

## 💻 Code Example — Subscription Pattern

```jsx
useEffect(() => {
  const onResize = () => console.log(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
```

## 💻 Code Example — Common Async Pitfall

```jsx
// ❌ wrong — useEffect doesn't expect a Promise
useEffect(async () => {
  const data = await fetch("/api");
  setData(data);
}, []);

// ✅ right — define an async function inside
useEffect(() => {
  async function load() {
    const res = await fetch("/api");
    setData(await res.json());
  }
  load();
}, []);
```

## 💻 Code Example — Stale Closure Bug

```jsx
function Chat({ roomId }) {
  const [messages, setMessages] = useState([]);

  // ❌ Bug: handler captures the initial `messages = []`
  useEffect(() => {
    socket.on("message", (msg) => setMessages([...messages, msg])); // stale!
  }, []);

  // ✅ Fix: functional update
  useEffect(() => {
    socket.on("message", (msg) => setMessages(prev => [...prev, msg]));
  }, []);
}
```

## 💻 Code Example — `useLayoutEffect`

```jsx
import { useLayoutEffect, useRef } from "react";

function Tooltip({ targetRef, children }) {
  const tipRef = useRef();

  // Runs synchronously AFTER DOM mutation, BEFORE paint
  // → no visual flicker
  useLayoutEffect(() => {
    const { top, left } = targetRef.current.getBoundingClientRect();
    tipRef.current.style.top = `${top - 30}px`;
    tipRef.current.style.left = `${left}px`;
  });

  return <div ref={tipRef} className="tooltip">{children}</div>;
}
```

| | `useEffect` | `useLayoutEffect` |
|---|---|---|
| Runs | After paint | After DOM mutation, before paint |
| Blocks paint? | No | Yes |
| Use when | Most cases | You need to measure or mutate layout synchronously |

## 💻 Code Example — Skipping Effect Re-Runs

```jsx
// ❌ inline object → new reference every render → effect re-runs forever
useEffect(() => {
  doSomething(options);
}, [{ x: 1 }]);

// ✅ memoize the object
const options = useMemo(() => ({ x: 1 }), []);
useEffect(() => {
  doSomething(options);
}, [options]);

// ✅ or extract primitives into deps
useEffect(() => {
  doSomething({ x: 1 });
}, []);
```

## 🌍 Real-World Impact

- Data fetching, websocket subscriptions, third-party DOM integrations.
- Cleanups prevent memory leaks and race conditions on prop changes.

## 🎯 Likely Interview Questions

1. **What does `useEffect` do?**
2. **What is the dependency array?**
3. **Difference between `useEffect` and `useLayoutEffect`?**
4. **How do you replicate `componentDidMount` / `componentDidUpdate` / `componentWillUnmount`?**
5. **Why shouldn't you make the effect itself `async`?** — Effects must return either nothing or a cleanup function. An async function returns a Promise.

---

[← Props vs State](02-props-vs-state.md) | [Index](../README.md) | [Next: useMemo / useCallback →](04-usememo-usecallback.md)
