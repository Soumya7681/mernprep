# Chapter 36 — Advanced Component Patterns

## 📖 Definition

Advanced component patterns are reusable ways to structure React components so they are **flexible** (the caller controls layout and behaviour) without becoming a mess of props. The common ones are compound components, render props, higher-order components, controlled/uncontrolled props, the state-reducer pattern, portals, and error boundaries.

## 💻 Pattern 1 — Compound Components

Several components share implicit state through context, giving the caller full control of markup.

```jsx
import { createContext, useContext, useState } from "react";

const TabsCtx = createContext(null);

export function Tabs({ defaultValue, children }) {
  const [active, setActive] = useState(defaultValue);
  return <TabsCtx.Provider value={{ active, setActive }}>{children}</TabsCtx.Provider>;
}

Tabs.List = function TabsList({ children }) {
  return <div role="tablist">{children}</div>;
};

Tabs.Tab = function Tab({ value, children }) {
  const { active, setActive } = useContext(TabsCtx);
  return (
    <button role="tab" aria-selected={active === value} onClick={() => setActive(value)}>
      {children}
    </button>
  );
};

Tabs.Panel = function TabPanel({ value, children }) {
  const { active } = useContext(TabsCtx);
  return active === value ? <div role="tabpanel">{children}</div> : null;
};

// Usage — the caller decides structure and order
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Tab value="profile">Profile</Tabs.Tab>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="billing"><Billing /></Tabs.Panel>
</Tabs>;
```

Used by Radix UI, Headless UI, Reach UI and shadcn/ui.

## 💻 Pattern 2 — Render Props

A component receives a function and calls it to decide what to render.

```jsx
function MouseTracker({ children }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })} style={{ height: 300 }}>
      {children(pos)}
    </div>
  );
}

<MouseTracker>{({ x, y }) => <p>Mouse at {x}, {y}</p>}</MouseTracker>;
```

Today a **custom hook** (`useMousePosition()`) usually replaces render props, but the pattern still appears in libraries (Formik's `<Field>`, React Router's older APIs, virtualised lists' `rowRenderer`).

## 💻 Pattern 3 — Higher-Order Component (HOC)

A function that takes a component and returns an enhanced component.

```jsx
function withAuth(Component, { role } = {}) {
  return function Protected(props) {
    const { user, loading } = useAuth();
    if (loading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) return <p>Forbidden</p>;
    return <Component {...props} user={user} />;
  };
}

export default withAuth(AdminPage, { role: "admin" });
```

**Downsides:** wrapper nesting ("wrapper hell"), prop-name collisions, harder typing. Prefer hooks for logic reuse and keep HOCs for cross-cutting wrapping.

## 💻 Pattern 4 — Controlled *and* Uncontrolled (Like `<input>`)

```jsx
function useControllableState({ value, defaultValue, onChange }) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const setValue = (next) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };
  return [current, setValue];
}

function Toggle({ on, defaultOn = false, onChange }) {
  const [isOn, setIsOn] = useControllableState({ value: on, defaultValue: defaultOn, onChange });
  return <button aria-pressed={isOn} onClick={() => setIsOn(!isOn)}>{isOn ? "ON" : "OFF"}</button>;
}

<Toggle defaultOn />;                            // uncontrolled
<Toggle on={enabled} onChange={setEnabled} />;   // controlled by parent
```

## 💻 Pattern 5 — State Reducer (Inversion of Control)

Let the caller override how state changes, without forking the component.

```jsx
function counterReducer(state, action) {
  switch (action.type) {
    case "inc": return { count: state.count + 1 };
    case "dec": return { count: state.count - 1 };
    default: return state;
  }
}

function useCounter({ reducer = counterReducer } = {}) {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  return { ...state, inc: () => dispatch({ type: "inc" }), dec: () => dispatch({ type: "dec" }) };
}

// Caller: never go below zero
const { count, inc, dec } = useCounter({
  reducer: (state, action) => {
    const next = counterReducer(state, action);
    return next.count < 0 ? state : next;
  },
});
```

## 💻 Pattern 6 — Portals (Modals, Tooltips, Toasts)

Render children into a DOM node outside the parent hierarchy, escaping `overflow: hidden` and `z-index` stacking problems, while React events still bubble through the React tree.

```jsx
import { createPortal } from "react-dom";

function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
```

## 💻 Pattern 7 — Error Boundaries

Catch render errors in a subtree and show a fallback. Still class-only (or use `react-error-boundary`).

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { logToSentry(error, info.componentStack); }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div role="alert">
          Something went wrong. <button onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**They do NOT catch:** errors in event handlers, async code (`setTimeout`, promises), server-side rendering, or errors in the boundary itself. Handle those with `try/catch` and state.

## 💻 Pattern 8 — Polymorphic `as` Prop

```jsx
function Text({ as: Component = "p", ...props }) {
  return <Component {...props} />;
}
<Text as="h1">Title</Text>;
<Text as={Link} to="/about">About</Text>;
```

## 💻 Pattern 9 — Container / Presentational (With Hooks)

```jsx
// Logic in a hook
function useOrders() {
  return useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
}

// Pure presentational component — easy to test and reuse in Storybook
function OrderTable({ orders }) { /* only renders */ }

function OrdersPage() {
  const { data, isLoading } = useOrders();
  return isLoading ? <Spinner /> : <OrderTable orders={data} />;
}
```

## 🌍 Real-World Use

| Pattern | Typical use |
|---|---|
| Compound | Tabs, accordions, dropdown menus, design-system components |
| Render props / hooks | Data fetching, mouse/scroll tracking, virtual lists |
| HOC | Auth guards, analytics wrappers, legacy code |
| Controlled + uncontrolled | Reusable form inputs, toggles, date pickers |
| State reducer | Highly customisable library components (Downshift) |
| Portal | Modals, toasts, tooltips, dropdowns inside scroll containers |
| Error Boundary | Per route and per widget so one crash does not blank the app |

## 🎯 Likely Interview Questions

1. **What are compound components? Build a Tabs or Accordion with them.**
2. **Render props vs HOC vs custom hooks — when would you use each today?**
3. **How do you build a component that can be controlled or uncontrolled?**
4. **What is a portal and why do modals use it? Do events bubble through portals?**
5. **What do Error Boundaries not catch? How do you handle those errors?**
6. **Why are Error Boundaries still class components?**
7. **What is the state-reducer pattern?**

---

[← Concurrent Rendering & Suspense](02-concurrent-rendering-suspense.md) | [Index](../README.md) | [Next: Server State & Data Fetching →](04-server-state-data-fetching.md)
