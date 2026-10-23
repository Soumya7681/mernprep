import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { Marked } from "marked";
import hljs from "highlight.js";
import { FLAT, FlatChapter } from "./manifest";
import { COMPILER_URL } from "./site";

// Languages that can be run in the JavaScript online compiler.
const RUNNABLE_LANGS = new Set(["javascript", "js", "jsx", "ts", "tsx", "typescript", "node"]);

// Markdown lives at the Next.js project root (same folder as package.json)
const ROOT = process.cwd();

const marked = new Marked({
  gfm: true,
  breaks: false,
});

// Custom renderer to highlight code blocks + rewrite internal .md links
const renderer = {
  code({ text, lang }: { text: string; lang?: string }) {
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
    const runnable = RUNNABLE_LANGS.has((lang || "").toLowerCase());
    const toolbar = `<div class="code-toolbar"><span class="code-lang">${language}</span>${
      runnable
        ? `<a class="code-run" href="${COMPILER_URL}" target="_blank" rel="noopener noreferrer">Run in compiler ↗</a>`
        : ""
    }</div>`;
    return `<div class="code-block">${toolbar}<pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
  },
  // h2/h3 get stable ids so the "On this page" rail and shared links can
  // target them. Ids are de-duplicated per document (see preprocess below).
  heading(this: { parser: { parseInline(t: unknown[]): string } }, { tokens, depth, text }: { tokens: unknown[]; depth: number; text: string }) {
    const inner = this.parser.parseInline(tokens);
    if (depth !== 2 && depth !== 3) return `<h${depth}>${inner}</h${depth}>\n`;
    const base =
      text
        .toLowerCase()
        .replace(/<[^>]+>|`/g, "")
        .replace(/&[a-z]+;/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
    const n = headingIds.get(base) ?? 0;
    headingIds.set(base, n + 1);
    const id = n ? `${base}-${n}` : base;
    return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
  },
};
// parse() is synchronous, so resetting at preprocess cannot interleave
// between two documents.
const headingIds = new Map<string, number>();
marked.use({
  renderer,
  hooks: {
    preprocess(md: string) {
      headingIds.clear();
      return md;
    },
  },
});

/**
 * The site is exported with `trailingSlash: true`, so every internal URL the
 * host serves ends in a slash. Markdown authors write "/02-react/03-useeffect" and
 * "/readme", which land on a redirect (or a 404 for /readme, which is served
 * at /start). Crawlers then report those links as broken or as canonicalised
 * to a different URL, so normalise them at render time.
 */
function normaliseInternal(path: string): string {
  const [, pathname, suffix] = path.match(/^([^#?]*)([\s\S]*)$/) as RegExpMatchArray;
  const base = pathname.replace(/\/+$/, "");
  if (base === "") return "/" + suffix;
  // README is published at /start, matching slugHref() used across the app.
  if (base.toLowerCase() === "/readme") return "/start/" + suffix;
  return base + "/" + suffix;
}

function rewriteHref(href: string, currentPath: string): string {
  if (!href) return href;
  if (/^https?:/i.test(href)) return href;
  if (href.startsWith("#") || href.startsWith("mailto:")) return href;

  // Already an absolute site path: normalise rather than resolve.
  if (href.startsWith("/")) return normaliseInternal(href);

  // Resolve relative path against current file's folder
  const baseSegments = currentPath.split("/").slice(0, -1);
  const refSegments = href.split("/");
  const out = [...baseSegments];
  for (const seg of refSegments) {
    if (seg === "..") out.pop();
    else if (seg !== ".") out.push(seg);
  }
  const resolved = out.join("/");

  // Only rewrite if it points to a known chapter
  const match = FLAT.find((f) => f.path.toLowerCase() === resolved.toLowerCase());
  if (!match) return href;

  return normaliseInternal("/" + match.slug.join("/"));
}

function rewriteLinks(html: string, currentPath: string): string {
  return html.replace(
    /<a\s+([^>]*?)href="([^"]+)"([^>]*)>/g,
    (full, before, href, after) => {
      const newHref = rewriteHref(href, currentPath);
      return `<a ${before}href="${newHref}"${after}>`;
    },
  );
}

// Wrap every <table>…</table> so it can scroll horizontally on small screens
function wrapTables(html: string): string {
  return html.replace(
    /<table\b[\s\S]*?<\/table>/g,
    (m) => `<div class="md-table-wrap">${m}</div>`,
  );
}

export async function loadChapterHtml(chapter: FlatChapter): Promise<string> {
  const filePath = path.join(ROOT, chapter.path);
  const md = await fs.readFile(filePath, "utf8");
  const html = await marked.parse(md);
  return wrapTables(rewriteLinks(html as string, chapter.path));
}

export async function loadReadme(): Promise<string> {
  const md = await fs.readFile(path.join(ROOT, "README.md"), "utf8");
  const html = await marked.parse(md);
  return wrapTables(rewriteLinks(html as string, "README.md"));
}

export function pagerFor(chapter: FlatChapter) {
  const idx = FLAT.findIndex((f) => f.slug.join("/") === chapter.slug.join("/"));
  return {
    prev: idx > 0 ? FLAT[idx - 1] : null,
    next: idx >= 0 && idx < FLAT.length - 1 ? FLAT[idx + 1] : null,
  };
}

/**
 * h2/h3 entries for the "On this page" rail, read back out of rendered HTML so
 * the ids always match the ones the heading renderer emitted.
 */
export function tocFromHtml(html: string): Array<{ id: string; text: string; level: 2 | 3 }> {
  const out: Array<{ id: string; text: string; level: 2 | 3 }> = [];
  const re = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  for (const m of html.matchAll(re)) {
    const text = m[3]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Chapter headings lead with an emoji; it is noise in a nav list.
      .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "")
      .trim();
    if (text) out.push({ id: m[2], text, level: m[1] === "2" ? 2 : 3 });
  }
  return out;
}
