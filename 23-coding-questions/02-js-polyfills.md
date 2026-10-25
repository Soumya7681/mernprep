# Chapter 102 — JS Polyfills & Implementations

## 📖 Definition

A **polyfill** is your own implementation of a built-in feature (`Array.prototype.map`, `Function.prototype.bind`, `Promise.all`…). Interviewers ask you to write them because doing so proves you understand exactly how the built-in behaves: its arguments, its edge cases, `this`, and asynchronous ordering.

Every block below is self-contained and runnable — paste it into the playground and check the logged output.

## 🧠 How to Approach a Polyfill Question

1. **State the contract**: arguments, return value, edge cases (empty array, sparse arrays, non-function callback, rejected promise).
2. **Write the simplest correct version** first.
3. **Mention what you skipped** (e.g. "the real `map` also skips holes and handles `thisArg`").
4. **Test it out loud** with 2–3 inputs.

## 🔁 Array Methods

### 1. `Array.prototype.map`

```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== "function") throw new TypeError(callback + " is not a function");
  const result = new Array(this.length);
  for (let i = 0; i < this.length; i++) {
    if (i in this) result[i] = callback.call(thisArg, this[i], i, this); // skip holes like the real map
  }
  return result;
};

console.log([1, 2, 3].myMap((x) => x * 2)); // [2, 4, 6]
```

### 2. `Array.prototype.filter`

```js
Array.prototype.myFilter = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) result.push(this[i]);
  }
  return result;
};

console.log([1, 2, 3, 4].myFilter((x) => x % 2 === 0)); // [2, 4]
```

### 3. `Array.prototype.reduce`

```js
Array.prototype.myReduce = function (callback, initialValue) {
  let i = 0;
  let acc = initialValue;
  if (arguments.length < 2) {
    while (i < this.length && !(i in this)) i++;          // find first real element
    if (i >= this.length) throw new TypeError("Reduce of empty array with no initial value");
    acc = this[i++];
  }
  for (; i < this.length; i++) {
    if (i in this) acc = callback(acc, this[i], i, this);
  }
  return acc;
};

console.log([1, 2, 3, 4].myReduce((a, b) => a + b));      // 10
console.log([1, 2, 3].myReduce((a, b) => a + b, 10));     // 16
```

### 4. `Array.prototype.forEach`, `some`, `every`, `find`

```js
Array.prototype.myForEach = function (cb, thisArg) {
  for (let i = 0; i < this.length; i++) if (i in this) cb.call(thisArg, this[i], i, this);
};
Array.prototype.mySome = function (cb) {
  for (let i = 0; i < this.length; i++) if (i in this && cb(this[i], i, this)) return true;
  return false;
};
Array.prototype.myEvery = function (cb) {
  for (let i = 0; i < this.length; i++) if (i in this && !cb(this[i], i, this)) return false;
  return true;
};
Array.prototype.myFind = function (cb) {
  for (let i = 0; i < this.length; i++) if (cb(this[i], i, this)) return this[i]; // find does NOT skip holes
  return undefined;
};

console.log([1, 2, 3].mySome((x) => x > 2), [1, 2, 3].myEvery((x) => x > 0), [5, 8].myFind((x) => x > 6));
// true true 8
```

### 5. `Array.prototype.flat` (and a recursive flatten)

```js
Array.prototype.myFlat = function (depth = 1) {
  const result = [];
  (function flatten(arr, d) {
    for (const item of arr) {
      if (Array.isArray(item) && d > 0) flatten(item, d - 1);
      else result.push(item);
    }
  })(this, depth);
  return result;
};

const nested = [1, [2, [3, [4]]]];
console.log(nested.myFlat());          // [1, 2, [3, [4]]]
console.log(nested.myFlat(Infinity));  // [1, 2, 3, 4]

// Iterative version with a stack (no recursion limit)
function flatDeep(arr) {
  const stack = [...arr];
  const out = [];
  while (stack.length) {
    const next = stack.pop();
    if (Array.isArray(next)) stack.push(...next);
    else out.push(next);
  }
  return out.reverse();
}
console.log(flatDeep(nested));         // [1, 2, 3, 4]
```

## 🎯 Function Methods

### 6. `Function.prototype.call` and `apply`

```js
Function.prototype.myCall = function (context, ...args) {
  context = context ?? globalThis;
  const key = Symbol("fn");             // unique key: never overwrites a real property
  context[key] = this;                  // `this` is the function being called
  const result = context[key](...args); // called as a method → `this` = context
  delete context[key];
  return result;
};

Function.prototype.myApply = function (context, args = []) {
  return this.myCall(context, ...args);
};

function greet(greeting, mark) { return `${greeting}, ${this.name}${mark}`; }
console.log(greet.myCall({ name: "Asha" }, "Hello", "!"));   // Hello, Asha!
console.log(greet.myApply({ name: "Ravi" }, ["Hi", "?"]));   // Hi, Ravi?
```

### 7. `Function.prototype.bind`

```js
Function.prototype.myBind = function (context, ...boundArgs) {
  const fn = this;
  function bound(...args) {
    // When called with `new`, ignore the bound context (like the real bind)
    const isNew = this instanceof bound;
    return fn.apply(isNew ? this : context, [...boundArgs, ...args]);
  }
  bound.prototype = Object.create(fn.prototype);
  return bound;
};

const person = { name: "Asha" };
function intro(city, country) { return `${this.name} from ${city}, ${country}`; }
const boundIntro = intro.myBind(person, "Pune");
console.log(boundIntro("India"));      // Asha from Pune, India

function Point(x, y) { this.x = x; this.y = y; }
const BoundPoint = Point.myBind(null, 1);
console.log(new BoundPoint(2));        // Point { x: 1, y: 2 }
```

## ⏱️ Timing Utilities

### 8. Debounce (with `cancel`, leading option)

```js
function debounce(fn, delay, { leading = false } = {}) {
  let timer = null;
  function debounced(...args) {
    const callNow = leading && timer === null;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!leading) fn.apply(this, args);
    }, delay);
    if (callNow) fn.apply(this, args);
  }
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}

const log = debounce((q) => console.log("search:", q), 100);
log("r"); log("re"); log("react");     // only "search: react" after 100 ms
```

### 9. Throttle

```js
function throttle(fn, interval) {
  let last = 0;
  let timer = null;
  let lastArgs;
  let lastThis;
  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - last);
    lastArgs = args;                     // remember the latest call for the trailing run
    lastThis = this;
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      // trailing call so the final event is not lost
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(lastThis, lastArgs);
      }, remaining);
    }
  };
}

const onScroll = throttle((y) => console.log("scroll", y), 100);
onScroll(1); onScroll(2); onScroll(3); // "scroll 1" now, "scroll 3" after ~100 ms
```

### 10. `setInterval` using `setTimeout`

```js
function mySetInterval(fn, ms) {
  let id;
  let stopped = false;
  const tick = () => {
    fn();
    if (!stopped) id = setTimeout(tick, ms); // next run is scheduled only after this one finishes
  };
  id = setTimeout(tick, ms);
  return {
    clear: () => {                           // works even when called from inside fn
      stopped = true;
      clearTimeout(id);
    },
  };
}

let n = 0;
const handle = mySetInterval(() => {
  console.log("tick", ++n);
  if (n === 3) handle.clear();
}, 20);
```

## 🤝 Promises

### 11. `Promise.all`

```js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve([]);

    items.forEach((item, i) => {
      Promise.resolve(item).then(              // wrap non-promise values
        (value) => {
          results[i] = value;                  // keep input order, not completion order
          if (--remaining === 0) resolve(results);
        },
        reject,                                // first rejection wins
      );
    });
  });
}

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
promiseAll([delay(30, "a"), 42, delay(10, "c")]).then(console.log); // ["a", 42, "c"]
promiseAll([delay(10), Promise.reject(new Error("x"))]).catch((e) => console.log(e.message)); // x
```

### 12. `Promise.allSettled`, `race`, `any`

```js
function promiseAllSettled(items) {
  return Promise.all(
    items.map((p) =>
      Promise.resolve(p).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason }),
      ),
    ),
  );
}

function promiseRace(items) {
  return new Promise((resolve, reject) => {
    for (const p of items) Promise.resolve(p).then(resolve, reject);
  });
}

function promiseAny(items) {
  return new Promise((resolve, reject) => {
    const errors = [];
    let pending = items.length;
    if (!pending) return reject(new AggregateError([], "All promises were rejected"));
    items.forEach((p, i) =>
      Promise.resolve(p).then(resolve, (err) => {
        errors[i] = err;
        if (--pending === 0) reject(new AggregateError(errors, "All promises were rejected"));
      }),
    );
  });
}

promiseAllSettled([1, Promise.reject("no")]).then(console.log);
promiseRace([new Promise((r) => setTimeout(r, 50, "slow")), "instant"]).then(console.log); // instant
promiseAny([Promise.reject(1), Promise.resolve(2)]).then(console.log);                      // 2
```

### 13. A Minimal Promise Class

```js
class MyPromise {
  #state = "pending";
  #value;
  #handlers = [];

  constructor(executor) {
    const settle = (state, value) => {
      if (this.#state !== "pending") return;           // settle only once
      if (state === "fulfilled" && value && typeof value.then === "function") {
        return value.then((v) => settle("fulfilled", v), (e) => settle("rejected", e)); // adopt thenables
      }
      this.#state = state;
      this.#value = value;
      this.#handlers.forEach((h) => h());
    };
    try {
      executor((v) => settle("fulfilled", v), (e) => settle("rejected", e));
    } catch (err) {
      settle("rejected", err);
    }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const run = () =>
        queueMicrotask(() => {                         // callbacks are always async
          const cb = this.#state === "fulfilled" ? onFulfilled : onRejected;
          if (typeof cb !== "function") {
            return this.#state === "fulfilled" ? resolve(this.#value) : reject(this.#value);
          }
          try { resolve(cb(this.#value)); } catch (e) { reject(e); }
        });
      if (this.#state === "pending") this.#handlers.push(run);
      else run();
    });
  }

  catch(onRejected) { return this.then(undefined, onRejected); }
  finally(fn) {
    return this.then(
      (v) => { fn(); return v; },
      (e) => { fn(); throw e; },
    );
  }
  static resolve(v) { return new MyPromise((r) => r(v)); }
  static reject(e) { return new MyPromise((_, j) => j(e)); }
}

new MyPromise((r) => setTimeout(() => r(1), 10))
  .then((v) => v + 1)
  .then((v) => { throw new Error("err at " + v); })
  .catch((e) => e.message)
  .then(console.log);                                  // err at 2
console.log("sync first");                             // printed before the chain
```

### 14. Promisify

```js
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, ...results) => {
        if (err) return reject(err);
        resolve(results.length > 1 ? results : results[0]);
      });
    });
  };
}

function legacyAdd(a, b, cb) { setTimeout(() => cb(null, a + b), 5); }
promisify(legacyAdd)(2, 3).then(console.log);          // 5
```

## 🧰 Utilities

### 15. Deep Equal

```js
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

console.log(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })); // true
console.log(deepEqual({ a: 1 }, { a: "1" }));                       // false
```

### 16. `curry` and `compose`

```js
const curry = (fn) =>
  function curried(...args) {
    return args.length >= fn.length ? fn.apply(this, args) : (...more) => curried.apply(this, [...args, ...more]);
  };
const compose = (...fns) => (x) => fns.reduceRight((acc, f) => f(acc), x);

const volume = curry((l, w, h) => l * w * h);
console.log(volume(2)(3)(4), volume(2, 3)(4));          // 24 24
console.log(compose((x) => x + 1, (x) => x * 2)(5));    // 11
```

### 17. `memoize` and `once`

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn.apply(this, args));
    return cache.get(key);
  };
}

function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const init = once(() => { console.log("initialising"); return 42; });
console.log(init(), init());   // logs "initialising" once, then 42 42
```

### 18. Get a Nested Value by Path (`_.get`)

```js
function get(obj, path, defaultValue) {
  const keys = Array.isArray(path) ? path : path.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
  let current = obj;
  for (const key of keys) {
    if (current == null) return defaultValue;
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}

const data = { user: { addresses: [{ city: "Pune" }] } };
console.log(get(data, "user.addresses[0].city"));       // Pune
console.log(get(data, "user.phone.number", "N/A"));     // N/A
```

### 19. Event Emitter

```js
class Emitter {
  #events = {};
  on(name, fn) { (this.#events[name] ??= []).push(fn); return () => this.off(name, fn); }
  off(name, fn) { this.#events[name] = (this.#events[name] ?? []).filter((f) => f !== fn && f.original !== fn); }
  once(name, fn) {
    const wrapper = (...args) => { this.off(name, wrapper); fn(...args); };
    wrapper.original = fn;
    return this.on(name, wrapper);
  }
  emit(name, ...args) { [...(this.#events[name] ?? [])].forEach((fn) => fn(...args)); }
}

const e = new Emitter();
e.once("login", (u) => console.log("welcome", u));
e.emit("login", "Asha");   // welcome Asha
e.emit("login", "Ravi");   // nothing — once
```

### 20. `Object.create`, `instanceof` and `new`

```js
function myCreate(proto) {
  function F() {}
  F.prototype = proto;
  return new F();
}

function myInstanceOf(obj, Ctor) {
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype);
  const result = Ctor.apply(obj, args);
  return result !== null && (typeof result === "object" || typeof result === "function") ? result : obj;
}

function Car(make) { this.make = make; }
const car = myNew(Car, "Tata");
console.log(car.make, myInstanceOf(car, Car), myInstanceOf(car, Array)); // Tata true false
console.log(Object.getPrototypeOf(myCreate({ x: 1 })).x);                // 1
```

## 🎯 Likely Interview Questions

1. **Implement `map`, `filter`, `reduce` on `Array.prototype`. What happens with an empty array and no initial value in `reduce`?**
2. **Implement `call`, `apply`, `bind`. How does `bind` behave with `new`?**
3. **Implement `Promise.all`. Why must results keep the input order?**
4. **Implement `debounce` and `throttle`. When do you use each?**
5. **Implement a minimal Promise. Why are `then` callbacks always asynchronous?**
6. **Implement `flat` with a depth parameter, recursively and iteratively.**
7. **Implement `deepEqual` / `deepClone`. What edge cases exist?**
8. **Should you add methods to built-in prototypes in production code?** — No; it can clash with future standards and other libraries. Write standalone functions instead.

---

[← JS Predict-the-Output](01-js-output-questions.md) | [Index](../README.md) | [Next: JS Problem Solving →](03-js-problem-solving.md)
