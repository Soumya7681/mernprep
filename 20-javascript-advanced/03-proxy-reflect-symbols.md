# Chapter 17 — Proxy, Reflect & Symbols

## 📖 Definition

- A **`Proxy`** wraps an object and intercepts fundamental operations (get, set, delete, `in`, function calls…) through **trap** functions.
- **`Reflect`** is a built-in object whose methods perform those same default operations. Inside a trap you call `Reflect.*` to forward to the original behaviour.
- A **`Symbol`** is a unique, immutable primitive used as a property key that cannot collide with any other key. *Well-known symbols* (`Symbol.iterator`, `Symbol.toPrimitive`…) let you hook into language behaviour.

## 🔍 Explanation

Common traps:

| Trap | Intercepts |
|---|---|
| `get(target, prop, receiver)` | `obj.prop`, `obj[prop]` |
| `set(target, prop, value, receiver)` | `obj.prop = value` |
| `has(target, prop)` | `prop in obj` |
| `deleteProperty(target, prop)` | `delete obj.prop` |
| `ownKeys(target)` | `Object.keys`, `for...in` |
| `apply(target, thisArg, args)` | Calling a proxied function |
| `construct(target, args)` | `new` on a proxied class |

Vue 3's reactivity system, MobX and Immer are all built on Proxies.

## 💻 Code Example — Validation

```js
const user = new Proxy({}, {
  set(target, prop, value, receiver) {
    if (prop === "age" && (!Number.isInteger(value) || value < 0)) {
      throw new TypeError("age must be a non-negative integer");
    }
    return Reflect.set(target, prop, value, receiver);
  },
});

user.age = 30;     // ok
user.age = -1;     // TypeError
```

## 💻 Code Example — Default Values and Negative Array Indexes

```js
const withDefault = (obj, fallback) =>
  new Proxy(obj, {
    get: (t, p, r) => (p in t ? Reflect.get(t, p, r) : fallback),
  });

const config = withDefault({ port: 3000 }, "N/A");
config.port;   // 3000
config.host;   // "N/A"

const arr = new Proxy([10, 20, 30], {
  get(t, p, r) {
    const i = Number(p);
    return Number.isInteger(i) && i < 0 ? t[t.length + i] : Reflect.get(t, p, r);
  },
});
arr[-1]; // 30
```

## 💻 Code Example — A Tiny Reactive Store (How Vue Works)

```js
function reactive(obj, onChange) {
  return new Proxy(obj, {
    set(t, p, v, r) {
      const old = t[p];
      const ok = Reflect.set(t, p, v, r);
      if (old !== v) onChange(p, v, old);
      return ok;
    },
  });
}

const state = reactive({ count: 0 }, (key, v) => console.log(`${key} → ${v}`));
state.count++;  // "count → 1"
```

## 💻 Code Example — Logging / Timing Every Method Call

```js
function instrument(service) {
  return new Proxy(service, {
    get(t, p, r) {
      const val = Reflect.get(t, p, r);
      if (typeof val !== "function") return val;
      return async (...args) => {
        const start = performance.now();
        try { return await val.apply(t, args); }
        finally { console.log(`${String(p)} took ${(performance.now() - start).toFixed(1)}ms`); }
      };
    },
  });
}

const userService = instrument(new UserService());
await userService.findById(1); // "findById took 12.3ms"
```

## 💻 Code Example — Symbols

```js
// 1. Unique keys — no collisions with other libraries
const ID = Symbol("id");
const user = { name: "Ravi", [ID]: 42 };
Object.keys(user);           // ["name"] — symbols are hidden from normal enumeration
JSON.stringify(user);        // '{"name":"Ravi"}'
user[ID];                    // 42

// 2. Global registry — same symbol across modules
Symbol.for("app.token") === Symbol.for("app.token"); // true
Symbol("x") === Symbol("x");                         // false

// 3. Well-known symbols
class Money {
  constructor(amount) { this.amount = amount; }
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? `₹${this.amount}` : this.amount;
  }
}
const m = new Money(500);
`${m}`;   // "₹500"
m + 100;  // 600

class Temperature {
  get [Symbol.toStringTag]() { return "Temperature"; }
}
Object.prototype.toString.call(new Temperature()); // "[object Temperature]"
```

## 🔍 Why `Reflect` and not `target[prop]`?

`Reflect.get(target, prop, receiver)` passes the correct `receiver`, so getters that use `this` keep working when the proxy is inherited from. `Reflect.set` returns a boolean, which is exactly what a `set` trap must return (returning `false` in strict mode throws).

## 🌍 Real-World Use

- **Immer** (used by Redux Toolkit) records mutations on a Proxy "draft" and produces a new immutable state.
- **Vue 3 / MobX** reactivity.
- API clients that turn `api.users.get(1)` into `GET /users/1` dynamically.
- Feature-flag or config objects that throw on unknown keys instead of returning `undefined`.

## 🎯 Likely Interview Questions

1. **What is a Proxy? Name some traps.**
2. **Why use `Reflect` inside traps?**
3. **How does Redux Toolkit let you "mutate" state in reducers?** — Immer + Proxy drafts.
4. **What is a Symbol and why is it useful as a property key?**
5. **Difference between `Symbol()` and `Symbol.for()`?**
6. **Name three well-known symbols and what they customise.**
7. **Can a Proxy intercept operations on primitives?** — No, only objects (including functions).

---

[← Iterators & Generators](02-iterators-generators.md) | [Index](../README.md) | [Next: Modules: ESM vs CommonJS →](04-modules-esm-cjs.md)
