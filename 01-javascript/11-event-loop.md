# Chapter 13 — Event Loop & Task Queues (Visual Guide)

## 📖 Definition

JavaScript runs your code on **one thread** — it can do only one thing at a time. The **event loop** is the manager that decides **what runs next**: your normal code first, then waiting callbacks from two queues — the **microtask queue** (promises) and the **task queue** (timers, clicks, network events).

> One line to remember: **Run the current code → run ALL microtasks → (browser paints) → run ONE task → repeat.**

## 🍳 A Simple Analogy — One Chef in a Kitchen

| Kitchen | JavaScript |
|---------|-----------|
| **One chef** who can cook only one dish at a time | **Call stack** — runs one function at a time |
| Kitchen helpers: oven timer, delivery person | **Web APIs / Node APIs** — timers, network, file system work in the background |
| **VIP order board** — always served first, all of them | **Microtask queue** — promise callbacks, `await` |
| **Regular order board** — one order at a time | **Task (macrotask) queue** — `setTimeout`, clicks, I/O |
| **Manager** who tells the chef what to cook next, only when the chef is free | **Event loop** |

The chef never stops in the middle of a dish. When a dish is finished, the manager first hands over **every** VIP order, and only then **one** regular order.

## 🖼️ The Big Picture

<figure class="evd">
<svg viewBox="0 0 760 400" role="img" aria-labelledby="evd1-title">
<title id="evd1-title">Call stack, Web APIs, microtask queue, task queue and the event loop</title>
<defs>
<marker id="evd1-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z"/></marker>
<marker id="evd1-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head-accent" d="M0,0 L10,5 L0,10 z"/></marker>
</defs>
<text class="t-title" x="115" y="36" text-anchor="middle">Call Stack</text>
<rect class="panel" x="20" y="48" width="190" height="300" rx="10"/>
<rect class="stack" x="40" y="194" width="150" height="40" rx="6"/>
<text x="115" y="219" text-anchor="middle">console.log()</text>
<rect class="stack" x="40" y="242" width="150" height="40" rx="6"/>
<text x="115" y="267" text-anchor="middle">handleClick()</text>
<rect class="stack" x="40" y="290" width="150" height="40" rx="6"/>
<text x="115" y="315" text-anchor="middle">main script</text>
<text class="t-small" x="115" y="372" text-anchor="middle">runs ONE thing at a time</text>
<text class="t-title" x="385" y="36" text-anchor="middle">Web APIs / Node APIs</text>
<rect class="panel" x="285" y="48" width="200" height="150" rx="10"/>
<rect class="api" x="300" y="64" width="170" height="34" rx="6"/>
<text x="385" y="86" text-anchor="middle">setTimeout timer</text>
<rect class="api" x="300" y="106" width="170" height="34" rx="6"/>
<text x="385" y="128" text-anchor="middle">fetch / network</text>
<rect class="api" x="300" y="148" width="170" height="34" rx="6"/>
<text x="385" y="170" text-anchor="middle">DOM events (click)</text>
<text class="t-title" x="650" y="36" text-anchor="middle">Microtask Queue</text>
<rect class="panel" x="560" y="48" width="180" height="140" rx="10"/>
<rect class="micro" x="575" y="64" width="150" height="32" rx="6"/>
<text x="650" y="85" text-anchor="middle">Promise .then()</text>
<rect class="micro" x="575" y="104" width="150" height="32" rx="6"/>
<text x="650" y="125" text-anchor="middle">code after await</text>
<text class="t-small" x="650" y="166" text-anchor="middle">VIP: ALL run first</text>
<text class="t-title" x="650" y="226" text-anchor="middle">Task Queue</text>
<rect class="panel" x="560" y="238" width="180" height="140" rx="10"/>
<rect class="macro" x="575" y="254" width="150" height="32" rx="6"/>
<text x="650" y="275" text-anchor="middle">setTimeout callback</text>
<rect class="macro" x="575" y="294" width="150" height="32" rx="6"/>
<text x="650" y="315" text-anchor="middle">click handler</text>
<text class="t-small" x="650" y="356" text-anchor="middle">ONE per loop turn</text>
<circle class="loop" cx="385" cy="300" r="58"/>
<text class="t-title" x="385" y="296" text-anchor="middle">Event</text>
<text class="t-title" x="385" y="314" text-anchor="middle">Loop</text>
<path class="arrow" d="M212,120 L282,120" marker-end="url(#evd1-a)"/>
<text class="t-small" x="247" y="110" text-anchor="middle">① hand off</text>
<path class="arrow" d="M487,80 L557,80" marker-end="url(#evd1-a)"/>
<text class="t-small" x="522" y="70" text-anchor="middle">② resolves</text>
<path class="arrow" d="M487,180 C525,200 530,255 557,268" marker-end="url(#evd1-a)"/>
<text class="t-small" x="548" y="216">② ready</text>
<path class="arrow-accent" d="M560,150 C505,175 475,230 440,262" marker-end="url(#evd1-b)"/>
<text class="t-small" x="523" y="140" text-anchor="middle">③ first</text>
<path class="arrow-accent" d="M560,312 L447,306" marker-end="url(#evd1-b)"/>
<text class="t-small" x="503" y="328" text-anchor="middle">④ then one</text>
<path class="arrow-accent" d="M326,300 L214,300" marker-end="url(#evd1-b)"/>
<text class="t-small" x="270" y="290" text-anchor="middle">⑤ push to stack</text>
<text class="t-small" x="270" y="322" text-anchor="middle">(only when empty)</text>
</svg>
<figcaption>① Async work is handed to the browser/Node. ② When it finishes, its callback waits in a queue. ③ The event loop empties the microtask queue first, ④ then takes one task, ⑤ and pushes it onto the call stack only when the stack is empty.</figcaption>
</figure>

## 🔍 The Five Parts

| Part | What it is | Examples |
|------|-----------|----------|
| **Call stack** | Where functions run. Last in, first out. | Your functions, `console.log` |
| **Web APIs / Node APIs** | Work done **outside** JavaScript, in the background | Timers, `fetch`, DOM events, file reading |
| **Microtask queue** | High-priority callbacks. **All** of them run before anything else. | `.then/.catch/.finally`, code after `await`, `queueMicrotask` |
| **Task (macrotask) queue** | Normal callbacks. **One** runs per loop turn. | `setTimeout`, `setInterval`, clicks, network events, `setImmediate` (Node) |
| **Event loop** | Keeps checking: "Is the stack empty? Then what's next?" | — |

## 🔁 One Turn of the Event Loop

<figure class="evd">
<svg viewBox="0 0 760 230" role="img" aria-labelledby="evd2-title">
<title id="evd2-title">One turn of the event loop: run one task, run all microtasks, render, pick next task</title>
<defs>
<marker id="evd2-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head-accent" d="M0,0 L10,5 L0,10 z"/></marker>
</defs>
<rect class="macro" x="20" y="50" width="160" height="90" rx="10"/>
<text class="t-title" x="100" y="88" text-anchor="middle">1. Run ONE task</text>
<text class="t-small" x="100" y="112" text-anchor="middle">script, timer, click</text>
<rect class="micro" x="210" y="50" width="160" height="90" rx="10"/>
<text class="t-title" x="290" y="88" text-anchor="middle">2. Run ALL</text>
<text class="t-title" x="290" y="106" text-anchor="middle">microtasks</text>
<text class="t-small" x="290" y="127" text-anchor="middle">until queue is empty</text>
<rect class="panel" x="400" y="50" width="160" height="90" rx="10"/>
<text class="t-title" x="480" y="88" text-anchor="middle">3. Render</text>
<text class="t-small" x="480" y="112" text-anchor="middle">rAF → layout → paint</text>
<rect class="macro" x="590" y="50" width="150" height="90" rx="10"/>
<text class="t-title" x="665" y="88" text-anchor="middle">4. Next task</text>
<text class="t-small" x="665" y="112" text-anchor="middle">from task queue</text>
<path class="arrow-accent" d="M182,95 L207,95" marker-end="url(#evd2-a)"/>
<path class="arrow-accent" d="M372,95 L397,95" marker-end="url(#evd2-a)"/>
<path class="arrow-accent" d="M562,95 L587,95" marker-end="url(#evd2-a)"/>
<path class="arrow-accent" d="M665,142 L665,188 L100,188 L100,145" marker-end="url(#evd2-a)"/>
<text class="t-small" x="382" y="210" text-anchor="middle">repeat forever (browser renders only when needed, ~60 times a second)</text>
</svg>
<figcaption>The whole algorithm. Notice step 2 empties the <em>entire</em> microtask queue — even microtasks added while it runs.</figcaption>
</figure>

**The rules in words:**

1. Run the current script (or task) **until the call stack is empty**. Nothing can interrupt it.
2. Run **every** microtask. If a microtask adds another microtask, that runs too, before moving on.
3. The browser may **repaint** the screen (and run `requestAnimationFrame` callbacks).
4. Take **one** task from the task queue and go back to step 1.

## 💻 Example 1 — The Classic Question

```js
console.log("1: start");

setTimeout(() => console.log("2: timeout"), 0);

Promise.resolve().then(() => console.log("3: promise"));

console.log("4: end");
```

**Output:** `1: start` → `4: end` → `3: promise` → `2: timeout`

### Step by step

| Step | What happens | Call stack | Microtask queue | Task queue | Output so far |
|------|-------------|-----------|-----------------|-----------|---------------|
| 1 | Run line 1 | `log("1")` | — | — | `1` |
| 2 | `setTimeout` hands the timer to the browser (0 ms). When it expires, its callback joins the task queue | `setTimeout` | — | `timeout cb` | `1` |
| 3 | Promise is already resolved → its `.then` callback joins the microtask queue | `then` | `promise cb` | `timeout cb` | `1` |
| 4 | Run line 4 | `log("4")` | `promise cb` | `timeout cb` | `1 4` |
| 5 | Script finished → stack empty → run **all** microtasks | `promise cb` | — | `timeout cb` | `1 4 3` |
| 6 | Microtasks empty → take **one** task | `timeout cb` | — | — | `1 4 3 2` |

<figure class="evd">
<svg viewBox="0 0 760 170" role="img" aria-labelledby="evd3-title">
<title id="evd3-title">Snapshot right after the script finishes: stack empty, one microtask and one task waiting</title>
<text class="t-title" x="110" y="30" text-anchor="middle">Call Stack</text>
<rect class="panel" x="20" y="42" width="180" height="110" rx="10"/>
<text class="t-small" x="110" y="102" text-anchor="middle">(empty — script done)</text>
<text class="t-title" x="305" y="30" text-anchor="middle">Microtask Queue</text>
<rect class="panel" x="220" y="42" width="170" height="110" rx="10"/>
<rect class="micro" x="235" y="78" width="140" height="36" rx="6"/>
<text x="305" y="101" text-anchor="middle">log("3: promise")</text>
<text class="t-title" x="495" y="30" text-anchor="middle">Task Queue</text>
<rect class="panel" x="410" y="42" width="170" height="110" rx="10"/>
<rect class="macro" x="425" y="78" width="140" height="36" rx="6"/>
<text x="495" y="101" text-anchor="middle">log("2: timeout")</text>
<text class="t-title" x="670" y="30" text-anchor="middle">Console</text>
<rect class="panel" x="600" y="42" width="140" height="110" rx="10"/>
<text x="670" y="88" text-anchor="middle">1: start</text>
<text x="670" y="110" text-anchor="middle">4: end</text>
</svg>
<figcaption>The moment after the last line runs. The green (microtask) box goes next, then the orange (task) box. That's why the promise prints before the timeout.</figcaption>
</figure>

> **Key insight:** `setTimeout(fn, 0)` does **not** mean "run now". It means "run after at least 0 ms, **once the stack is empty and all microtasks are done**".

## 💻 Example 2 — `async` / `await`

```js
async function load() {
  console.log("A1: inside load");
  await null;                        // everything after await becomes a microtask
  console.log("A2: after await");
}

console.log("S: start");
setTimeout(() => console.log("T: timeout"), 0);
load();
Promise.resolve().then(() => console.log("P: promise"));
console.log("E: end");
```

**Output:** `S` → `A1` → `E` → `A2` → `P` → `T`

| Step | Event | Microtask queue | Task queue | Output |
|------|-------|-----------------|-----------|--------|
| 1 | `S` logs | — | — | S |
| 2 | Timer registered | — | T | S |
| 3 | `load()` runs **synchronously** until `await` → `A1` logs | — | T | S A1 |
| 4 | `await` pauses `load`; the rest of the function is queued | A2 | T | S A1 |
| 5 | `.then` queued | A2, P | T | S A1 |
| 6 | `E` logs, script ends | A2, P | T | S A1 E |
| 7 | Run all microtasks in order | — | T | S A1 E A2 P |
| 8 | Run one task | — | — | S A1 E A2 P T |

> An `async` function runs **normally (synchronously) until the first `await`**. Only the code **after** `await` is delayed.

## 💻 Example 3 — Microtasks Added by Microtasks

```js
setTimeout(() => console.log("timeout"), 0);

Promise.resolve().then(() => {
  console.log("p1");
  Promise.resolve().then(() => console.log("p2"));   // added while microtasks are running
});
```

**Output:** `p1` → `p2` → `timeout`
New microtasks join the **same** queue that is being emptied, so `p2` still runs before the timeout.

## 💻 Example 4 — Microtasks Run After **Each** Task

```js
setTimeout(() => {
  console.log("t1");
  Promise.resolve().then(() => console.log("promise inside t1"));
}, 0);
setTimeout(() => console.log("t2"), 0);
```

**Output:** `t1` → `promise inside t1` → `t2`
After task `t1`, the loop empties the microtask queue **before** picking task `t2`.

## 📋 Which Queue Does It Go To?

| API | Queue |
|-----|-------|
| `Promise.then / catch / finally` | 🟢 Microtask |
| Code after `await` | 🟢 Microtask |
| `queueMicrotask(fn)` | 🟢 Microtask |
| `MutationObserver` | 🟢 Microtask |
| `setTimeout`, `setInterval` | 🟠 Task |
| DOM events (click, keydown, input) | 🟠 Task |
| Network / I/O callbacks | 🟠 Task |
| `MessageChannel` / `postMessage` | 🟠 Task |
| `setImmediate` (Node only) | 🟠 Task (check phase) |
| `requestAnimationFrame` | 🎨 Before the next paint (render step) |
| `new Promise(executor)` — the executor itself | ⚡ Runs **immediately** (synchronous!) |
| `process.nextTick` (Node only) | 🟣 Its own queue, runs even before promise microtasks |

## ⚠️ Common Mistakes

### 1. Blocking the call stack freezes everything

```js
button.addEventListener("click", () => {
  const end = Date.now() + 3000;
  while (Date.now() < end) {}        // 3 s of busy work — page can't scroll, click or repaint
  console.log("done");
});
```

While the stack is busy, the event loop can't run **anything** — no clicks, no timers, no painting.

**Fix:** split work into chunks so the loop can breathe, or move it to a **Web Worker** (browser) / **worker thread** (Node).

```js
async function processInChunks(items, chunkSize = 500) {
  for (let i = 0; i < items.length; i += chunkSize) {
    items.slice(i, i + chunkSize).forEach(processItem);
    await new Promise((r) => setTimeout(r, 0));     // give the event loop a turn
  }
}
```

### 2. Endless microtasks also freeze the page

```js
function loop() { Promise.resolve().then(loop); }   // ❌ microtask queue never empties
loop();                                              // page never repaints, timers never run
```

### 3. Expecting `setTimeout(fn, 1000)` to run in exactly 1 second

The delay is a **minimum**. If the stack is busy for 3 seconds, the callback runs after 3 seconds. Browsers also clamp nested timers to at least ~4 ms.

### 4. Thinking `new Promise` is async

```js
new Promise((resolve) => {
  console.log("executor");   // runs immediately
  resolve();
}).then(() => console.log("then"));
console.log("after");
// executor → after → then
```

## 🟩 Node.js Is Slightly Different

Node uses the same idea but its event loop has **phases**: timers → pending callbacks → poll (I/O) → check (`setImmediate`) → close callbacks. Between callbacks it drains the `process.nextTick` queue first, then promise microtasks. Details are in the **Node.js: Event Loop** chapter.

## 🧩 Practice — Predict the Output

**Puzzle 1**

```js
console.log(1);
setTimeout(() => console.log(2));
Promise.resolve().then(() => console.log(3));
queueMicrotask(() => console.log(4));
console.log(5);
```

<details><summary>Show answer</summary><p><code>1 5 3 4 2</code> — sync logs first (1, 5), then both microtasks in the order they were queued (3, 4), then the timer task (2).</p></details>

**Puzzle 2**

```js
async function f() {
  console.log("f1");
  await g();
  console.log("f2");
}
async function g() { console.log("g"); }

f();
console.log("end");
```

<details><summary>Show answer</summary><p><code>f1 g end f2</code> — <code>f</code> runs synchronously and calls <code>g</code> (also synchronous inside), then <code>await</code> pauses <code>f</code>; <code>end</code> logs; finally the rest of <code>f</code> runs as a microtask.</p></details>

**Puzzle 3**

```js
setTimeout(() => console.log("A"), 10);
setTimeout(() => console.log("B"), 0);
const start = Date.now();
while (Date.now() - start < 50) {}     // block for 50 ms
console.log("C");
```

<details><summary>Show answer</summary><p><code>C B A</code> — nothing runs until the 50 ms loop ends. By then both timers have expired; B's timer (0 ms) expired before A's (10 ms), so B runs first.</p></details>

**Puzzle 4**

```js
const p = new Promise((resolve) => {
  console.log("1");
  setTimeout(() => { console.log("2"); resolve(); }, 0);
});
p.then(() => console.log("3"));
console.log("4");
```

<details><summary>Show answer</summary><p><code>1 4 2 3</code> — the executor runs immediately (1), then 4. The promise isn't resolved yet, so no microtask exists. The timer task logs 2 and resolves the promise, which queues the <code>.then</code> microtask, and that runs right after the task (3).</p></details>

**Puzzle 5**

```js
button.addEventListener("click", () => {
  Promise.resolve().then(() => console.log("micro"));
  console.log("listener");
});
button.click();          // called from code
console.log("after click");
```

<details><summary>Show answer</summary><p><code>listener after click micro</code> — <code>button.click()</code> from script calls the listener synchronously, so the stack isn't empty until after <code>"after click"</code>; only then do microtasks run. (A real user click would print <code>listener micro</code> because each user-triggered listener runs as its own task.)</p></details>

## 🌍 Real-World Impact

- Understanding the loop explains why a heavy `for` loop makes the UI freeze, and why moving it to a Web Worker fixes it.
- It explains why React state updates and promise callbacks appear "later" than surrounding code.
- In Node.js APIs, one CPU-heavy request (big JSON parse, image resize) blocks **all** users — the same rule applies on the server.

## 🎯 Likely Interview Questions

1. **What is the event loop?** — A mechanism that runs queued callbacks when the call stack is empty: all microtasks first, then one task, repeatedly.
2. **Microtask vs macrotask?** — Microtasks (promises, `await`, `queueMicrotask`) all run right after the current code; macrotasks (`setTimeout`, events, I/O) run one per loop turn.
3. **Why does `Promise.then` run before `setTimeout(fn, 0)`?** — The microtask queue is emptied before the next task is taken.
4. **Is JavaScript single-threaded? Then how is it asynchronous?** — Your JS runs on one thread; timers, network and I/O run in the browser/Node background, and their callbacks are queued for the loop.
5. **Does `setTimeout(fn, 0)` run immediately?** — No; after the current code and all microtasks finish, with at least the given delay.
6. **What runs synchronously in an `async` function?** — Everything up to the first `await`.
7. **How can the event loop get blocked?** — Long synchronous work or an endless chain of microtasks; nothing else can run, the page freezes.
8. **Where does `requestAnimationFrame` run?** — In the render step, just before the browser paints.
9. **How is Node's event loop different?** — It has phases (timers, poll, check…) and a `process.nextTick` queue that runs before promise microtasks.

---

[← Promises](09-promises.md) | [Index](../README.md) | [Next: Debounce / Throttle →](10-debounce-throttle.md)
