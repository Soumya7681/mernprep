# Chapter 15 — Execution Context, Memory & Garbage Collection

## 📖 Definition

An **execution context** is the environment in which JavaScript code runs. It holds the variables, the scope chain and the value of `this`. The engine keeps contexts on the **call stack**. Objects live on the **heap**, and the **garbage collector (GC)** frees heap memory that can no longer be reached.

## 🔍 Explanation

### Phases of an execution context

Every context (global, function, or `eval`) is created in two phases:

1. **Creation phase**
   - Creates the lexical environment (scope) and links it to the outer one.
   - Hoists function declarations completely.
   - Registers `var` as `undefined`, and `let`/`const`/`class` as *uninitialised* (the Temporal Dead Zone).
   - Determines `this`.
2. **Execution phase** — runs the code line by line and assigns values.

### Stack vs heap

| Stack | Heap |
|---|---|
| Execution contexts and frames | Objects, arrays, functions, closures |
| LIFO, fast, small (~1 MB in V8) | Large, managed by the GC |
| Overflow → `RangeError: Maximum call stack size exceeded` | Exhaustion → `JavaScript heap out of memory` |

Primitives are copied by value. Objects are reached through references, which is why two variables can point to the same object.

### How the garbage collector decides what to free

V8 uses **reachability**, not reference counting. Starting from the *roots* (global object, current stack, active closures), it marks everything reachable; the rest is swept. That is why circular references are **not** a leak in JavaScript.

V8 is **generational**:
- **Young generation** (new space): most objects die young; collected often and fast by a *scavenger*.
- **Old generation**: objects that survive move here; collected less often by *mark-sweep-compact*, mostly incrementally and concurrently to keep pauses short.

## 💻 Code Example — The Call Stack

```js
function a() { b(); }
function b() { c(); }
function c() { console.trace("stack"); }
a();
// Trace: c ← b ← a ← (global)

function recurse(n) { return recurse(n + 1); }
// recurse(0); // RangeError: Maximum call stack size exceeded
```

## 💻 Code Example — Common Memory Leaks

```js
// 1. Accidental global (non-strict mode)
function leak() { cache = []; }            // no let/const → window.cache

// 2. Forgotten timer holding a large object
const bigData = new Array(1e6).fill("x");
setInterval(() => console.log(bigData.length), 1000); // never cleared

// 3. Detached DOM node still referenced
let button = document.getElementById("save");
document.body.removeChild(button);         // removed from the page...
// ...but `button` still references it → cannot be collected

// 4. Listeners never removed
window.addEventListener("resize", onResize); // in a component that unmounts

// 5. Unbounded cache (very common in Node servers)
const cache = {};
app.get("/user/:id", async (req, res) => {
  cache[req.params.id] ??= await db.users.findById(req.params.id); // grows forever
  res.json(cache[req.params.id]);
});
```

**Fixes:** strict mode / modules, `clearInterval`, set references to `null`, remove listeners in cleanup (`useEffect` return), and bounded caches (LRU with a max size or TTL).

## 💻 Code Example — WeakMap, WeakSet and WeakRef

A `WeakMap` holds its **keys weakly**: if nothing else references the key object, the entry can be collected.

```js
// Attach metadata to DOM nodes or objects without preventing GC
const meta = new WeakMap();

function track(el) {
  meta.set(el, { clicks: 0 });
  el.addEventListener("click", () => meta.get(el).clicks++);
}
// When `el` is removed and unreferenced, its WeakMap entry disappears too.

// Private data per instance (pre-#private fields pattern)
const privates = new WeakMap();
class Account {
  constructor(balance) { privates.set(this, { balance }); }
  get balance() { return privates.get(this).balance; }
}

// WeakRef + FinalizationRegistry — advanced, rarely needed
const ref = new WeakRef(someLargeObject);
const obj = ref.deref(); // undefined if it has been collected
```

| | `Map` | `WeakMap` |
|---|---|---|
| Key types | Any | Objects (and non-registered symbols) only |
| Prevents GC of key | Yes | No |
| Iterable / `.size` | Yes | No |

## 💻 Code Example — Finding a Leak in Node

```bash
node --inspect server.js          # open chrome://inspect → Memory tab
node --max-old-space-size=4096 app.js   # raise heap limit (a band-aid, not a fix)
```

```js
// Quick heap check in code
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  console.log(`heap: ${(heapUsed / 1024 / 1024).toFixed(1)} MB`);
}, 10_000);
```

Take two **heap snapshots** a few minutes apart under load and use the *Comparison* view: the constructor whose count keeps growing is your leak.

## 🌍 Real-World Use

- A React dashboard that slows down over hours: usually intervals or subscriptions not cleaned up on unmount.
- A Node API whose memory climbs until the container restarts: usually an unbounded in-memory cache, a growing array of request data, or listeners added per request.
- Caching computed data per object without leaking: `WeakMap`.

## 🎯 Likely Interview Questions

1. **What is an execution context? What happens in the creation phase?**
2. **Where are primitives and objects stored?**
3. **How does garbage collection work in JavaScript? Do circular references leak?** — No; mark-and-sweep is based on reachability.
4. **Name four ways to create a memory leak in a browser or Node app.**
5. **What is the difference between `Map` and `WeakMap`? When would you use `WeakMap`?**
6. **How would you debug a Node process whose memory keeps growing?**
7. **What causes "Maximum call stack size exceeded"?**

---

[← Debounce / Throttle](../01-javascript/10-debounce-throttle.md) | [Index](../README.md) | [Next: Iterators & Generators →](02-iterators-generators.md)
