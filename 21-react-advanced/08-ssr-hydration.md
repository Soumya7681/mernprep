# Chapter 39 — SSR, Hydration & Rendering Strategies

## 📖 Definition

- **Server-Side Rendering (SSR)**: React renders components to an **HTML string or stream on the server**, so the browser can show content before any JavaScript runs.
- **Hydration**: the browser downloads the same React code, renders the same tree in memory, and **attaches event handlers and state to the existing server HTML** instead of recreating the DOM.
- **Hydration mismatch**: the HTML the client renders differs from what the server sent. React has to throw away the server HTML for that part and re-render on the client.

## 🔍 Explanation

### Rendering Strategies Compared

| Strategy | HTML produced | When | Good for | Trade-offs |
|----------|---------------|------|----------|------------|
| **CSR** (Client-Side Rendering) | Empty `<div id="root">` | In the browser | Dashboards behind login | Blank page until JS loads, weaker SEO |
| **SSR** | Full HTML | Every request | Personalised and frequently changing pages | Server cost, slower TTFB |
| **SSG** (Static Site Generation) | Full HTML | At build time | Docs, blogs, marketing | Content stale until next build |
| **ISR** (Incremental Static Regeneration) | Full HTML | Build + revalidate in background | Product pages, large catalogues | Briefly stale content |
| **Streaming SSR** | HTML in chunks | Per request, progressively | Pages with slow data sections | Needs Suspense boundaries |
| **RSC** (React Server Components) | Serialized component tree (+ HTML via SSR) | On the server | Data-heavy pages with less client JS | Needs a framework (Next.js) |

### The SSR + Hydration Timeline

```
Server: fetch data → render HTML → send
Browser: ── HTML arrives → FCP (user sees content, can't interact)
         ── JS bundle downloads + parses
         ── hydrateRoot(): React renders, matches DOM, attaches listeners
         ── TTI (page is interactive)
```

The gap between "visible" and "interactive" is sometimes called the **uncanny valley**: buttons are on screen but clicks do nothing. Reducing JS size, streaming and selective hydration all shrink this gap.

### SSR ≠ Server Components

| | SSR | React Server Components |
|---|---|---|
| What runs on server | **All** components, once, to produce HTML | Only server components, and they **never** run in the browser |
| JS shipped for those components | ✅ Yes, they hydrate | ❌ No |
| Can use state and effects | ✅ (after hydration) | ❌ |
| Output | HTML | RSC payload (serialized tree), which is usually also SSR'd to HTML |

They are complementary. Next.js App Router uses both: server components cut client JS, and SSR gives fast first paint for the client components.

## 💻 Code Example — Minimal SSR with Express

```jsx
// server.jsx
import express from "express";
import { renderToPipeableStream } from "react-dom/server";
import App from "./App.jsx";

const app = express();
app.use(express.static("dist/client"));

app.get("*", (req, res) => {
  const { pipe } = renderToPipeableStream(<App url={req.url} />, {
    bootstrapScripts: ["/client.js"],          // client bundle that hydrates
    onShellReady() {
      res.setHeader("Content-Type", "text/html");
      pipe(res);                               // start streaming as soon as the shell is ready
    },
    onShellError() {
      res.status(500).send("<h1>Something went wrong</h1>");
    },
    onError(err) {
      console.error(err);
    },
  });
});

app.listen(3000);
```

```jsx
// client.jsx
import { hydrateRoot } from "react-dom/client";
import App from "./App.jsx";

hydrateRoot(document, <App url={location.pathname} />);
```

### Server Rendering APIs

| API | Environment | Streams | Notes |
|-----|-------------|---------|-------|
| `renderToString` | Any | ❌ | Legacy. Waits for everything, no Suspense streaming |
| `renderToPipeableStream` | Node.js | ✅ | Use with Express / Node HTTP |
| `renderToReadableStream` | Web streams (Deno, Bun, edge, Workers) | ✅ | Returns a promise of a `ReadableStream` |
| `prerender` / `prerenderToNodeStream` (React 19) | Build time | — | Static generation that waits for all data |

In practice you rarely call these yourself: Next.js, Remix/React Router and Astro do it for you. Interviewers still like you to know what happens underneath.

## 💻 Code Example — Common Hydration Mismatches

```jsx
// ❌ 1. Values that differ between server and client
function Footer() {
  return <p>Rendered at {new Date().toLocaleTimeString()}</p>;   // time and locale differ
}

// ❌ 2. Branching on the environment during render
function Banner() {
  if (typeof window !== "undefined" && window.innerWidth < 600) return <MobileBanner />;
  return <DesktopBanner />;      // server always renders Desktop, mobile client renders Mobile
}

// ❌ 3. Random values or IDs
const id = Math.random().toString(36);    // use useId() instead

// ❌ 4. Reading browser storage in render
const theme = localStorage.getItem("theme");    // crashes on the server, differs on the client

// ❌ 5. Invalid HTML nesting: the browser "fixes" the server HTML so the DOM differs
<p><div>Block inside paragraph</div></p>      // browser closes <p> early
<table><tr>…</tr></table>                      // browser inserts <tbody>
```

Browser extensions (password managers, translators, Grammarly) that edit the DOM before hydration can cause mismatch warnings too. Those are not bugs in your code.

### What React Does on a Mismatch

React 18+ discards the server HTML up to the nearest `<Suspense>` boundary (or the root) and **client-renders** that part, reporting a recoverable error. React 19 logs a single error with a **diff** of the mismatched content. The page still works, but you lose the benefit of SSR there and may see a flash. Treat these errors as bugs.

## 💻 Code Example — Fixing Mismatches

### Fix 1 — Move client-only values into an effect

```jsx
function LocalTime({ iso }) {
  const [text, setText] = useState(iso);             // server + first client render match
  useEffect(() => {
    setText(new Date(iso).toLocaleTimeString());      // update after hydration
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
```

### Fix 2 — Two-pass rendering with a "has mounted" flag

```jsx
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function ThemeToggle() {
  const isClient = useIsClient();
  if (!isClient) return <button aria-busy>Theme</button>;   // same on server and first client pass
  return <button>{localStorage.getItem("theme") ?? "light"}</button>;
}
```

### Fix 3 — `suppressHydrationWarning` (narrow escape hatch)

```jsx
<time suppressHydrationWarning>{new Date().toLocaleTimeString()}</time>
```

It only applies **one level deep** to that element's attributes and text content. Use it for unavoidable differences such as timestamps, not to hide real bugs.

### Fix 4 — Skip SSR for a component (Next.js)

```jsx
"use client";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), { ssr: false });    // browser-only library
```

### Fix 5 — Use CSS for responsive layout, not `window.innerWidth`

```jsx
<>
  <MobileBanner className="md:hidden" />
  <DesktopBanner className="hidden md:block" />
</>
```

## 💻 Code Example — Streaming + Selective Hydration

```jsx
export default function ProductPage() {
  return (
    <Layout>
      <ProductDetails />                         {/* fast: in the first chunk */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />                              {/* slow data: streamed later */}
      </Suspense>
      <Suspense fallback={<RecsSkeleton />}>
        <Recommendations />
      </Suspense>
    </Layout>
  );
}
```

1. The server sends the shell with skeletons immediately.
2. As each data source resolves, React streams that section's HTML plus a tiny inline script that swaps it into place.
3. On the client, **each Suspense boundary hydrates independently**. If the user clicks inside `Reviews` before it hydrates, React **prioritises hydrating that boundary** (selective hydration) and replays the click.

## 📊 Core Web Vitals and SSR

| Metric | Meaning | How SSR / streaming helps |
|--------|---------|---------------------------|
| **TTFB** (Time to First Byte) | Server response time | Streaming sends the shell early, while plain SSR waits for all data |
| **FCP / LCP** (First / Largest Contentful Paint) | When content appears | HTML arrives already rendered |
| **INP** (Interaction to Next Paint) | Responsiveness to input | Selective hydration + smaller bundles (RSC) |
| **CLS** (Cumulative Layout Shift) | Visual stability | Server HTML with sized skeletons avoids jumps |

## 🌍 Real-World Impact

- For a MERN app, CSR (Vite + React) is fine for authenticated dashboards. Use Next.js SSR/SSG when SEO or first-load speed on public pages matters.
- Keep render output **deterministic**: no time, randomness, `window` or storage reads during render.
- Wrap slow sections in `<Suspense>` so streaming and selective hydration can work.
- Watch the console for hydration errors in development. Each one means part of the page lost SSR.

## 🎯 Likely Interview Questions

1. **What is hydration?** — React attaches event listeners and state to server-rendered HTML by rendering the same tree on the client and matching it against the existing DOM.
2. **CSR vs SSR vs SSG vs ISR?** — Where and when the HTML is produced: browser, each request, build time, or build time with background revalidation.
3. **What causes hydration mismatches and how do you fix them?** — Non-deterministic render output (dates, random values, `window` checks, storage), invalid HTML nesting, and extensions. Fix by moving client-only values to effects, using `useId`, two-pass rendering, CSS for responsiveness, or `ssr: false`.
4. **What happens when hydration fails?** — React client-renders up to the nearest Suspense boundary and reports a recoverable error.
5. **`renderToString` vs `renderToPipeableStream`?** — The first waits for the whole tree and can't stream Suspense. The second streams HTML as boundaries resolve.
6. **What is selective hydration?** — With streaming, Suspense boundaries hydrate independently, and React prioritises the boundary the user interacts with.
7. **SSR vs React Server Components?** — SSR renders all components to HTML and then hydrates them. RSC components run only on the server and ship no JS. They are used together.
8. **What does `suppressHydrationWarning` do?** — It silences mismatch warnings for one element's text and attributes. It is an escape hatch for unavoidable differences.
9. **Why is a page visible but not clickable for a moment?** — HTML has arrived but hydration hasn't finished (the uncanny valley). Reduce JS, stream, and use selective hydration.

---

[← Concurrent Rendering & Suspense](02-concurrent-rendering-suspense.md) | [Index](../README.md) | [Next: Advanced Component Patterns →](03-advanced-patterns.md)
