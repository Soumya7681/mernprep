# Chapter 27 — `useReducer`

## 📖 Definition

`useReducer(reducer, initialArg, init?)` manages state through a **reducer**: a pure function `(state, action) => newState`. Instead of setting state directly, components **dispatch actions** that describe what happened, and the reducer decides how state changes.

```jsx
const [state, dispatch] = useReducer(reducer, initialState);
```

## 🔍 Explanation

### How It Works

1. A component calls `dispatch({ type: "added", text: "Milk" })`.
2. React queues the action and, on the next render, calls `reducer(currentState, action)`.
3. The returned value becomes the new state. If it is `Object.is`-equal to the old state, React can skip the re-render.

### Reducer Rules

- **Pure**: same inputs, same output. No fetches, no `Math.random()`, no `Date.now()`, no logging to a server. StrictMode calls reducers twice in development to catch this.
- **Immutable**: return a new object or array. Never mutate `state`.
- **Handle unknown actions**: throw (or return `state`) so typos are caught.

### `useState` vs `useReducer`

| Use `useState` when… | Use `useReducer` when… |
|---|---|
| State is a single value or a few independent values | Several values change together (status + data + error) |
| Updates are simple (`setOpen(true)`) | The next state depends on the previous state in non-trivial ways |
| Logic lives in one handler | Many handlers update the same state, and you want the logic in one place |
| — | You want to unit-test state logic without rendering |
| — | You pass update logic deep down (`dispatch` has a stable identity) |

Internally `useState` is just `useReducer` with a built-in reducer: `(state, action) => typeof action === "function" ? action(state) : action`.

## 💻 Code Example — Counter

```jsx
import { useReducer } from "react";

function reducer(state, action) {
  switch (action.type) {
    case "increment": return { count: state.count + 1 };
    case "decrement": return { count: state.count - 1 };
    case "reset":     return { count: 0 };
    case "set":       return { count: action.value };
    default: throw new Error(`Unknown action: ${action.type}`);
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  return (
    <>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: "decrement" })}>-</button>
      <button onClick={() => dispatch({ type: "increment" })}>+</button>
      <button onClick={() => dispatch({ type: "reset" })}>Reset</button>
    </>
  );
}
```

## 💻 Code Example — Fetch State (Impossible States Avoided)

With three separate `useState` calls you can end up with `loading: true` **and** `error` set at the same time. A reducer moves between valid states only:

```jsx
const initial = { status: "idle", data: null, error: null };

function fetchReducer(state, action) {
  switch (action.type) {
    case "start":   return { status: "loading", data: null, error: null };
    case "success": return { status: "success", data: action.data, error: null };
    case "failure": return { status: "error", data: null, error: action.error };
    default: return state;
  }
}

function Users() {
  const [state, dispatch] = useReducer(fetchReducer, initial);

  useEffect(() => {
    let ignore = false;
    dispatch({ type: "start" });
    fetch("/api/users")
      .then(r => r.json())
      .then(data => !ignore && dispatch({ type: "success", data }))
      .catch(error => !ignore && dispatch({ type: "failure", error }));
    return () => { ignore = true; };
  }, []);

  if (state.status === "loading") return <p>Loading…</p>;
  if (state.status === "error") return <p>Error: {state.error.message}</p>;
  return <ul>{state.data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

Side effects (the fetch) stay in `useEffect`. The reducer only describes the transitions.

## 💻 Code Example — Todo List (Arrays Immutably)

```jsx
function todosReducer(todos, action) {
  switch (action.type) {
    case "added":
      return [...todos, { id: action.id, text: action.text, done: false }];
    case "toggled":
      return todos.map(t => t.id === action.id ? { ...t, done: !t.done } : t);
    case "deleted":
      return todos.filter(t => t.id !== action.id);
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

function TodoApp() {
  const [todos, dispatch] = useReducer(todosReducer, []);
  const [text, setText] = useState("");

  return (
    <>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={() => {
        dispatch({ type: "added", id: crypto.randomUUID(), text });   // id made outside the reducer: keeps it pure
        setText("");
      }}>Add</button>
      <ul>
        {todos.map(t => (
          <li key={t.id}>
            <input type="checkbox" checked={t.done}
                   onChange={() => dispatch({ type: "toggled", id: t.id })} />
            {t.text}
            <button onClick={() => dispatch({ type: "deleted", id: t.id })}>×</button>
          </li>
        ))}
      </ul>
    </>
  );
}
```

Note the input text uses `useState`. Mixing both hooks in one component is normal.

## 💻 Code Example — Lazy Initialisation

The third argument runs **once** to build the initial state, which is useful when it is expensive or read from storage:

```jsx
function init(userId) {
  const saved = localStorage.getItem(`draft:${userId}`);
  return saved ? JSON.parse(saved) : { title: "", body: "" };
}

function Editor({ userId }) {
  const [draft, dispatch] = useReducer(draftReducer, userId, init);
  // ❌ useReducer(draftReducer, init(userId)) would call init on every render
}
```

## 💻 Code Example — Form with a Generic "field" Action

```jsx
function formReducer(state, action) {
  switch (action.type) {
    case "field":
      return { ...state, [action.name]: action.value };
    case "reset":
      return action.initial;
    default:
      return state;
  }
}

function SignupForm() {
  const initial = { name: "", email: "", password: "" };
  const [form, dispatch] = useReducer(formReducer, initial);

  const onChange = e => dispatch({ type: "field", name: e.target.name, value: e.target.value });

  return (
    <form>
      <input name="name" value={form.name} onChange={onChange} />
      <input name="email" value={form.email} onChange={onChange} />
      <input name="password" type="password" value={form.password} onChange={onChange} />
      <button type="button" onClick={() => dispatch({ type: "reset", initial })}>Clear</button>
    </form>
  );
}
```

## 💻 Code Example — TypeScript Discriminated Union

```tsx
type State = { count: number; step: number };

type Action =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "setStep"; step: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment": return { ...state, count: state.count + state.step };
    case "decrement": return { ...state, count: state.count - state.step };
    case "setStep":   return { ...state, step: action.step };   // `action.step` is typed here
  }
}

// dispatch({ type: "setStep" })  ❌ compile error: step is missing
```

## 💻 Code Example — Testing a Reducer (No Rendering Needed)

```js
import { todosReducer } from "./todosReducer";

test("toggles a todo", () => {
  const before = [{ id: "1", text: "Milk", done: false }];
  const after = todosReducer(before, { type: "toggled", id: "1" });

  expect(after[0].done).toBe(true);
  expect(before[0].done).toBe(false);   // original not mutated
});
```

## 💻 Code Example — Immer for Deeply Nested State

```jsx
import { useImmerReducer } from "use-immer";

function reducer(draft, action) {
  switch (action.type) {
    case "renamed":
      draft.users[action.index].profile.name = action.name;   // "mutate" the draft
      break;
  }
}

const [state, dispatch] = useImmerReducer(reducer, initialState);
```

Immer produces a new immutable state from your mutations. Redux Toolkit uses the same idea inside `createSlice`.

## ⚠️ Common Pitfalls

| Mistake | Fix |
|---------|-----|
| Mutating state (`state.items.push(x); return state;`) | Return a new array/object. Same reference means no re-render |
| Side effects in the reducer (fetch, `localStorage.setItem`) | Do them in event handlers or `useEffect` |
| Generating IDs or timestamps inside the reducer | Create them before dispatching and put them in the action |
| Reading `state` right after `dispatch` and expecting the new value | `state` updates on the next render, like `useState` |
| Forgetting a `default` case | Throw on unknown actions to catch typos |

## 📊 `useReducer` vs Redux

| | `useReducer` | Redux / Redux Toolkit |
|---|---|---|
| Scope | One component (share with Context) | Global store |
| Middleware, DevTools time travel | ❌ | ✅ |
| Selectors and fine-grained subscriptions | ❌ (Context re-renders all consumers) | ✅ |
| Boilerplate | Very little | More (much less with RTK) |
| Good for | Complex local state, small apps | Large shared state, many teams |

`useReducer` + Context is a fine "mini-Redux" for a small app. See the Context API chapter for the pattern and its re-render trade-offs.

## 🎯 Likely Interview Questions

1. **What is `useReducer` and when would you use it over `useState`?** — For state with several related fields or complex transitions, when many handlers update the same state, or when you want testable state logic.
2. **What makes a reducer "pure"? Why does it matter?** — No side effects and no mutation, and the same input always gives the same output. React may call it more than once (StrictMode, concurrent rendering), and purity makes it predictable and testable.
3. **Is `dispatch` stable?** — Yes. Its identity never changes, so it is safe to leave out of dependency arrays and to pass down without `useCallback`.
4. **What is the third argument?** — A lazy initialiser `init(initialArg)` that runs once on mount.
5. **How does `useReducer` relate to `useState`?** — `useState` is implemented as `useReducer` with a built-in reducer.
6. **Can you do async work in a reducer?** — No. Run async work in an effect or handler and dispatch actions for start, success and failure.
7. **`useReducer` + Context vs Redux?** — Fine for small apps. Redux adds middleware, DevTools and selector-based subscriptions that avoid re-rendering every consumer.

---

[← Props vs State](02-props-vs-state.md) | [Index](../README.md) | [Next: useEffect →](03-useeffect.md)
