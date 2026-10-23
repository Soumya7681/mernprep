# Chapter 10 — Event Bubbling, Capturing & Delegation

## 📖 Definitions

- **Event bubbling** — an event triggered on a child propagates **upward** through its ancestors.
- **Event capturing** — the opposite direction; from root down to the target.
- **Event delegation** — attaching one listener on a parent and relying on bubbling to handle events from many descendants.

## 🔍 Explanation

When you click an element, the event travels through three phases:
1. **Capture phase** — root → target (top-down).
2. **Target phase** — at the actual clicked element.
3. **Bubble phase** — target → root (bottom-up).

By default, `addEventListener` listens in the **bubble** phase. Pass `true` (or `{ capture: true }`) to listen in the capture phase.

## 💻 Code Example — Bubbling

```html
<div id="outer">
  <div id="inner">
    <button id="btn">Click me</button>
  </div>
</div>
```

```js
document.getElementById("outer").addEventListener("click", () => console.log("outer"));
document.getElementById("inner").addEventListener("click", () => console.log("inner"));
document.getElementById("btn").addEventListener("click",   () => console.log("btn"));

// Clicking the button logs: btn → inner → outer  (bubbling)
```

## 💻 Code Example — Capturing

```js
document.getElementById("outer").addEventListener("click",
  () => console.log("outer"), true);  // capture
document.getElementById("inner").addEventListener("click",
  () => console.log("inner"), true);
document.getElementById("btn").addEventListener("click",
  () => console.log("btn"));

// Output on click: outer → inner → btn  (capture goes top-down)
```

## 💻 Code Example — Stopping Propagation

```js
document.getElementById("btn").addEventListener("click", (e) => {
  console.log("btn");
  e.stopPropagation();          // prevents outer/inner from firing
});

// Now clicking the button logs only: btn
```

`e.stopImmediatePropagation()` also prevents other listeners on the **same** element.

## 💻 Code Example — Event Delegation

```html
<ul id="list">
  <li data-id="1">One</li>
  <li data-id="2">Two</li>
  <li data-id="3">Three</li>
</ul>
```

```js
// One listener handles all <li> clicks — even ones added later
document.getElementById("list").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  console.log("Clicked id:", li.dataset.id);
});

// Dynamically add — still works without re-binding
document.getElementById("list").insertAdjacentHTML(
  "beforeend", `<li data-id="4">Four</li>`
);
```

### Benefits of Delegation
- 1 listener instead of N → less memory.
- Works for elements added **after** the listener is attached.
- Easier to clean up.

## 💻 Code Example — `preventDefault`

```js
document.querySelector("a").addEventListener("click", (e) => {
  e.preventDefault();           // stop navigation
  console.log("Link clicked but blocked");
});

document.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();           // stop full-page form submit
  // ...submit via fetch
});
```

## 💻 Code Example — Once / Passive Options

```js
button.addEventListener("click", handler, { once: true }); // auto-removes after first call

window.addEventListener("scroll", onScroll, { passive: true });
// `passive: true` tells the browser the handler will not call preventDefault,
// allowing it to scroll without waiting → smoother performance.
```

## 🌍 Real-World Impact

- In React, **synthetic events** are delegated to the root container automatically.
- Tables, lists, and large grids should use event delegation for performance.
- `passive` listeners are crucial for scroll/touch performance on mobile.

## 🎯 Likely Interview Questions

1. **Event bubbling vs capturing.**
2. **What is event delegation and why use it?**
3. **Difference between `stopPropagation` and `preventDefault`?**
   - `stopPropagation` — stops the event from traveling further along the chain.
   - `preventDefault` — cancels the browser's default action (navigation, form submit, etc.).
4. **How does React handle events under the hood?** — Synthetic event system, delegated to the root.

---

[← Equality](06-equality.md) | [Index](../README.md) | [Next: Array Methods →](08-array-methods.md)
