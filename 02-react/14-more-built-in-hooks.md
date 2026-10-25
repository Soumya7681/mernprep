# Chapter 34 — More Built-in Hooks: `useId`, `useSyncExternalStore`, `useInsertionEffect`, `useDebugValue`

## 📖 Definition

These are the less common built-in hooks. You rarely reach for them in app code, but interviewers use them to check depth, and they solve problems nothing else does:

| Hook | Solves |
|------|--------|
| `useId` | Unique, **SSR-safe** IDs for accessibility attributes |
| `useSyncExternalStore` | Subscribing to a store **outside React** without tearing |
| `useInsertionEffect` | Injecting `<style>` tags before layout effects (CSS-in-JS libraries) |
| `useDebugValue` | Showing a label for a custom hook in React DevTools |

## 🗺️ Map of Every Built-in Hook

| Category | Hooks | Where in this book |
|----------|-------|--------------------|
| State | `useState`, `useReducer` | Props vs State, `useReducer` |
| Context | `useContext`, `use` | Context API, React 19 |
| Refs | `useRef`, `useImperativeHandle` | `useRef` |
| Effects | `useEffect`, `useLayoutEffect`, `useInsertionEffect` | `useEffect`, this chapter |
| Performance | `useMemo`, `useCallback` | `useMemo` / `useCallback` |
| Concurrency | `useTransition`, `useDeferredValue` | Concurrent Rendering & Suspense |
| Actions / forms (React 19) | `useActionState`, `useFormStatus`, `useOptimistic` | React 19 |
| Other | `useId`, `useSyncExternalStore`, `useDebugValue` | This chapter |

## 💻 `useId` — Stable Unique IDs

```jsx
import { useId } from "react";

function EmailField() {
  const id = useId();                         // e.g. ":r3:" (format varies by version)
  return (
    <>
      <label htmlFor={id}>Email</label>
      <input id={id} type="email" aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`}>We never share your email.</p>
    </>
  );
}

// Render <EmailField /> twice and each gets its own id: no collisions.
```

### Why Not a Counter or `Math.random()`?

```jsx
let next = 0;
const id = `field-${next++}`;    // ❌ server and client count differently → hydration mismatch
const id = Math.random();        // ❌ different on every render and between server and client
```

`useId` builds the ID from the component's **position in the tree**, so the server and client produce the same value and hydration matches.

- **Don't** use `useId` for list `key`s. Keys should come from your data.
- If you have **multiple React roots** on one page, pass `identifierPrefix` to `createRoot` / `hydrateRoot` to keep IDs unique.

## 💻 `useSyncExternalStore` — Subscribing to External Stores

Use it when data lives **outside React state**: a browser API, a third-party store, or a global singleton.

```jsx
const [state] = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?);
```

- `subscribe(callback)`: start listening, call `callback` on change, return an unsubscribe function.
- `getSnapshot()`: return the current value. It **must return the same value (by `Object.is`) if nothing changed**, or React re-renders forever.
- `getServerSnapshot()` (optional): the value during SSR and hydration.

### Example — Online Status

```jsx
import { useSyncExternalStore } from "react";

function subscribe(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,     // client snapshot
    () => true                  // server snapshot: assume online
  );
}

function StatusBar() {
  const online = useOnlineStatus();
  return <p>{online ? "✅ Online" : "❌ Offline"}</p>;
}
```

Define `subscribe` **outside** the component (or memoise it). A new function every render makes React resubscribe every render.

### Example — A Tiny Global Store

```jsx
function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set: (next) => { state = { ...state, ...next }; listeners.forEach(l => l()); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

const cartStore = createStore({ items: [] });

function useCart(selector) {
  return useSyncExternalStore(cartStore.subscribe, () => selector(cartStore.get()));
}

function CartCount() {
  const count = useCart(s => s.items.length);    // primitive: stable snapshot
  return <span>{count}</span>;
}
```

This is roughly how **Zustand** and **React-Redux** work internally today.

### The Snapshot Trap

```jsx
// ❌ New array every call → snapshot always "changed" → infinite loop
useSyncExternalStore(store.subscribe, () => store.get().items.filter(i => i.inStock));

// ✅ Return stored references or primitives, and derive in render (or memoise the selector)
const items = useSyncExternalStore(store.subscribe, () => store.get().items);
const inStock = useMemo(() => items.filter(i => i.inStock), [items]);
```

### What Is "Tearing"?

In concurrent rendering, React can pause halfway through rendering a tree. If an external store changes during that pause, components rendered before and after the change show **different values for the same data**. This inconsistent UI is called tearing. `useSyncExternalStore` prevents it by forcing a synchronous re-render when the snapshot changes mid-render. That is why subscribing with `useEffect` + `useState` is not safe for external stores under concurrent React.

## 💻 `useInsertionEffect` — For CSS-in-JS Libraries

```jsx
function useCSS(rule) {
  useInsertionEffect(() => {
    // Runs before any layout effect reads the DOM
    const style = document.createElement("style");
    style.textContent = rule;
    document.head.appendChild(style);
    return () => style.remove();
  }, [rule]);
}
```

Effect timing order in one commit:

```
useInsertionEffect  →  DOM mutations  →  useLayoutEffect  →  (paint)  →  useEffect
```

Styles are inserted first, so `useLayoutEffect` code that measures elements sees the final styles. Restrictions: it **cannot update state**, and refs are not attached yet. Unless you are writing a styling library (styled-components and Emotion use it), you don't need it.

## 💻 `useDebugValue` — Labels in DevTools

```jsx
function useOnlineStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  useDebugValue(online ? "Online" : "Offline");
  return online;
}

// Expensive formatting? Pass a formatter so it only runs when DevTools is open:
useDebugValue(date, d => d.toISOString());
```

React DevTools then shows `OnlineStatus: "Online"` next to the component. It does nothing in production, and it is only worth adding to custom hooks in shared libraries.

## 💻 Quick Reminder — `useImperativeHandle`

Covered in the `useRef` chapter: it lets a child choose which methods a parent's ref can call. In React 19, `ref` is a normal prop, so `forwardRef` is no longer needed:

```jsx
function VideoPlayer({ ref, src }) {
  const videoRef = useRef(null);
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current.play(),
    pause: () => videoRef.current.pause(),
  }));
  return <video ref={videoRef} src={src} />;
}
```

## 🌍 Real-World Impact

- `useId` is the right way to connect labels, `aria-describedby` and form errors in a reusable input component, especially with SSR (Next.js).
- `useSyncExternalStore` is how you safely read `window` sizes, media queries, `localStorage` events or a custom store. Most state libraries use it for you.
- `useInsertionEffect` and `useDebugValue` are mostly for library authors.

## 🎯 Likely Interview Questions

1. **Why use `useId` instead of `Math.random()` for IDs?** — It is stable across renders and identical on server and client, so no hydration mismatch.
2. **Can `useId` be used for list keys?** — No. Keys must come from data. `useId` gives one ID per component instance.
3. **What problem does `useSyncExternalStore` solve?** — Safely subscribing to non-React stores in concurrent React without tearing, with SSR support through `getServerSnapshot`.
4. **What is tearing?** — Different parts of the UI showing different versions of the same external data because the store changed during an interruptible render.
5. **Why can `getSnapshot` cause an infinite loop?** — If it returns a new object or array every call, React thinks the store changed on every check.
6. **What is the order of `useInsertionEffect`, `useLayoutEffect` and `useEffect`?** — Insertion (before DOM mutations), then layout (after mutations, before paint), then passive `useEffect` (after paint).
7. **What does `useDebugValue` do?** — Adds a label for a custom hook in React DevTools. No runtime effect.

---

[← Custom Hooks](08-custom-hooks.md) | [Index](../README.md) | [Next: Virtual DOM, Reconciliation & Fiber →](09-virtual-dom-reconciliation.md)
