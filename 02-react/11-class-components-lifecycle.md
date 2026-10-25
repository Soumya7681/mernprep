# Chapter 25 — Class Components & Lifecycle Methods

## 📖 Definition

A **class component** is a React component written as an ES6 class that extends `React.Component` (or `React.PureComponent`). It must have a `render()` method, keeps state in `this.state`, updates it with `this.setState()`, and reacts to mounting, updating and unmounting through **lifecycle methods**.

## 🔍 Explanation

Before Hooks (React 16.8, 2019), classes were the **only** way to have state or side effects. Function components were "stateless". Today, functions with Hooks are the default, but class components still matter in interviews because:

- Large codebases written before 2019 are full of them, and you will maintain that code.
- **Error Boundaries still need a class.** There is no hook equivalent yet.
- Interviewers use the lifecycle to check that you really understand what `useEffect` replaces.

### Anatomy of a Class Component

| Piece | Purpose |
|-------|---------|
| `extends React.Component` | Gives you `setState`, `forceUpdate`, `props`, `context` |
| `constructor(props)` + `super(props)` | Initialise state, bind methods (optional with class fields) |
| `this.props` | Read-only inputs from the parent |
| `this.state` | Local state, **always an object** |
| `this.setState(update, callback?)` | Schedules a re-render with **shallow-merged** state |
| `render()` | **Required.** Pure: returns JSX, no side effects |
| Lifecycle methods | Hooks into mount / update / unmount / error phases |

### The Lifecycle at a Glance

```
MOUNTING        constructor → getDerivedStateFromProps → render → (DOM updated) → componentDidMount
UPDATING        getDerivedStateFromProps → shouldComponentUpdate → render
                → getSnapshotBeforeUpdate → (DOM updated) → componentDidUpdate
UNMOUNTING      componentWillUnmount
ERRORS          getDerivedStateFromError (render phase) → componentDidCatch (commit phase)
```

An update is triggered by new props, `setState`, or `forceUpdate()` (which skips `shouldComponentUpdate`).

**Render phase vs commit phase:** `constructor`, `getDerivedStateFromProps`, `shouldComponentUpdate` and `render` run in the **render phase**. They must be pure, because React may call them more than once (Strict Mode does this deliberately in development). `componentDidMount`, `componentDidUpdate`, `componentWillUnmount` and `getSnapshotBeforeUpdate` run in the **commit phase**, once per commit, and that is where side effects belong.

### Every Lifecycle Method

| Method | Phase | Use it for | Don't |
|--------|-------|-----------|-------|
| `constructor(props)` | Mount | Init `this.state`, bind handlers | Call `setState`, fetch data, subscribe |
| `static getDerivedStateFromProps(props, state)` | Mount + update | Return state derived from props (rare) | Side effects (it's static, no `this`) |
| `render()` | Mount + update | Return JSX | `setState`, fetch, touch the DOM |
| `componentDidMount()` | Mount | Fetch data, subscriptions, timers, DOM measurements | Forget to clean up in unmount |
| `shouldComponentUpdate(nextProps, nextState)` | Update | Return `false` to skip a re-render | Deep-compare big objects (slow) |
| `getSnapshotBeforeUpdate(prevProps, prevState)` | Update | Read DOM (e.g. scroll position) right before it changes | Mutate the DOM |
| `componentDidUpdate(prevProps, prevState, snapshot)` | Update | Effects that depend on changed props/state | Call `setState` without a condition (infinite loop) |
| `componentWillUnmount()` | Unmount | Clear timers, cancel requests, unsubscribe | `setState` (component is going away) |
| `static getDerivedStateFromError(error)` | Error | Return state to show fallback UI | Side effects |
| `componentDidCatch(error, info)` | Error | Log the error to a service | Rely on it for event handler / async errors |

### Deprecated (`UNSAFE_`) Methods

`componentWillMount`, `componentWillReceiveProps` and `componentWillUpdate` were renamed to `UNSAFE_componentWillMount` etc. in React 16.3. They run in the render phase, so with concurrent rendering they can fire several times for one commit, and people put side effects in them. Replacements:

| Old | Use instead |
|-----|-------------|
| `componentWillMount` | `constructor` (state) or `componentDidMount` (effects) |
| `componentWillReceiveProps` | `getDerivedStateFromProps`, `componentDidUpdate`, or a `key` to reset |
| `componentWillUpdate` | `getSnapshotBeforeUpdate` + `componentDidUpdate` |

## 💻 Code Example — Basic Class Component with State

```jsx
import React from "react";

class Counter extends React.Component {
  constructor(props) {
    super(props);                         // must call before using `this`
    this.state = { count: 0 };
    this.increment = this.increment.bind(this);   // otherwise `this` is undefined in the handler
  }

  increment() {
    this.setState({ count: this.state.count + 1 });
  }

  render() {
    return (
      <button onClick={this.increment}>
        {this.props.label}: {this.state.count}
      </button>
    );
  }
}

// Usage
<Counter label="Clicks" />
```

## 💻 Code Example — Class Fields (No Constructor, No Binding)

Class fields + arrow functions are the modern way to write classes. The arrow function captures `this` lexically, so no `.bind` is needed.

```jsx
class Counter extends React.Component {
  state = { count: 0 };

  increment = () => {
    this.setState(prev => ({ count: prev.count + 1 }));
  };

  render() {
    return <button onClick={this.increment}>{this.state.count}</button>;
  }
}
```

### Why `this` Gets Lost

```jsx
class Broken extends React.Component {
  handleClick() {
    console.log(this);   // undefined: the method is passed as a bare function reference
  }
  render() {
    return <button onClick={this.handleClick}>Click</button>;
  }
}
```

Three fixes: bind in the constructor, use an arrow-function class field, or use an inline arrow `onClick={() => this.handleClick()}` (which creates a new function every render).

## 💻 Code Example — `setState` Is Async and Merges

```jsx
class Demo extends React.Component {
  state = { count: 0, name: "Soumya" };

  addThree = () => {
    // ❌ All three read the same stale this.state.count, so the result is +1
    this.setState({ count: this.state.count + 1 });
    this.setState({ count: this.state.count + 1 });
    this.setState({ count: this.state.count + 1 });
  };

  addThreeCorrectly = () => {
    // ✅ Updater function receives the latest pending state, so the result is +3
    this.setState(prev => ({ count: prev.count + 1 }));
    this.setState(prev => ({ count: prev.count + 1 }));
    this.setState(prev => ({ count: prev.count + 1 }));
  };

  logAfterUpdate = () => {
    this.setState({ count: 10 }, () => {
      console.log("Committed:", this.state.count);   // callback runs after the update is applied
    });
  };

  render() {
    // setState({ count }) keeps `name`: class state is shallow-merged.
    // useState does NOT merge, it replaces the value.
    return <p>{this.state.name}: {this.state.count}</p>;
  }
}
```

## 💻 Code Example — Full Lifecycle (Data Fetching)

```jsx
class UserProfile extends React.Component {
  state = { user: null, loading: true };

  componentDidMount() {
    this.fetchUser(this.props.userId);
  }

  componentDidUpdate(prevProps) {
    // Always compare, or setState here will loop forever
    if (prevProps.userId !== this.props.userId) {
      this.fetchUser(this.props.userId);
    }
  }

  componentWillUnmount() {
    this.controller?.abort();             // cancel the in-flight request
  }

  fetchUser(id) {
    this.controller?.abort();
    this.controller = new AbortController();
    this.setState({ loading: true });

    fetch(`/api/users/${id}`, { signal: this.controller.signal })
      .then(r => r.json())
      .then(user => this.setState({ user, loading: false }))
      .catch(err => { if (err.name !== "AbortError") this.setState({ loading: false }); });
  }

  render() {
    const { user, loading } = this.state;
    if (loading) return <p>Loading…</p>;
    return user ? <h2>{user.name}</h2> : <p>Not found</p>;
  }
}
```

The same component with Hooks is one effect, because mount, update and cleanup live together:

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(setUser)
      .catch(() => {});
    return () => controller.abort();      // componentWillUnmount + "before next update"
  }, [userId]);                           // componentDidMount + componentDidUpdate

  return user ? <h2>{user.name}</h2> : <p>Loading…</p>;
}
```

## 💻 Code Example — Subscriptions and Timers

```jsx
class Clock extends React.Component {
  state = { now: new Date() };

  componentDidMount() {
    this.timerId = setInterval(() => this.setState({ now: new Date() }), 1000);
    window.addEventListener("resize", this.handleResize);
  }

  componentWillUnmount() {
    clearInterval(this.timerId);                          // ❗ forget this → memory leak
    window.removeEventListener("resize", this.handleResize);
  }

  handleResize = () => console.log(window.innerWidth);

  render() {
    return <p>{this.state.now.toLocaleTimeString()}</p>;
  }
}
```

## 💻 Code Example — `shouldComponentUpdate` and `PureComponent`

```jsx
class Row extends React.Component {
  shouldComponentUpdate(nextProps) {
    // Skip re-render unless the data we display changed
    return nextProps.item.id !== this.props.item.id
        || nextProps.item.label !== this.props.item.label;
  }
  render() {
    return <li>{this.props.item.label}</li>;
  }
}

// PureComponent implements shouldComponentUpdate with a shallow compare of props and state
class FastRow extends React.PureComponent {
  render() {
    return <li>{this.props.label}</li>;
  }
}
```

`PureComponent` is the class version of `React.memo`. Same trap: if you mutate an array/object and pass the same reference, the shallow compare says "nothing changed" and the UI goes stale.

## 💻 Code Example — `getDerivedStateFromProps`

Rarely needed. Use it only when state must follow a prop but can also change on its own.

```jsx
class EmailInput extends React.Component {
  state = { email: this.props.defaultEmail, prevUserId: this.props.userId };

  static getDerivedStateFromProps(props, state) {
    // Reset the draft when a different user is selected
    if (props.userId !== state.prevUserId) {
      return { email: props.defaultEmail, prevUserId: props.userId };
    }
    return null;                          // null = no state change
  }

  render() {
    return (
      <input
        value={this.state.email}
        onChange={e => this.setState({ email: e.target.value })}
      />
    );
  }
}
```

The simpler alternative is usually a `key`: `<EmailInput key={userId} />` remounts the component with fresh state.

## 💻 Code Example — `getSnapshotBeforeUpdate` (Keep Chat Scroll Position)

```jsx
class ChatLog extends React.Component {
  listRef = React.createRef();

  getSnapshotBeforeUpdate(prevProps) {
    if (prevProps.messages.length < this.props.messages.length) {
      const el = this.listRef.current;
      return el.scrollHeight - el.scrollTop;   // distance from bottom, read before DOM changes
    }
    return null;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (snapshot !== null) {
      const el = this.listRef.current;
      el.scrollTop = el.scrollHeight - snapshot;
    }
  }

  render() {
    return (
      <ul ref={this.listRef} className="chat">
        {this.props.messages.map(m => <li key={m.id}>{m.text}</li>)}
      </ul>
    );
  }
}
```

No hook can run at exactly this moment, which is one reason this method still exists.

## 💻 Code Example — Error Boundary (Still Class-Only)

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };            // render phase: switch to fallback UI
  }

  componentDidCatch(error, info) {
    logToService(error, info.componentStack);   // commit phase: side effects OK
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? <h2>Something went wrong.</h2>;
    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<p>Widget failed to load</p>}>
  <Dashboard />
</ErrorBoundary>
```

Error boundaries catch errors thrown during **rendering, lifecycle methods and constructors** of their children. They do **not** catch errors in event handlers, `setTimeout`/promises, server-side rendering, or the boundary itself. Use `try/catch` for those.

## 💻 Code Example — Refs and Context in Classes

```jsx
const ThemeContext = React.createContext("light");

class SearchBox extends React.Component {
  static contextType = ThemeContext;      // one context via this.context
  inputRef = React.createRef();

  componentDidMount() {
    this.inputRef.current.focus();
  }

  render() {
    return <input ref={this.inputRef} className={this.context} />;
  }
}
```

For more than one context, use `<ThemeContext.Consumer>{value => …}</ThemeContext.Consumer>` in `render`.

## 💻 Code Example — Default Props

```jsx
class Button extends React.Component {
  static defaultProps = { variant: "primary" };
  render() {
    return <button className={this.props.variant}>{this.props.children}</button>;
  }
}
```

`defaultProps` still works on classes. On function components it was removed in React 19, so use default parameters there: `function Button({ variant = "primary" })`.

## 🗑️ Legacy Class APIs You May See in Old Code

| API | Status | Replacement |
|-----|--------|-------------|
| `React.createClass({...})` | Removed in React 16 (moved to the `create-react-class` package) | ES6 `class` or function component |
| Mixins | Only worked with `createClass` | HOCs, render props, custom hooks |
| String refs (`ref="input"` + `this.refs.input`) | Removed in React 19 | `React.createRef()` or callback refs |
| Legacy context (`childContextTypes`, `getChildContext`) | Removed in React 19 | `React.createContext` + `static contextType` |
| `propTypes` runtime checks | Silently ignored in React 19 | TypeScript |
| `ReactDOM.findDOMNode(this)` | Removed in React 19 | Attach a ref to the DOM node |
| `this.forceUpdate()` | Still works, skips `shouldComponentUpdate` | Put the data in state so a normal update happens |

## 📊 Class vs Function: Side-by-Side

| Concept | Class component | Function component |
|---------|-----------------|--------------------|
| State | `this.state` (one object, merged) | `useState` / `useReducer` (any value, replaced) |
| Update state | `this.setState(obj \| fn, cb)` | `setX(value \| fn)` |
| After-update callback | `setState` 2nd arg | `useEffect` on that state |
| Mount | `componentDidMount` | `useEffect(fn, [])` |
| Update | `componentDidUpdate` | `useEffect(fn, [deps])` |
| Unmount | `componentWillUnmount` | Cleanup returned from `useEffect` |
| Read DOM before paint | `getSnapshotBeforeUpdate` | `useLayoutEffect` (close, not identical) |
| Skip re-render | `shouldComponentUpdate` / `PureComponent` | `React.memo` |
| Derived state | `getDerivedStateFromProps` | Compute during render, or `key` to reset |
| Refs | `React.createRef()` | `useRef()` |
| Context | `static contextType` / `Consumer` | `useContext` / `use` |
| Error boundary | `getDerivedStateFromError` + `componentDidCatch` | ❌ Not possible, wrap with a class |
| Instance variables | `this.timerId` | `useRef` |
| Logic reuse | HOCs, render props | Custom hooks |
| `this` binding | Needed | None |

## 🌍 Real-World Impact

- **Legacy code:** expect class components in older admin panels and dashboards. Know the lifecycle well enough to fix bugs without rewriting everything.
- **Migration:** convert a class to hooks when you are already changing it and it has tests. A common bug in migration is splitting `componentDidMount` + `componentDidUpdate` logic into the wrong deps array.
- **Memory leaks:** the classic class bug is a timer or listener added in `componentDidMount` and never removed in `componentWillUnmount`.
- **Error boundaries:** most apps keep one or two small class components (or `react-error-boundary`) just for this.

## 🎯 Likely Interview Questions

1. **What are the lifecycle methods of a class component?** — Mounting: `constructor`, `getDerivedStateFromProps`, `render`, `componentDidMount`. Updating: `getDerivedStateFromProps`, `shouldComponentUpdate`, `render`, `getSnapshotBeforeUpdate`, `componentDidUpdate`. Unmounting: `componentWillUnmount`. Errors: `getDerivedStateFromError`, `componentDidCatch`.
2. **Where do you fetch data in a class component?** — `componentDidMount`, and again in `componentDidUpdate` when the relevant prop changes. Never in `render` or the constructor.
3. **Why call `super(props)` in the constructor?** — `this` is not initialised until `super()` runs. Passing `props` makes `this.props` available inside the constructor.
4. **Is `setState` synchronous?** — No. Updates are batched (in all contexts since React 18), so read the result in the callback or `componentDidUpdate`, and use the updater function when the new state depends on the old.
5. **Difference between `setState` and `useState` setter?** — `setState` shallow-merges into the state object. The `useState` setter replaces the value. Both are batched, and both accept an updater function.
6. **What does `shouldComponentUpdate` do? What is `PureComponent`?** — Returning `false` skips `render`. `PureComponent` does it automatically with a shallow compare, like `React.memo`.
7. **Why were `componentWillMount` / `componentWillReceiveProps` deprecated?** — They run in the render phase, which can run several times under concurrent rendering, and they encouraged side effects there. They are now `UNSAFE_` prefixed.
8. **How do you map lifecycle methods to Hooks?** — Mount/update/unmount → `useEffect` with deps and cleanup; `shouldComponentUpdate` → `React.memo`; `getSnapshotBeforeUpdate` → `useLayoutEffect` (roughly); error boundaries have no hook equivalent.
9. **Why do event handlers lose `this`?** — Class methods are not auto-bound. Passing `this.handleClick` passes a plain function, so `this` is `undefined` in strict mode. Bind it or use an arrow class field.
10. **What happens if you call `setState` in `componentDidUpdate` without a condition?** — Infinite loop: update → `componentDidUpdate` → `setState` → update… React throws "Maximum update depth exceeded".
11. **Can a class component use Hooks?** — No. Hooks only work in function components and custom hooks. Wrap the class in a function component or pass hook values as props.
12. **When would you still write a class today?** — Error boundaries, or when keeping consistency inside an existing class-heavy module.

---

[← JSX, Fragments & StrictMode](12-jsx-fragments-strictmode.md) | [Index](../README.md) | [Next: Props vs State →](02-props-vs-state.md)
