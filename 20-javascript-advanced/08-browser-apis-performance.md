# Chapter 22 — Browser APIs & Web Performance

## 📖 Definition

The browser exposes APIs beyond the JavaScript language itself: the DOM, events, storage, networking (`fetch`, CORS), observers, and background threads (Web Workers). **Web performance** is how quickly a page loads and responds, measured by Google's **Core Web Vitals**.

## 🔍 Critical Rendering Path

```text
HTML → DOM ─┐
            ├→ Render tree → Layout (reflow) → Paint → Composite
CSS  → CSSOM┘
```

- CSS is **render-blocking**; a `<script>` without `defer`/`async` is **parser-blocking**.
- `defer`: download in parallel, run after parsing, in order. `async`: download in parallel, run as soon as ready, in any order.
- **Reflow** (layout) is expensive; it is triggered by changing geometry (width, top, font-size) or by *reading* layout (`offsetHeight`) right after writing. **Repaint** is cheaper (colour). `transform` and `opacity` only need compositing — use them for animation.

## 🔍 Core Web Vitals

| Metric | Measures | Good | Common fixes |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | Loading | ≤ 2.5 s | Optimise hero image, preload, SSR, CDN |
| **INP** — Interaction to Next Paint | Responsiveness | ≤ 200 ms | Break up long tasks, `useTransition`, Web Workers |
| **CLS** — Cumulative Layout Shift | Visual stability | ≤ 0.1 | Set width/height on images, reserve space for ads |

## 💻 Code Example — Event Delegation

```js
// ❌ One listener per row (1,000 rows → 1,000 listeners)
// ✅ One listener on the parent, using bubbling
document.querySelector("#todo-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.closest("li").dataset.id;
  if (btn.dataset.action === "delete") deleteTodo(id);
  if (btn.dataset.action === "toggle") toggleTodo(id);
});
```

Works for elements added later, too. React itself delegates all events to the root container.

## 💻 Code Example — Avoid Layout Thrashing

```js
// ❌ Read-write-read-write forces a reflow on every iteration
items.forEach((el) => { el.style.width = el.offsetWidth + 10 + "px"; });

// ✅ Batch reads, then writes
const widths = items.map((el) => el.offsetWidth);
items.forEach((el, i) => { el.style.width = widths[i] + 10 + "px"; });

// ✅ Schedule visual updates for the next frame
requestAnimationFrame(() => { box.style.transform = `translateX(${x}px)`; });
```

## 💻 Code Example — IntersectionObserver (Lazy Load, Infinite Scroll)

```js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    });
  },
  { rootMargin: "200px" },          // start loading 200px before visible
);

document.querySelectorAll("img[data-src]").forEach((img) => observer.observe(img));
// Simple case: <img loading="lazy" src="..." width="400" height="300">
```

## 💻 Code Example — Web Worker for Heavy Computation

```js
// worker.js
self.onmessage = ({ data }) => {
  const result = data.rows.filter((r) => r.amount > 1000).sort((a, b) => b.amount - a.amount);
  self.postMessage(result);
};

// main.js
const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
worker.postMessage({ rows: hugeArray });
worker.onmessage = ({ data }) => render(data);   // UI stays responsive meanwhile
```

Workers have no DOM access; data is copied using the structured clone algorithm (or transferred with `Transferable`s like `ArrayBuffer`).

## 💻 Code Example — Storage Options

| | Capacity | Lifetime | Sent to server | Accessible from JS |
|---|---|---|---|---|
| Cookie | ~4 KB | Set by `Expires`/`Max-Age` | ✅ every request | ❌ if `HttpOnly` |
| `localStorage` | ~5–10 MB | Until cleared | ❌ | ✅ (sync, main thread) |
| `sessionStorage` | ~5 MB | Tab lifetime | ❌ | ✅ |
| IndexedDB | Large (quota-based) | Until cleared | ❌ | ✅ (async) |
| Cache API | Large | Until cleared | ❌ | ✅ (service workers) |

**Security:** never store access tokens in `localStorage` if you can avoid it — any XSS can read it. Prefer an `HttpOnly; Secure; SameSite` cookie for the refresh token.

## 🔍 CORS in One Picture

```text
Browser on https://app.com  ──fetch──▶  https://api.com
   1. Is it a "simple" request (GET/POST, simple headers)? → send it, check response headers
   2. Otherwise send a PREFLIGHT:  OPTIONS /orders
        Origin: https://app.com
        Access-Control-Request-Method: PUT
        Access-Control-Request-Headers: authorization, content-type
   3. Server must answer:
        Access-Control-Allow-Origin: https://app.com
        Access-Control-Allow-Methods: GET, POST, PUT
        Access-Control-Allow-Headers: authorization, content-type
        Access-Control-Allow-Credentials: true   (if cookies are sent)
```

```js
// Express
import cors from "cors";
app.use(cors({ origin: ["https://app.com"], credentials: true }));
```

CORS is enforced **by the browser**, not the server — Postman and curl ignore it. With `credentials: true`, `Allow-Origin` cannot be `*`.

## 💻 Code Example — Measuring Performance

```js
performance.mark("start-render");
renderDashboard();
performance.mark("end-render");
performance.measure("render", "start-render", "end-render");
console.log(performance.getEntriesByName("render")[0].duration);

// Long tasks (>50 ms) block input
new PerformanceObserver((list) => {
  list.getEntries().forEach((e) => console.warn("Long task", e.duration));
}).observe({ type: "longtask", buffered: true });
```

## 🌍 Real-World Use

- Product grid with thousands of images → `loading="lazy"`, explicit dimensions (CLS), modern formats (WebP/AVIF).
- Excel import parsed in the browser → Web Worker so the UI does not freeze.
- Infinite scroll feed → IntersectionObserver on a sentinel element.
- "Works in Postman but not in the browser" → CORS configuration.

## 🎯 Likely Interview Questions

1. **Explain the critical rendering path.**
2. **Difference between `async` and `defer`?**
3. **What is reflow vs repaint? How do you avoid layout thrashing?**
4. **What is event delegation and why is it efficient?**
5. **What are the Core Web Vitals and how do you improve each?**
6. **Cookies vs localStorage vs sessionStorage — where would you store a JWT?**
7. **What is CORS? What is a preflight request? Why does the request work in Postman?**
8. **When would you use a Web Worker?**

---

[← Advanced Async Patterns](07-async-advanced.md) | [Index](../README.md) | [Next: Functional Components →](../02-react/01-functional-components.md)
