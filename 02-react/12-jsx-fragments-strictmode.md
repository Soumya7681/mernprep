# Chapter 24 — JSX, Fragments & StrictMode

## 📖 Definition

- **JSX** is a syntax extension that lets you write HTML-like markup inside JavaScript. It is not HTML and not a template language. A compiler (Babel, SWC, esbuild, TypeScript) turns it into plain function calls that return **React elements**.
- **Fragments** (`<>…</>` or `<React.Fragment>`) group several elements without adding an extra DOM node.
- **`<StrictMode>`** is a development-only wrapper that runs extra checks to surface impure rendering, missing effect cleanups and deprecated APIs.

## 🔍 Explanation

### What JSX Compiles To

```jsx
const el = <h1 className="title">Hello, {name}</h1>;
```

**Classic runtime** (React ≤ 16, needed `import React` in every file):

```js
const el = React.createElement("h1", { className: "title" }, "Hello, ", name);
```

**Automatic runtime** (React 17+, the default today): the compiler adds the import for you.

```js
import { jsx as _jsx } from "react/jsx-runtime";
const el = _jsx("h1", { className: "title", children: ["Hello, ", name] });
```

That is why modern code no longer needs `import React from "react"` just to use JSX.

Both return a plain object such as `{ type: "h1", props: { className: "title", children: [...] }, key: null }`. That object is the "virtual DOM" node.

### JSX Rules

| Rule | Example | Why |
|------|---------|-----|
| One root element per return | Wrap siblings in `<>…</>` | A function returns one value |
| Close every tag | `<img />`, `<br />`, `<Input />` | XML-style parsing |
| `className`, not `class` | `<div className="box">` | `class` is a reserved word in JS |
| `htmlFor`, not `for` | `<label htmlFor="email">` | `for` is reserved too |
| camelCase attributes and events | `onClick`, `tabIndex`, `strokeWidth` | They map to DOM properties |
| `style` takes an object | `style={{ marginTop: 8 }}` | Numbers get `px` for most properties |
| `{}` holds **expressions**, not statements | `{cond ? <A /> : <B />}`, not `{if (cond) …}` | It becomes a function argument |
| Components start with a capital letter | `<UserCard />` | Lowercase compiles to the string `"usercard"` (a DOM tag) |
| `data-*` and `aria-*` stay hyphenated | `aria-label="Close"` | Passed through as-is |

### What Renders and What Doesn't

| Value in `{}` | Renders |
|---------------|---------|
| String, number | As text (including `0`!) |
| `true`, `false`, `null`, `undefined` | Nothing |
| Array | Each item (needs `key`s) |
| React element | The element |
| Plain object | ❌ Error: "Objects are not valid as a React child" |
| Function | ❌ Nothing, plus a warning |

### JSX Escapes Values

```jsx
const comment = "<img src=x onerror=alert(1)>";
<p>{comment}</p>   // shown as literal text, safe against XSS
```

The only way to inject raw HTML is the deliberately ugly `dangerouslySetInnerHTML={{ __html: html }}`, and you should sanitise the HTML first (for example with DOMPurify). See the Frontend Security chapter.

## 💻 Code Example — The `&&` Zero Bug

```jsx
function Cart({ items }) {
  return (
    <div>
      {items.length && <p>{items.length} items</p>}
      {/* ❌ When length is 0, React renders the number 0 */}

      {items.length > 0 && <p>{items.length} items</p>}
      {/* ✅ Boolean condition renders nothing when false */}
    </div>
  );
}
```

On React Native, a stray `0` outside `<Text>` crashes the app, so this bug is even worse there.

## 💻 Code Example — Fragments

```jsx
// ❌ Extra <div> breaks table markup: <tr> can't contain <div>
function Columns() {
  return (
    <div>
      <td>Name</td>
      <td>Email</td>
    </div>
  );
}

// ✅ Fragment adds no DOM node
function Columns() {
  return (
    <>
      <td>Name</td>
      <td>Email</td>
    </>
  );
}
```

## 💻 Code Example — Keyed Fragments

The short `<>` syntax cannot take props. When you need a `key` (for example in a list), use the long form:

```jsx
import { Fragment } from "react";

function Glossary({ terms }) {
  return (
    <dl>
      {terms.map(t => (
        <Fragment key={t.id}>
          <dt>{t.word}</dt>
          <dd>{t.meaning}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

## 💻 Code Example — Children, Spreading and Conditional Attributes

```jsx
function Card({ title, children, ...rest }) {
  // `rest` forwards any other props (id, aria-*, onClick…) to the DOM node
  return (
    <section className="card" {...rest}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

<Card title="Profile" id="profile" aria-busy={loading || undefined}>
  <p>Body content goes in `children`</p>
</Card>
```

Passing `undefined` removes an attribute entirely. Be careful when spreading props onto DOM elements: unknown props like `isActive` end up as invalid HTML attributes and React warns.

## 💻 Code Example — Dynamic Component Type

```jsx
const icons = { success: CheckIcon, error: XIcon };

function Status({ kind }) {
  const Icon = icons[kind];       // must be a capitalised variable
  return <Icon />;
}

// ❌ <icons[kind] /> is not valid JSX
```

## 💻 Code Example — StrictMode

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

In **development only**, StrictMode:

1. **Renders components twice** (and calls `useState`/`useMemo`/`useReducer` initialisers and reducers twice) to catch impure rendering. React 19 reuses the first result of `useMemo` and `useState` initialisers, so the second call only exposes side effects.
2. **Runs effects twice on mount**: mount → unmount (cleanup) → mount. This catches effects without proper cleanup.
3. **Runs ref callbacks twice on mount** (React 19).
4. **Warns about deprecated APIs** such as `UNSAFE_` lifecycles and legacy refs or context.

It does **nothing in production**. You can also wrap just part of the tree.

## 💻 Code Example — Bug StrictMode Exposes

```jsx
function Chat({ roomId }) {
  useEffect(() => {
    const conn = createConnection(roomId);
    conn.connect();
    // ❌ No cleanup: in StrictMode you'll see two connections in dev,
    //    which is exactly the leak you'd get in production when roomId changes
  }, [roomId]);
}

// ✅ Fix
useEffect(() => {
  const conn = createConnection(roomId);
  conn.connect();
  return () => conn.disconnect();
}, [roomId]);
```

"My API is called twice in development" is almost always StrictMode. The fix is a cleanup (abort the request or ignore the stale result), or a data-fetching library, not removing StrictMode.

## 🌍 Real-World Impact

- Use `> 0` or `Boolean(x)` for `&&` conditions on numbers.
- Use Fragments to keep table, list and flex/grid markup valid.
- Keep StrictMode on. Double effects in dev reveal real leaks before users hit them.
- Never put unsanitised HTML into `dangerouslySetInnerHTML`.

## 🎯 Likely Interview Questions

1. **What is JSX and is it required?** — Syntax sugar for `React.createElement` / `jsx()` calls. Not required, but almost everyone uses it.
2. **Why don't we need `import React` any more?** — React 17's automatic JSX runtime makes the compiler import `jsx` from `react/jsx-runtime` itself.
3. **Why must component names start with a capital letter?** — Lowercase tags compile to strings and are treated as DOM elements. Capitalised names compile to variable references.
4. **What is a Fragment and when do you need the long form?** — It groups children without a DOM wrapper. Use `<Fragment key={…}>` when you need a key in a list.
5. **Why does `{count && <X />}` show `0`?** — `0 && …` evaluates to `0`, and React renders numbers. Use a boolean condition.
6. **How does JSX protect against XSS?** — Values in `{}` are escaped as text. Only `dangerouslySetInnerHTML` bypasses that.
7. **What does StrictMode do? Does it affect production?** — Dev-only double render, double effect mount/cleanup, and deprecation warnings. No effect in production.
8. **Why is my `useEffect` running twice?** — StrictMode in development. Add a proper cleanup.
9. **Difference between `className` and `class`?** — `class` is a reserved JS keyword, so JSX uses the DOM property name `className`.

---

[← Functional Components](01-functional-components.md) | [Index](../README.md) | [Next: Class Components & Lifecycle →](11-class-components-lifecycle.md)
