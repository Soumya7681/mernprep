# Chapter 04 — Closures

## 📖 Definition

A **closure** is a function that "remembers" the variables from the lexical scope in which it was created, even after that outer scope has finished executing.

## 🔍 Explanation

When a function is created in JavaScript, it carries a hidden reference (`[[Environment]]`) to the variable environment in which it was defined. When invoked later — even from a completely different scope — it can still access those original variables.

Closures power:
- **Data privacy** (private state)
- **Currying** and partial application
- **Memoization** and caching
- **Event handlers** and callbacks
- **React hooks** internally

## 💻 Code Example — Basic Counter

```js
function createCounter() {
  let count = 0;                    // private variable
  return function increment() {
    count += 1;                     // closes over `count`
    return count;
  };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3

const counter2 = createCounter();
console.log(counter2()); // 1 — independent closure
```

## 💻 Code Example — Private State (Module Pattern)

```js
function createBankAccount(initial) {
  let balance = initial;            // truly private

  return {
    deposit(amount)  { balance += amount; return balance; },
    withdraw(amount) {
      if (amount > balance) throw new Error("Insufficient funds");
      balance -= amount;
      return balance;
    },
    getBalance() { return balance; },
  };
}

const acc = createBankAccount(100);
acc.deposit(50);              // 150
acc.withdraw(30);             // 120
acc.getBalance();             // 120
// acc.balance → undefined   ✅ inaccessible from outside
```

## 💻 Code Example — Once-Only Function

```js
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

const initApp = once(() => console.log("App initialized"));
initApp(); // "App initialized"
initApp(); // (nothing)
initApp(); // (nothing)
```

## 💻 Code Example — Currying with Closures

```js
function multiply(a) {
  return function (b) {
    return function (c) {
      return a * b * c;
    };
  };
}

multiply(2)(3)(4); // 24

// Or generic curry:
const curry = (fn) => {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...next) => curried(...args, ...next);
  };
};

const sum = (a, b, c) => a + b + c;
curry(sum)(1)(2)(3); // 6
```

## 💻 Code Example — Classic Loop Pitfall

```js
// Bug: all callbacks see the final i
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 3, 3, 3

// Fix 1: block-scoped let creates new binding per iteration
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 0, 1, 2

// Fix 2: IIFE to capture the value
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
// Output: 0, 1, 2
```

## 🌍 Real-World Uses

- React `useState` setter closes over a slot in the fiber.
- Express middleware closes over config: `app.use(authMiddleware(config))`.
- Memoization caches: `const memo = {}; return (key) => memo[key] ??= compute(key);`

## 🎯 Likely Interview Questions

1. **Explain closure with a real example.**
2. **What's the output of the classic `setTimeout` loop?** (See above.)
3. **How can closures cause memory leaks?**
   > A closure holds references to its outer scope. If a long-lived object (event listener, global handler) closes over a large data structure, GC cannot collect it.
4. **What are some real uses of closures?** — Data privacy, currying, memoization, function factories.

---

[← 8-Week Study Plan](../00-requirements/03-study-plan.md) | [Index](../README.md) | [Next: Hoisting →](02-hoisting.md)
