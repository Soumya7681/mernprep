# Chapter 47 — Promises & `async`/`await` in Node

## 📖 Definition

`async`/`await` is syntactic sugar over Promises that makes asynchronous code look and read like synchronous code while remaining non-blocking.

## 🔍 Explanation

- An `async` function always returns a Promise.
- `await` pauses execution **inside** the async function until the awaited Promise settles. The event loop continues to handle other work.
- Errors inside an async function reject the returned Promise — handle with `try/catch` or `.catch()`.

## 💻 Code Example — Callback → Promise → async/await

```js
// Callback hell
fs.readFile("a.txt", (err, a) => {
  if (err) return console.error(err);
  fs.readFile("b.txt", (err, b) => {
    if (err) return console.error(err);
    fs.writeFile("c.txt", a + b, (err) => {
      if (err) return console.error(err);
      console.log("Done");
    });
  });
});

// Promises
fs.promises.readFile("a.txt")
  .then(a => fs.promises.readFile("b.txt").then(b => [a, b]))
  .then(([a, b]) => fs.promises.writeFile("c.txt", a + b))
  .then(() => console.log("Done"))
  .catch(console.error);

// async/await
async function combine() {
  try {
    const a = await fs.promises.readFile("a.txt");
    const b = await fs.promises.readFile("b.txt");
    await fs.promises.writeFile("c.txt", a + b);
    console.log("Done");
  } catch (err) {
    console.error(err);
  }
}
```

## 💻 Code Example — Sequential vs Parallel

```js
// ❌ Sequential — total time = A + B + C
async function loadSequential() {
  const a = await fetchA();
  const b = await fetchB();
  const c = await fetchC();
  return { a, b, c };
}

// ✅ Parallel — total time = max(A, B, C)
async function loadParallel() {
  const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);
  return { a, b, c };
}
```

## 💻 Code Example — Async in Loops

```js
const urls = ["a", "b", "c"];

// ❌ forEach doesn't await — fires all and moves on
urls.forEach(async (url) => {
  await fetch(url);
});
console.log("Done");                      // logs immediately, fetches still running

// ✅ for...of waits each iteration
for (const url of urls) {
  await fetch(url);
}
console.log("Done");                      // logs after all fetches

// ✅ Parallel
await Promise.all(urls.map(url => fetch(url)));
console.log("Done");
```

## 💻 Code Example — Error Handling

```js
// try/catch
async function getUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("getUser failed:", err);
    throw err;                           // re-throw if caller should know
  }
}

// .catch on the returned Promise
getUser(1).catch(err => console.error(err));
```

## 💻 Code Example — Top-Level Await (ES Modules)

```js
// In a .mjs file or with "type": "module" in package.json
import fs from "fs/promises";

const data = await fs.readFile("config.json", "utf8");   // ✅ allowed at top level
console.log(JSON.parse(data));
```

## 💻 Code Example — Retry with Exponential Backoff

```js
async function retry(fn, attempts = 5, baseDelay = 200) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const delay = baseDelay * 2 ** i + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

await retry(() => fetch("/api/flaky"));
```

## 💻 Code Example — Timeout Wrapper

```js
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

const data = await withTimeout(fetch("/slow"), 3000);
```

## 💻 Code Example — `Promise.all` with Concurrency Limit

```js
// Process N at a time
async function pLimit(tasks, concurrency) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  return Promise.all(results);
}

// Process 100 URLs, 5 at a time
const tasks = urls.map(url => () => fetch(url));
await pLimit(tasks, 5);
```

## 🌍 Real-World Impact

- API orchestration: combine `Promise.all` + `Promise.race` for fast, resilient backends.
- Database calls: prefer parallel awaits when independent.
- Watch out for `forEach` + `async` — a classic source of "Done before work finished" bugs.

## 🎯 Likely Interview Questions

1. **Difference between callbacks, Promises, and async/await?**
2. **How do you run async tasks in parallel?**
3. **Why doesn't `forEach` work with async?**
4. **How would you implement a timeout for a fetch?**
5. **What does `async` return?** — Always a Promise.

---

[← Event Loop](01-event-loop.md) | [Index](../README.md) | [Next: Middleware →](03-middleware.md)
