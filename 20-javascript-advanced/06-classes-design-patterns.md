# Chapter 20 — Classes & Design Patterns

## 📖 Definition

A JavaScript **class** is syntax over prototype-based inheritance: it creates a constructor function whose `prototype` holds the methods. A **design pattern** is a reusable, named solution to a recurring design problem — Singleton, Factory, Observer, Strategy, Module, Decorator, and so on.

## 🔍 Class Features You Should Know

```js
class Account {
  static #count = 0;                 // private static field
  static bank = "JS Bank";           // public static field
  #balance = 0;                      // private instance field (truly private)
  owner;                             // public field

  constructor(owner, initial = 0) {
    this.owner = owner;
    this.#balance = initial;
    Account.#count++;
  }

  get balance() { return this.#balance; }        // getter
  deposit(amount) {
    if (amount <= 0) throw new RangeError("amount must be positive");
    this.#balance += amount;
    return this;                                  // chainable
  }
  #audit(msg) { console.log(`[${this.owner}] ${msg}`); }  // private method
  static count() { return Account.#count; }
  static { /* static initialisation block — runs once */ }
}

class Savings extends Account {
  constructor(owner, initial, rate) {
    super(owner, initial);           // must call super before using `this`
    this.rate = rate;
  }
  addInterest() { return this.deposit(this.balance * this.rate); }
  toString() { return `${super.toString()} (savings)`; }   // call parent method
}

const s = new Savings("Asha", 1000, 0.05).addInterest();
s.balance;        // 1050
s.#balance;       // SyntaxError — private
typeof Account;   // "function"
```

**Gotchas:** class bodies are always strict mode; classes are hoisted but stay in the TDZ (no use before declaration); methods are non-enumerable; calling a class without `new` throws.

## 💻 Pattern 1 — Singleton

One shared instance — typical for DB connections, loggers and config.

```js
// In Node, a module is already a singleton because modules are cached.
// db.js
import mongoose from "mongoose";
let connection;
export async function getDb() {
  connection ??= await mongoose.connect(process.env.MONGO_URI);
  return connection;
}

// Class-based
class Config {
  static #instance;
  static get instance() { return (Config.#instance ??= new Config()); }
}
```

## 💻 Pattern 2 — Factory

Create objects without the caller knowing the concrete class.

```js
class EmailNotifier { send(msg) { /* SES */ } }
class SmsNotifier   { send(msg) { /* Twilio */ } }
class PushNotifier  { send(msg) { /* FCM */ } }

const notifiers = { email: EmailNotifier, sms: SmsNotifier, push: PushNotifier };

function createNotifier(type) {
  const Cls = notifiers[type];
  if (!Cls) throw new Error(`Unknown notifier: ${type}`);
  return new Cls();
}

createNotifier(user.preferredChannel).send("Your order shipped");
```

## 💻 Pattern 3 — Observer / Pub-Sub (Event Emitter)

```js
class EventEmitter {
  #events = new Map();

  on(event, listener) {
    if (!this.#events.has(event)) this.#events.set(event, new Set());
    this.#events.get(event).add(listener);
    return () => this.off(event, listener);      // unsubscribe function
  }
  once(event, listener) {
    const wrapper = (...args) => { this.off(event, wrapper); listener(...args); };
    return this.on(event, wrapper);
  }
  off(event, listener) { this.#events.get(event)?.delete(listener); }
  emit(event, ...args) {
    for (const l of [...(this.#events.get(event) ?? [])]) l(...args);
    return this.#events.has(event);
  }
}

const bus = new EventEmitter();
const unsubscribe = bus.on("order:created", (o) => console.log("email for", o.id));
bus.emit("order:created", { id: 1 });
unsubscribe();
```

Node's `EventEmitter`, DOM events, Redux `store.subscribe`, and Socket.IO all follow this pattern.

## 💻 Pattern 4 — Strategy

Swap an algorithm at runtime instead of a growing `if/else` chain.

```js
const pricing = {
  regular: (amount) => amount,
  premium: (amount) => amount * 0.9,
  festival: (amount) => Math.max(amount - 500, 0),
};

function checkout(cart, strategy = "regular") {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return pricing[strategy](subtotal);
}
```

Passport.js (`passport.use(new GoogleStrategy(...))`) is the Strategy pattern.

## 💻 Pattern 5 — Decorator / Wrapper

Add behaviour without changing the original.

```js
const withRetry = (fn, retries = 3) => async (...args) => {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(...args); }
    catch (err) { if (attempt >= retries) throw err; }
  }
};

const withLogging = (fn) => async (...args) => {
  console.log(`→ ${fn.name}`, args);
  return fn(...args);
};

const fetchUser = withLogging(withRetry(api.getUser));
```

Express middleware, React higher-order components (`withAuth(Component)`) and NestJS decorators all apply this idea.

## 💻 Pattern 6 — Module / Revealing Module (Closures)

```js
const counter = (() => {
  let count = 0;                         // private
  return { inc: () => ++count, get: () => count };
})();
```

## 💻 Pattern 7 — Repository (Backend)

Hide the database behind an interface so services do not depend on Mongoose directly.

```js
class UserRepository {
  findById(id) { return User.findById(id).lean(); }
  findByEmail(email) { return User.findOne({ email }).lean(); }
  create(data) { return User.create(data); }
}

class UserService {
  constructor(repo = new UserRepository()) { this.repo = repo; } // dependency injection
  async register(dto) {
    if (await this.repo.findByEmail(dto.email)) throw new ConflictError("Email in use");
    return this.repo.create(dto);
  }
}
// In tests: new UserService(fakeRepo)
```

## 🔍 Composition Over Inheritance

Deep `extends` chains become rigid. Prefer combining small behaviours:

```js
const canFly = (o) => ({ ...o, fly: () => `${o.name} flies` });
const canSwim = (o) => ({ ...o, swim: () => `${o.name} swims` });
const duck = canSwim(canFly({ name: "Duck" }));
```

React chose composition (children, hooks) over class inheritance for the same reason.

## 🌍 Real-World Use

| Pattern | Where you have already seen it |
|---|---|
| Singleton | Mongoose connection, logger, Redux store |
| Factory | `React.createElement`, `express()`, notification senders |
| Observer | `EventEmitter`, `addEventListener`, Socket.IO, RxJS |
| Strategy | Passport strategies, payment gateways, pricing rules |
| Decorator | Express middleware, HOCs, NestJS `@Injectable()` |
| Repository | Data access layer in a layered Node API |

## 🎯 Likely Interview Questions

1. **Are JavaScript classes real classes?** — Syntax over prototypes.
2. **What are private fields (`#`)? How were they done before?** — Closures or WeakMap.
3. **Why must you call `super()` before `this` in a subclass constructor?**
4. **Implement an EventEmitter with `on`, `off`, `once`, `emit`.**
5. **What is the Singleton pattern and how does Node's module cache relate to it?**
6. **Explain the Strategy pattern with a real example.**
7. **Composition vs inheritance — which do you prefer and why?**
8. **What design patterns did you use in your last project?**

---

[← Functional Patterns & Immutability](05-functional-patterns.md) | [Index](../README.md) | [Next: Advanced Async Patterns →](07-async-advanced.md)
