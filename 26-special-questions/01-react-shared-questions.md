# Chapter 121 — React: 40 Shared Interview Questions

## 📖 How to Use This Chapter

These 40 React questions were shared in the **MERN STACK TI** WhatsApp group (17 Oct 2026). Each answer is kept short and simple, so you can read it once and say it in your own words. For more detail, see the **React** and **React Advanced** sections.

---

## 🧱 Basics (1–10)

### 1. What is React? What are its benefits?

React is a JavaScript library for building user interfaces. You build the UI from small pieces called **components**.

**Benefits:**
- Reusable components.
- Fast updates: React changes only the parts of the page that changed.
- Easy to understand: data flows one way, from parent to child.
- Huge community and many libraries.

### 2. React Node vs React Element vs React Component?

- **Component:** a function that returns UI. `function Button() { ... }`
- **Element:** what you get when you write JSX. `<Button />` is an element: a small object that describes what to show.
- **Node:** anything React can show: an element, text, a number, `null` or an array.

Simple way to remember: the component is the recipe, the element is one dish, and a node is anything you can put on the plate.

### 3. What is JSX and how does it work?

JSX lets you write HTML-like code inside JavaScript.

```jsx
const el = <h1>Hello, {name}</h1>;
```

The browser doesn't understand JSX, so a tool like Babel converts it into normal JavaScript function calls that create React elements.

### 4. State vs props?

- **Props** are passed **from the parent**. The child can only read them.
- **State** belongs to the component itself and can change. When state changes, the component re-renders.

```jsx
function Counter({ step }) {               // step = prop
  const [count, setCount] = useState(0);   // count = state
  return <button onClick={() => setCount(count + step)}>{count}</button>;
}
```

### 5. What is the purpose of the `key` prop?

When you show a list, `key` helps React know **which item is which**. Then React can update, add or remove the right item.

```jsx
{users.map(user => <li key={user.id}>{user.name}</li>)}
```

Use a unique, stable value like an ID.

### 6. What happens if you use the array index as the key?

If items are added, removed or reordered, the indexes change. React then mixes up items, for example:
- text typed in one row's input shows up in another row
- the wrong item gets updated.

Using the index is OK only when the list never changes.

### 7. Controlled vs uncontrolled components?

- **Controlled:** React state holds the input value.
- **Uncontrolled:** the browser holds the value, and you read it with a `ref` when needed.

```jsx
// Controlled
<input value={name} onChange={e => setName(e.target.value)} />

// Uncontrolled
<input ref={inputRef} />   // read inputRef.current.value later
```

Controlled is easier for validation. Uncontrolled needs less code.

### 8. What are the pitfalls of using Context?

- When the context value changes, **every component using it re-renders**.
- Passing a new object every render (`value={{ user }}`) causes extra re-renders.
- It is not good for values that change very often, like typed text.
- Components that use context are harder to reuse outside the provider.

### 9. What are the benefits of hooks?

- You can use state and side effects in **function components**, with no classes.
- You can share logic with **custom hooks** (for example `useFetch`).
- Less code, and related code stays together.

### 10. What are the rules of hooks?

1. Call hooks **only at the top level**. Never inside `if`, loops or nested functions.
2. Call hooks **only from React function components or custom hooks**.

React tracks hooks by the order they are called, so the order must stay the same on every render.

---

## 🪝 Hooks (11–20)

### 11. `useEffect` vs `useLayoutEffect`?

- `useEffect` runs **after** the screen is painted. Use it for most things: API calls, timers, subscriptions.
- `useLayoutEffect` runs **before** the screen is painted. Use it only when you need to measure the DOM (size, position) and adjust it without a flicker.

Default to `useEffect`.

### 12. Why use the callback form of `setState`?

Use it when the new state depends on the old state:

```jsx
setCount(count + 1);       // uses the old value from this render
setCount(c => c + 1);      // always uses the latest value ✅
```

If you call `setCount(count + 1)` twice, count goes up by only 1. With `c => c + 1` twice, it goes up by 2.

### 13. What does the `useEffect` dependency array do?

It decides **when the effect runs**:

| Dependency array | Runs |
|---|---|
| None | After every render |
| `[]` | Only once, after the first render |
| `[id]` | After the first render and whenever `id` changes |

If you forget a dependency, the effect may use old values.

### 14. What is `useRef` and when do you use it?

`useRef` gives you a box (`ref.current`) that keeps its value between renders. **Changing it does not cause a re-render.**

Use it to:
- access a DOM element (focus an input)
- store values like a timer ID.

```jsx
const inputRef = useRef(null);
<input ref={inputRef} />
inputRef.current.focus();
```

### 15. What is `useCallback` and when do you use it?

`useCallback` keeps the **same function** between renders, instead of creating a new one each time.

```jsx
const handleClick = useCallback(() => doSomething(id), [id]);
```

Use it when you pass the function to a child wrapped in `React.memo`, or when the function is a `useEffect` dependency. Don't use it everywhere.

### 16. What is `useMemo` and when do you use it?

`useMemo` saves the **result of a calculation** and recalculates only when its inputs change.

```jsx
const filtered = useMemo(() => products.filter(p => p.price < 500), [products]);
```

Use it for slow calculations. `useCallback` saves a function; `useMemo` saves a value.

### 17. What is `useReducer` and when do you use it?

`useReducer` is like `useState`, but for more complex state. You send **actions**, and a **reducer** function decides the new state.

```jsx
function reducer(state, action) {
  if (action.type === "increment") return { count: state.count + 1 };
  if (action.type === "reset") return { count: 0 };
  return state;
}
const [state, dispatch] = useReducer(reducer, { count: 0 });
dispatch({ type: "increment" });
```

Use it when you have many related state values or complex update logic.

### 18. What is `useId` and when do you use it?

`useId` creates a **unique ID** that is the same on the server and the client. Use it to connect a label to an input.

```jsx
const id = useId();
<label htmlFor={id}>Email</label>
<input id={id} />
```

Don't use it for list keys.

### 19. What does re-rendering mean?

Re-rendering means React **runs your component function again** to see if the UI should change. Then it updates only what actually changed on the page.

A component re-renders when:
- its state changes
- its parent re-renders
- a context it uses changes.

### 20. What are Fragments used for?

Fragments let you return several elements **without adding an extra `<div>`**.

```jsx
return (
  <>
    <h1>Title</h1>
    <p>Text</p>
  </>
);
```

Use `<React.Fragment key={id}>` when you need a key in a list.

---

## 🧩 Components & Patterns (21–30)

### 21. What is `forwardRef()` used for?

It lets a parent pass a `ref` down to a DOM element inside a child component.

```jsx
const MyInput = forwardRef((props, ref) => <input ref={ref} {...props} />);
```

In **React 19**, `ref` is a normal prop, so you don't need `forwardRef` anymore:

```jsx
function MyInput({ ref, ...props }) { return <input ref={ref} {...props} />; }
```

### 22. How do you reset a component's state?

- The easiest way: **change its `key`**. React creates a fresh component with fresh state.
  ```jsx
  <Form key={userId} />
  ```
- Or set the state back to its starting value: `setForm(initialForm)`.

### 23. Why should you not mutate state directly?

React checks whether state changed by comparing references (is it a new object?). If you change the same object, React thinks **nothing changed** and doesn't update the screen.

```jsx
items.push(newItem); setItems(items);   // ❌ same array, no update
setItems([...items, newItem]);          // ✅ new array
```

### 24. What are error boundaries for?

An error boundary catches errors in the components inside it and shows a **fallback UI** instead of crashing the whole app.

```jsx
<ErrorBoundary fallback={<p>Something went wrong</p>}>
  <Dashboard />
</ErrorBoundary>
```

It must be a class component (or use the `react-error-boundary` package). It does **not** catch errors in event handlers or async code; use `try/catch` there.

### 25. How do you test React apps?

- **Jest** or **Vitest** to run tests.
- **React Testing Library** to render components and act like a user (click, type).
- **Playwright** or **Cypress** for end-to-end tests in a real browser.

```jsx
render(<Counter />);
await userEvent.click(screen.getByText("+"));
expect(screen.getByText("1")).toBeInTheDocument();
```

### 26. What is hydration?

With server-side rendering, the server sends ready HTML so the page shows fast. **Hydration** is when React loads in the browser and **attaches event handlers to that HTML**, making it interactive.

If the server HTML and the client render don't match (for example, using `Date.now()`), you get a hydration error.

### 27. What are Portals used for?

A Portal renders a component **somewhere else in the DOM**, usually `document.body`, while it still behaves like part of its parent.

```jsx
createPortal(<div className="modal">Hello</div>, document.body);
```

Use it for modals, tooltips and popups, so a parent's CSS (like `overflow: hidden`) doesn't cut them off.

### 28. How do you debug React apps?

- **React DevTools:** see props, state and hooks. The Profiler shows slow renders.
- **Browser DevTools:** console, breakpoints, network tab.
- Read React's warnings in the console.
- `console.log` inside the component.
- **Sentry** (or similar) for errors in production.

### 29. What is StrictMode and what are its benefits?

`<StrictMode>` is a **development-only** helper. It finds bugs early by:
- rendering components twice
- running effects twice, to catch missing cleanup
- warning about old, unsafe APIs.

It does nothing in production.

### 30. How do you localise a React app (multiple languages)?

Use a library like **react-i18next**. Keep text in JSON files per language and use the `t()` function.

```jsx
// en.json: { "hello": "Hello" }   hi.json: { "hello": "नमस्ते" }
const { t, i18n } = useTranslation();
<h1>{t("hello")}</h1>
<button onClick={() => i18n.changeLanguage("hi")}>Hindi</button>
```

Use `Intl` to format dates and currency for each language.

---

## 🚀 Data & Rendering (31–40)

### 31. What is code splitting?

Code splitting means **loading code only when it's needed**, instead of one big file. The page loads faster.

```jsx
const Admin = lazy(() => import("./Admin"));
<Suspense fallback={<p>Loading...</p>}><Admin /></Suspense>
```

### 32. How do you reduce re-renders caused by Context?

- Wrap the value in `useMemo` so it doesn't change on every render.
- Split one big context into smaller ones (for example, user and theme separately).
- Keep the provider close to the components that need it.
- For data that changes often, use Redux or Zustand instead.

### 33. What are Higher-Order Components (HOCs)?

A HOC is a function that **takes a component and returns a new component** with extra features.

```jsx
function withAuth(Component) {
  return function (props) {
    if (!isLoggedIn()) return <Login />;
    return <Component {...props} />;
  };
}
const SafeDashboard = withAuth(Dashboard);
```

Today, custom hooks are usually used instead.

### 34. What is the Flux pattern and its benefits?

Flux is a way of managing data where it flows **in one direction**:

```
Action → Dispatcher → Store → View → (user does something) → Action
```

**Benefit:** state changes are predictable and easy to debug. Redux is based on Flux.

### 35. What is one-way data flow, and what are its benefits?

Data goes **from parent to child** through props. A child can't change props directly. It calls a function the parent gave it, and the parent updates its state.

**Benefits:** easy to see where data comes from, easier to debug, fewer surprises.

### 36. How do you load data asynchronously in React?

Use `useEffect` with loading and error states:

```jsx
useEffect(() => {
  setLoading(true);
  fetch("/api/users")
    .then(res => res.json())
    .then(data => setUsers(data))
    .catch(err => setError(err))
    .finally(() => setLoading(false));
}, []);
```

In real apps, **TanStack Query** or **RTK Query** is better: they handle caching, loading and retries for you.

### 37. What is server-side rendering (SSR) and its benefits?

With SSR, the **server builds the HTML** for each request and sends it to the browser. Then React hydrates it (see Q26).

**Benefits:**
- The page shows faster.
- Better SEO, because search engines see the full content.

**Downside:** more work for the server. Next.js makes SSR easy.

### 38. What is static generation (SSG) and its benefits?

With SSG, HTML pages are built **once, at build time**, and served as files from a CDN.

**Benefits:** very fast, cheap to host, good for SEO.

**Downside:** data only updates when you rebuild. Good for blogs, docs and landing pages.

### 39. What is the presentational vs container component pattern?

- **Container:** gets the data and handles logic.
- **Presentational:** only shows the UI using props.

```jsx
function UserListContainer() {
  const users = useUsers();            // logic
  return <UserList users={users} />;
}
function UserList({ users }) {         // UI only
  return users.map(u => <p key={u.id}>{u.name}</p>);
}
```

Today, custom hooks often play the container's role.

### 40. What are common mistakes when fetching data in React?

- **No loading or error state.**
- **Race condition:** an old response arrives late and overwrites new data. Fix: cancel it with `AbortController` in the cleanup.
- **Infinite loop:** a wrong dependency array keeps re-running the effect.
- **Not checking `res.ok`:** `fetch` doesn't throw on 404 or 500.
- **Making `useEffect` itself `async`:** write an async function inside the effect instead.
- **No caching:** use TanStack Query or RTK Query.

```jsx
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal }).then(r => r.json()).then(setData);
  return () => controller.abort();   // cancel on change or unmount
}, [url]);
```

---

## ✅ Quick Revision

- Props come from the parent; state belongs to the component.
- Use a stable `id` as `key`, not the index.
- Hooks go at the top level only.
- `useEffect` runs after paint; `useLayoutEffect` runs before paint.
- Never mutate state; create a new object or array.
- `useMemo` saves a value, `useCallback` saves a function, `useRef` keeps a value without re-rendering.
- SSR builds HTML per request, SSG builds it at build time, and hydration makes it interactive.

---

[← Git, Agile, Testing & Deployment](../18-mern-interview/08-git-agile-deployment-questions.md) | [Index](../README.md) | [Next: Node.js: Shared Interview Questions →](02-node-shared-questions.md)
