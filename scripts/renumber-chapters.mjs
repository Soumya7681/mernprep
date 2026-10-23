/**
 * Keeps chapter files in step with lib/manifest.ts:
 *   1. rewrites each "# Chapter N — Title" heading to the manifest number
 *   2. regenerates the "← Previous | Index | Next →" footer line
 *
 * Run after reordering or adding chapters: node scripts/renumber-chapters.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { posix as path } from "node:path";

const src = readFileSync("lib/manifest.ts", "utf8");
const body = src.slice(src.indexOf("export const MANIFEST"), src.indexOf("export const DSA_PATH"));

const chapters = [];
for (const sec of body.matchAll(/folder:\s*"([^"]*)",\s*chapters:\s*\[([\s\S]*?)\n\s*\],/g)) {
  const [, folder, list] = sec;
  for (const m of list.matchAll(/num:\s*"([^"]+)",\s*file:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)"/g)) {
    const [, num, file] = m;
    const title = JSON.parse(`"${m[3]}"`).replace(/`/g, "");
    chapters.push({ num, title, path: folder ? `${folder}/${file}` : file });
  }
}

const book = chapters.filter((c) => c.path !== "README.md");
const rel = (from, to) => path.relative(path.dirname(from), to) || path.basename(to);
const FOOTER = /\n---\n\n\[(?:←|Index)[^\n]*\n*$/;
// Rendered as an interactive checklist by lib/dsa.ts, not as markdown.
const DSA_PATH = body.match(/DSA_PATH = "([^"]+)"/)?.[1] ?? src.match(/DSA_PATH = "([^"]+)"/)[1];

let changed = 0;
book.forEach((ch, i) => {
  let md = readFileSync(ch.path, "utf8");
  const before = md;

  // 1. Heading: only files that already use the "Chapter" convention
  md = md.replace(/^# Chapter[^—\n]*—\s*/, `# Chapter ${ch.num} — `);

  // 2. Footer
  if (ch.path === DSA_PATH) {
    if (FOOTER.test(md)) md = md.replace(FOOTER, "\n");
    if (md !== before) { writeFileSync(ch.path, md); changed++; }
    return;
  }
  const prev = book[i - 1];
  const next = book[i + 1];
  const parts = [
    prev ? `[← ${prev.title}](${rel(ch.path, prev.path)})` : `[← Back to Index](${rel(ch.path, "README.md")})`,
    ...(prev ? [`[Index](${rel(ch.path, "README.md")})`] : []),
    ...(next ? [`[Next: ${next.title} →](${rel(ch.path, next.path)})`] : []),
  ];
  const footer = `\n---\n\n${parts.join(" | ")}\n`;
  md = FOOTER.test(md) ? md.replace(FOOTER, footer) : md.replace(/\s*$/, "\n") + footer;

  if (md !== before) {
    writeFileSync(ch.path, md);
    changed++;
  }
});

console.log(`${book.length} chapters checked, ${changed} updated.`);
