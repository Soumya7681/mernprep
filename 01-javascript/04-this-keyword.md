# Chapter 07 — The `this` Keyword

## 📖 Definition

`this` refers to the **execution context** — the object that is currently calling the function.

## 🔍 Explanation

The value of `this` is determined by **how a function is called**, not where it is defined (with the major exception of arrow functions).

### The 5 Binding Rules

| # | Binding | Trigger | `this` is… |
|---|---------|---------|-----------|
| 1 | **Method call** | `obj.fn()` | `obj` |
| 2 | **Plain call** | `fn()` | `undefined` (strict) / `globalThis` (sloppy) |
| 3 | **Constructor** | `new Fn()` | The new instance |
| 4 | **Explicit** | `fn.call(ctx)` / `apply` / `bind` | `ctx` |
| 5 | **Arrow function** | Any | **Lexically inherited** from enclosing scope |

## 💻 Code Example — Method vs Plain Call

```js
const user = {
  name: "Soumya",
  greet() { return `Hi, ${this.name}`; },
};

user.greet();                 // "Hi, Soumya"

const ref = user.greet;
ref();                        // "Hi, undefined" — `this` is lost
```

## 💻 Code Example — Constructor

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.bark = function () {
  return `${this.name} barks`;
};

const dog = new Animal("Rex");
dog.bark();                   // "Rex barks"
```

## 💻 Code Example — `call`, `apply`, `bind`

```js
function intro(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

const user = { name: "Soumya" };

intro.call(user, "Hi", "!");          // "Hi, Soumya!"
intro.apply(user, ["Hello", "."]);    // "Hello, Soumya."

const bound = intro.bind(user, "Hey");
bound("?");                           // "Hey, Soumya?"
```

| Method | Calls immediately? | Args |
|--------|-------------------|------|
| `call`  | ✅ | individually |
| `apply` | ✅ | as an array |
| `bind`  | ❌ (returns new fn) | individually (partial application) |

## 💻 Code Example — Arrow Functions Inherit `this`

```js
class Timer {
  constructor() {
    this.seconds = 0;
  }
  startBroken() {
    setInterval(function () {
      this.seconds++;             // ❌ this is undefined / globalThis
    }, 1000);
  }
  startFixed() {
    setInterval(() => {
      this.seconds++;             // ✅ arrow inherits `this` from method
      console.log(this.seconds);
    }, 1000);
  }
}
```

## 💻 Code Example — `this` in Event Handlers

```js
const button = document.querySelector("button");

// Regular function — `this` is the button DOM element
button.addEventListener("click", function () {
  console.log(this);            // <button>
});

// Arrow — `this` is the surrounding scope
button.addEventListener("click", () => {
  console.log(this);            // window / undefined in module
});
```

## 💻 Code Example — Class Methods Need Binding

```jsx
// React class component (legacy)
class Counter extends React.Component {
  constructor() {
    super();
    this.state = { count: 0 };
    this.handleClick = this.handleClick.bind(this); // ✅ required
  }
  handleClick() {
    this.setState({ count: this.state.count + 1 });
  }
  render() {
    return <button onClick={this.handleClick}>{this.state.count}</button>;
  }
}
```

## 🌍 Real-World Impact

- React functional components + hooks completely avoid this whole mess.
- Always prefer arrow functions for callbacks that need to "see" the surrounding `this`.
- Use `bind` when passing methods as callbacks if you can't change to an arrow.

## 🎯 Likely Interview Questions

1. **What is `this`?**
2. **Difference between `call`, `apply`, and `bind`?**
3. **What's `this` inside an arrow function?** — Inherited from the enclosing lexical scope; arrow functions have no own `this`.
4. **Output prediction:**
   ```js
   const obj = {
     val: 42,
     arrow: () => this.val,
     method() { return this.val; },
   };
   obj.arrow();   // undefined — arrow's this is module/global
   obj.method();  // 42 — method's this is obj
   ```

---

[← Scope](03-scope.md) | [Index](../README.md) | [Next: Prototype →](05-prototype.md)
