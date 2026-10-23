/**
 * Validates the roadmap catalogue.
 *
 * Roadmap data is hand-written and links into the book by path, so a typo
 * produces a 404 that nothing else catches — the build happily renders a dead
 * <Link>. This checks the things TypeScript cannot:
 *
 *   1. every node `ref.href` and track `chapter.href` resolves to a real file
 *   2. node ids are globally unique (they are the localStorage progress key,
 *      so a duplicate silently ties two topics' tick state together)
 *   3. track slugs and two-letter marks are unique
 *
 * Run with: node scripts/check-roadmap-links.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Chapter routes are `/<folder>/<file-without-.md>`, plus a few root pages. */
function buildRouteSet() {
  const routes = new Set(["/start", "/playground", "/roadmaps"]);
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isDirectory() && /^\d\d-/.test(entry.name)) {
      for (const file of readdirSync(join(ROOT, entry.name))) {
        if (file.endsWith(".md")) {
          routes.add(`/${entry.name}/${file.replace(/\.md$/, "")}`);
        }
      }
    } else if (entry.isFile() && /^\d\d-.*\.md$/.test(entry.name)) {
      routes.add(`/${entry.name.replace(/\.md$/, "")}`);
    }
  }
  return routes;
}

function sourceFiles() {
  const files = ["lib/roadmaps.ts"];
  const dir = join(ROOT, "lib/tracks");
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".ts")) files.push(`lib/tracks/${f}`);
    }
  }
  return files;
}

const routes = buildRouteSet();
const errors = [];
const seenNodeIds = new Map();
const seenSlugs = new Map();
const seenMarks = new Map();

for (const file of sourceFiles()) {
  const src = readFileSync(join(ROOT, file), "utf8");

  for (const m of src.matchAll(/href:\s*"(\/[^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith("http")) continue;
    if (!routes.has(href.replace(/\/$/, ""))) {
      errors.push(`${file}: href "${href}" does not resolve to a chapter`);
    }
  }

  for (const m of src.matchAll(/^\s{4,}id:\s*"([^"]+)"/gm)) {
    const id = m[1];
    if (seenNodeIds.has(id)) {
      errors.push(`${file}: duplicate node id "${id}" (also in ${seenNodeIds.get(id)})`);
    } else {
      seenNodeIds.set(id, file);
    }
  }

  for (const m of src.matchAll(/slug:\s*"([^"]+)"/g)) {
    const slug = m[1];
    if (seenSlugs.has(slug)) errors.push(`${file}: duplicate track slug "${slug}"`);
    else seenSlugs.set(slug, file);
  }

  for (const m of src.matchAll(/mark:\s*"([^"]+)"/g)) {
    const mark = m[1];
    if (seenMarks.has(mark)) {
      errors.push(`${file}: duplicate mark "${mark}" (also in ${seenMarks.get(mark)})`);
    } else {
      seenMarks.set(mark, file);
    }
  }
}

console.log(
  `Checked ${seenSlugs.size} tracks, ${seenNodeIds.size} node ids, against ${routes.size} routes.`,
);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("All roadmap links and ids are valid.");
