# Chapter 62 — Cluster, Worker Threads & Scaling

## 📖 Definition

Node.js runs your JavaScript on **one main thread**. To use multiple CPU cores you either run **multiple processes** (the `cluster` module, PM2, or containers) or offload CPU-heavy work to **worker threads**. **Horizontal scaling** means running more instances behind a load balancer; **vertical scaling** means a bigger machine.

## 🔍 Explanation

### What blocks the event loop?

- CPU-heavy JS: image resizing in JS, big `JSON.parse`, sorting huge arrays, crypto in a loop, complex regex (ReDoS).
- Synchronous APIs: `fs.readFileSync`, `crypto.pbkdf2Sync`, `zlib.gzipSync` inside request handlers.

I/O (database, HTTP, file reads) is **not** the problem — libuv handles it asynchronously, and some work (fs, DNS lookup, crypto, zlib) runs on libuv's **thread pool** (default 4 threads, `UV_THREADPOOL_SIZE`).

### Cluster vs worker threads vs child processes

| | `cluster` / PM2 | `worker_threads` | `child_process` |
|---|---|---|---|
| Unit | Process | Thread in the same process | Separate process |
| Memory | Separate per worker | Separate heap, can **share** `SharedArrayBuffer` | Separate |
| Purpose | Handle more **requests** on all cores | Run **CPU-heavy** tasks without blocking | Run other programs (ffmpeg, Python) |
| Communication | IPC messages | `postMessage`, shared memory | stdin/stdout, IPC |
| Shares the port | ✅ (primary distributes connections) | ❌ | ❌ |

## 💻 Code Example — Cluster

```js
import cluster from "node:cluster";
import os from "node:os";
import express from "express";

if (cluster.isPrimary) {
  const cpus = os.availableParallelism();
  for (let i = 0; i < cpus; i++) cluster.fork();

  cluster.on("exit", (worker, code) => {
    console.log(`Worker ${worker.process.pid} died (${code}); starting a new one`);
    cluster.fork();
  });
} else {
  const app = express();
  app.get("/", (req, res) => res.send(`Handled by ${process.pid}`));
  app.listen(3000);
}
```

In practice, use **PM2** instead of writing this yourself:

```bash
pm2 start server.js -i max          # one process per core, auto-restart
pm2 reload server                   # zero-downtime reload
pm2 monit
```

In Kubernetes/ECS, you usually run **one Node process per container** and scale the number of containers instead.

## 💻 Code Example — Worker Threads for CPU Work

```js
// hash-worker.js
import { parentPort, workerData } from "node:worker_threads";
import crypto from "node:crypto";

const result = crypto.pbkdf2Sync(workerData.password, workerData.salt, 600_000, 64, "sha512");
parentPort.postMessage(result.toString("hex"));
```

```js
// server.js
import { Worker } from "node:worker_threads";

function runWorker(file, data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(file, import.meta.url), { workerData: data });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => code !== 0 && reject(new Error(`Worker exited with ${code}`)));
  });
}

app.post("/hash", async (req, res) => {
  const hash = await runWorker("./hash-worker.js", { password: req.body.password, salt: "s" });
  res.json({ hash });                    // event loop stays free for other requests
});
```

Creating a worker per request is expensive (~tens of ms). Use a **pool** — e.g. the `piscina` library:

```js
import Piscina from "piscina";
const pool = new Piscina({ filename: new URL("./resize-worker.js", import.meta.url).href });
const thumbnail = await pool.run({ buffer, width: 300 });
```

## 💻 Code Example — Detecting a Blocked Event Loop

```js
import { monitorEventLoopDelay } from "node:perf_hooks";

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  console.log(`event loop p99 delay: ${(h.percentile(99) / 1e6).toFixed(1)} ms`);
  h.reset();
}, 10_000);
```

A p99 above ~100 ms means something is blocking. Profile with `node --cpu-prof` or Clinic.js (`clinic flame -- node server.js`).

## 💻 Code Example — Partitioning Long Loops

If you cannot move work to a thread, yield to the event loop between chunks:

```js
async function processInChunks(items, fn, chunk = 1000) {
  for (let i = 0; i < items.length; i += chunk) {
    items.slice(i, i + chunk).forEach(fn);
    await new Promise((r) => setImmediate(r)); // let pending I/O callbacks run
  }
}
```

## 🔍 Horizontal Scaling Checklist (Stateless Servers)

When you run 2+ instances behind a load balancer, anything kept **in process memory** breaks:

| In-memory thing | Problem | Fix |
|---|---|---|
| `express-session` MemoryStore | User logged in on instance A, request hits B | Redis session store, or stateless JWT |
| In-memory cache | Each instance has different data | Redis |
| Rate-limit counters | Limits multiplied by instance count | Redis store |
| Socket.IO rooms | Clients on different instances cannot see each other | `@socket.io/redis-adapter` |
| Uploaded files on local disk | Other instances cannot read them | S3 / object storage |
| Cron jobs (`node-cron`) | Run N times | One scheduler, or a queue with job locks (BullMQ) |

## 🌍 Real-World Use

- Image thumbnails, PDF generation, Excel parsing → worker pool or a separate service fed by a queue.
- API servers → PM2 cluster on a VM, or one process per container with autoscaling.
- Sticky sessions on the load balancer only when unavoidable (e.g. Socket.IO long-polling).

## 🎯 Likely Interview Questions

1. **Node is single-threaded — how does it handle thousands of concurrent requests?**
2. **What is the libuv thread pool and what uses it?**
3. **Cluster vs worker threads — when do you use each?**
4. **What blocks the event loop? How do you detect it in production?**
5. **How do you scale a Node API horizontally? What must change in the code?**
6. **Why should you use a worker pool rather than a new worker per request?**
7. **What is PM2 and what does `pm2 reload` do?**

---

[← Streams, Buffers & Backpressure](01-streams-buffers.md) | [Index](../README.md) | [Next: WebSockets & Real-Time →](03-websockets-realtime.md)
