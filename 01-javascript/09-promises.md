# Chapter 12 — Promises & `Promise.all`

## 📖 Definition

A **Promise** is an object representing the eventual completion or failure of an asynchronous operation, with three possible states: `pending`, `fulfilled`, `rejected`.

## 🔍 Explanation

A Promise transitions exactly once: from `pending` → `fulfilled` (with a value) or `pending` → `rejected` (with a reason). Once settled, it can't change.

### Handlers
- `.then(onFulfilled, onRejected)` — register success/failure handlers.
- `.catch(fn)` — short for `.then(undefined, fn)`.
- `.finally(fn)` — always runs (cleanup).

### Static Methods
| Method | Resolves when… | Rejects when… |
|--------|----------------|----------------|
| `Promise.all`        | **all** resolve | **any** rejects (fails fast) |
| `Promise.allSettled` | all settle (never rejects) | — |
| `Promise.race`       | first settles (any outcome) | first settles (any outcome) |
| `Promise.any`        | first **fulfilled** | all reject (`AggregateError`) |

## 💻 Code Example — Creating a Promise

```js
function wait(ms) {
  return new Promise((resolve, reject) => {
    if (ms < 0) return reject(new Error("Negative ms"));
    setTimeout(resolve, ms);
  });
}

wait(1000).then(() => console.log("1 second later"));
```

## 💻 Code Example — Chaining

```js
fetchUser(1)
  .then(user => fetchOrders(user.id))
  .then(orders => orders.filter(o => o.status === "paid"))
  .then(paid => console.log("Paid orders:", paid))
  .catch(err => console.error("Something failed:", err))
  .finally(() => console.log("Done"));
```

Each `.then` returns a new Promise — the next handler receives whatever the previous one returned.

## 💻 Code Example — `async/await`

```js
async function loadDashboard(userId) {
  try {
    const user = await fetchUser(userId);
    const orders = await fetchOrders(user.id);
    return { user, orders };
  } catch (err) {
    console.error("Failed to load dashboard:", err);
    throw err;
  }
}
```

> ✅ `async` functions always return a Promise. `await` pauses inside the async function only, not the whole program.

## 💻 Code Example — `Promise.all` (Parallel)

```js
async function loadDashboard(userId) {
  // All three start at the same time — total time ≈ slowest one
  const [user, orders, notifications] = await Promise.all([
    fetchUser(userId),
    fetchOrders(userId),
    fetchNotifications(userId),
  ]);
  return { user, orders, notifications };
}
```

### ⚠️ Common Mistake — Sequential Awaits
```js
// ❌ Slow — takes the SUM of all three
const user = await fetchUser(id);
const orders = await fetchOrders(id);
const notifs = await fetchNotifications(id);

// ✅ Fast — takes the MAX of all three
const [user, orders, notifs] = await Promise.all([
  fetchUser(id), fetchOrders(id), fetchNotifications(id),
]);
```

## 💻 Code Example — `Promise.allSettled`

```js
const results = await Promise.allSettled([
  fetchUser(1),       // resolves
  fetchUser(999),     // rejects (not found)
  fetchUser(2),       // resolves
]);

results.forEach((r, i) => {
  if (r.status === "fulfilled") console.log(i, "✓", r.value);
  else                          console.log(i, "✗", r.reason);
});
```

Use when you want **all** results, even if some fail.

## 💻 Code Example — `Promise.race`

```js
function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
}

await Promise.race([
  fetch("/api/data"),
  timeout(3000),        // rejects after 3s
]);
```

## 💻 Code Example — `Promise.any`

```js
// First successful CDN wins
await Promise.any([
  fetch("https://cdn1.example.com/data"),
  fetch("https://cdn2.example.com/data"),
  fetch("https://cdn3.example.com/data"),
]);
```

## 💻 Code Example — Error Handling Strategies

```js
// Strategy 1: catch on each call to not stop the batch
const results = await Promise.all(
  ids.map(id =>
    fetchUser(id).catch(err => ({ id, error: err.message }))
  )
);

// Strategy 2: use allSettled
const settled = await Promise.allSettled(ids.map(fetchUser));
```

## 💻 Code Example — Microtask vs Macrotask

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");

// Output: 1, 4, 3, 2
// Promises (microtasks) run BEFORE setTimeout (macrotasks).
```

> For a visual, step-by-step explanation of why this happens, see [Chapter 10 — Event Loop & Task Queues](11-event-loop.md).

## 🌍 Real-World Impact

- API parallelization in dashboards (`Promise.all` saves 60–80% of load time).
- Retries with backoff use Promises chained recursively.
- Timeouts wrap fetches with `Promise.race`.

## 🎯 Likely Interview Questions

1. **What is a Promise?**
2. **Difference between `Promise.all` and `Promise.allSettled`?**
3. **What is `async/await`? Is it the same as Promises?** — Sugar over Promises. `async` always returns a Promise.
4. **How do you handle one failing promise without killing the whole batch?**
5. **Output prediction:** see microtask example above.

---

[← Array Methods](08-array-methods.md) | [Index](../README.md) | [Next: Event Loop & Task Queues →](11-event-loop.md)
