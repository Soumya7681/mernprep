# Chapter 46 — The Event Loop

## 📖 Definition

The **event loop** is Node.js's mechanism for performing non-blocking I/O on a single-threaded JavaScript engine by offloading work to the OS or thread pool and handling completion callbacks in phases.

## 🔍 Explanation

Node.js runs JS on a **single main thread**. It achieves concurrency by:
1. Using OS-level async I/O (epoll/kqueue/IOCP).
2. Using a thread pool (libuv) for fs, dns, crypto.
3. Polling completed work in a loop and running JS callbacks one at a time.

### The Six Phases (simplified)

```
   ┌───────────────────────────┐
┌─>│           timers          │  ← setTimeout / setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  ← deferred TCP errors, etc.
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare        │  ← internal
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  ← retrieve new I/O; run their callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  ← setImmediate callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  ← socket.on('close'), etc.
   └───────────────────────────┘
```

Between every phase, the **microtask queue** drains: `process.nextTick` callbacks first, then resolved `Promise` callbacks.

## 💻 Code Example — Microtask vs Macrotask

```js
console.log("1");
setTimeout(() => console.log("2"), 0);          // macrotask (timers phase)
setImmediate(() => console.log("3"));            // macrotask (check phase)
Promise.resolve().then(() => console.log("4")); // microtask
process.nextTick(() => console.log("5"));        // microtask (highest priority)
console.log("6");

// Output: 1, 6, 5, 4, 2, 3
// (2 vs 3 ordering can vary — depends on the I/O context.)
```

## 💻 Code Example — Blocking the Loop

```js
const http = require("http");

http.createServer((req, res) => {
  if (req.url === "/slow") {
    // ❌ CPU-bound loop blocks every other request
    let sum = 0;
    for (let i = 0; i < 1e10; i++) sum += i;
    return res.end(`Sum=${sum}`);
  }
  res.end("OK");
}).listen(3000);

// While /slow runs, /OK requests pile up and wait.
```

### Fix 1 — Offload to a Worker Thread
```js
const { Worker } = require("worker_threads");

http.createServer((req, res) => {
  if (req.url === "/slow") {
    const worker = new Worker(`
      const { parentPort } = require("worker_threads");
      let sum = 0;
      for (let i = 0; i < 1e10; i++) sum += i;
      parentPort.postMessage(sum);
    `, { eval: true });
    worker.on("message", (sum) => res.end(`Sum=${sum}`));
  }
});
```

### Fix 2 — Break the work into chunks
```js
function expensiveAsync(callback) {
  let i = 0, sum = 0;
  function step() {
    const end = i + 1e6;
    for (; i < end && i < 1e10; i++) sum += i;
    if (i < 1e10) setImmediate(step);
    else callback(sum);
  }
  step();
}
```

## 💻 Code Example — `setImmediate` vs `setTimeout(0)`

```js
setImmediate(() => console.log("immediate"));
setTimeout(() => console.log("timeout"), 0);

// Inside an I/O callback, setImmediate runs first.
// At top level, order is non-deterministic.
```

## 💻 Code Example — `process.nextTick` Caution

```js
process.nextTick(function recurse() {
  process.nextTick(recurse);             // ❌ starves I/O
});
// nextTick queue drains completely before moving on — abuse = frozen server.
```

## 💻 Code Example — Async I/O is Non-Blocking

```js
const fs = require("fs/promises");

console.log("start");
fs.readFile("big.txt", "utf8").then(() => console.log("done"));
console.log("end");

// Output: start, end, done
// Reading happens off the main thread.
```

## 💻 Code Example — Thread Pool Limit

```js
// crypto.pbkdf2 uses the libuv thread pool (default 4 workers)
const crypto = require("crypto");

for (let i = 0; i < 8; i++) {
  console.time(`hash-${i}`);
  crypto.pbkdf2("pw", "salt", 100000, 64, "sha512", () => {
    console.timeEnd(`hash-${i}`);
  });
}

// First 4 finish around the same time; next 4 wait.
// Increase with: UV_THREADPOOL_SIZE=8 node app.js
```

## 🌍 Real-World Impact

- Servers handle thousands of concurrent connections by avoiding sync work.
- Identify CPU-bound endpoints with profilers and move them to workers/queues.
- Tune `UV_THREADPOOL_SIZE` for crypto-heavy workloads.

## 🎯 Likely Interview Questions

1. **Explain the event loop.**
2. **Why is Node.js single-threaded but still scalable?**
3. **Difference between `setImmediate`, `setTimeout(0)`, and `process.nextTick`?**
4. **What happens if you put a `while(true)` in a handler?** — Blocks all other requests.
5. **What is the libuv thread pool?** — A pool of OS threads used for fs, crypto, dns, zlib. Default size 4.

---

[← Middleware, Testing & Alternatives](../16-redux/06-middleware-testing-alternatives.md) | [Index](../README.md) | [Next: async/await →](02-async-await.md)
