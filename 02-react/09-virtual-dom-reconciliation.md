# Chapter 31 — Virtual DOM & Reconciliation

## 📖 Definitions

- **Virtual DOM (VDOM)** — an in-memory tree of JavaScript objects that mirrors the real DOM.
- **Reconciliation** — the algorithm React uses to diff the previous VDOM tree against the new one and update only what changed.
- **Fiber** — React's modern reconciler architecture (since v16). It splits work into units that can be paused, resumed, or discarded.

## 🔍 Explanation

### The Render Cycle
1. State or props change → React calls your component function again.
2. The function returns a new VDOM subtree.
3. React **diffs** the new tree against the previous one.
4. React commits **only the changed nodes** to the real DOM (slow part of the pipeline).

### Why the VDOM Exists
Direct DOM operations are expensive. By batching diffs in memory and committing once, React minimizes real DOM work.

### Diffing Heuristics
React's diff algorithm assumes:
1. **Two elements of different types produce different trees.**
2. **`key` props let you hint stable identity** across renders.

Without these assumptions, the diff would be O(n³). With them, it's O(n).

## 💻 Code Example — How `key` Affects Diffing

```jsx
// Without keys — React matches by index
<ul>
  <li>Apple</li>
  <li>Banana</li>
</ul>

// Adding "Mango" at the start:
<ul>
  <li>Mango</li>
  <li>Apple</li>
  <li>Banana</li>
</ul>

// React thinks:
// position 0 changed Apple → Mango   (replace text)
// position 1 changed Banana → Apple  (replace text)
// position 2 is new: Banana          (add)
// → 3 mutations
```

With stable keys:

```jsx
<ul>
  <li key="m">Mango</li>
  <li key="a">Apple</li>
  <li key="b">Banana</li>
</ul>

// React thinks:
// key "m" is new → insert
// key "a" unchanged
// key "b" unchanged
// → 1 mutation
```

## 💻 Code Example — Wrong Key (Index in Sortable List)

```jsx
// ❌ Using array index as key on a sortable list
function Todos({ todos }) {
  return (
    <ul>
      {todos.map((todo, i) => (
        <li key={i}>
          <input defaultValue={todo.text} />
        </li>
      ))}
    </ul>
  );
}
// When the user reorders todos, React sees the same keys and reuses the
// <input> DOM nodes — but the bound state is now wrong.
// Fix: use a stable id from the data.
```

## 💻 Code Example — Different Element Type → Full Tree Rebuild

```jsx
// If a <div> changes to a <span>, React destroys the whole subtree
return condition ? <div>{children}</div> : <span>{children}</span>;
```

## 💻 Code Example — Component Type Matters

```jsx
function A() { return <Spinner />; }
function B() { return <Spinner />; }

// If you switch from <A /> to <B />, React unmounts A and mounts B from
// scratch — even though both render <Spinner />. Component identity is
// based on the type reference.
```

## 💻 Code Example — Fiber Time-Slicing (Conceptual)

```jsx
// Concurrent rendering can interrupt a long render to handle higher-priority updates
import { startTransition } from "react";

function Search({ list }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(list);

  const onChange = (e) => {
    const value = e.target.value;
    setQuery(value);                                  // urgent: input change
    startTransition(() => {                           // non-urgent: filtering
      setResults(list.filter(i => i.includes(value)));
    });
  };

  return (
    <>
      <input value={query} onChange={onChange} />
      <ul>{results.map(r => <li key={r}>{r}</li>)}</ul>
    </>
  );
}
```

The `startTransition` wrap marks the state update as non-urgent. The fiber scheduler may pause it if the user keeps typing.

## 💻 Code Example — Bail-Out via `React.memo`

```jsx
const Item = React.memo(function Item({ name }) {
  console.log("Render", name);
  return <li>{name}</li>;
});
// Only re-renders when `name` prop changes (shallow compare).
```

## 📊 Phases (Simplified)

| Phase | Work |
|-------|------|
| **Render** | Call components, build new VDOM, diff |
| **Commit** | Apply DOM mutations, run `useLayoutEffect` |
| **Passive Effects** | Run `useEffect` after the browser paints |

## 🌍 Real-World Impact

- Stable keys are the single biggest win for list performance.
- Avoid swapping component types unnecessarily (`{cond ? <A/> : <B/>}` can destroy state).
- Use concurrent features (`startTransition`, `useDeferredValue`) for typeahead/large lists in React 18+.

## 🎯 Likely Interview Questions

1. **What is the Virtual DOM?**
2. **How does React's diff algorithm work?**
3. **Why are keys important?**
4. **What is the Fiber architecture?**
5. **How does React decide whether to re-use a component vs unmount and re-mount?** — Same component type + same key → reuse. Anything else → throw away the subtree.

---

[← Custom Hooks](08-custom-hooks.md) | [Index](../README.md) | [Next: Performance Optimization →](10-performance-optimization.md)
