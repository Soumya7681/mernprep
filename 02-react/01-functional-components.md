# Chapter 23 — Functional Components

## 📖 Definition

A **functional component** is a React component written as a JavaScript function that accepts `props` and returns JSX.

## 🔍 Explanation

Since React 16.8 introduced **Hooks**, functional components became the standard for new code. They are:
- **Simpler** — no `this`, no constructor.
- **Easier to test** — they're plain functions.
- **More composable** — custom hooks let you share logic without wrapper hell.

Class components still exist (mostly in legacy code), but you should default to functions.

## 💻 Code Example — Minimal Functional Component

```jsx
function Greeting({ name }) {
  return <h1>Hello, {name}</h1>;
}

// Usage
<Greeting name="Soumya" />
```

## 💻 Code Example — Arrow Function Variant

```jsx
const Greeting = ({ name }) => <h1>Hello, {name}</h1>;
```

Both forms are interchangeable.

## 💻 Code Example — With State and Effects

```jsx
import { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => active && setUser(data))
      .finally(() => active && setLoading(false));
    return () => { active = false; };       // cleanup
  }, [userId]);

  if (loading) return <p>Loading…</p>;
  if (!user) return <p>Not found</p>;
  return <h2>{user.name}</h2>;
}
```

## 💻 Code Example — Class vs Functional (Same Component)

```jsx
// Class (legacy)
class Counter extends React.Component {
  state = { count: 0 };
  inc = () => this.setState({ count: this.state.count + 1 });
  render() {
    return <button onClick={this.inc}>{this.state.count}</button>;
  }
}

// Functional (modern)
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

The full class component API (lifecycle methods, `setState`, `PureComponent`, error boundaries) is covered in [Class Components & Lifecycle](11-class-components-lifecycle.md).

## 💻 Code Example — Composition

```jsx
function Avatar({ url }) { return <img src={url} className="avatar" />; }
function UserName({ name }) { return <span className="name">{name}</span>; }

function UserCard({ user }) {
  return (
    <div className="card">
      <Avatar url={user.avatar} />
      <UserName name={user.name} />
    </div>
  );
}
```

## 💻 Code Example — Conditional Rendering

```jsx
function Status({ isOnline }) {
  return (
    <div>
      {isOnline ? (
        <span className="green">Online</span>
      ) : (
        <span className="grey">Offline</span>
      )}
      {isOnline && <button>Send message</button>}
    </div>
  );
}
```

## 💻 Code Example — Lists with Keys

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>      // key must be stable + unique
      ))}
    </ul>
  );
}
```

## 🌍 Real-World Impact

- All new components in your Hyscaler projects should be functional.
- Refactor old class components only when you touch them — don't waste cycles on rewrites.

## 🎯 Likely Interview Questions

1. **Functional vs class components?**
2. **What is JSX?** — Syntactic sugar over `React.createElement(type, props, children)`. Babel compiles it.
3. **Can a functional component have state?** — Yes, via `useState`.
4. **Why are keys needed in lists?** — Stable identity for reconciliation diffing.

---

[← Browser APIs & Web Performance](../20-javascript-advanced/08-browser-apis-performance.md) | [Index](../README.md) | [Next: JSX, Fragments & StrictMode →](12-jsx-fragments-strictmode.md)
