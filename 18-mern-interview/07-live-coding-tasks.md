# Chapter 109 — MERN Interview: Live Coding Tasks (with Solutions)

## 📖 How to Approach Live Coding

In MERN interviews you're often asked to write code while sharing your screen (VS Code, CodeSandbox, StackBlitz). Interviewers check that you can **write working code, explain while coding, and handle edge cases**.

1. Repeat the task and ask about edge cases.
2. Say your plan in 2–3 sentences.
3. Write the simplest working version first.
4. Test it, then improve (loading, errors, validation).

---

## ⚛️ React Tasks

### 1. Counter with increment, decrement and reset (never below 0)

```jsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h2>{count}</h2>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => Math.max(0, c - 1))} disabled={count === 0}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

Mention: functional updates `c => c + 1` avoid stale state when updates are batched.

### 2. Fetch users from an API and show loading / error / list

```jsx
import { useEffect, useState } from "react";

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://jsonplaceholder.typicode.com/users", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setUsers)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p role="alert">Error: {error}</p>;
  return <ul>{users.map((u) => <li key={u.id}>{u.name} — {u.email}</li>)}</ul>;
}
```

### 3. Search with debounce

```jsx
import { useEffect, useState } from "react";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const q = useDebounce(query).trim().toLowerCase();
  const results = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" />
      {results.length ? (
        <ul>{results.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
      ) : (
        <p>No products found</p>
      )}
    </>
  );
}
```

### 4. Todo list (add, toggle, delete, filter)

```jsx
import { useState } from "react";

export default function Todos() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all");

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setTodos((t) => [...t, { id: crypto.randomUUID(), text: text.trim(), done: false }]);
    setText("");
  };
  const toggle = (id) => setTodos((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const remove = (id) => setTodos((t) => t.filter((x) => x.id !== id));

  const visible = todos.filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done));

  return (
    <div>
      <form onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task" />
        <button>Add</button>
      </form>
      {["all", "open", "done"].map((f) => (
        <button key={f} onClick={() => setFilter(f)} disabled={filter === f}>{f}</button>
      ))}
      <ul>
        {visible.map((t) => (
          <li key={t.id}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
            <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            <button onClick={() => remove(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <p>{todos.filter((t) => !t.done).length} remaining</p>
    </div>
  );
}
```

### 5. Pagination component for an API

```jsx
function Pagination({ page, totalPages, onChange }) {
  return (
    <nav>
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span> Page {page} of {totalPages} </span>
      <button disabled={page === totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}
```

Follow-up: keep `page` in the URL (`useSearchParams`) so refresh and back button work.

### 6. Form with validation (no library)

```jsx
import { useState } from "react";

export default function SignupForm({ onSubmit }) {
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});

  const validate = (v) => {
    const e = {};
    if (!v.name.trim()) e.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email";
    if (v.password.length < 8) e.password = "Minimum 8 characters";
    return e;
  };

  const handleChange = (e) => setValues({ ...values, [e.target.name]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {["name", "email", "password"].map((field) => (
        <div key={field}>
          <input
            name={field}
            type={field === "password" ? "password" : field === "email" ? "email" : "text"}
            value={values[field]}
            onChange={handleChange}
            placeholder={field}
          />
          {errors[field] && <small role="alert">{errors[field]}</small>}
        </div>
      ))}
      <button>Sign up</button>
    </form>
  );
}
```

---

## 🟩 Node.js / Express Tasks

### 7. CRUD API for products with Express + Mongoose

```js
import express from "express";
import mongoose from "mongoose";

const Product = mongoose.model("Product", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
}, { timestamps: true }));

const router = express.Router();
const isId = (id) => mongoose.isValidObjectId(id);

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const [items, total] = await Promise.all([
      Product.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, price, stock } = req.body;           // whitelist fields
    const product = await Product.create({ name, price, stock });
    res.status(201).json(product);
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const { name, price, stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: Object.fromEntries(Object.entries({ name, price, stock }).filter(([, v]) => v !== undefined)) },
      { new: true, runValidators: true },
    );
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await Product.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.status(204).end();
  } catch (err) { next(err); }
});

const app = express();
app.use(express.json());
app.use("/api/products", router);
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: "Server error" }); });

await mongoose.connect(process.env.MONGO_URI);
app.listen(4000);
```

### 8. Login API with bcrypt + JWT

```js
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  // same message for both cases → don't reveal which emails exist
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});
```

### 9. Write a middleware that logs method, URL and time taken

```js
function requestTimer(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
}
app.use(requestTimer);
```

### 10. Simple in-memory rate limiter middleware

```js
function rateLimiter({ windowMs = 60_000, max = 100 } = {}) {
  const hits = new Map();                                  // ip → { count, resetAt }
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || entry.resetAt < now) {
      hits.set(req.ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      res.set("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ message: "Too many requests" });
    }
    next();
  };
}
```

Follow-up: in-memory doesn't work across multiple servers — use Redis.

---

## 🟨 JavaScript Tasks (Common Warm-ups)

### 11. Group an array of objects by a key

```js
const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});

groupBy([{ city: "Pune", n: 1 }, { city: "Delhi", n: 2 }, { city: "Pune", n: 3 }], "city");
// { Pune: [{…}, {…}], Delhi: [{…}] }
```

### 12. Remove duplicates by `id`

```js
const uniqueById = (arr) => [...new Map(arr.map((x) => [x.id, x])).values()];
```

### 13. Flatten a nested array (without `.flat()`)

```js
const flatten = (arr) => arr.reduce((acc, x) => acc.concat(Array.isArray(x) ? flatten(x) : x), []);
flatten([1, [2, [3, [4]]]]);   // [1, 2, 3, 4]
```

### 14. Implement `Promise.all`

```js
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let done = 0;
    if (promises.length === 0) return resolve([]);
    promises.forEach((p, i) => {
      Promise.resolve(p).then((value) => {
        results[i] = value;                 // keep original order
        if (++done === promises.length) resolve(results);
      }, reject);                           // first rejection rejects all
    });
  });
}
```

### 15. Retry an async function with exponential backoff

```js
async function retry(fn, { retries = 3, baseMs = 300 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
    }
  }
}
```

---

## 🍃 MongoDB Task

### 16. Count orders per status for the last 30 days, sorted by count

```js
Order.aggregate([
  { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: "$status", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);
```

## 🧠 What Interviewers Look For

- Working code first, then improvements.
- Handling loading, errors, empty states and invalid input.
- Clear names and small functions.
- Talking through decisions ("I'm using a functional update because…").
- Knowing what you'd change for production (validation library, tests, pagination, Redis).

---

[← Scenario & Debugging Questions](06-scenario-debugging-questions.md) | [Index](../README.md) | [Next: Git, Agile, Testing & Deployment →](08-git-agile-deployment-questions.md)
