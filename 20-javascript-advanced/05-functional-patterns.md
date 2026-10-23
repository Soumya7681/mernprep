# Chapter 19 — Functional Patterns & Immutability

## 📖 Definition

**Functional programming (FP)** builds programs from **pure functions** — functions whose output depends only on their input and that cause no side effects — combined through composition. Its core tools in JavaScript are higher-order functions, currying, composition, memoisation and immutable data.

## 🔍 Explanation

| Concept | Meaning |
|---|---|
| **Pure function** | Same input → same output, no side effects (no mutation, I/O, `Date.now()`, randomness) |
| **Higher-order function** | Takes or returns a function (`map`, `filter`, middleware factories) |
| **Currying** | `f(a, b, c)` → `f(a)(b)(c)` |
| **Partial application** | Fix some arguments now, pass the rest later |
| **Composition** | `compose(f, g)(x) === f(g(x))` |
| **Immutability** | Never change existing data; create new copies |
| **Memoisation** | Cache results of pure functions by input |

React relies on these ideas: components should be pure functions of props and state, and state updates must be immutable so `Object.is` comparisons detect changes.

## 💻 Code Example — Pure vs Impure

```js
// Impure: mutates input and depends on outside state
let taxRate = 0.18;
function addTax(order) {
  order.total = order.subtotal * (1 + taxRate);
  return order;
}

// Pure
const withTax = (order, rate) => ({ ...order, total: order.subtotal * (1 + rate) });
```

## 💻 Code Example — Currying (Generic)

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...next) => curried.apply(this, [...args, ...next]);
  };
}

const sum3 = (a, b, c) => a + b + c;
const c = curry(sum3);
c(1)(2)(3);   // 6
c(1, 2)(3);   // 6
c(1)(2, 3);   // 6

// Infinite currying: sum(1)(2)(3)() → 6
const sum = (a) => (b) => (b === undefined ? a : sum(a + b));
sum(1)(2)(3)(); // 6
```

## 💻 Code Example — Compose and Pipe

```js
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe    = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const slugify = (s) => s.replace(/\s+/g, "-");

const toSlug = pipe(trim, lower, slugify);
toSlug("  Hello World  "); // "hello-world"

// Async pipe
const pipeAsync = (...fns) => (x) => fns.reduce((p, fn) => p.then(fn), Promise.resolve(x));
```

## 💻 Code Example — Memoisation

```js
function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return function (...args) {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const slowSquare = (n) => { for (let i = 0; i < 1e8; i++); return n * n; };
const fastSquare = memoize(slowSquare);
fastSquare(9); // slow
fastSquare(9); // instant

// Memoised recursive fibonacci
const fib = memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
fib(90);
```

## 💻 Code Example — Immutable Updates (The React/Redux Way)

```js
const state = {
  user: { name: "Asha", address: { city: "Pune" } },
  todos: [{ id: 1, done: false }, { id: 2, done: false }],
};

// Update a nested field
const s1 = { ...state, user: { ...state.user, address: { ...state.user.address, city: "Delhi" } } };

// Toggle one item in an array
const s2 = { ...state, todos: state.todos.map((t) => (t.id === 2 ? { ...t, done: true } : t)) };

// Remove an item
const s3 = { ...state, todos: state.todos.filter((t) => t.id !== 1) };

// ES2023 non-mutating array methods
const sorted = state.todos.toSorted((a, b) => b.id - a.id);
const reversed = state.todos.toReversed();
const replaced = state.todos.with(0, { id: 1, done: true });
```

## 💻 Code Example — Shallow vs Deep Copy

```js
const original = { a: 1, nested: { b: 2 }, date: new Date(), list: [1, 2] };

const shallow = { ...original };          // nested objects are SHARED
shallow.nested.b = 99;                     // also changes original.nested.b

const viaJSON = JSON.parse(JSON.stringify(original));
// ❌ loses Date (becomes string), undefined, functions, Map/Set, and fails on cycles

const deep = structuredClone(original);   // ✅ built-in deep clone
// handles Date, Map, Set, RegExp, typed arrays, cycles; NOT functions, DOM nodes, class prototypes
```

Hand-written deep clone (a common interview task):

```js
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [deepClone(k, seen), deepClone(v, seen)]));
  if (value instanceof Set) return new Set([...value].map((v) => deepClone(v, seen)));
  if (seen.has(value)) return seen.get(value);       // handle circular references

  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) copy[key] = deepClone(value[key], seen);
  return copy;
}
```

## 💻 Code Example — `Object.freeze` Is Shallow

```js
const cfg = Object.freeze({ db: { host: "localhost" } });
cfg.port = 1;           // ignored (throws in strict mode)
cfg.db.host = "prod";   // ✅ works — nested object is not frozen

function deepFreeze(obj) {
  Object.values(obj).forEach((v) => typeof v === "object" && v !== null && deepFreeze(v));
  return Object.freeze(obj);
}
```

## 🌍 Real-World Use

- **Redux reducers** must be pure and immutable; Redux Toolkit uses Immer so you can write mutating-looking code safely.
- **Express middleware factories** are higher-order functions: `authorize("admin")` returns a middleware.
- **Selectors** (`reselect`, `createSelector`) are memoised functions.
- **Data transformation pipelines** for API responses (`pipe(normalize, filterActive, sortByDate)`).

## 🎯 Likely Interview Questions

1. **What is a pure function? Why must React components and reducers be pure?**
2. **Implement `curry` and an infinite `sum(1)(2)(3)()`.**
3. **Implement `compose` and `pipe`. What is the difference?**
4. **Implement `memoize`. When should you not memoise?** — Impure functions, cheap functions, unbounded input space.
5. **Shallow vs deep copy? What are the limitations of `JSON.parse(JSON.stringify())`?**
6. **What does `structuredClone` support?**
7. **Is `Object.freeze` deep?**
8. **How would you update a deeply nested value immutably?**

---

[← Modules: ESM vs CommonJS](04-modules-esm-cjs.md) | [Index](../README.md) | [Next: Classes & Design Patterns →](06-classes-design-patterns.md)
