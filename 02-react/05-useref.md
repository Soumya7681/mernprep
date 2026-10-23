# Chapter 27 — `useRef`

## 📖 Definition

`useRef(initialValue)` returns a mutable object `{ current: initialValue }` that persists across renders **without triggering re-renders** when mutated.

## 🔍 Explanation

`useRef` has two main uses:
1. **Accessing DOM nodes** — `<input ref={inputRef} />`.
2. **Storing mutable values** that should survive renders but not cause them (timer IDs, previous props, instance data).

## 💻 Code Example — Focusing an Input

```jsx
import { useRef, useEffect } from "react";

function Search() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();             // focus on mount
  }, []);

  return <input ref={inputRef} placeholder="Search…" />;
}
```

## 💻 Code Example — Storing a Timer ID

```jsx
function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef();

  const start = () => {
    if (intervalRef.current) return;       // already running
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => stop, []);               // cleanup on unmount

  return (
    <>
      <p>{seconds}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </>
  );
}
```

## 💻 Code Example — Previous Value Hook

```jsx
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

function Counter() {
  const [count, setCount] = useState(0);
  const prev = usePrevious(count);

  return (
    <p>Now: {count}, Before: {prev}</p>
  );
}
```

## 💻 Code Example — Avoiding Re-Renders for Internal Counters

```jsx
function ClickTracker() {
  const renderCount = useRef(0);
  const [, forceRerender] = useState(0);

  renderCount.current += 1;                // mutating doesn't trigger re-render

  return (
    <>
      <p>Renders: {renderCount.current}</p>
      <button onClick={() => forceRerender(n => n + 1)}>Re-render</button>
    </>
  );
}
```

## 💻 Code Example — Imperative Handle (`forwardRef` + `useImperativeHandle`)

```jsx
import { forwardRef, useImperativeHandle, useRef } from "react";

const FancyInput = forwardRef(function FancyInput(props, ref) {
  const inputRef = useRef();

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    clear: () => { inputRef.current.value = ""; },
  }));

  return <input ref={inputRef} {...props} />;
});

function Parent() {
  const ref = useRef();
  return (
    <>
      <FancyInput ref={ref} />
      <button onClick={() => ref.current.focus()}>Focus</button>
      <button onClick={() => ref.current.clear()}>Clear</button>
    </>
  );
}
```

## 💻 Code Example — Callback Ref (Alternative)

```jsx
function MeasureBox() {
  const [height, setHeight] = useState(0);

  const measureRef = useCallback((node) => {
    if (node) setHeight(node.getBoundingClientRect().height);
  }, []);

  return (
    <>
      <div ref={measureRef}>Box content</div>
      <p>Height: {height}px</p>
    </>
  );
}
```

## ⚠️ Common Pitfalls

| Mistake | Why it's wrong |
|---------|----------------|
| Reading `ref.current` during render | DOM nodes don't exist yet → `null` |
| Treating `useRef` like state | Mutating doesn't re-render |
| Using `useRef` to bypass dependency arrays | Hides bugs; reach for `useReducer` or pull state up instead |

## 🎯 Likely Interview Questions

1. **What is `useRef`?**
2. **Difference between `useState` and `useRef`?**
   - `useState` re-renders on change; `useRef` does not.
3. **How do you access a DOM node in React?** — `useRef` + `ref={refObject}`.
4. **What is `forwardRef`?** — Lets a child component receive a ref from its parent and forward it to a DOM node.
5. **What does `useImperativeHandle` do?** — Lets the parent call methods on the child by exposing a custom ref interface.

---

[← useMemo / useCallback](04-usememo-usecallback.md) | [Index](../README.md) | [Next: Controlled / Uncontrolled →](06-controlled-uncontrolled.md)
