# Chapter 93 — JS Predict-the-Output

## 📖 Definition

*Predict-the-output* questions show a short snippet and ask what it prints. They test whether you understand the engine's real rules — hoisting, the event loop, `this`, coercion, references — rather than whether you can recall definitions. They appear in almost every JavaScript screening round and online test.

Every answer below was **verified by running the snippet in Node.js**. Cover the answer, predict, then check.

## 🧠 How to Answer in an Interview

1. Read the whole snippet before answering.
2. Mark what is **synchronous**, what is a **microtask** (`then`, `await` continuation, `queueMicrotask`) and what is a **macrotask** (`setTimeout`, `setImmediate`, I/O).
3. Say your reasoning out loud — a wrong answer with the right reasoning often scores better than a lucky guess.

## Hoisting, scope & closures

### 1. Hoisting with var and function

```js
console.log(a);
var a = 1;
console.log(foo());
function foo() { return "foo"; }
```

<details><summary>Answer</summary>

```text
undefined
foo
```

`var a` is hoisted and initialised to `undefined`; the assignment happens later. Function declarations are hoisted completely, body included.

</details>

### 2. TDZ

```js
try {
  console.log(b);
  let b = 2;
} catch (e) { console.log(e.constructor.name); }
```

<details><summary>Answer</summary>

```text
ReferenceError
```

`let`/`const` are hoisted but stay uninitialised in the Temporal Dead Zone until their line runs, so reading them early throws `ReferenceError`.

</details>

### 3. Function expression hoisting

```js
try {
  bar();
  var bar = function () { console.log("bar"); };
} catch (e) { console.log(e.constructor.name, e.message); }
```

<details><summary>Answer</summary>

```text
TypeError bar is not a function
```

Only the `var bar` declaration is hoisted (as `undefined`), not the function assigned to it. Calling `undefined` is a `TypeError`.

</details>

### 4. Shadowing and hoisting inside a function

```js
var x = 10;
function test() {
  console.log(x);
  var x = 20;
}
test();
```

<details><summary>Answer</summary>

```text
undefined
```

The local `var x` is hoisted to the top of `test`, shadowing the global `x`. At the `console.log` it exists but is still `undefined`.

</details>

### 5. setTimeout in a var loop

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));
```

<details><summary>Answer</summary>

```text
3
3
3
```

`var` is function-scoped: there is one `i` shared by all callbacks. By the time the timers fire the loop has finished and `i` is 3.

</details>

### 6. setTimeout in a let loop

```js
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i));
```

<details><summary>Answer</summary>

```text
0
1
2
```

`let` creates a new binding for each iteration, so each callback closes over its own `i`.

</details>

### 7. Closures counter

```js
function makeCounter() {
  let count = 0;
  return { inc: () => ++count, get: () => count };
}
const c1 = makeCounter();
const c2 = makeCounter();
c1.inc(); c1.inc(); c2.inc();
console.log(c1.get(), c2.get());
```

<details><summary>Answer</summary>

```text
2 1
```

Each call to `makeCounter` creates a new scope with its own `count`; the closures are independent.

</details>

### 8. Closure in IIFE with var

```js
var fns = [];
for (var i = 0; i < 3; i++) {
  (function (j) { fns.push(() => j); })(i);
}
console.log(fns.map((fn) => fn()));
```

<details><summary>Answer</summary>

```text
[ 0, 1, 2 ]
```

The pre-`let` fix: the IIFE creates a new scope per iteration, capturing the current value as `j`.

</details>

## Event loop & async

### 9. Event loop order

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
queueMicrotask(() => console.log("4"));
console.log("5");
```

<details><summary>Answer</summary>

```text
1
5
3
4
2
```

Synchronous code first (1, 5). Then the whole microtask queue in order (3, 4). Then one macrotask (the timer, 2).

</details>

### 10. async/await order

```js
async function a1() {
  console.log("a1 start");
  await a2();
  console.log("a1 end");
}
async function a2() { console.log("a2"); }
console.log("script start");
setTimeout(() => console.log("timeout"), 0);
a1();
new Promise((resolve) => { console.log("promise executor"); resolve(); })
  .then(() => console.log("then"));
console.log("script end");
```

<details><summary>Answer</summary>

```text
script start
a1 start
a2
promise executor
script end
a1 end
then
timeout
```

`a1` runs synchronously until its first `await`; `a2` also runs synchronously. The rest of `a1` is queued as a microtask *before* the `.then`, because it was queued first. Timers run last.

</details>

### 11. process.nextTick vs promise vs setImmediate (Node)

```js
setImmediate(() => console.log("immediate"));
setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));
console.log("sync");
```

<details><summary>Answer</summary>

```text
sync
nextTick
promise
timeout
immediate
```

In Node the `nextTick` queue drains before the promise microtask queue. Then the event loop starts: timers phase, then check phase (`setImmediate`). *Note:* from the main module, timeout vs immediate order can vary by system timing; inside an I/O callback, `setImmediate` always runs first.

</details>

### 12. Nested microtasks and macrotasks

```js
setTimeout(() => {
  console.log("t1");
  Promise.resolve().then(() => console.log("p-in-t1"));
}, 0);
setTimeout(() => console.log("t2"), 0);
Promise.resolve().then(() => {
  console.log("p1");
  setTimeout(() => console.log("t-in-p1"), 0);
});
```

<details><summary>Answer</summary>

```text
p1
t1
p-in-t1
t2
t-in-p1
```

Microtask `p1` runs first and schedules a *new* timer at the back of the queue. `t1` runs, and its microtask `p-in-t1` runs immediately after it — before the next timer `t2`. `t-in-p1` was queued last.

</details>

### 13. Promise chaining and return values

```js
Promise.resolve(1)
  .then((v) => v + 1)
  .then((v) => { throw new Error("boom " + v); })
  .then(() => console.log("skipped"))
  .catch((e) => { console.log(e.message); return 10; })
  .then((v) => console.log("after catch", v))
  .finally(() => console.log("finally"));
```

<details><summary>Answer</summary>

```text
boom 2
after catch 10
finally
```

A thrown error skips `.then` handlers until a `.catch`. A value returned from `.catch` resumes the chain as fulfilled. `finally` runs at the end and passes the value through.

</details>

### 14. Promise resolves only once

```js
new Promise((resolve, reject) => {
  resolve("first");
  resolve("second");
  reject(new Error("ignored"));
}).then(console.log);
```

<details><summary>Answer</summary>

```text
first
```

A promise settles once; later `resolve`/`reject` calls are ignored.

</details>

### 15. Promise.all fail fast vs allSettled

```js
const ok = (v, ms) => new Promise((r) => setTimeout(() => r(v), ms));
const bad = (ms) => new Promise((_, j) => setTimeout(() => j(new Error("fail")), ms));
Promise.all([ok("a", 10), bad(5)]).catch((e) => console.log("all:", e.message));
Promise.allSettled([ok("a", 10), bad(5)]).then((r) => console.log("allSettled:", r.map((x) => x.status).join(",")));
Promise.race([ok("fast", 1), ok("slow", 20)]).then((v) => console.log("race:", v));
Promise.any([bad(1), ok("any-ok", 5)]).then((v) => console.log("any:", v));
```

<details><summary>Answer</summary>

```text
race: fast
all: fail
any: any-ok
allSettled: fulfilled,rejected
```

`race` settles with the first to settle (1 ms). `all` rejects as soon as any input rejects (5 ms). `any` resolves with the first *fulfilled* (5 ms; registered before allSettled). `allSettled` waits for everything (10 ms) and never rejects.

</details>

### 16. async function returns a promise

```js
async function getNum() { return 42; }
console.log(getNum() instanceof Promise);
getNum().then(console.log);
```

<details><summary>Answer</summary>

```text
true
42
```

An `async` function always returns a promise; `return 42` resolves it with 42. The `.then` callback runs after the synchronous log.

</details>

### 17. await in forEach

```js
const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
async function run() {
  const out = [];
  [3, 1, 2].forEach(async (n) => { out.push(await wait(n * 10, n)); });
  console.log("forEach:", out);
  const out2 = [];
  for (const n of [3, 1, 2]) out2.push(await wait(n * 10, n));
  console.log("for...of:", out2);
}
run();
```

<details><summary>Answer</summary>

```text
forEach: []
for...of: [ 3, 1, 2 ]
```

`forEach` ignores the promises returned by async callbacks, so the log runs immediately with an empty array. `for...of` with `await` runs sequentially and keeps order.

</details>

### 18. Generators

```js
function* gen() {
  const x = yield 1;
  console.log("received", x);
  yield x * 2;
}
const g = gen();
console.log(g.next().value);
console.log(g.next(5).value);
console.log(g.next().done);
```

<details><summary>Answer</summary>

```text
1
received 5
10
true
```

The first `next()` runs to the first `yield` (1). `next(5)` resumes and makes the paused `yield` evaluate to 5, logs, then yields 10. The third `next()` finishes the function.

</details>

## `this` keyword

### 19. this in object method vs arrow

```js
const obj = {
  name: "obj",
  regular() { return this.name; },
  arrow: () => typeof this,
};
console.log(obj.regular());
console.log(obj.arrow());
```

<details><summary>Answer</summary>

```text
obj
object
```

A method called as `obj.regular()` gets `this = obj`. Arrow functions have no own `this`; they use the enclosing scope's. At the top level of a CommonJS module that is `module.exports` (`{}`), in a browser script it is `window` — both `"object"`. In an ES module it would be `undefined`.

</details>

### 20. Lost this

```js
"use strict";
const user = {
  name: "Asha",
  greet() { return this?.name; },
};
const greet = user.greet;
console.log(greet());
console.log(user.greet());
```

<details><summary>Answer</summary>

```text
undefined
Asha
```

Assigning the method to a variable loses the receiver. In strict mode a plain call gets `this = undefined` (sloppy mode would give the global object).

</details>

### 21. this inside setTimeout callback

```js
const timer = {
  name: "timer",
  start() {
    setTimeout(function () { console.log(this === timer); }, 0);
    setTimeout(() => console.log(this === timer), 0);
  },
};
timer.start();
```

<details><summary>Answer</summary>

```text
false
true
```

A regular `function` callback is called by the timer with its own `this` (a `Timeout` object in Node, `window` in browsers). The arrow function keeps `this` from `start()`, which is `timer`.

</details>

### 22. bind cannot be overridden

```js
function show() { return this.v; }
const bound = show.bind({ v: 1 });
console.log(bound.call({ v: 2 }));
console.log(bound.bind({ v: 3 })());
```

<details><summary>Answer</summary>

```text
1
1
```

A bound function's `this` is fixed permanently. Neither `call` nor a second `bind` can change it (only `new` can).

</details>

## Types, coercion & equality

### 23. Type coercion basics

```js
console.log(1 + "2");
console.log("5" - 2);
console.log("5" * "2");
console.log(true + 1);
console.log([] + []);
console.log([] + {});
console.log(1 + null);
console.log(1 + undefined);
```

<details><summary>Answer</summary>

```text
12
3
10
2

[object Object]
1
NaN
```

`+` with a string concatenates. `-` and `*` convert to numbers. `true` → 1. Arrays/objects convert to strings: `[]` → `""`, `{}` → `"[object Object]"`. `null` → 0, `undefined` → `NaN`.

</details>

### 24. Equality traps

```js
console.log(null == undefined);
console.log(null === undefined);
console.log(NaN === NaN);
console.log(Object.is(NaN, NaN));
console.log(0 == "");
console.log("0" == false);
console.log([] == false);
console.log([1] == 1);
```

<details><summary>Answer</summary>

```text
true
false
false
true
true
true
true
true
```

`null == undefined` is a special rule (only equal to each other). `NaN` is never equal to itself; `Object.is` handles it. `==` converts both sides to numbers: `""` → 0, `"0"` → 0, `false` → 0, `[]` → `""` → 0, `[1]` → `"1"` → 1.

</details>

### 25. typeof quirks

```js
console.log(typeof null);
console.log(typeof []);
console.log(typeof function () {});
console.log(typeof NaN);
console.log(typeof undefinedVariable);
console.log(typeof class {});
```

<details><summary>Answer</summary>

```text
object
object
function
number
undefined
function
```

`typeof null === "object"` is a historical bug. Arrays are objects (use `Array.isArray`). Classes are functions. `NaN` is a number. `typeof` an undeclared variable does not throw.

</details>

### 26. Floating point

```js
console.log(0.1 + 0.2 === 0.3);
console.log((0.1 + 0.2).toFixed(2));
console.log(Number.EPSILON > Math.abs(0.1 + 0.2 - 0.3));
```

<details><summary>Answer</summary>

```text
false
0.30
true
```

Numbers are IEEE-754 doubles; 0.1 and 0.2 cannot be represented exactly. Compare with a tolerance (`Number.EPSILON`) or work in integers (paise, cents).

</details>

### 27. Optional chaining and nullish coalescing

```js
const cfg = { retries: 0, nested: null };
console.log(cfg.retries || 3);
console.log(cfg.retries ?? 3);
console.log(cfg.nested?.value);
console.log(cfg.missing?.());
```

<details><summary>Answer</summary>

```text
3
0
undefined
undefined
```

`||` replaces any falsy value (including 0). `??` replaces only `null`/`undefined`. `?.` short-circuits to `undefined` instead of throwing, including for calls (`?.()`).

</details>

### 28. Comma and void

```js
console.log((1, 2, 3));
console.log(void 0);
```

<details><summary>Answer</summary>

```text
3
undefined
```

The comma operator evaluates left to right and returns the last value. `void` always returns `undefined`.

</details>

### 29. Infinity and division

```js
console.log(1 / 0, -1 / 0, 0 / 0);
console.log(Math.max(), Math.min());
```

<details><summary>Answer</summary>

```text
Infinity -Infinity NaN
-Infinity Infinity
```

Division by zero gives ±`Infinity`; `0/0` is `NaN`. `Math.max()` with no arguments is `-Infinity` (the identity for max), `Math.min()` is `Infinity`.

</details>

### 30. Chained comparison

```js
console.log(1 < 2 < 3);
console.log(3 > 2 > 1);
```

<details><summary>Answer</summary>

```text
true
false
```

Evaluated left to right: `1 < 2` → `true` → `true < 3` → `1 < 3` → `true`. `3 > 2` → `true` → `true > 1` → `1 > 1` → `false`.

</details>

### 31. Postfix and prefix increment

```js
let counter = 0;
const incr = () => counter++;
incr(); incr();
console.log(counter++, ++counter, counter);
```

<details><summary>Answer</summary>

```text
2 4 4
```

After two calls `counter` is 2. `counter++` returns 2 then makes it 3; `++counter` makes it 4 and returns 4.

</details>

## Objects, arrays & prototypes

### 32. Object references

```js
const p1 = { n: 1 };
const p2 = p1;
p2.n = 2;
console.log(p1.n);
console.log({ a: 1 } === { a: 1 });
```

<details><summary>Answer</summary>

```text
2
false
```

Objects are assigned by reference: `p1` and `p2` point to the same object. Two separately created objects are never `===`, even with identical contents.

</details>

### 33. Object keys are strings

```js
const k = {};
const keyA = { id: 1 };
const keyB = { id: 2 };
k[keyA] = "A";
k[keyB] = "B";
console.log(k[keyA]);
console.log(Object.keys(k));
```

<details><summary>Answer</summary>

```text
B
[ '[object Object]' ]
```

Plain-object keys are strings (or symbols). Both objects convert to `"[object Object]"`, so the second write overwrites the first. Use a `Map` for object keys.

</details>

### 34. Spread is shallow

```js
const orig = { a: 1, nested: { b: 2 } };
const copy = { ...orig };
copy.a = 100;
copy.nested.b = 200;
console.log(orig.a, orig.nested.b);
```

<details><summary>Answer</summary>

```text
1 200
```

Spread copies top-level properties only. `nested` is the same object in both, so changing `copy.nested.b` changes `orig.nested.b`.

</details>

### 35. const with objects

```js
const arr = [1, 2];
arr.push(3);
console.log(arr);
try { arr = []; } catch (e) { console.log(e.constructor.name); }
```

<details><summary>Answer</summary>

```text
[ 1, 2, 3 ]
TypeError
```

`const` prevents re-assignment of the variable, not mutation of the object it points to.

</details>

### 36. Object.freeze is shallow

```js
const frozen = Object.freeze({ a: 1, inner: { b: 2 } });
frozen.a = 99;
frozen.inner.b = 99;
console.log(frozen.a, frozen.inner.b);
```

<details><summary>Answer</summary>

```text
1 99
```

The top level is frozen (assignment ignored), but `inner` is a separate, unfrozen object.

</details>

### 37. String immutability

```js
let s = "hello";
s[0] = "H";
console.log(s);
console.log(s.toUpperCase(), s);
```

<details><summary>Answer</summary>

```text
hello
HELLO hello
```

Strings are immutable; index assignment is silently ignored (throws in strict mode). Methods return new strings.

</details>

### 38. Array length and holes

```js
const holes = [1, 2, 3];
holes[10] = 11;
console.log(holes.length);
console.log(holes.filter(() => true).length);
```

<details><summary>Answer</summary>

```text
11
4
```

Assigning index 10 sets `length` to 11 and leaves holes (empty slots). Iteration methods like `filter` skip holes.

</details>

### 39. map with parseInt

```js
console.log(["1", "2", "3"].map(parseInt));
```

<details><summary>Answer</summary>

```text
[ 1, NaN, NaN ]
```

`map` passes `(value, index)`. So the calls are `parseInt("1", 0)` → 1 (radix 0 = default), `parseInt("2", 1)` → `NaN` (invalid radix), `parseInt("3", 2)` → `NaN` (3 is not a binary digit). Use `.map(Number)`.

</details>

### 40. sort default is string order

```js
console.log([10, 1, 5, 100].sort());
console.log([10, 1, 5, 100].sort((a, b) => a - b));
```

<details><summary>Answer</summary>

```text
[ 1, 10, 100, 5 ]
[ 1, 5, 10, 100 ]
```

Without a comparator, `sort` converts elements to strings and compares UTF-16 order: `"100" < "5"`. Always pass `(a, b) => a - b` for numbers. `sort` also mutates the array.

</details>

### 41. Array destructuring swap and defaults

```js
let m = 1, n = 2;
[m, n] = [n, m];
const [p = 5, q = 6] = [undefined, null];
console.log(m, n, p, q);
```

<details><summary>Answer</summary>

```text
2 1 5 null
```

Destructuring swaps without a temp variable. Defaults apply only for `undefined`, not `null`.

</details>

### 42. delete on arrays

```js
const d = [1, 2, 3];
delete d[1];
console.log(d, d.length);
```

<details><summary>Answer</summary>

```text
[ 1, <1 empty item>, 3 ] 3
```

`delete` removes the value but leaves a hole; `length` is unchanged. Use `splice` or `filter`.

</details>

### 43. Default parameters and arguments

```js
function f(a, b = 2) { return arguments.length; }
console.log(f(1));
console.log(f.length);
```

<details><summary>Answer</summary>

```text
1
1
```

`arguments.length` counts what was actually passed (1). `f.length` counts parameters *before* the first default (1).

</details>

### 44. Prototype chain

```js
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return `${this.name} makes a sound`; };
const dog = new Animal("Rex");
console.log(dog.speak());
console.log(dog.hasOwnProperty("speak"));
console.log(Object.getPrototypeOf(dog) === Animal.prototype);
```

<details><summary>Answer</summary>

```text
Rex makes a sound
false
true
```

`speak` lives on `Animal.prototype`, not on `dog` itself, so `hasOwnProperty` is false; lookup walks the prototype chain.

</details>

### 45. Class getter and static

```js
class Temp {
  static unit = "C";
  #c = 25;
  get f() { return this.#c * 9 / 5 + 32; }
}
const t = new Temp();
console.log(t.f, Temp.unit, t.unit);
```

<details><summary>Answer</summary>

```text
77 C undefined
```

`25 * 9 / 5 + 32 = 77`. Static fields belong to the class, not instances, so `t.unit` is `undefined`.

</details>

## 🎯 Likely Follow-Up Questions

1. **Why does `var` in a loop with `setTimeout` print the same number? Give two fixes.**
2. **What is the order of microtasks vs macrotasks? Where does `process.nextTick` fit?**
3. **How does `await` change the order of execution?**
4. **What are the rules for `this`? How do arrow functions differ?**
5. **When does `==` behave differently from `===`? Why is `[] == false` true?**
6. **Why does `["1","2","3"].map(parseInt)` not return `[1,2,3]`?**
7. **Why is `0.1 + 0.2 !== 0.3`, and how do you handle money in JavaScript?**

---

[← MERN + TS Rapid-Fire Q&A](../15-mern-typescript/10-mern-interview-questions.md) | [Index](../README.md) | [Next: JS Polyfills & Implementations →](02-js-polyfills.md)
