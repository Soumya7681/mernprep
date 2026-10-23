/**
 * Career roadmap tracks for the dedicated /roadmaps area.
 *
 * This file is the single place to edit when a roadmap changes. The map view,
 * the index cards, the progress percentages, and the sitemap are all derived
 * from it — no other file needs touching to add a track, a stage, or a node.
 *
 * Node ids are the persistence key for study progress (localStorage), so they
 * must stay stable once published. Renaming a node's `label` is safe; renaming
 * its `id` silently resets that node's tick for every existing reader.
 *
 * Long-form narrative, code examples, and interview questions live in the book
 * chapters — a track links to its chapter via `chapter`, and
 * a node links to a specific chapter via `ref`.
 */

import { WEB_TRACKS } from "./tracks/web";

/** How essential a node is. Drives the node's colour in the map. */
export type NodeKind = "core" | "recommended" | "optional";

export type RoadmapNode = {
  /** Stable, globally unique. Used as the localStorage progress key. */
  id: string;
  label: string;
  kind?: NodeKind; // default "core"
  /** One or two sentences shown at the top of the detail panel. */
  summary?: string;
  /** Concrete sub-topics to study. */
  topics?: string[];
  /** Chapter slug inside this book, e.g. "/02-react/03-useeffect". */
  ref?: { href: string; label: string };
  /** External free references. */
  links?: Array<{ href: string; label: string }>;
};

export type RoadmapStage = {
  id: string;
  title: string;
  duration: string;
  goal: string;
  /** Nodes hang off the stage's spine, alternating left and right. */
  nodes: RoadmapNode[];
  /** The artefact that proves the stage is finished. */
  build: string;
};

/**
 * Groups the index page. Add a new one freely — the filter bar is built from
 * whatever categories the tracks actually declare, in CATEGORY_ORDER order.
 */
export type TrackCategory =
  | "AI & ML"
  | "Data"
  | "Web & Mobile"
  | "Platform & Infra"
  | "Security"
  | "Quality & Testing"
  | "Product & Delivery"
  | "Emerging Tech";

export type RoadmapTrack = {
  slug: string;
  title: string;
  shortTitle: string;
  category: TrackCategory;
  /** Two-letter mark used in the index cards and the map header. */
  mark: string;
  tagline: string;
  /** Who hires for it. No salary claims — we would be inventing them. */
  market: string;
  timeline: string;
  entryBar: string;
  /** ISO date of the last content review, shown on the card. */
  updated: string;
  prerequisites: string[];
  stages: RoadmapStage[];
  tools: string[];
  proofOfWork: string[];
  /** Companion long-form chapter, when one has been written for this track. */
  chapter?: { href: string; label: string };
};

export const TRACKS: RoadmapTrack[] = [...WEB_TRACKS];

/** Cross-cutting advice shown on the roadmaps index. */
export const ROADMAP_PRINCIPLES: string[] = [
  "One track at a time. Two half-finished paths read as neither on a CV.",
  "Ship in public. A deployed project beats a certificate in every one of these interviews.",
  "Measure everything you claim — \"faster\" and \"better\" need a number beside them.",
  "Re-read the job ads at every stage. Match your stack and project wording to what the role actually asks for.",
  "Six focused hours a week finishes a track. Twenty hours one weekend a month does not.",
  "Never pay for placement. Every tool here has a free tier or a local equivalent.",
];

export function trackBySlug(slug: string): RoadmapTrack | undefined {
  return TRACKS.find((t) => t.slug === slug);
}

/** Every node id in a track — the denominator for its progress percentage. */
export function trackNodeIds(track: RoadmapTrack): string[] {
  return track.stages.flatMap((stage) => stage.nodes.map((n) => n.id));
}

/** Display order for the filter bar; unlisted categories fall to the end. */
export const CATEGORY_ORDER: TrackCategory[] = [
  "AI & ML",
  "Data",
  "Web & Mobile",
  "Platform & Infra",
  "Security",
  "Quality & Testing",
  "Product & Delivery",
  "Emerging Tech",
];

/** Categories that actually have tracks, with counts, for the filter bar. */
export function trackCategories(): Array<{ name: TrackCategory; count: number }> {
  const counts = new Map<TrackCategory, number>();
  for (const t of TRACKS) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]);
      const bi = CATEGORY_ORDER.indexOf(b[0]);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .map(([name, count]) => ({ name, count }));
}

/** Lowercased haystack for the index search box. Built once per track. */
export function trackSearchText(track: RoadmapTrack): string {
  return [
    track.title,
    track.shortTitle,
    track.category,
    track.tagline,
    track.entryBar,
    ...track.tools,
  ]
    .join(" ")
    .toLowerCase();
}

export function totalNodeCount(): number {
  return TRACKS.reduce((sum, t) => sum + trackNodeIds(t).length, 0);
}
