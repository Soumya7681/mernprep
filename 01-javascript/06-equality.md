# Chapter 09 — `==` vs `===` (Equality)

## 📖 Definition

- `==` performs **loose equality** with type coercion.
- `===` performs **strict equality** — no coercion, types must match.

## 🔍 Explanation

`==` tries to make types match before comparing. The rules are notoriously inconsistent, which is why **most teams ban `==` outright** (ESLint `eqeqeq`).

### Coercion Rules (`==`)
1. If types match → behave like `===`.
2. `null == undefined` → `true` (special rule).
3. Number vs string → string is converted to number.
4. Boolean → converted to number (`true → 1`, `false → 0`).
5. Object vs primitive → object is converted via `valueOf` / `toString`.

## 💻 Code Example — Surprising Coercions

```js
0 == "0";              // true  (string → number 0)
0 == "";               // true  (empty string → 0)
0 == false;            // true  (false → 0)
"" == false;           // true  (both → 0)

null == undefined;     // true  (special rule)
null == 0;             // false (special exception)

[] == false;           // true   ([] → "" → 0; false → 0)
[1] == 1;              // true   ([1] → "1" → 1)
[1, 2] == "1,2";       // true

NaN == NaN;            // false  (NaN never equals anything)
NaN === NaN;           // false
```

## 💻 Code Example — Strict Equality

```js
0 === "0";             // false (different types)
0 === false;           // false
null === undefined;    // false
NaN === NaN;           // false

1 === 1;               // true
"a" === "a";           // true
```

## 💻 Code Example — Object Equality

```js
const a = { x: 1 };
const b = { x: 1 };
const c = a;

a === b;               // false — different references
a === c;               // true  — same reference

// Deep equality requires a helper:
JSON.stringify(a) === JSON.stringify(b);   // true (works for simple shapes)
```

## 💻 Code Example — Checking for NaN

```js
// Wrong:
x === NaN;             // always false

// Right:
Number.isNaN(x);       // ES6, type-safe
isNaN("abc");          // true  (legacy — coerces first)
Number.isNaN("abc");   // false (no coercion)
```

## 💻 Code Example — `Object.is`

```js
Object.is(NaN, NaN);   // true
Object.is(+0, -0);     // false  (=== returns true)
Object.is(1, 1);       // true
```

`Object.is` is the same as `===` except for `NaN` and signed zeros.

## 💻 Code Example — Safe Null Checks

```js
// Loose check covers both null and undefined
if (value == null) {
  // matches null OR undefined
}

// Strict equivalent
if (value === null || value === undefined) {}

// Modern (preferred)
if (value ?? false) {}             // ?? treats only null/undefined as empty
```

## 🌍 Real-World Impact

- **Always use `===`** unless you specifically want `value == null` to catch both `null` and `undefined`.
- Add `"eqeqeq": "error"` to ESLint config.
- For deep equality, use `lodash.isEqual` or a library; never roll your own without testing edge cases.

## 🎯 Likely Interview Questions

1. **Difference between `==` and `===`?**
2. **Why is `[] == false` true?** — `[]` converts via `toString` → `""` → number `0`. `false` → `0`. Both equal.
3. **How do you check for `NaN`?** — `Number.isNaN(x)`.
4. **How do you compare two objects for value equality?** — `JSON.stringify` (limited), `lodash.isEqual`, or a custom deep-equals.

---

[← Prototype](05-prototype.md) | [Index](../README.md) | [Next: Event Handling →](07-event-handling.md)
