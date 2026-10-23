# Chapter 06 — Scope (Global, Function, Block)

## 📖 Definition

**Scope** defines the region of a program where a variable is accessible.

## 🔍 Explanation

JavaScript uses **lexical (static) scoping** — scope is determined by where code is *written*, not where it is *called*.

| Scope | Created by | Holds |
|-------|-----------|-------|
| **Global** | Top of the script | `var` / `let` / `const` at the top level |
| **Function** | Any function body | `var`, `let`, `const`, parameters |
| **Block** | `{}` of `if`, `for`, `while`, etc. | Only `let` and `const` |
| **Module** | An ES module file | Top-level declarations are module-scoped (not global) |

## 💻 Code Example — Function vs Block Scope

```js
function test() {
  if (true) {
    var a = 1;                 // function-scoped
    let b = 2;                 // block-scoped
    const c = 3;               // block-scoped
  }
  console.log(a);              // 1  ✅
  console.log(b);              // ❌ ReferenceError
  console.log(c);              // ❌ ReferenceError
}
```

## 💻 Code Example — Lexical (Static) Scoping

```js
let x = "global";

function outer() {
  let x = "outer";
  function inner() {
    console.log(x);            // "outer" — lexical lookup
  }
  inner();
}
outer();
```

Even if `inner()` is called from somewhere else, it still resolves `x` to `"outer"`, because that's where it was defined.

## 💻 Code Example — Scope Chain

```js
const a = 1;
function f1() {
  const b = 2;
  function f2() {
    const c = 3;
    console.log(a, b, c);      // 1 2 3 — walks up the chain
  }
  f2();
}
f1();
```

## 💻 Code Example — Module Scope

```js
// math.js
export const PI = 3.14;        // module-scoped, NOT global
const internal = "private";    // not exported → invisible outside

// app.js
import { PI } from "./math.js";
console.log(PI);               // 3.14
console.log(internal);         // ❌ ReferenceError
```

## 💻 Code Example — Block Scope Saves Loops

```js
// var leaks out
for (var i = 0; i < 3; i++) {}
console.log(i);                // 3 — leaked

// let stays inside
for (let j = 0; j < 3; j++) {}
console.log(j);                // ❌ ReferenceError
```

## 🌍 Real-World Impact

- Prefer `const` everywhere; use `let` only when reassignment is needed; avoid `var`.
- Modules give natural encapsulation — your "private" helpers stay private if you don't export them.

## 🎯 Likely Interview Questions

1. **What's the difference between function and block scope?**
2. **What is lexical scoping?**
3. **Why is `var` considered dangerous?** — Function-scoped (not block-scoped), hoisted to `undefined`, can leak out of loops/blocks.
4. **Scope chain explained.**
5. **Output prediction:**
   ```js
   function outer() {
     const greeting = "hi";
     return function () { console.log(greeting); };
   }
   const fn = outer();
   fn(); // "hi" — closure preserves outer scope
   ```

---

[← Hoisting](02-hoisting.md) | [Index](../README.md) | [Next: this Keyword →](04-this-keyword.md)
