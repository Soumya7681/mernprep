# Chapter 14 — Debounce vs Throttle

## 📖 Definition

- **Debounce** — delay execution until the user stops triggering events for N ms.
- **Throttle** — guarantee execution at most once every N ms, regardless of how often events fire.

## 🔍 Explanation

Both control the **rate** of function execution to improve performance.

| Use Case | Use |
|----------|-----|
| Search input (wait until user stops typing) | **Debounce** |
| Auto-save after editing pauses | **Debounce** |
| Scroll handler | **Throttle** |
| Resize handler | **Throttle** |
| Mousemove drag handler | **Throttle** |
| Button-spam prevention | **Throttle** (leading edge) |

## 💻 Code Example — Debounce

```js
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Usage
const onSearch = debounce((query) => {
  fetch(`/api/search?q=${query}`).then(r => r.json()).then(console.log);
}, 400);

document.getElementById("search").addEventListener("input", (e) => {
  onSearch(e.target.value);
});

// User types "react" quickly → ONE API call, 400ms after the last keystroke.
```

## 💻 Code Example — Throttle

```js
function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (inThrottle) return;
    fn.apply(this, args);
    inThrottle = true;
    setTimeout(() => (inThrottle = false), limit);
  };
}

// Usage
const onScroll = throttle(() => {
  console.log("scroll position:", window.scrollY);
}, 200);

window.addEventListener("scroll", onScroll);

// Even if scroll fires 100x/sec, onScroll runs at most every 200ms.
```

## 💻 Code Example — Debounce with Immediate (Leading) Option

```js
function debounce(fn, delay, immediate = false) {
  let timer;
  return function (...args) {
    const callNow = immediate && !timer;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);
    if (callNow) fn.apply(this, args);
  };
}

// Fires the FIRST keystroke immediately, ignores subsequent ones for 400ms.
const immediateSave = debounce(save, 400, true);
```

## 💻 Code Example — Trailing Throttle

```js
function throttle(fn, limit) {
  let inThrottle = false;
  let lastArgs = null;

  return function (...args) {
    if (inThrottle) {
      lastArgs = args;        // remember the last call
      return;
    }
    fn.apply(this, args);
    inThrottle = true;
    setTimeout(() => {
      inThrottle = false;
      if (lastArgs) {          // trailing call ensures latest event isn't lost
        fn.apply(this, lastArgs);
        lastArgs = null;
      }
    }, limit);
  };
}
```

## 💻 Code Example — React Debounce Hook

```jsx
import { useState, useEffect } from "react";

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function Search() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 400);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!debounced) return setResults([]);
    fetch(`/api/search?q=${debounced}`)
      .then(r => r.json())
      .then(setResults);
  }, [debounced]);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>
    </>
  );
}
```

## 💻 Code Example — Using `lodash`

```js
import { debounce, throttle } from "lodash";

const onSearch = debounce(handleSearch, 400);
const onScroll = throttle(handleScroll, 200, { leading: true, trailing: true });
```

Lodash handles edge cases (leading/trailing, cancellation, max wait) so prefer it in production unless you need a learning exercise.

## 💻 Code Example — Throttle with `requestAnimationFrame`

```js
function rafThrottle(fn) {
  let scheduled = false;
  return function (...args) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      fn.apply(this, args);
      scheduled = false;
    });
  };
}

// Caps at one call per repaint (~16ms at 60fps)
window.addEventListener("mousemove", rafThrottle(updatePosition));
```

## 🌍 Real-World Impact

- **Debounce** an autocomplete: 10 API calls → 1. Major reduction in server load.
- **Throttle** scroll: smooth 60fps interactions instead of stutters.
- Always use **rAF throttling** for visual updates (parallax, drag).

## 🎯 Likely Interview Questions

1. **Difference between debounce and throttle?**
2. **When would you use each?**
3. **Implement debounce from scratch** (see above).
4. **Implement throttle from scratch** (see above).
5. **How would you debounce in React?** — Use a custom hook (`useDebounce`) so the debounce timer is tied to the component lifecycle and cleans up properly.

---

[← Event Loop & Task Queues](11-event-loop.md) | [Index](../README.md) | [Next: Execution Context, Memory & GC →](../20-javascript-advanced/01-execution-context-memory.md)
