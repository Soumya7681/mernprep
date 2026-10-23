import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DSA_PATH } from "./manifest";

const ROOT = process.cwd();

export type DsaItem = { id: number; label: string };
export type DsaCategory = { title: string; items: DsaItem[] };

export type DsaContent = {
  title: string;        // the document's H1
  intro: string;        // plain-text lines between the H1 and the first category
  categories: DsaCategory[];
  total: number;        // total number of checklist items
};

// Matches "- [ ] 12. Two Sum" (or "- [x] ...") and captures the number + label.
const ITEM_RE = /^[-*]\s*\[[ xX]?\]\s*(\d+)\.\s*(.+?)\s*$/;

/**
 * Parse the DSA markdown into structured data so it can be rendered as an
 * interactive checklist. We deliberately do NOT run it through `marked` —
 * the checkboxes need to be real, stateful inputs, not static HTML.
 */
export async function loadDsaContent(): Promise<DsaContent> {
  const md = await fs.readFile(path.join(ROOT, DSA_PATH), "utf8");
  const lines = md.split(/\r?\n/);

  let title = "Coding Question Tracker";
  const introLines: string[] = [];
  const categories: DsaCategory[] = [];
  let current: DsaCategory | null = null;
  let total = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h1 = /^#\s+(.+)/.exec(line);
    if (h1) {
      title = h1[1].trim();
      continue;
    }

    const h2 = /^##\s+(.+)/.exec(line);
    if (h2) {
      current = { title: h2[1].trim(), items: [] };
      categories.push(current);
      continue;
    }

    const item = ITEM_RE.exec(line);
    if (item && current) {
      current.items.push({ id: Number(item[1]), label: item[2].trim() });
      total += 1;
      continue;
    }

    // Collect a little intro prose (skip dividers, blanks, and leftover markdown).
    if (!current && line && !/^[-=#>*]/.test(line)) {
      const clean = line.replace(/\*\*/g, "").replace(/[`_]/g, "").trim();
      if (clean) introLines.push(clean);
    }
  }

  // Drop empty categories (e.g. a trailing heading with no items).
  const filtered = categories.filter((c) => c.items.length > 0);

  return { title, intro: introLines.join(" "), categories: filtered, total };
}
