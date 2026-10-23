# Chapter 21 — Advanced Async Patterns

## 📖 Definition

Advanced async patterns are the techniques for *controlling* asynchronous work: running tasks in parallel or with limited concurrency, cancelling them, retrying with backoff, timing them out, and handling errors without losing any. Interviewers use these to separate people who can *use* `async/await` from people who can *reason* about it.

## 🔍 The Four Promise Combinators

| Combinator | Resolves when | Rejects when | Use case |
|---|---|---|---|
| `Promise.all` | **All** fulfil (array of values) | **Any** rejects (fail fast) | Load user + orders + settings together |
| `Promise.allSettled` | All settle (array of `{status, value/reason}`) | Never | Bulk operations where partial failure is fine |
| `Promise.race` | First **settles** (fulfil or reject) | First settles with rejection | Timeouts |
| `Promise.any` | First **fulfils** | All reject (`AggregateError`) | Fastest mirror / fallback servers |

## 💻 Code Example — Sequential vs Parallel

```js
// ❌ Sequential: ~3 seconds if each takes 1 s
const user = await getUser(id);
const orders = await getOrders(id);
const reviews = await getReviews(id);

// ✅ Parallel: ~1 second — the calls are independent
const [user2, orders2, reviews2] = await Promise.all([getUser(id), getOrders(id), getReviews(id)]);

// ❌ forEach does NOT wait for async callbacks
ids.forEach(async (id) => await save(id));
console.log("done"); // logs before any save finishes

// ✅ Sequential loop when order matters
for (const id of ids) await save(id);

// ✅ Parallel when it does not
await Promise.all(ids.map((id) => save(id)));
```

## 💻 Code Example — Concurrency Limit (Promise Pool)

Calling an API for 10,000 IDs with `Promise.all` opens 10,000 requests at once — you will hit rate limits or exhaust sockets. Limit concurrency:

```js
async function promisePool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;                 // safe: JS is single-threaded between awaits
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

const tasks = userIds.map((id) => () => fetch(`/api/users/${id}`).then((r) => r.json()));
const users = await promisePool(tasks, 5); // at most 5 requests in flight
```

## 💻 Code Example — Timeout With `Promise.race`

```js
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

await withTimeout(fetch("/slow"), 3000);
```

Note: `race` does not *cancel* the slow promise — it only stops waiting for it. To really cancel, use `AbortController`.

## 💻 Code Example — Cancellation With `AbortController`

```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch("/api/report", { signal: controller.signal });
  console.log(await res.json());
} catch (err) {
  if (err.name === "AbortError") console.log("Request cancelled");
  else throw err;
} finally {
  clearTimeout(timer);
}

// Shorter, modern version
await fetch("/api/report", { signal: AbortSignal.timeout(5000) });
```

In React, abort in the effect cleanup so a stale response never overwrites newer state:

```jsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/search?q=${query}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setResults)
    .catch((e) => { if (e.name !== "AbortError") setError(e); });
  return () => controller.abort();
}, [query]);
```

## 💻 Code Example — Retry With Exponential Backoff and Jitter

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, { retries = 3, baseMs = 300, shouldRetry = () => true } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const delay = baseMs * 2 ** attempt + Math.random() * 100;  // 300, 600, 1200 … + jitter
      await sleep(delay);
    }
  }
}

await retry(() => paymentApi.charge(order), {
  shouldRetry: (e) => e.status >= 500 || e.code === "ECONNRESET", // never retry 4xx
});
```

Jitter prevents thousands of clients retrying at exactly the same moment (the *thundering herd*). Only retry **idempotent** operations, or send an idempotency key.

## 💻 Code Example — Deduplicating In-Flight Requests

```js
const inFlight = new Map();

function getProduct(id) {
  if (!inFlight.has(id)) {
    const p = fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .finally(() => inFlight.delete(id));
    inFlight.set(id, p);
  }
  return inFlight.get(id);   // 10 components asking at once → 1 request
}
```

## 💻 Code Example — Promisify a Callback API

```js
function promisify(fn) {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
}

import fs from "node:fs";
const readFile = promisify(fs.readFile);   // or: import { readFile } from "node:fs/promises"
```

## 💻 Code Example — Error Handling Pitfalls

```js
// 1. A promise created without await/catch → unhandled rejection
async function bad() {
  sendEmail(user);               // if this rejects, nobody catches it
}

// 2. try/catch only catches what you await
try {
  return fetchData();            // ❌ returned, not awaited → rejection escapes this catch
} catch {}
try {
  return await fetchData();      // ✅
} catch {}

// 3. Global safety nets (log and exit in Node; let the process manager restart)
process.on("unhandledRejection", (reason) => { logger.error(reason); process.exit(1); });
```

## 💻 Code Example — `Promise.withResolvers` (ES2024)

```js
const { promise, resolve, reject } = Promise.withResolvers();
socket.once("ready", resolve);
socket.once("error", reject);
await promise;
```

## 🌍 Real-World Use

- Dashboards loading independent widgets → `Promise.allSettled` so one failing widget does not blank the page.
- Bulk email or data migration → promise pool with a concurrency of 5–20.
- Payment gateway calls → timeout + retry with backoff + idempotency key.
- Search-as-you-type → `AbortController` to cancel stale requests.

## 🎯 Likely Interview Questions

1. **Difference between `Promise.all`, `allSettled`, `race` and `any`?**
2. **Why does `await` inside `forEach` not work as expected?**
3. **How do you run 1,000 API calls with at most 5 at a time?** (Implement it.)
4. **How do you cancel a fetch request? How do you cancel it on unmount in React?**
5. **Implement retry with exponential backoff. Why add jitter?**
6. **Does `Promise.race` cancel the losing promises?** — No.
7. **What is an unhandled promise rejection and how do you handle it in Node?**
8. **What is the difference between `return promise` and `return await promise` inside `try`?**

---

[← Classes & Design Patterns](06-classes-design-patterns.md) | [Index](../README.md) | [Next: Browser APIs & Web Performance →](08-browser-apis-performance.md)
