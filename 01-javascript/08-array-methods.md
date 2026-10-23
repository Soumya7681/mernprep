# Chapter 11 — `map`, `filter`, `reduce` (and Friends)

## 📖 Definition

Higher-order array methods that take a callback and produce new values without mutating the original array.

| Method | Returns | Use |
|--------|---------|-----|
| `map(fn)` | Array of same length | Transform each item |
| `filter(fn)` | Array, possibly shorter | Keep items matching a predicate |
| `reduce(fn, init)` | Any single value | Accumulate into one result |
| `find(fn)` | First match or `undefined` | Locate one element |
| `some(fn)` | Boolean | Any item matches? |
| `every(fn)` | Boolean | All items match? |
| `flatMap(fn)` | Flattened array | Map + flatten one level |
| `forEach(fn)` | `undefined` | Side effects only |

## 💻 Code Example — `map`

```js
const nums = [1, 2, 3, 4];

const doubled = nums.map(n => n * 2);
// [2, 4, 6, 8]

const users = [{ name: "A" }, { name: "B" }];
const names = users.map(u => u.name);
// ["A", "B"]

// With index:
const indexed = nums.map((n, i) => `${i}: ${n}`);
// ["0: 1", "1: 2", "2: 3", "3: 4"]
```

## 💻 Code Example — `filter`

```js
const nums = [1, 2, 3, 4, 5, 6];

nums.filter(n => n % 2 === 0);             // [2, 4, 6]

const users = [
  { name: "A", active: true },
  { name: "B", active: false },
  { name: "C", active: true },
];
users.filter(u => u.active).map(u => u.name);   // ["A", "C"]
```

## 💻 Code Example — `reduce`

```js
const nums = [1, 2, 3, 4];

// Sum
nums.reduce((acc, n) => acc + n, 0);       // 10

// Max
nums.reduce((max, n) => (n > max ? n : max), -Infinity); // 4

// Count occurrences
const words = ["a", "b", "a", "c", "b", "a"];
words.reduce((acc, w) => {
  acc[w] = (acc[w] || 0) + 1;
  return acc;
}, {});                                     // { a: 3, b: 2, c: 1 }

// Group by
const users = [
  { name: "A", role: "admin" },
  { name: "B", role: "user" },
  { name: "C", role: "admin" },
];
users.reduce((acc, u) => {
  (acc[u.role] ||= []).push(u);
  return acc;
}, {});
// { admin: [{name:"A",..}, {name:"C",..}], user: [{name:"B",..}] }
```

## 💻 Code Example — `find`, `some`, `every`

```js
const users = [
  { id: 1, age: 17 },
  { id: 2, age: 25 },
  { id: 3, age: 30 },
];

users.find(u => u.id === 2);        // { id: 2, age: 25 }
users.find(u => u.id === 99);       // undefined

users.some(u => u.age >= 18);       // true (anyone adult?)
users.every(u => u.age >= 18);      // false (all adults?)
```

## 💻 Code Example — `flatMap`

```js
const data = [
  { id: 1, tags: ["js", "react"] },
  { id: 2, tags: ["node"] },
];

// map + flat in one step
data.flatMap(d => d.tags);          // ["js", "react", "node"]

// Equivalent: data.map(d => d.tags).flat()
```

## 💻 Code Example — Chaining (Pipeline)

```js
const orders = [
  { id: 1, amount: 100, status: "paid" },
  { id: 2, amount: 50,  status: "cancelled" },
  { id: 3, amount: 200, status: "paid" },
  { id: 4, amount: 75,  status: "paid" },
];

const totalPaidRevenue = orders
  .filter(o => o.status === "paid")
  .map(o => o.amount)
  .reduce((sum, x) => sum + x, 0);

// totalPaidRevenue = 375
```

## 💻 Code Example — Building an Index (Map for O(1) lookups)

```js
const users = [
  { id: 1, name: "A" },
  { id: 2, name: "B" },
];

const byId = users.reduce((acc, u) => {
  acc[u.id] = u;
  return acc;
}, {});

byId[2];                            // { id: 2, name: "B" }  ← O(1) lookup
```

## ⚠️ Mutating vs Non-Mutating

| Mutating | Non-mutating |
|----------|--------------|
| `push`, `pop`, `shift`, `unshift` | `concat`, `slice`, `spread` |
| `splice` | `toSpliced` (ES2023) |
| `sort` | `toSorted` (ES2023) |
| `reverse` | `toReversed` (ES2023) |
| `fill` | — |

In React state, **always use non-mutating** methods:
```js
// ❌ wrong
state.items.push(newItem);
setState({ items: state.items });        // React sees same reference

// ✅ right
setState({ items: [...state.items, newItem] });
```

## 🎯 Likely Interview Questions

1. **Difference between `map`, `filter`, `reduce`.**
2. **How is `forEach` different from `map`?** — `forEach` returns `undefined` (side effects); `map` returns a new array.
3. **Implement `map` using `reduce`:**
   ```js
   const myMap = (arr, fn) => arr.reduce((acc, x, i) => (acc.push(fn(x, i)), acc), []);
   ```
4. **What does `reduce` do?**
5. **Why prefer immutability in React?** — React relies on reference equality to detect changes (`oldState !== newState`).

---

[← Event Handling](07-event-handling.md) | [Index](../README.md) | [Next: Promises →](09-promises.md)
