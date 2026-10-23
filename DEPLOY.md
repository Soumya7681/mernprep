# Deploy to Cloudflare Pages

This project is a Next.js app that **statically exports** to plain HTML/JS/CSS. After `npm run build` it produces an `out/` folder you can host on any static host. Cloudflare Pages is recommended (free tier, fast global CDN, no cold starts).

---

## Option A — Connect a Git Repository (recommended)

1. Push this folder to a new GitHub/GitLab repository:
   ```bash
   git init
   git add .
   git commit -m "Prep book site"
   gh repo create prep-book --public --source=. --remote=origin --push
   # (or create on github.com and `git push` manually)
   ```

2. Sign in to <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.

3. Pick the repository. Configure:

   | Field | Value |
   |-------|-------|
   | Framework preset | **Next.js (Static HTML Export)** |
   | Build command | `npm run build` |
   | Build output directory | `out` |
   | Root directory | (leave empty) |
   | Node version | `20` or newer — set env var `NODE_VERSION=20` |

4. Click **Save and Deploy**. First build takes ~2–3 min. Every `git push` redeploys automatically.

---

## Option B — Direct Upload (no Git)

1. Build locally:
   ```bash
   npm install
   npm run build
   ```

2. In Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.

3. Drag the `out/` folder onto the page. Done.

---

## Option C — Wrangler CLI

```bash
npm install -g wrangler
npm run build
wrangler pages deploy out --project-name prep-book
```

---

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

## Local production preview

```bash
npm run build
npx serve out        # static preview at http://localhost:3000
```

---

## What gets shipped

After `next build` the `out/` folder contains:

```
out/
├── index.html                      ← README rendered as the home page
├── 404.html
├── 01-javascript/
│   ├── 01-closures/index.html
│   ├── 02-hoisting/index.html
│   └── …
├── 02-react/
├── …
├── _next/                          ← bundled JS/CSS
├── favicon.ico
└── …
```

Everything is pre-rendered HTML — no Node runtime needed at the edge. Cloudflare Pages just serves the files.

---

## Adding or editing chapters

1. Add the new `.md` file inside its section folder (e.g. `02-react/12-new-topic.md`).
2. Register it in `lib/manifest.ts` — append a new entry to the matching section's `chapters` array.
3. `npm run dev` to preview locally, then `git push` to redeploy.

That's it — the dynamic route `app/[...slug]/page.tsx` picks up new manifest entries automatically.
