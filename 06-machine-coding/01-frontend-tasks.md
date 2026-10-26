# Chapter 123 — Frontend Machine Coding Tasks

## 📖 What Interviewers Are Testing

In a 30–60 minute task, they look at:
1. **Folder structure** — components, hooks, utils separated.
2. **State management** — clean useState / useReducer.
3. **Edge cases** — loading, error, empty.
4. **Reusability** — extract small components.
5. **Verbal reasoning** — explain trade-offs as you code.

> **Tip:** Don't optimize prematurely. Get a working version first, then refactor.

---

## Task 1 — Todo App

### Spec
- Add a todo (input + button).
- Mark complete (checkbox).
- Delete (×).
- Filter: all / active / done.
- Persist to localStorage.

### 💻 Solution

```jsx
import { useState, useEffect, useMemo } from "react";

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : initial;
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal];
}

export default function App() {
  const [todos, setTodos]   = useLocalStorage("todos", []);
  const [text, setText]     = useState("");
  const [filter, setFilter] = useState("all");

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setTodos([...todos, { id: crypto.randomUUID(), text: text.trim(), done: false }]);
    setText("");
  };

  const toggle = (id) =>
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const remove = (id) => setTodos(todos.filter(t => t.id !== id));

  const visible = useMemo(() => {
    switch (filter) {
      case "active": return todos.filter(t => !t.done);
      case "done":   return todos.filter(t =>  t.done);
      default:       return todos;
    }
  }, [todos, filter]);

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto" }}>
      <form onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a todo" />
        <button type="submit">Add</button>
      </form>

      <div>
        {["all", "active", "done"].map(f => (
          <button key={f} disabled={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <ul>
        {visible.map(t => (
          <li key={t.id}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
            <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            <button onClick={() => remove(t.id)}>×</button>
          </li>
        ))}
        {visible.length === 0 && <li>No todos</li>}
      </ul>
    </div>
  );
}
```

---

## Task 2 — Debounced Search

### Spec
- Input that fires `/api/search?q=…` after 400ms of idle typing.
- Show loading state.
- Cancel stale responses.

### 💻 Solution

```jsx
import { useState, useEffect } from "react";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function Search() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const debounced = useDebounce(query);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debounced)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setResults(data); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
      {loading && <p>Loading…</p>}
      <ul>
        {results.map(r => <li key={r.id}>{r.name}</li>)}
        {!loading && debounced && results.length === 0 && <li>No results</li>}
      </ul>
    </div>
  );
}
```

---

## Task 3 — Paginated Table

### Spec
- Fetch `/api/items?page=N&limit=20`.
- Show table + prev/next buttons.
- Show total pages and current page.

### 💻 Solution

```jsx
import { useState, useEffect } from "react";

export default function Table() {
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState([]);
  const [meta,    setMeta]    = useState({ totalPages: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/items?page=${page}&limit=20`)
      .then(r => r.json())
      .then(({ data, meta }) => { setData(data); setMeta(meta); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      {loading ? <p>Loading…</p> : (
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Created</th></tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.name}</td><td>{r.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span> Page {page} of {meta.totalPages} </span>
        <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
```

---

## Task 4 — Form with Validation

### Spec
- Fields: name, email, password.
- Show inline errors.
- Submit button disabled while invalid.

### 💻 Solution

```jsx
import { useState } from "react";

const validators = {
  name:     (v) => v.trim().length >= 2 || "Min 2 characters",
  email:    (v) => /^\S+@\S+$/.test(v) || "Invalid email",
  password: (v) => v.length >= 8        || "Min 8 characters",
};

export default function SignupForm() {
  const [form, setForm]     = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));

    const result = validators[field](value);
    setErrors(prev => ({ ...prev, [field]: result === true ? null : result }));
  };

  const isValid =
    Object.keys(form).every(k => validators[k](form[k]) === true);

  const submit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    console.log("submit", form);
  };

  return (
    <form onSubmit={submit}>
      {["name", "email", "password"].map(field => (
        <div key={field}>
          <input
            type={field === "password" ? "password" : "text"}
            placeholder={field}
            value={form[field]}
            onChange={update(field)}
          />
          {errors[field] && <span className="err">{errors[field]}</span>}
        </div>
      ))}
      <button disabled={!isValid}>Sign up</button>
    </form>
  );
}
```

---

## Task 5 — Sortable / Filterable Table

### 💻 Solution

```jsx
import { useState, useMemo } from "react";

export default function DataTable({ rows }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [direction, setDirection] = useState(1);

  const visible = useMemo(() => {
    return rows
      .filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * direction);
  }, [rows, filter, sortKey, direction]);

  const handleSort = (key) => {
    if (sortKey === key) setDirection(d => -d);
    else { setSortKey(key); setDirection(1); }
  };

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" />
      <table>
        <thead>
          <tr>
            {["name", "age", "city"].map(k => (
              <th key={k} onClick={() => handleSort(k)}>
                {k} {sortKey === k && (direction > 0 ? "▲" : "▼")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.id}><td>{r.name}</td><td>{r.age}</td><td>{r.city}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Task 6 — Modal with Outside Click Close

### 💻 Solution

```jsx
import { useEffect, useRef, useState } from "react";

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const cb = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener("mousedown", cb);
    return () => document.removeEventListener("mousedown", cb);
  }, [ref, handler]);
}

export default function Modal({ open, onClose, children }) {
  const ref = useRef();
  useOutsideClick(ref, onClose);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay">
      <div className="modal" ref={ref}>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

---

## Suggested Folder Structure

```
src/
├── components/
│   ├── Todo/
│   │   ├── TodoList.jsx
│   │   ├── TodoItem.jsx
│   │   └── Filter.jsx
│   ├── Form/
│   │   ├── Field.jsx
│   │   └── validators.js
│   └── Modal/
│       └── Modal.jsx
├── hooks/
│   ├── useDebounce.js
│   ├── useLocalStorage.js
│   └── useOutsideClick.js
├── api/
│   └── client.js
├── App.jsx
└── main.jsx
```

## 🎯 What to Say While Coding

- "I'll start with the data shape and component skeleton…"
- "I'll extract a `useDebounce` hook to keep the component focused."
- "Let me handle the empty and loading states explicitly."
- "If I had more time, I'd add `react-window` for very large lists."

---

[← Node.js: Shared Interview Questions](../26-special-questions/02-node-shared-questions.md) | [Index](../README.md) | [Next: Backend Tasks →](02-backend-tasks.md)
