# Chapter 106 — JavaScript Scenarios

## 📖 Definition

A **scenario-based question** describes a realistic problem ("the page freezes when…", "this value is sometimes wrong…") and asks how you would diagnose and fix it. There is rarely one right answer; the interviewer scores your **reasoning process**, your knowledge of the language's rules, and whether your fix is safe.

## 🧠 The Answer Structure (Use It Every Time)

```text
1. Clarify    — reproduce it; what exactly happens, for whom, since when?
2. Hypothesise — list likely causes, most likely first, and WHY
3. Verify     — the tool or experiment that confirms the cause
4. Fix        — the smallest correct change (show code)
5. Prevent    — test, lint rule, pattern, monitoring
```

---

### Scenario 1 — "A button handler runs twice / multiple times."

**Likely causes**
- The listener is attached repeatedly (inside a function that runs on every render or every API response).
- Event bubbling: both a child and parent handle the same click.
- In React 18 dev mode, `StrictMode` double-invokes effects — attaching listeners without cleanup shows up as duplicates.

**Verify:** `getEventListeners(el)` in Chrome DevTools console; log inside the code that adds the listener.

**Fix**
```js
// Attach once, or remove before re-adding
button.removeEventListener("click", onSave);
button.addEventListener("click", onSave);

// Or guard against double submission explicitly
let saving = false;
async function onSave() {
  if (saving) return;
  saving = true;
  try { await save(); } finally { saving = false; }
}
```
**Prevent:** always return a cleanup from effects that subscribe; disable the button while a request is in flight.

---

### Scenario 2 — "Totals in the cart are off by a paisa (e.g. ₹199.99000000000001)."

**Cause:** binary floating point — `0.1 + 0.2 !== 0.3`.

**Fix:** store and calculate money in the **smallest unit as integers** (paise/cents), format only for display.

```js
const items = [{ pricePaise: 19999, qty: 3 }];
const totalPaise = items.reduce((s, i) => s + i.pricePaise * i.qty, 0);   // 59997, exact
const display = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(totalPaise / 100);
// "₹599.97"
```
In MongoDB use integers or `Decimal128`; never `toFixed` in the middle of calculations (it returns a string and rounds inconsistently).

---

### Scenario 3 — "Dates show one day earlier for some users."

**Cause:** time zones. `new Date("2026-10-23")` is parsed as **UTC midnight**, which is the previous evening in the Americas. Or the server stored local time without a zone.

**Fix**
- Store instants in UTC (`ISODate`), convert to the user's zone only for display:
```js
new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(order.createdAt);
```
- For calendar dates without a time (birthdays, due dates), store the string `"2026-10-23"` and never convert it through `Date`.
- Use `date-fns-tz`, Luxon or the Temporal API for zone maths.

---

### Scenario 4 — "The page freezes for several seconds when a large report loads."

**Cause:** a long synchronous task on the main thread (parsing a huge JSON, sorting/filtering 100k rows, building a giant DOM).

**Verify:** DevTools → Performance → look for long tasks (red triangles > 50 ms) and which function they are in.

**Fix options**
1. Paginate or aggregate on the server — do not send 100k rows to the browser.
2. Move the computation to a **Web Worker**.
3. Virtualise the table (`react-window`) so only ~30 rows are in the DOM.
4. Chunk the work and yield between chunks:
```js
async function processInChunks(rows, fn, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    rows.slice(i, i + size).forEach(fn);
    await new Promise((r) => setTimeout(r));   // let the browser paint and handle input
  }
}
```

---

### Scenario 5 — "Search results sometimes show results for an older query."

**Cause:** race condition — responses arrive out of order; the slow response for `"re"` lands after the fast one for `"react"`.

**Fix:** cancel the previous request, or ignore stale responses.
```js
let controller;
async function search(q) {
  controller?.abort();
  controller = new AbortController();
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    render(await res.json());
  } catch (e) {
    if (e.name !== "AbortError") showError(e);
  }
}
```
Combine with debounce to cut request volume.

---

### Scenario 6 — "Memory keeps growing in a single-page app left open all day."

**Likely causes:** intervals not cleared, global event listeners added per view, detached DOM nodes held in arrays/closures, unbounded caches, WebSocket subscriptions never closed.

**Verify:** DevTools → Memory → take heap snapshots before and after navigating between screens a few times; compare and look at *Detached* DOM nodes and growing constructors; inspect retainers.

**Fix:** clean up every subscription when a view is destroyed (`clearInterval`, `removeEventListener`, `socket.off`, `observer.disconnect`); cap caches (LRU); use `WeakMap` for metadata keyed by objects.

---

### Scenario 7 — "An object we pass into a function gets mysteriously changed."

**Cause:** objects are passed by reference; some function mutates its argument (`arr.sort()`, `obj.x = …`, `Object.assign(target, …)` with the shared object as target).

**Verify:** freeze it in development to find the culprit — any write will throw in strict mode:
```js
"use strict";
const config = Object.freeze(structuredClone(rawConfig));
```

**Fix:** treat inputs as immutable; copy before changing (`[...arr].sort()` or `arr.toSorted()`, `{ ...obj, x }`, `structuredClone`).

---

### Scenario 8 — "`this` is undefined inside a callback / class method."

```js
class Uploader {
  constructor() { this.count = 0; }
  onProgress() { this.count++; }          // `this` lost when passed as a callback
  start() { xhr.upload.addEventListener("progress", this.onProgress); }
}
```

**Fix:** bind or use an arrow function class field.
```js
class Uploader {
  count = 0;
  onProgress = () => { this.count++; };   // arrow field: `this` is always the instance
}
```

---

### Scenario 9 — "Errors in async code are not caught and the process/console shows 'Uncaught (in promise)'."

**Causes:** a promise without `await` or `.catch`; `try/catch` around code that returns a promise without awaiting it; `async` callbacks in `forEach`.

**Fix**
```js
// ❌
try { items.forEach(async (i) => await save(i)); } catch (e) { /* never runs */ }

// ✅
try { await Promise.all(items.map((i) => save(i))); } catch (e) { handle(e); }
```
**Prevent:** ESLint rules `@typescript-eslint/no-floating-promises` and `no-misused-promises`; global `unhandledrejection` logging in the browser and `process.on("unhandledRejection")` in Node.

---

### Scenario 10 — "The same data is fetched 5 times when the dashboard loads."

**Cause:** several widgets independently request the same endpoint; or a hook without caching is used in many components.

**Fix:** deduplicate in-flight requests and cache.
```js
const inflight = new Map();
export function getJSON(url) {
  if (!inflight.has(url)) {
    inflight.set(url, fetch(url).then((r) => r.json()).finally(() => setTimeout(() => inflight.delete(url), 1000)));
  }
  return inflight.get(url);
}
```
In React, TanStack Query/RTK Query do this automatically via query keys.

---

### Scenario 11 — "A sorted list of prices looks wrong: 100 appears before 25."

**Cause:** default `sort()` compares as strings; or prices arrive from the API as strings.

**Fix:** `prices.toSorted((a, b) => a - b)` and convert types at the API boundary (`Number(...)`, or validate with Zod `z.coerce.number()`).

---

### Scenario 12 — "Our JSON API returns a large number ID and the frontend shows it changed (e.g. …001 becomes …000)."

**Cause:** numbers above `Number.MAX_SAFE_INTEGER` (2^53 − 1) lose precision in JavaScript (common with Twitter-style IDs, bank account numbers).

**Fix:** send such IDs as **strings** in JSON; use `BigInt` for arithmetic if needed. MongoDB `ObjectId`s are already strings when serialised.

---

## 🎯 What Interviewers Are Scoring

- You **reproduce and measure** before changing code.
- You know the **language rule** behind the bug (reference vs value, floating point, event loop, `this`).
- Your fix is **minimal and safe**, and you add something that **prevents it recurring**.

---

[← Node & Express Coding Questions](../23-coding-questions/05-node-express-coding.md) | [Index](../README.md) | [Next: React Scenarios →](02-react-scenarios.md)
