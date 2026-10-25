# Chapter 44 — Frontend Security & Accessibility

## 📖 Definition

**Frontend security** is protecting users from attacks that run through the browser: cross-site scripting (XSS), cross-site request forgery (CSRF), token theft, clickjacking and leaked secrets. **Accessibility (a11y)** is making the app usable by everyone, including people using screen readers, keyboards only, or with low vision — following the **WCAG** guidelines.

## 🔍 XSS in React

React escapes values rendered in JSX, so `<div>{userInput}</div>` is safe. XSS still happens through:

| Hole | Example |
|---|---|
| `dangerouslySetInnerHTML` | Rendering user-written HTML (comments, rich text) |
| `href` / `src` with user data | `<a href={user.website}>` where website is `javascript:alert(1)` |
| Direct DOM APIs | `ref.current.innerHTML = …`, `document.write` |
| Server-rendered state | Injecting `JSON.stringify(state)` into a `<script>` without escaping `</script>` |
| Third-party scripts | A compromised analytics or chat widget |

## 💻 Code Example — Safe Rich Text and URLs

```jsx
import DOMPurify from "dompurify";

function Comment({ html }) {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ["b", "i", "a", "p", "ul", "li"] });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

function safeUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
}
<a href={safeUrl(user.website)} rel="noopener noreferrer" target="_blank">Website</a>;
```

## 🔍 Where to Store Tokens

| Option | XSS can steal it? | CSRF risk? | Notes |
|---|---|---|---|
| `localStorage` | ✅ Yes | No | Simple, but any injected script reads it |
| In-memory (JS variable) | Harder (lost on refresh) | No | Pair with a refresh cookie |
| `HttpOnly; Secure; SameSite` cookie | ❌ No | Mitigated by `SameSite=Lax/Strict` + CSRF token | Recommended for refresh tokens |

**Common production setup:** short-lived access token (≈15 min) kept in memory; long-lived refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, rotated on every refresh.

## 💻 Code Example — Silent Refresh With an Axios Interceptor

```js
let accessToken = null;
let refreshing = null;

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) throw error;
    original._retry = true;

    // Share one refresh call between all requests that failed at the same time
    refreshing ??= axios
      .post("/api/auth/refresh", null, { withCredentials: true })
      .then((r) => (accessToken = r.data.accessToken))
      .finally(() => (refreshing = null));

    await refreshing;
    return api(original);
  },
);
```

## 🔍 Other Frontend Security Essentials

- **CSRF:** with cookies, use `SameSite` and a CSRF token for state-changing requests; never change state on `GET`.
- **Content-Security-Policy** header: restrict where scripts can load from (`script-src 'self'`), the strongest XSS defence-in-depth.
- **Clickjacking:** `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`.
- **Secrets:** anything in the frontend bundle is public. `VITE_*` / `NEXT_PUBLIC_*` env vars are shipped to the browser — never put API secrets there.
- **Dependencies:** `npm audit`, Dependabot/Renovate, lockfiles, and Subresource Integrity for CDN scripts.
- **`target="_blank"`:** add `rel="noopener noreferrer"` (modern browsers imply `noopener`, but be explicit).

## 🔍 Accessibility Essentials

| Rule | How |
|---|---|
| Use semantic HTML | `<button>`, `<nav>`, `<main>`, `<label>` — not clickable `<div>`s |
| Every input has a label | `<label htmlFor="email">` or `aria-label` |
| Images have alt text | `alt="Red running shoe"`; decorative: `alt=""` |
| Keyboard works everywhere | Tab order, visible focus, `Enter`/`Space` activate, `Esc` closes |
| Colour contrast | ≥ 4.5:1 for body text |
| Announce dynamic changes | `role="alert"` or `aria-live="polite"` |
| Manage focus | Move focus into a modal, trap it there, return it on close |
| Don't rely on colour alone | Error = red **and** an icon/text |

## 💻 Code Example — Accessible Custom Button and Modal Focus

```jsx
// ❌ Not keyboard accessible, not announced as a button
<div onClick={save}>Save</div>

// ✅
<button type="button" onClick={save}>Save</button>

// Icon-only button needs a name
<button aria-label="Delete item" onClick={onDelete}><TrashIcon aria-hidden="true" /></button>
```

```jsx
function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    ref.current?.focus();
    return () => previouslyFocused?.focus();     // return focus on close
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabIndex={-1} ref={ref}
         onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <h2 id="dlg-title">{title}</h2>
      {children}
    </div>,
    document.body,
  );
}
// Or use the native <dialog> element with showModal(), which handles focus trapping.
```

## 💻 Code Example — Testing Accessibility

```jsx
import { axe } from "vitest-axe";

test("form has no a11y violations", async () => {
  const { container } = render(<SignupForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

Also use Lighthouse, the axe DevTools extension, and try your app with only the keyboard and a screen reader (NVDA, VoiceOver).

## 🌍 Real-World Use

- Blog/comment features → sanitise with DOMPurify, enforce a CSP.
- Auth → access token in memory, refresh token in an `HttpOnly` cookie, silent refresh interceptor.
- Government, banking and enterprise clients often require WCAG 2.1 AA compliance contractually.

## 🎯 Likely Interview Questions

1. **Is React safe from XSS by default? Where can XSS still happen?**
2. **Where should you store a JWT on the frontend and why?**
3. **What is CSRF and how does `SameSite` help?**
4. **What is a Content-Security-Policy?**
5. **Are environment variables in a React build secret?** — No.
6. **How do you implement silent token refresh without firing multiple refresh calls?**
7. **Name five accessibility practices you follow.**
8. **How do you make a custom modal accessible?**

---

[← Testing React Apps](06-testing-react.md) | [Index](../README.md) | [Next: Redux Core Concepts →](../16-redux/01-redux-core-concepts.md)
