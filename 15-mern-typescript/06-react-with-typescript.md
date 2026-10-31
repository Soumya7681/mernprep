# Chapter 117 — React with TypeScript

## 📖 Definition

React components are just functions, so TypeScript types them through their **props**, **state**, **events**, **refs** and **context**. Getting these right means bad props fail at compile time and editors autocomplete every API.

## 💻 Code Example — Typing Props

```tsx
import type { ReactNode, ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {   // all native <button> props
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", loading = false, icon, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

<Button variant="danger" onClick={() => remove(id)}>Delete</Button>;
// <Button variant="warning" />   ❌ Type '"warning"' is not assignable to type 'ButtonVariant'
```

**`React.FC` or plain function?** Prefer a plain function with typed props. `React.FC` no longer adds implicit `children` (since React 18) and offers little; plain functions also support generics.

| Type | Use for |
|------|---------|
| `ReactNode` | Anything renderable: string, number, JSX, array, `null` (use for `children`) |
| `ReactElement` | Exactly one JSX element |
| `JSX.Element` | What a component returns (similar to `ReactElement`) |
| `ComponentPropsWithoutRef<"input">` | Extend native element props |
| `ComponentProps<typeof Button>` | Reuse another component's props |

## 💻 Code Example — Discriminated-Union Props

```tsx
// Either a link OR a button — never both, never neither
type ActionProps =
  | { as: "link"; href: string; onClick?: never }
  | { as: "button"; onClick: () => void; href?: never };

function Action(props: ActionProps & { label: string }) {
  return props.as === "link"
    ? <a href={props.href}>{props.label}</a>
    : <button onClick={props.onClick}>{props.label}</button>;
}

<Action as="link" href="/tasks" label="Tasks" />;
// <Action as="link" onClick={...} label="x" />   ❌
```

## 💻 Code Example — State & Reducers

```tsx
const [count, setCount] = useState(0);                       // inferred number
const [user, setUser] = useState<PublicUser | null>(null);   // annotate when initial value is narrower
const [tags, setTags] = useState<string[]>([]);              // [] alone would be never[]

// useReducer with a discriminated-union action
type FormState = { title: string; priority: "low" | "high"; error: string | null };
type FormAction =
  | { type: "field"; name: "title"; value: string }
  | { type: "field"; name: "priority"; value: "low" | "high" }
  | { type: "error"; message: string }
  | { type: "reset" };

const initial: FormState = { title: "", priority: "low", error: null };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "field": return { ...state, [action.name]: action.value, error: null };
    case "error": return { ...state, error: action.message };
    case "reset": return initial;
  }
}

const [form, dispatch] = useReducer(formReducer, initial);
```

## 💻 Code Example — Event Handlers

```tsx
function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch(q.trim());
  };
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setQ("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={q} onChange={handleChange} onKeyDown={handleKey} />
    </form>
  );
}
```

Tip: write the handler inline once (`onChange={(e) => …}`), hover `e`, and copy the inferred type.

| Event | Type |
|-------|------|
| input/select/textarea change | `React.ChangeEvent<HTMLInputElement \| HTMLSelectElement \| HTMLTextAreaElement>` |
| form submit | `React.FormEvent<HTMLFormElement>` |
| click | `React.MouseEvent<HTMLButtonElement>` |
| key | `React.KeyboardEvent<HTMLInputElement>` |
| focus/blur | `React.FocusEvent<HTMLInputElement>` |

## 💻 Code Example — Refs (React 19)

```tsx
// DOM ref
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => inputRef.current?.focus(), []);

// Mutable value ref (no re-render when it changes)
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// React 19: `ref` is a normal prop — forwardRef is no longer needed
interface InputProps extends ComponentPropsWithoutRef<"input"> {
  label: string;
  ref?: React.Ref<HTMLInputElement>;
}
export function TextInput({ label, ref, ...rest }: InputProps) {
  return (
    <label>
      {label}
      <input ref={ref} {...rest} />
    </label>
  );
}

// React 18 and earlier:
// export const TextInput = forwardRef<HTMLInputElement, Omit<InputProps, "ref">>(
//   ({ label, ...rest }, ref) => <label>{label}<input ref={ref} {...rest} /></label>,
// );
```

## 💻 Code Example — Generic Components

```tsx
interface Column<T> {
  key: keyof T & string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
}

export function DataTable<T extends { id: string }>({ rows, columns, onRowClick, empty = "No data" }: DataTableProps<T>) {
  if (!rows.length) return <p>{empty}</p>;
  return (
    <table>
      <thead><tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} onClick={() => onRowClick?.(row)}>
            {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : String(row[c.key])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// T is inferred as Task; a column key typo like "titel" is a compile error
<DataTable
  rows={tasks}
  columns={[
    { key: "title", header: "Title" },
    { key: "done", header: "Status", render: (t) => (t.done ? "✅" : "⏳") },
  ]}
  onRowClick={(t) => navigate(`/tasks/${t.id}`)}
/>;
```

## 💻 Code Example — Typed Context (No `undefined` Leaks)

Use Context for low-frequency values (theme, feature flags). Use Redux for frequently changing shared state.

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
interface ThemeCtx { theme: Theme; toggle: () => void }

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const value = useMemo(() => ({ theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Custom hook throws if used outside the provider → consumers get ThemeCtx, never null
export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
```

## 💻 Code Example — Typed Custom Hooks

```tsx
// Returns a tuple → use `as const` so it's [T, setter], not (T | setter)[]
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Usage with RTK Query: search fires only after the user stops typing
const [search, setSearch] = useState("");
const debounced = useDebounce(search);
const { data } = useGetUsersQuery({ page: 1, search: debounced });
```

## 💻 Code Example — Error Boundary (Class Component in TS)

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { fallback: ReactNode; children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);     // send to Sentry etc.
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

Error boundaries catch **render** errors only — not event handlers or async code (handle those with try/catch and RTK Query's `error`).

## 💻 Code Example — Code Splitting with `lazy` + `Suspense`

```tsx
import { lazy, Suspense } from "react";

const AdminUsers = lazy(() => import("./features/admin/AdminUsers"));   // must be a default export

<Route
  path="/admin/users"
  element={
    <Suspense fallback={<p>Loading…</p>}>
      <AdminUsers />
    </Suspense>
  }
/>;
```

## 🌍 Real-World Impact

- Extending native element props gives design-system components full HTML support (`aria-*`, `type`, `form`) for free.
- Generic tables/selects are written once and reused for every entity with full key safety.
- The "throw outside provider" context pattern removes `ctx?.` noise and a class of runtime crashes.

## 🎯 Likely Interview Questions

1. **How do you type props and children?** — Interface/type for props; `children: ReactNode`.
2. **Why avoid `React.FC`?** — No real benefit, awkward with generics, no implicit `children` since React 18.
3. **How do you type `useState` with null initial value?** — `useState<User | null>(null)`.
4. **How do you type event handlers?** — `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`, etc.
5. **What changed about refs in React 19?** — `ref` is a regular prop for function components; `forwardRef` is unnecessary.
6. **Write a generic component.** — `DataTable<T>` above.
7. **How do you make Context type-safe?** — `createContext<T | null>(null)` + custom hook that throws if null.
8. **What can't error boundaries catch?** — Event handlers, async code, SSR errors, errors in the boundary itself.
9. **Context or Redux?** — Context for rarely-changing values; Redux for frequently updated shared state with selectors.

---

[← Authentication End-to-End](05-authentication-end-to-end.md) | [Index](../README.md) | [Next: Full-Stack Feature Walkthrough →](07-fullstack-feature-walkthrough.md)
