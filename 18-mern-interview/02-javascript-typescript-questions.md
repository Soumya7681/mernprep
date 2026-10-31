# Chapter 146 — MERN Interview: JavaScript & TypeScript Questions

## 📖 How to Use This Chapter

These are the JavaScript and TypeScript questions most often asked in MERN interviews, with answers you can say in 30–60 seconds. Code examples show the "explain with an example" follow-up. For deeper theory see the **JavaScript** section and **MERN Stack + TypeScript: TypeScript Essentials**.

---

## 🟨 JavaScript

### 1. `var` vs `let` vs `const`?

| | `var` | `let` | `const` |
|---|-------|-------|---------|
| Scope | Function | Block | Block |
| Hoisted | Yes, initialised to `undefined` | Yes, but in temporal dead zone | Same as `let` |
| Re-declare | Allowed | Not allowed | Not allowed |
| Re-assign | Allowed | Allowed | Not allowed (object contents can still change) |

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));   // 3 3 3  (one shared i)
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j));   // 0 1 2  (new j per iteration)
```

### 2. What is a closure? Give a real use.

A function that remembers variables from the scope where it was created, even after that scope has finished.

```js
function createRateLimiter(limit) {
  let count = 0;                         // private, survives between calls
  return () => (++count <= limit ? "allowed" : "blocked");
}
const check = createRateLimiter(2);
check(); check(); check();               // allowed, allowed, blocked
```

Real uses: data privacy, debounce/throttle, memoization, React hooks (each render's handlers close over that render's state).

### 3. Explain the event loop.

JavaScript runs on one thread. Synchronous code runs on the **call stack**. Async callbacks wait in queues:
- **Microtasks**: promise callbacks, `queueMicrotask` — run right after the current code finishes, **all of them**.
- **Macrotasks**: `setTimeout`, `setInterval`, I/O — one per loop turn.

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");
// 1 4 3 2
```

### 4. `==` vs `===`?

`===` compares value **and** type with no conversion. `==` converts types first (`"5" == 5` is true, `null == undefined` is true). Always use `===`, except `x == null` to check null or undefined together.

### 5. What is `this`?

Decided by **how** a function is called:
- `obj.method()` → `obj`
- Plain call `fn()` → `undefined` in strict mode
- `new Fn()` → the new object
- `fn.call(x)` / `apply` / `bind` → `x`
- **Arrow functions** have no own `this`; they use the surrounding scope's `this`.

### 6. Promises vs async/await? How do you run requests in parallel?

`async/await` is syntax over promises — easier to read and use with `try/catch`.

```js
// ❌ sequential: total = a + b + c time
const user = await getUser(); const orders = await getOrders(); const stats = await getStats();

// ✅ parallel
const [user, orders, stats] = await Promise.all([getUser(), getOrders(), getStats()]);
```

| Method | Behaviour |
|--------|-----------|
| `Promise.all` | Fails fast if any rejects |
| `Promise.allSettled` | Waits for all, gives each result/status |
| `Promise.race` | First to settle (useful for timeouts) |
| `Promise.any` | First to **fulfil** |

### 7. Debounce vs throttle?

- **Debounce**: run only after the user **stops** for X ms (search box).
- **Throttle**: run at most once every X ms (scroll, resize).

```js
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
```

### 8. Shallow copy vs deep copy?

```js
const a = { user: { name: "A" } };
const shallow = { ...a };            // nested object is shared
shallow.user.name = "B";             // a.user.name is now "B" too
const deep = structuredClone(a);     // full copy (modern browsers / Node 17+)
```

`JSON.parse(JSON.stringify(x))` loses Dates, `undefined`, functions, Maps.

### 9. `map` vs `forEach` vs `filter` vs `reduce`?

`map` returns a new array of transformed items; `forEach` returns nothing (side effects); `filter` returns items that pass a test; `reduce` folds an array into one value.

```js
const total = cart.filter((i) => i.inStock).reduce((sum, i) => sum + i.price * i.qty, 0);
```

### 10. What is hoisting?

Declarations are processed before code runs. Function declarations are fully hoisted (callable before definition); `var` is hoisted as `undefined`; `let`/`const`/`class` are hoisted but unusable until declared (temporal dead zone).

### 11. Prototypal inheritance?

Objects link to a **prototype** object; property lookup walks the chain (`obj → Class.prototype → Object.prototype → null`). `class` syntax is sugar over prototypes.

### 12. `null` vs `undefined`?

`undefined` = not assigned yet (missing property, missing argument). `null` = intentionally empty. `typeof null` is `"object"` (old bug).

### 13. Optional chaining and nullish coalescing?

```js
const city = user?.address?.city ?? "Unknown";   // ?? only falls back for null/undefined
const count = input || 10;                        // || also replaces 0 and "" — often a bug
```

### 14. What are ES modules vs CommonJS?

ESM: `import`/`export`, static, async loading, tree-shakeable, `"type": "module"`. CommonJS: `require`/`module.exports`, synchronous, Node's original system. New Node projects usually use ESM.

### 15. How do you handle errors in async code?

`try/catch` around `await`, `.catch()` on promises, a central Express error handler, and `process.on("unhandledRejection")` as a last resort (log and exit).

---

## 🟦 TypeScript

### 16. Why use TypeScript in a MERN project?

Catches errors at compile time, safe refactoring, autocompletion, and **shared types** between frontend and backend so API changes break the build instead of production.

### 17. `interface` vs `type`?

Both describe object shapes. `interface` can be extended and merged (used to add `req.user` to Express's `Request`). `type` can also express unions, tuples and utility combinations. Teams usually pick one style for objects and use `type` for unions.

### 18. `any` vs `unknown`?

`any` turns off checking. `unknown` forces you to check the type before use — safer for API responses and `JSON.parse` results.

### 19. Generics — give an example.

```ts
interface ApiResponse<T> { success: boolean; data: T; message?: string }

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}
const users = await get<ApiResponse<User[]>>("/api/users");
```

### 20. Utility types you use?

```ts
type PublicUser = Omit<User, "password">;
type UpdateUserDto = Partial<Pick<User, "name" | "phone">>;
type RoleMap = Record<"admin" | "user", string[]>;
type Result = Awaited<ReturnType<typeof fetchUser>>;
```

### 21. What is a union type and narrowing?

```ts
type Status = "loading" | "success" | "error";
function show(id: string | number) {
  if (typeof id === "string") return id.toUpperCase();   // narrowed to string
  return id.toFixed(0);                                   // narrowed to number
}
```

### 22. Does TypeScript validate API data at runtime?

No — types disappear after compilation. Validate incoming request bodies on the server (express-validator, class-validator in NestJS, or custom type guards).

### 23. How do you type props and state in React?

```tsx
interface Props { title: string; onSave: (value: string) => void; children?: React.ReactNode }
const [user, setUser] = useState<User | null>(null);
```

### 24. How do you add `req.user` in Express with TypeScript?

```ts
declare global {
  namespace Express {
    interface Request { user?: { id: string; role: "admin" | "user" } }
  }
}
```

### 25. `enum` or union of strings?

Many teams prefer string unions or `as const` objects: no runtime code, simpler, and work well with JSON. Enums are fine if the team uses them consistently.

---

[← MERN Self-Intro & Project Questions](01-project-experience.md) | [Index](../README.md) | [Next: React & Redux Questions →](03-react-redux-questions.md)
