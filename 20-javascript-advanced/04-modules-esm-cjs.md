# Chapter 18 — Modules: ESM vs CommonJS

## 📖 Definition

A **module** is a file with its own scope that explicitly exports values and imports others. JavaScript has two module systems:

- **CommonJS (CJS)** — `require()` / `module.exports`. Node's original system.
- **ES Modules (ESM)** — `import` / `export`. The language standard, used by browsers, bundlers and modern Node.

## 🔍 Key Differences

| | CommonJS | ES Modules |
|---|---|---|
| Syntax | `const x = require("x")`, `module.exports = …` | `import x from "x"`, `export default …` |
| Loading | Synchronous, at runtime | Parsed statically, loaded asynchronously |
| When resolved | When the `require` line runs | Before any code runs (static graph) |
| Bindings | A **copy** of `module.exports` at require time | **Live bindings** (read-only view of the exporter's variable) |
| Conditional import | `if (x) require("a")` works | Use dynamic `await import("a")` |
| Top-level `await` | ❌ | ✅ |
| `this` at top level | `module.exports` | `undefined` |
| `__dirname`, `__filename` | ✅ | ❌ — use `import.meta.dirname` / `import.meta.url` |
| Tree shaking | Hard | ✅ (static structure) |
| File extension in Node | `.js` (default) or `.cjs` | `.mjs`, or `.js` with `"type": "module"` |

## 💻 Code Example — Same Module, Both Ways

```js
// math.cjs — CommonJS
function add(a, b) { return a + b; }
module.exports = { add };

// app.cjs
const { add } = require("./math.cjs");
```

```js
// math.mjs — ESM
export function add(a, b) { return a + b; }
export default function multiply(a, b) { return a * b; }

// app.mjs
import multiply, { add } from "./math.mjs";   // extension is required in Node ESM
import * as math from "./math.mjs";
```

## 💻 Code Example — Live Bindings vs Copies

```js
// counter.mjs
export let count = 0;
export function inc() { count++; }

// main.mjs
import { count, inc } from "./counter.mjs";
inc();
console.log(count); // 1 — live binding
```

```js
// counter.cjs
let count = 0;
module.exports = { count, inc: () => count++ };

// main.cjs
const { count, inc } = require("./counter.cjs");
inc();
console.log(count); // 0 — a copy of the value at require time
```

## 💻 Code Example — Dynamic Import and Code Splitting

```js
// Load a heavy library only when needed (works in CJS and ESM)
button.addEventListener("click", async () => {
  const { default: Chart } = await import("chart.js/auto");
  new Chart(ctx, config);
});
```

```jsx
// React: each lazy() creates a separate bundle chunk
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
```

## 💻 Code Example — ESM Equivalents of `__dirname` in Node

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Node 20.11+: import.meta.dirname and import.meta.filename
```

## 💻 Code Example — Interop

```js
// ESM importing a CJS package: default import gets module.exports
import express from "express";

// CJS requiring an ESM package: Node 22+ supports require(esm) for sync ESM graphs;
// older versions need dynamic import:
const { nanoid } = await import("nanoid");
```

## 🔍 Circular Dependencies

Both systems allow cycles, but behave differently:
- **CJS** returns a **partially filled** `module.exports` → you get `undefined` for things not yet exported.
- **ESM** hoists bindings; accessing a `let/const` export before it is initialised throws a `ReferenceError` (TDZ), while function declarations work.

Fix cycles by extracting the shared code into a third module.

## 🔍 Module Caching

Both systems **evaluate a module once** and cache it. Every later import returns the same instance — which is why a module-level `new PrismaClient()` or `mongoose.connect()` acts as a singleton.

## 🌍 Real-World Use

- New Node projects: `"type": "module"` in `package.json` and ESM everywhere.
- Libraries often ship both (`"exports": { "import": "./index.mjs", "require": "./index.cjs" }`).
- Bundlers (Vite, webpack) rely on ESM's static structure for tree shaking.

## 🎯 Likely Interview Questions

1. **Difference between CommonJS and ES Modules?**
2. **What are live bindings?**
3. **Why does tree shaking work better with ESM?**
4. **How do you use `__dirname` in an ES module?**
5. **What is dynamic `import()` and where do you use it?**
6. **What happens with circular dependencies in CJS vs ESM?**
7. **Why does requiring the same module twice not run it twice?**

---

[← Proxy, Reflect & Symbols](03-proxy-reflect-symbols.md) | [Index](../README.md) | [Next: Functional Patterns & Immutability →](05-functional-patterns.md)
