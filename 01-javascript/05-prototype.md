# Chapter 08 — Prototype & Prototypal Inheritance

## 📖 Definition

Every JavaScript object has an internal `[[Prototype]]` link (accessible via `__proto__` or `Object.getPrototypeOf(obj)`) that points to another object from which it inherits properties and methods.

## 🔍 Explanation

When you access `obj.prop`:
1. JS engine first looks at the object itself.
2. If not found, it follows `__proto__` up the prototype chain.
3. Continues until it reaches `null` (the top).

This is called the **prototype chain**, and it's how methods like `Array.prototype.map` or `Object.prototype.toString` are available everywhere without being copied to each instance.

ES6 `class` syntax is **syntactic sugar** over this prototype mechanism.

## 💻 Code Example — Manual Prototype

```js
function Animal(name) {
  this.name = name;
}

Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

const dog = new Animal("Rex");
console.log(dog.speak());                          // "Rex makes a sound"
console.log(dog.__proto__ === Animal.prototype);   // true
console.log(Animal.prototype.__proto__ === Object.prototype); // true
console.log(Object.prototype.__proto__);           // null (end of chain)
```

## 💻 Code Example — ES6 Class (Syntactic Sugar)

```js
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
}

class Dog extends Animal {
  speak() { return `${this.name} barks`; }       // method override
  fetch() { return `${this.name} fetches the ball`; }
}

const rex = new Dog("Rex");
rex.speak();   // "Rex barks"
rex.fetch();   // "Rex fetches the ball"

// Under the hood:
console.log(Object.getPrototypeOf(rex) === Dog.prototype);     // true
console.log(Object.getPrototypeOf(Dog.prototype) === Animal.prototype); // true
```

## 💻 Code Example — `Object.create`

```js
const animal = {
  speak() { return `${this.name} makes a sound`; },
};

const dog = Object.create(animal);     // dog's prototype is animal
dog.name = "Rex";
dog.speak();                            // "Rex makes a sound"
```

## 💻 Code Example — Extending Built-Ins

```js
// Add a custom method to all arrays (don't do this in production!)
Array.prototype.last = function () {
  return this[this.length - 1];
};

[1, 2, 3].last();                       // 3
```
> ⚠️ Modifying built-in prototypes is considered an anti-pattern — collisions and unpredictable behavior. Stick to your own classes.

## 💻 Code Example — `hasOwnProperty` vs Inherited

```js
class User {
  constructor(name) { this.name = name; }
  greet() {}
}

const u = new User("S");
u.hasOwnProperty("name");      // true   (own)
u.hasOwnProperty("greet");     // false  (inherited from prototype)

"greet" in u;                  // true   (in checks the entire chain)
```

## 💻 Code Example — Calling Parent Method

```js
class Animal {
  constructor(name) { this.name = name; }
  describe() { return `Animal: ${this.name}`; }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);                                 // calls Animal constructor
    this.breed = breed;
  }
  describe() {
    return `${super.describe()}, breed: ${this.breed}`;
  }
}

new Dog("Rex", "Labrador").describe();
// "Animal: Rex, breed: Labrador"
```

## 🌍 Real-World Impact

- Every framework class (React class component, Express middleware base, NestJS providers) uses prototypal inheritance underneath.
- Understanding the chain helps you debug `undefined is not a function` — usually a missing `this` binding or a wrong inheritance link.

## 🎯 Likely Interview Questions

1. **What is prototypal inheritance?**
2. **Difference between `__proto__` and `prototype`?**
   > `prototype` exists on **functions** — it's the object that becomes the `__proto__` of instances created with `new`.
   > `__proto__` exists on **instances** — it's the actual link to the prototype object.
3. **How does ES6 class differ from prototype-based inheritance?** — Same mechanism, cleaner syntax. Classes also enforce `new` (throw if called without it).
4. **What is the prototype chain?**

---

[← this Keyword](04-this-keyword.md) | [Index](../README.md) | [Next: Equality →](06-equality.md)
