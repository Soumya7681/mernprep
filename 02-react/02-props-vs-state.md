# Chapter 24 — Props vs State

## 📖 Definition

- **Props** — read-only inputs passed from a parent to a child component.
- **State** — internal, mutable data managed within a component.

## 🔍 Explanation

| Aspect | Props | State |
|--------|-------|-------|
| Owner | Parent | The component itself |
| Mutable inside the component? | ❌ No (immutable) | ✅ Yes (via setter) |
| Triggers re-render? | When parent passes a new value | When setter is called |
| Purpose | Configuration / data passing | Local UI behavior |
| Initial value? | Always from parent | Set on first render |

## 💻 Code Example — Props

```jsx
function Welcome({ name, role }) {
  return <h2>Welcome, {role} {name}!</h2>;
}

// Parent
<Welcome name="Soumya" role="Engineer" />
```

`name` and `role` are received in `props` and are **read-only inside `Welcome`**.

## 💻 Code Example — State

```jsx
function Counter() {
  const [count, setCount] = useState(0);     // initial state = 0

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>−</button>
    </div>
  );
}
```

## 💻 Code Example — Props + State Together

```jsx
function Counter({ initial = 0 }) {           // props = initial value
  const [count, setCount] = useState(initial); // state holds current count
  return (
    <button onClick={() => setCount(count + 1)}>{count}</button>
  );
}

<Counter initial={5} />
```

## 💻 Code Example — Lifting State Up

When two siblings need to share state, move it to their common parent.

```jsx
function TemperatureInput({ value, onChange }) {   // ← controlled by parent
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Converter() {
  const [celsius, setCelsius] = useState("");

  return (
    <>
      <TemperatureInput value={celsius} onChange={setCelsius} />
      <p>Fahrenheit: {celsius ? (celsius * 9 / 5 + 32) : "-"}</p>
    </>
  );
}
```

## 💻 Code Example — State Updates Are Asynchronous

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  const tripleIncrement = () => {
    setCount(count + 1);          // queues 1
    setCount(count + 1);          // STILL queues 1 — `count` is stale
    setCount(count + 1);          // STILL queues 1
  };

  // ❌ result: count becomes 1, not 3

  const tripleIncrementFixed = () => {
    setCount(c => c + 1);         // ✅ functional updates
    setCount(c => c + 1);
    setCount(c => c + 1);
  };
}
```

> **Rule:** Use the functional form `setX(prev => …)` when the new state depends on the previous state.

## 💻 Code Example — Don't Mutate State

```jsx
// ❌ wrong — React doesn't detect the change
const addItem = (item) => {
  state.items.push(item);
  setItems(state.items);          // same reference → no re-render!
};

// ✅ right — create a new array
const addItem = (item) => {
  setItems(prev => [...prev, item]);
};

// ✅ for objects
setUser(prev => ({ ...prev, name: "New" }));
```

## 💻 Code Example — `useState` with Complex State

```jsx
function Form() {
  const [form, setForm] = useState({ name: "", email: "" });

  const update = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <>
      <input value={form.name}  onChange={update("name")}  />
      <input value={form.email} onChange={update("email")} />
    </>
  );
}
```

For complex state shapes, consider `useReducer`:

```jsx
const [state, dispatch] = useReducer(reducer, initialState);
dispatch({ type: "UPDATE_FIELD", field: "name", value: "Soumya" });
```

## 💻 Code Example — Props Drilling Problem

```jsx
function App() {
  const [theme, setTheme] = useState("light");
  return <Page theme={theme} />;
}
function Page({ theme }) { return <Sidebar theme={theme} />; }
function Sidebar({ theme }) { return <Menu theme={theme} />; }
function Menu({ theme }) { return <span>{theme}</span>; }
// theme is "drilled" through three components that don't use it.
// Solution: Context API (Chapter 18).
```

## 🎯 Likely Interview Questions

1. **Difference between props and state.**
2. **Can a component change its own props?** — No; props are immutable inside the receiver.
3. **What is lifting state up?**
4. **Why use the functional form of `setState`?** — When new state depends on the previous, the variable in closure may be stale.
5. **Why immutability for state?** — React uses reference equality (`prev !== next`) to decide whether to re-render.

---

[← Functional Components](01-functional-components.md) | [Index](../README.md) | [Next: useEffect →](03-useeffect.md)
