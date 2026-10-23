# Chapter 95 — React Coding Questions

## 📖 Definition

React coding questions ask you to **build a small working component or hook live**, usually in 20–45 minutes on CodeSandbox or StackBlitz. They test state design, effects and cleanup, event handling, edge cases (loading, empty, error), accessibility and how clearly you talk while coding.

## 🧠 What Interviewers Look For

| They check | Show it by |
|---|---|
| State design | Keep minimal state; derive the rest (`filtered = items.filter(...)` during render) |
| Effects | Correct dependencies, cleanup for timers/listeners/requests |
| Edge cases | Loading, error, empty list, disabled buttons, rapid clicks |
| Keys | Stable IDs, never array index for editable lists |
| Immutability | `setItems(prev => [...prev, item])`, never `items.push` |
| Communication | Say what you are doing and why; ask about requirements first |

## 1. Counter With Step, Min and Max

```jsx
import { useState } from "react";

export default function Counter({ min = 0, max = 10 }) {
  const [count, setCount] = useState(min);
  const [step, setStep] = useState(1);

  const change = (delta) => setCount((c) => Math.min(max, Math.max(min, c + delta)));

  return (
    <div>
      <h2 aria-live="polite">Count: {count}</h2>
      <label>
        Step{" "}
        <input type="number" min="1" value={step} onChange={(e) => setStep(Number(e.target.value) || 1)} />
      </label>
      <button onClick={() => change(-step)} disabled={count <= min}>−</button>
      <button onClick={() => change(step)} disabled={count >= max}>+</button>
      <button onClick={() => setCount(min)}>Reset</button>
    </div>
  );
}
```

**Talking point:** functional updates (`c => c + delta`) avoid stale values when updates are batched or clicks are fast.

## 2. Todo List (Add, Toggle, Delete, Filter, Edit)

```jsx
import { useState } from "react";

const FILTERS = { all: () => true, active: (t) => !t.done, done: (t) => t.done };

export default function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);

  function add(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setTodos((prev) => [...prev, { id: crypto.randomUUID(), text: value, done: false }]);
    setText("");
  }

  const toggle = (id) => setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id) => setTodos((prev) => prev.filter((t) => t.id !== id));
  const rename = (id, newText) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text: newText.trim() || t.text } : t)));
    setEditingId(null);
  };

  const visible = todos.filter(FILTERS[filter]);           // derived, not stored
  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div>
      <form onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" />
        <button>Add</button>
      </form>

      <div role="group" aria-label="Filter">
        {Object.keys(FILTERS).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p>Nothing here.</p>
      ) : (
        <ul>
          {visible.map((t) => (
            <li key={t.id}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={`Mark ${t.text}`} />
              {editingId === t.id ? (
                <input
                  autoFocus
                  defaultValue={t.text}
                  onBlur={(e) => rename(t.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && rename(t.id, e.currentTarget.value)}
                />
              ) : (
                <span onDoubleClick={() => setEditingId(t.id)} style={{ textDecoration: t.done ? "line-through" : "none" }}>
                  {t.text}
                </span>
              )}
              <button onClick={() => remove(t.id)} aria-label={`Delete ${t.text}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <p>{remaining} item(s) left</p>
    </div>
  );
}
```

**Follow-ups:** persist to `localStorage` (see #6), why not use index as key (state of inputs moves to the wrong row on delete), how to make it a `useReducer`.

## 3. `useFetch` Hook With Abort and Race Safety

```jsx
import { useEffect, useState } from "react";

export function useFetch(url, options) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    fetch(url, { ...options, signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ data: null, error, loading: false });
      });

    return () => controller.abort();          // cancels stale requests when url changes or on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return state;
}

// Usage
function Users() {
  const { data, error, loading } = useFetch("/api/users");
  if (loading) return <p>Loading…</p>;
  if (error) return <p role="alert">{error.message}</p>;
  return <ul>{data.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

**Talking point:** in production I would use TanStack Query for caching, retries and deduplication; this shows the fundamentals.

## 4. Debounced Search With Results

```jsx
import { useEffect, useState } from "react";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query.trim());
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!debounced) { setResults([]); setStatus("idle"); return; }
    const controller = new AbortController();
    setStatus("loading");
    fetch(`/api/products?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { setResults(data); setStatus("done"); })
      .catch((e) => e.name !== "AbortError" && setStatus("error"));
    return () => controller.abort();
  }, [debounced]);

  return (
    <div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" />
      {status === "loading" && <p>Searching…</p>}
      {status === "error" && <p role="alert">Something went wrong</p>}
      {status === "done" && results.length === 0 && <p>No results for “{debounced}”</p>}
      <ul>{results.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </div>
  );
}
```

Debounce reduces requests; abort guarantees an old response can never overwrite a newer one.

## 5. Pagination (Server-Side)

```jsx
export default function PaginatedList() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch(`/api/orders?page=${page}&limit=10`);

  if (error) return <p role="alert">{error.message}</p>;
  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      {loading ? <p>Loading…</p> : <ul>{data.items.map((o) => <li key={o.id}>#{o.number}</li>)}</ul>}
      <nav aria-label="Pagination">
        <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>
        ))}
        <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next</button>
      </nav>
    </>
  );
}
```

**Follow-up:** with hundreds of pages, show a window (`1 … 4 5 6 … 50`); store `page` in the URL (`useSearchParams`) so refresh and back button work.

## 6. `useLocalStorage` Hook

```jsx
import { useEffect, useState } from "react";

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;                    // private mode, corrupt JSON, SSR
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
  }, [key, value]);

  // keep tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === key && e.newValue !== null) setValue(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue];
}

// const [theme, setTheme] = useLocalStorage("theme", "light");
```

**Talking point:** the lazy initialiser `useState(() => …)` reads storage only once, not on every render.

## 7. Infinite Scroll With IntersectionObserver

```jsx
import { useCallback, useEffect, useRef, useState } from "react";

export default function Feed() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const res = await fetch(`/api/posts?page=${page}&limit=20`);
    const data = await res.json();
    setItems((prev) => [...prev, ...data.items]);
    setHasMore(data.hasMore);
    setPage((p) => p + 1);
    setLoading(false);
  }, [page, loading, hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), {
      rootMargin: "300px",                     // start loading before the user hits the bottom
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      {items.map((post) => <article key={post.id}>{post.title}</article>)}
      {hasMore ? <div ref={sentinelRef}>{loading && "Loading…"}</div> : <p>You are all caught up.</p>}
    </>
  );
}
```

**Follow-ups:** cursor-based pagination on the API, virtualising very long lists (`react-window`), restoring scroll position on back navigation.

## 8. Accessible Modal

```jsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";   // lock background scroll
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();                        // return focus to the trigger
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title">{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}
```

## 9. Accordion (Single or Multiple Open)

```jsx
export function Accordion({ items, allowMultiple = false }) {
  const [open, setOpen] = useState(() => new Set());

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      prev.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return items.map((item) => {
    const isOpen = open.has(item.id);
    return (
      <section key={item.id}>
        <h3>
          <button aria-expanded={isOpen} aria-controls={`panel-${item.id}`} onClick={() => toggle(item.id)}>
            {item.title} {isOpen ? "−" : "+"}
          </button>
        </h3>
        <div id={`panel-${item.id}`} hidden={!isOpen}>{item.content}</div>
      </section>
    );
  });
}
```

**Note:** a new `Set` is created on every change — mutating the old one would not trigger a re-render.

## 10. Star Rating

```jsx
export function StarRating({ value, onChange, max = 5 }) {
  const [hover, setHover] = useState(0);
  return (
    <div role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(star)}
          onClick={() => onChange(star)}
          style={{ color: star <= (hover || value) ? "gold" : "lightgray", fontSize: 24 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
```

## 11. OTP Input (Auto-Focus, Backspace, Paste)

```jsx
import { useRef, useState } from "react";

export function OtpInput({ length = 6, onComplete }) {
  const [digits, setDigits] = useState(Array(length).fill(""));
  const inputs = useRef([]);

  function update(index, value) {
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }

  function onChange(e, i) {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    update(i, v);
    if (v && i < length - 1) inputs.current[i + 1].focus();
  }

  function onKeyDown(e, i) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1].focus();
  }

  function onPaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length }, (_, i) => pasted[i] ?? "");
    setDigits(next);
    inputs.current[Math.min(pasted.length, length - 1)].focus();
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }

  return (
    <div onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => onChange(e, i)}
          onKeyDown={(e) => onKeyDown(e, i)}
          style={{ width: 40, textAlign: "center" }}
        />
      ))}
    </div>
  );
}
```

Index keys are fine here: the list has a fixed length and is never reordered.

## 12. Countdown Timer / Stopwatch

```jsx
import { useEffect, useRef, useState } from "react";

export function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);       // ms
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed;       // resume from where we paused
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const format = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
  };

  return (
    <div>
      <p style={{ fontVariantNumeric: "tabular-nums" }}>{format(elapsed)}</p>
      <button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</button>
      <button onClick={() => { setRunning(false); setElapsed(0); }}>Reset</button>
    </div>
  );
}
```

**Talking point:** compute from `Date.now()` rather than adding 50 ms per tick — `setInterval` drifts, and background tabs throttle timers.

## 13. Form With Validation (No Library)

```jsx
const validate = ({ name, email, password }) => {
  const errors = {};
  if (!name.trim()) errors.name = "Name is required";
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email";
  if (password.length < 8) errors.password = "At least 8 characters";
  return errors;
};

export function SignupForm({ onSubmit }) {
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const errors = validate(values);                         // derived on every render

  const handleChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  const handleBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    try { await onSubmit(values); } finally { setSubmitting(false); }
  }

  const field = (name, type = "text") => (
    <div>
      <label htmlFor={name}>{name}</label>
      <input id={name} name={name} type={type} value={values[name]} onChange={handleChange} onBlur={handleBlur}
             aria-invalid={!!(touched[name] && errors[name])} aria-describedby={`${name}-err`} />
      {touched[name] && errors[name] && <p id={`${name}-err`} role="alert">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      {field("name")}
      {field("email", "email")}
      {field("password", "password")}
      <button disabled={submitting}>{submitting ? "Submitting…" : "Sign up"}</button>
    </form>
  );
}
```

## 14. Shopping Cart With `useReducer` + Context

```jsx
import { createContext, useContext, useMemo, useReducer } from "react";

function cartReducer(state, action) {
  switch (action.type) {
    case "add": {
      const existing = state.find((i) => i.id === action.item.id);
      return existing
        ? state.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i))
        : [...state, { ...action.item, qty: 1 }];
    }
    case "setQty":
      return action.qty <= 0
        ? state.filter((i) => i.id !== action.id)
        : state.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i));
    case "clear":
      return [];
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const value = useMemo(() => {
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const count = items.reduce((s, i) => s + i.qty, 0);
    return { items, total, count, dispatch };
  }, [items]);                                   // stable value → fewer consumer re-renders
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};

function CartBadge() {
  const { count } = useCart();
  return <span aria-label={`${count} items in cart`}>🛒 {count}</span>;
}
```

## 15. Progress Bar and File Upload With Progress

```jsx
export function UploadWithProgress() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");

  function upload(file) {
    const xhr = new XMLHttpRequest();                 // fetch has no upload progress events
    const form = new FormData();
    form.append("file", file);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => setStatus(xhr.status < 300 ? "done" : "error");
    xhr.onerror = () => setStatus("error");
    xhr.open("POST", "/api/upload");
    setStatus("uploading");
    xhr.send(form);
  }

  return (
    <>
      <input type="file" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
      <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
           style={{ background: "#eee", height: 8 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "teal", transition: "width .2s" }} />
      </div>
      <p>{status === "done" ? "Uploaded!" : status === "error" ? "Upload failed" : `${progress}%`}</p>
    </>
  );
}
```

## 16. Optimised Large List (Memo + Stable Callbacks)

```jsx
import { memo, useCallback, useMemo, useState } from "react";

const Row = memo(function Row({ item, onToggle }) {
  return (
    <li>
      <label>
        <input type="checkbox" checked={item.selected} onChange={() => onToggle(item.id)} /> {item.name}
      </label>
    </li>
  );
});

export function BigList({ initial }) {
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");

  const onToggle = useCallback(
    (id) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))),
    [],                                            // stable reference → memo(Row) can skip
  );

  const visible = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <ul>{visible.map((item) => <Row key={item.id} item={item} onToggle={onToggle} />)}</ul>
    </>
  );
}
```

Toggling one row re-renders only that row, because the other `item` objects and `onToggle` keep the same references.

## 🎯 Likely Interview Questions

1. **Build a todo app with add/toggle/delete/filter. Why not use the index as key?**
2. **Write a `useFetch` hook. How do you prevent race conditions?**
3. **Build a debounced search box.**
4. **Build an infinite scroll list.**
5. **Build an accessible modal. Why use a portal?**
6. **Build an OTP input with paste support.**
7. **Why does `setCount(count + 1)` called twice only increase by 1?**
8. **How would you make this component faster if the list had 10,000 rows?**

---

[← JS Problem Solving](03-js-problem-solving.md) | [Index](../README.md) | [Next: Node & Express Coding Questions →](05-node-express-coding.md)
