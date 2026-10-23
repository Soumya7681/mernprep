# Chapter 16 — Iterators & Generators

## 📖 Definition

An **iterator** is an object with a `next()` method that returns `{ value, done }`. An **iterable** is an object with a `[Symbol.iterator]()` method that returns an iterator — this is what `for...of`, spread (`...`), destructuring and `Array.from` consume.

A **generator** (`function*`) is a function that can pause with `yield` and resume later. Calling it returns a generator object that is both an iterator and an iterable.

## 🔍 Explanation

- Built-in iterables: `Array`, `String`, `Map`, `Set`, `arguments`, `NodeList`, typed arrays. Plain objects are **not** iterable.
- Generators are **lazy**: values are produced only when requested, which allows infinite sequences and processing large data piece by piece.
- `yield` sends a value out; `next(x)` sends a value **in** (it becomes the result of the paused `yield`).
- `async function*` + `for await...of` give **async iteration**, used for streams, paginated APIs and MongoDB cursors.

## 💻 Code Example — Custom Iterable

```js
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  },
};

console.log([...range]);          // [1, 2, 3, 4, 5]
for (const n of range) console.log(n);
```

## 💻 Code Example — The Same With a Generator

```js
function* rangeGen(from, to) {
  for (let i = from; i <= to; i++) yield i;
}
console.log([...rangeGen(1, 5)]); // [1, 2, 3, 4, 5]

const it = rangeGen(1, 2);
it.next(); // { value: 1, done: false }
it.next(); // { value: 2, done: false }
it.next(); // { value: undefined, done: true }
```

## 💻 Code Example — Infinite, Lazy Sequences

```js
function* ids() {
  let id = 1;
  while (true) yield id++;
}

function* take(iter, n) {
  for (const v of iter) {
    if (n-- <= 0) return;
    yield v;
  }
}

const gen = ids();
console.log([...take(gen, 3)]); // [1, 2, 3]
console.log(gen.next());         // { value: undefined, done: true }
// Leaving a for...of early calls gen.return(), which closes the source generator.
```

## 💻 Code Example — Two-Way Communication

```js
function* conversation() {
  const name = yield "What is your name?";
  const lang = yield `Hi ${name}, favourite language?`;
  return `${name} likes ${lang}`;
}

const c = conversation();
c.next().value;          // "What is your name?"
c.next("Asha").value;    // "Hi Asha, favourite language?"
c.next("JS").value;      // "Asha likes JS"
```

## 💻 Code Example — Async Generators for Paginated APIs

```js
async function* fetchAllUsers() {
  let page = 1;
  while (true) {
    const res = await fetch(`/api/users?page=${page}`);
    const { data, hasMore } = await res.json();
    yield* data;                 // delegate: yield each user
    if (!hasMore) return;
    page++;
  }
}

for await (const user of fetchAllUsers()) {
  console.log(user.name);        // pages are fetched only as needed
}
```

## 💻 Code Example — MongoDB / Node Streams Are Async Iterables

```js
// Process a million documents without loading them all into memory
const cursor = Order.find({ status: "paid" }).cursor();
for await (const order of cursor) {
  await sendInvoice(order);
}

// Read a file line by line
import { createReadStream } from "node:fs";
import readline from "node:readline";

const rl = readline.createInterface({ input: createReadStream("big.csv") });
for await (const line of rl) {
  // handle one line at a time
}
```

## 💻 Code Example — Making a Class Iterable

```js
class Playlist {
  #songs = [];
  add(song) { this.#songs.push(song); return this; }
  *[Symbol.iterator]() { yield* this.#songs; }
}

const p = new Playlist().add("A").add("B");
console.log([...p]); // ["A", "B"]
```

## 🌍 Real-World Use

- **Redux-Saga** is built on generators (`yield call(api)`, `yield put(action)`).
- Reading huge MongoDB collections or CSV files with `for await` and a cursor/stream.
- Pagination helpers that hide "next page" logic from the caller.
- ID generators, test data generators, lazy pipelines.

## 🎯 Likely Interview Questions

1. **What is the difference between an iterable and an iterator?**
2. **Why are plain objects not iterable? How would you make one iterable?**
3. **What does a generator return when called? When does its body start running?** — It returns a generator object; the body runs on the first `next()`.
4. **What is the difference between `yield` and `yield*`?**
5. **How can you pass a value into a generator?**
6. **What is `for await...of`? Give a Node.js use case.**
7. **How do generators relate to async/await?** — async/await is essentially generators + promises with an automatic runner.

---

[← Execution Context, Memory & GC](01-execution-context-memory.md) | [Index](../README.md) | [Next: Proxy, Reflect & Symbols →](03-proxy-reflect-symbols.md)
