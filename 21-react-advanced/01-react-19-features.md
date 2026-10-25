# Chapter 37 — React 19: Actions, `use` & Server Components

## 📖 Definition

**React 19** (stable since December 2024) adds first-class support for async data mutations — **Actions** — along with new hooks (`useActionState`, `useOptimistic`, `useFormStatus`, `use`), stable **Server Components**, `ref` as a regular prop, and built-in document metadata. The **React Compiler** (opt-in) automatically memoises components.

## 🔍 What Changed and Why It Matters

| Feature | Replaces / improves |
|---|---|
| **Actions** (async functions in `startTransition` or `<form action>`) | Manual `isLoading`, `error` state and `e.preventDefault()` boilerplate |
| `useActionState` | `useState` + `useReducer` around a submit handler |
| `useOptimistic` | Hand-written optimistic update + rollback logic |
| `useFormStatus` | Prop-drilling `isSubmitting` into a submit button |
| `use(promise)` / `use(context)` | Reading a promise inside render with Suspense; reading context conditionally |
| `ref` as a prop | `forwardRef` |
| `<title>`, `<meta>`, `<link>` in components | `react-helmet` |
| Server Components + Server Actions | Separate API route for every form or read |
| React Compiler | Most manual `useMemo` / `useCallback` / `React.memo` |

## 💻 Code Example — Form With an Action and `useActionState`

```jsx
import { useActionState } from "react";

async function updateName(prevState, formData) {
  const name = formData.get("name");
  if (!name) return { error: "Name is required" };
  const res = await fetch("/api/me", { method: "PATCH", body: JSON.stringify({ name }) });
  if (!res.ok) return { error: "Could not save" };
  return { error: null, saved: true };
}

export function NameForm() {
  const [state, formAction, isPending] = useActionState(updateName, { error: null });

  return (
    <form action={formAction}>
      <input name="name" />
      <button disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.saved && <p>Saved!</p>}
    </form>
  );
}
```

No `onSubmit`, no `preventDefault`, no separate loading state. React resets uncontrolled form fields after a successful action.

## 💻 Code Example — `useFormStatus` in a Reusable Button

```jsx
import { useFormStatus } from "react-dom";

function SubmitButton({ children }) {
  const { pending } = useFormStatus();   // reads the nearest parent <form>
  return <button disabled={pending}>{pending ? "Please wait…" : children}</button>;
}
```

## 💻 Code Example — `useOptimistic` for Instant UI

```jsx
import { useOptimistic, startTransition } from "react";

function LikeButton({ postId, likes }) {
  const [optimisticLikes, addOptimistic] = useOptimistic(likes, (current, delta) => current + delta);

  function like() {
    startTransition(async () => {
      addOptimistic(1);                     // UI updates immediately
      await api.like(postId);               // if this throws, React reverts to `likes`
    });
  }

  return <button onClick={like}>❤️ {optimisticLikes}</button>;
}
```

## 💻 Code Example — `use()` With Suspense

```jsx
import { use, Suspense } from "react";

function Comments({ commentsPromise }) {
  const comments = use(commentsPromise);      // suspends until resolved
  return comments.map((c) => <p key={c.id}>{c.text}</p>);
}

export function Post({ id }) {
  // Create the promise outside the suspending component (e.g. in a loader or parent),
  // otherwise a new promise is created on every render.
  const commentsPromise = useMemo(() => fetchComments(id), [id]);
  return (
    <Suspense fallback={<p>Loading comments…</p>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}

// use() can also read context, and unlike useContext it may be called inside if/loops
function Panel({ show }) {
  if (!show) return null;
  const theme = use(ThemeContext);
  return <div className={theme}>…</div>;
}
```

## 💻 Code Example — `ref` as a Prop (No More `forwardRef`)

```jsx
// React 19
function TextInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

// Parent
const inputRef = useRef(null);
<TextInput ref={inputRef} />;
inputRef.current.focus();
```

## 💻 Code Example — Document Metadata

```jsx
function ProductPage({ product }) {
  return (
    <>
      <title>{`${product.name} | ShopLite`}</title>
      <meta name="description" content={product.summary} />
      <h1>{product.name}</h1>
    </>
  );
}
// React hoists <title> and <meta> into <head>.
```

## 🔍 Server Components (RSC) — The Mental Model

| | Server Component (default in Next.js App Router) | Client Component (`"use client"`) |
|---|---|---|
| Runs | On the server only (build or request time) | On the server for HTML **and** in the browser |
| Can use | `async/await`, DB, file system, secrets | State, effects, event handlers, browser APIs |
| Ships JS to browser | ❌ No | ✅ Yes |
| Can import | Server and client components | Only client components |

```jsx
// app/products/page.jsx — Server Component
import { db } from "@/lib/db";
import AddToCart from "./AddToCart";       // a client component

export default async function ProductsPage() {
  const products = await db.product.find().lean();   // direct DB access, no API route
  return products.map((p) => (
    <div key={p._id}>
      {p.name} <AddToCart id={String(p._id)} />
    </div>
  ));
}
```

```jsx
// AddToCart.jsx
"use client";
export default function AddToCart({ id }) {
  return <button onClick={() => addToCart(id)}>Add</button>;
}
```

**Server Actions** (`"use server"`) are functions that run on the server and can be passed to `<form action>` from either kind of component.

> **In a classic MERN app** (Vite + Express API), you will not use Server Components — they need a framework such as Next.js. Actions, `useOptimistic`, `useActionState`, `use` and `ref` as a prop all work in a Vite SPA.

## 🔍 The React Compiler

The compiler analyses components at build time and inserts memoisation automatically, so most hand-written `useMemo`, `useCallback` and `React.memo` become unnecessary. It requires components to follow the *Rules of React* (pure render, no mutating props/state). Until your project enables it, manual memoisation still matters.

## 🌍 Real-World Use

- Login, sign-up and settings forms → `useActionState` + `useFormStatus`.
- Like buttons, cart quantity, chat messages → `useOptimistic`.
- Design-system inputs → `ref` as a prop instead of `forwardRef`.
- Next.js apps → Server Components for data-heavy pages, client components only where interactivity is needed.

## 🎯 Likely Interview Questions

1. **What is new in React 19?**
2. **What is an Action? How does `useActionState` differ from `useState`?**
3. **How does `useOptimistic` roll back on failure?**
4. **What can `use()` do that `useContext` cannot?**
5. **Server Components vs Client Components — what can each do?**
6. **Can you use Server Components in a Vite + Express MERN app?**
7. **What does the React Compiler do? Does it make `useMemo` obsolete?**
8. **How did `forwardRef` change in React 19?**

---

[← Performance Optimization](../02-react/10-performance-optimization.md) | [Index](../README.md) | [Next: Concurrent Rendering & Suspense →](02-concurrent-rendering-suspense.md)
