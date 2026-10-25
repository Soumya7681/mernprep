# Chapter 32 — Virtual DOM, Reconciliation & Fiber

## 📖 Definitions

- **Virtual DOM (VDOM)**: an in-memory tree of plain JavaScript objects (React elements) that describes what the UI should look like.
- **Reconciliation**: the algorithm React uses to compare the new element tree with the previous one and work out the smallest set of changes to apply to the real DOM.
- **Fiber**: React's reconciler since v16. Every component instance and DOM node gets a **fiber**, a JS object that holds its type, props, state and links to its parent, child and sibling. Rendering is split into small **units of work** (one fiber each) that can be paused, resumed, prioritised or thrown away.

## 🔍 Explanation

### The Render Cycle
1. A state update is scheduled (`setState`, `useState` setter, `useReducer` dispatch, a context change).
2. **Render phase:** React calls your components to get new elements and diffs them against the current fibers. It does not touch the DOM in this phase.
3. **Commit phase:** React applies the collected DOM changes in one synchronous pass, then runs layout effects.
4. After the browser paints, React runs passive effects (`useEffect`).

### What a React Element Is

JSX compiles to function calls that return plain objects:

```jsx
<button className="primary" onClick={save}>Save</button>

// compiles to (React 17+ automatic runtime)
jsx("button", { className: "primary", onClick: save, children: "Save" });

// which returns roughly
{ $$typeof: Symbol(react.element), type: "button", key: null, props: { className: "primary", onClick: save, children: "Save" } }
```

Elements are cheap, immutable descriptions created fresh on every render. **Fibers** are the long-lived objects React keeps between renders. Reconciliation compares new elements against existing fibers.

### Why the VDOM Exists
Touching the real DOM causes style recalculation and layout, which is expensive. React diffs in memory and then commits all changes at once. The VDOM is not "faster than the DOM". What it gives you is a **declarative** model: you describe the UI for the current state, and React works out the DOM operations, which are fast enough for most apps.

### Diffing Heuristics
A general tree diff is O(n³). React makes it O(n) with two assumptions:
1. **Elements of different types produce different trees.** If `<div>` becomes `<span>`, or `<A>` becomes `<B>`, React destroys the old subtree (and its state) and builds a new one.
2. **The `key` prop marks stable identity among siblings**, so React can match children that moved.

React also compares only **at the same level**. It never tries to detect a subtree that moved to a different parent.

## 🧬 Fiber Architecture in Depth

### Why Fiber Was Needed (Stack Reconciler vs Fiber)

Before React 16, the **stack reconciler** walked the tree with recursive function calls. Once it started, it could not stop until the whole tree was done. On a large update that could block the main thread for 100 ms or more, so typing, animations and clicks stuttered.

Fiber rewrote the reconciler so the tree walk is a **loop over a linked list** instead of recursion. A loop can stop after any fiber, hand control back to the browser, and continue later. This is what makes **concurrent rendering** (`startTransition`, `useDeferredValue`, Suspense) possible.

| | Stack reconciler (≤ v15) | Fiber (v16+) |
|---|---|---|
| Traversal | Recursive calls on the JS call stack | Iterative loop over fiber linked list |
| Interruptible | ❌ No | ✅ Yes, in the render phase |
| Priorities | None, all updates equal | Lanes (urgent vs transition vs idle) |
| Can discard work | ❌ | ✅ (a newer update can restart a render) |
| Enables | — | Concurrent features, Suspense, error boundaries, fragments returning arrays |

### What a Fiber Looks Like (Simplified)

```js
{
  tag: FunctionComponent,     // or HostComponent (DOM node), ClassComponent, Fragment…
  type: UserCard,             // the function/class, or "div" for host nodes
  key: "u42",
  stateNode: null,            // DOM node for host fibers, class instance for classes

  // Tree links: this is what makes the walk a loop instead of recursion
  return: parentFiber,        // parent
  child: firstChildFiber,     // first child
  sibling: nextSiblingFiber,  // next sibling

  pendingProps: {...},        // props for this render
  memoizedProps: {...},       // props used last render
  memoizedState: hook1,       // function components: linked list of hooks
  updateQueue: ...,           // pending state updates / effects

  flags: Placement | Update,  // side effects to apply in commit ("effect tags")
  lanes: DefaultLane,         // priority of pending work on this fiber
  alternate: otherFiber,      // the matching fiber in the other tree (double buffering)
}
```

Tree shape for `<App><Header/><Main/></App>`:

```
App
 │ child
 ▼
Header ──sibling──▶ Main
   │ return           │ return
   └──────▶ App ◀─────┘
```

### The Work Loop

Conceptually (the real code lives in `ReactFiberWorkLoop`):

```js
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber) {
  const next = beginWork(fiber);   // render component, reconcile its children
  if (next) return next;           // go down to the child

  let node = fiber;
  while (node) {
    completeWork(node);            // create/prepare DOM node, bubble up flags
    if (node.sibling) return node.sibling;   // then across
    node = node.return;                      // then back up
  }
  return null;
}
```

- **`beginWork`**: calls the component (or `render()` for classes), then reconciles the returned children against the old child fibers. If nothing changed, it **bails out** and skips the subtree.
- **`completeWork`**: for host components, it creates the DOM node or works out which props changed. It does **not** insert anything into the document yet.
- **`shouldYield()`**: the Scheduler checks whether the time slice (about 5 ms) is used up. If it is, React yields so the browser can handle input and paint, then resumes in a new task (scheduled with `MessageChannel`).
- Synchronous updates (for example from a click) use `workLoopSync`, which is the same loop without `shouldYield`.

### Double Buffering: `current` and `workInProgress`

React keeps **two fiber trees**:

- **`current`**: what is on screen now.
- **`workInProgress`**: the tree being built for the next render. Each fiber's `alternate` points at its twin in the other tree.

The render phase builds `workInProgress` off-screen, reusing alternates instead of allocating new objects. If a higher-priority update arrives, React can **throw `workInProgress` away** and the screen is unaffected. At the end of the commit, React swaps a single pointer (`root.current = finishedWork`), and the finished tree becomes `current`. This is the same idea as double buffering in graphics, and it is why users never see a half-rendered UI.

### Render Phase vs Commit Phase

| | Render phase | Commit phase |
|---|---|---|
| What happens | Call components, diff children, mark flags | Apply DOM mutations, attach refs, run effects |
| Interruptible? | ✅ Yes (concurrent mode) | ❌ No, always synchronous |
| May run more than once? | ✅ Yes, so it **must be pure** | ❌ Exactly once per commit |
| Class methods | `constructor`, `getDerivedStateFromProps`, `shouldComponentUpdate`, `render` | `getSnapshotBeforeUpdate`, `componentDidMount/Update`, `componentWillUnmount` |
| Hooks | Component body, `useMemo`, `useState` initialisers, reducers | `useInsertionEffect`, `useLayoutEffect`, `useEffect` |

The commit phase has three sub-steps:

1. **Before mutation**: `getSnapshotBeforeUpdate` reads the DOM before it changes.
2. **Mutation**: insert, update and remove DOM nodes, detach old refs, run `useLayoutEffect` cleanups.
3. **Layout**: swap `current`, attach refs, run `useLayoutEffect` and `componentDidMount/DidUpdate`. These run **before the browser paints**.

After paint, React runs **passive effects** (`useEffect` cleanup, then setup), scheduled asynchronously.

This is why **Strict Mode double-invokes** components and reducers in development: render-phase code can legitimately run more than once, and the double call exposes impure code.

### Lanes: How Fiber Prioritises Updates

Every update is assigned a **lane**, a bit in a 31-bit bitmask. Several updates in the same lane are batched together.

| Lane (simplified) | Triggered by | Behaviour |
|---|---|---|
| `SyncLane` | Discrete events: click, keydown, submit | Rendered synchronously, no yielding |
| `InputContinuousLane` | Continuous events: mousemove, scroll, drag | High priority |
| `DefaultLane` | Updates outside events (`setTimeout`, fetch callbacks) | Normal priority |
| `TransitionLanes` | `startTransition`, `useTransition`, `useDeferredValue` | Interruptible, can be restarted |
| `IdleLane` | Offscreen / background work | Lowest |

When you type in a search box while a transition re-renders a big list, the keystroke (sync lane) **interrupts** the transition render. React handles the keystroke, then restarts the transition with the latest state. Stale intermediate results are never committed.

### Bailouts: When React Skips Work

During `beginWork`, React skips a fiber (and often its whole subtree) when **all** of these hold:

- `oldProps === newProps` (**reference** equality of the props object),
- no context it reads has changed,
- it has no pending update in the current lanes.

The props object is recreated every time the parent renders, so `oldProps === newProps` is false for every child of a component that re-rendered. That is why **a parent re-render re-renders all its children by default**. `React.memo`, `PureComponent` and `shouldComponentUpdate` swap the reference check for a shallow comparison of each prop.

A second bailout applies to state: if you call `setState` with a value that is `Object.is`-equal to the current one, React can skip re-rendering that component.

### Hooks Live on the Fiber

A function component has no instance, so its hooks are stored on its fiber as a **linked list** in `memoizedState`:

```
fiber.memoizedState → useState(count) → useRef(timer) → useEffect(...) → null
```

On each render React walks this list **in call order**. This is the real reason for the **Rules of Hooks**: if a hook call is inside a condition and gets skipped, every following hook reads the wrong slot.

```jsx
function Bad({ loggedIn }) {
  if (loggedIn) {
    const [name, setName] = useState("");   // ❌ slot 0 only sometimes
  }
  const [count, setCount] = useState(0);   // reads slot 0 or slot 1 depending on loggedIn
}
```

### Batching

Updates scheduled together share a lane and are rendered **once**. Since React 18 (`createRoot`), batching is **automatic everywhere**: event handlers, promises, `setTimeout`, native listeners.

```jsx
function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  // one render, not two
}

setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // React 17: two renders. React 18+: one render.
}, 0);
```

Use `flushSync(() => setX(...))` from `react-dom` when you really need the DOM updated immediately, for example to measure it.

## 🔀 How Children Are Reconciled (The List Algorithm)

When a component returns an array of children, React diffs old child fibers against new elements in two passes:

1. **Pass 1, walk in order:** compare `old[i]` with `new[i]`. While keys match, update in place. Stop at the first key mismatch.
2. **Pass 2, keyed lookup:** put the remaining old fibers in a `Map` by key (or by index when there's no key). For each remaining new element, look up a match by key. Reuse it if found, otherwise create a new fiber. Any old fibers left in the map are **deleted**.

To decide what has to **move**, React tracks `lastPlacedIndex`: if a reused fiber's old index is lower than `lastPlacedIndex`, it is marked to move. Otherwise it stays and `lastPlacedIndex` becomes its old index.

```
old: [A, B, C, D]          new: [D, A, B, C]

D → old index 3 ≥ 0  → stays,   lastPlacedIndex = 3
A → old index 0 < 3  → MOVE
B → old index 1 < 3  → MOVE
C → old index 2 < 3  → MOVE
```

Moving the **last item to the front costs 3 DOM moves**, not 1, because the algorithm only scans forward. Moving the first item to the end costs 1. This is a well-known interview follow-up.

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

Index keys are fine only for static lists that are never reordered, filtered or prepended to. Never use `Math.random()` as a key: every render gets new keys, so every item is unmounted and remounted.

## 💻 Code Example — Using `key` to Reset State

Because a changed key means "different component", you can force a fresh instance on purpose:

```jsx
// Switching user throws away the old form's state and remounts it
<ProfileForm key={userId} userId={userId} />
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

## 💻 Code Example — Defining a Component Inside Another (Classic Bug)

```jsx
function Parent() {
  // ❌ A new Input function is created every render → new type each time
  function Input() {
    return <input />;
  }
  return <Input />;   // remounts on every Parent render: input loses focus and text
}

// ✅ Define components at module level
function Input() { return <input />; }
function Parent() { return <Input />; }
```

## 💻 Code Example — Position in the Tree Preserves State

```jsx
function Page({ isEditing }) {
  return (
    <div>
      {isEditing ? <Counter /> : <Counter />}
      {/* Same type at the same position → same fiber → state is KEPT */}
    </div>
  );
}

// To reset, give them different keys:
// {isEditing ? <Counter key="edit" /> : <Counter key="view" />}
```

## 💻 Code Example — Fiber Time-Slicing with `startTransition`

```jsx
// Concurrent rendering can interrupt a long render to handle higher-priority updates
import { startTransition } from "react";

function Search({ list }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(list);

  const onChange = (e) => {
    const value = e.target.value;
    setQuery(value);                                  // SyncLane: input stays responsive
    startTransition(() => {                           // TransitionLane: interruptible
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

The `startTransition` wrap puts the update in a transition lane. If the user keeps typing, Fiber abandons the half-built `workInProgress` tree and starts again with the newest query.

## 💻 Code Example — Bail-Out via `React.memo`

```jsx
const Item = React.memo(function Item({ name }) {
  console.log("Render", name);
  return <li>{name}</li>;
});
// Only re-renders when `name` prop changes (shallow compare).
```

## 📊 Phases Summary

| Phase | Work | Interruptible |
|-------|------|---------------|
| **Render** | Call components, reconcile children, mark flags on `workInProgress` | ✅ (concurrent) |
| **Commit: before mutation** | `getSnapshotBeforeUpdate` | ❌ |
| **Commit: mutation** | DOM inserts/updates/deletes, layout effect cleanups | ❌ |
| **Commit: layout** | Swap `current`, attach refs, `useLayoutEffect`, `componentDidMount/Update` | ❌ |
| **Passive effects** | `useEffect` cleanup + setup, after paint | Runs async |

## 🌍 Real-World Impact

- Stable keys are the single biggest win for list performance and correctness.
- Never define components inside other components. It changes the type every render and wipes state.
- Use `key` deliberately to reset a subtree instead of syncing state with effects.
- Keep render code pure. Under concurrent rendering and Strict Mode it can run more than once.
- Use transitions (`startTransition`, `useDeferredValue`) for typeahead and large lists so typing stays responsive.

## 🎯 Likely Interview Questions

1. **What is the Virtual DOM?** — A tree of plain JS objects (React elements) describing the UI. React diffs the new tree against the previous one and applies only the differences to the real DOM.
2. **How does React's diff algorithm work?** — It is O(n) based on two heuristics: a different type means rebuild the subtree, and keys identify siblings. It only compares nodes at the same level.
3. **Why are keys important? Why not use index?** — Keys let React match moved items. Index keys break when items are inserted, removed or reordered, which causes wrong DOM/state reuse and extra mutations.
4. **What is the Fiber architecture?** — The React 16+ reconciler. Each component gets a fiber node linked by `child`/`sibling`/`return`, so the tree walk is an interruptible loop. Work is split into units, prioritised with lanes, built off-screen in a `workInProgress` tree, and committed synchronously.
5. **What problem did Fiber solve?** — The old stack reconciler was recursive and could not be interrupted, so big updates blocked the main thread. Fiber can pause, prioritise, resume or abort rendering.
6. **What are the render and commit phases?** — Render: pure and interruptible, it computes changes. Commit: synchronous, it applies DOM changes and runs layout effects. `useEffect` runs after paint.
7. **What is double buffering in React?** — There are two fiber trees, `current` (on screen) and `workInProgress` (being built), linked by `alternate`. React swaps them at the end of the commit, so the UI never shows a partial update.
8. **What are lanes?** — Bitmask priorities assigned to updates: sync for clicks, default, transition, idle. Higher lanes can interrupt lower ones, and updates in the same lane are batched.
9. **Why must hooks be called in the same order?** — Hooks are stored as a linked list on the fiber and matched by call order, not by name.
10. **When does a component re-render?** — Its state changes, its parent re-renders, or a context it consumes changes. Props changing is not the trigger by itself. The parent re-rendering is.
11. **How does React decide whether to reuse a component or unmount and remount it?** — Same type and same key at the same position means reuse (state kept). Anything else means the subtree is destroyed and created again.
12. **What is automatic batching?** — Since React 18, multiple state updates in any context (events, promises, timeouts) are combined into one render. `flushSync` opts out.
13. **Is the Virtual DOM faster than the real DOM?** — Not inherently, because it adds diffing overhead. Its value is a declarative programming model with good-enough performance and smart batching. Frameworks like Svelte and Solid skip the VDOM entirely.

---

[← Custom Hooks](08-custom-hooks.md) | [Index](../README.md) | [Next: Performance Optimization →](10-performance-optimization.md)
