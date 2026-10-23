"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import {
  TRACKS,
  trackCategories,
  trackNodeIds,
  trackSearchText,
  type RoadmapTrack,
  type TrackCategory,
} from "@/lib/roadmaps";
import { clearRoadmapProgress, useRoadmapProgress } from "@/lib/progress";
import { ArrowRight } from "lucide-react";

/**
 * Track cards for /roadmaps. Client-side because each card shows live progress
 * from localStorage; the copy itself is static and comes from lib/roadmaps.ts.
 *
 * Built to stay usable as the catalogue grows: a flat grid works at six tracks
 * and is unusable at two hundred, so browsing is search + category + sort, and
 * results are revealed a page at a time rather than all at once.
 */

const PAGE = 24;

type Sort = "default" | "az" | "shortest" | "progress";

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "default", label: "Suggested" },
  { value: "az", label: "A–Z" },
  { value: "shortest", label: "Shortest first" },
  { value: "progress", label: "My progress" },
];

/** Leading number of months in "6-9 months part-time", for the duration sort. */
function months(track: RoadmapTrack): number {
  const m = track.timeline.match(/\d+/);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
}

export default function RoadmapIndex() {
  const done = useRoadmapProgress();
  const totalDone = done.size;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TrackCategory | "all">("all");
  const [sort, setSort] = useState<Sort>("default");
  const [shown, setShown] = useState(PAGE);

  // Keeps typing responsive once the catalogue is large.
  const deferredQuery = useDeferredValue(query);
  const categories = useMemo(() => trackCategories(), []);

  // Search text is derived from static data, so it is built once, not per keystroke.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of TRACKS) map.set(t.slug, trackSearchText(t));
    return map;
  }, []);

  const progressOf = (track: RoadmapTrack) => {
    const ids = trackNodeIds(track);
    const doneCount = ids.filter((id) => done.has(id)).length;
    return {
      ids,
      doneCount,
      pct: ids.length ? Math.round((doneCount / ids.length) * 100) : 0,
    };
  };

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let list = TRACKS.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (haystacks.get(t.slug) ?? "").includes(q);
    });

    if (sort === "az") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "shortest") {
      list = [...list].sort((a, b) => months(a) - months(b));
    } else if (sort === "progress") {
      list = [...list].sort((a, b) => progressOf(b).pct - progressOf(a).pct);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery, category, sort, haystacks, done]);

  const visible = results.slice(0, shown);
  const remaining = results.length - visible.length;

  // Tracks already underway, surfaced above the catalogue so they are never
  // buried once there are hundreds of cards.
  const inProgress = useMemo(
    () => TRACKS.filter((t) => progressOf(t).doneCount > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [done],
  );

  const resetBrowse = () => {
    setQuery("");
    setCategory("all");
    setSort("default");
    setShown(PAGE);
  };

  const renderCard = (track: RoadmapTrack) => {
    const { ids, doneCount, pct } = progressOf(track);
    return (
      <Link
        key={track.slug}
        href={`/roadmaps/${track.slug}`}
        className={`rmi-card${doneCount > 0 ? " is-started" : ""}`}
      >
        <div className="rmi-card-head">
          <span className="rm-mark rmi-mark" aria-hidden>
            {track.mark}
          </span>
          <div className="rmi-card-heading">
            <h3 className="rmi-card-title">{track.title}</h3>
            {/* Timeline alone on this line: the old combined meta string
                wrapped mid-phrase in every card. */}
            <p className="rmi-card-meta">{track.timeline}</p>
          </div>
          <ArrowRight className="rmi-card-go" aria-hidden="true" />
        </div>

        <p className="rmi-card-tagline">{track.tagline}</p>

        <div className="rmi-card-foot">
          <div className="rmi-card-stats">
            <span className="rmi-card-cat">{track.category}</span>
            <span>
              <strong>{ids.length}</strong> topics
            </span>
            <span className="rmi-card-pct">
              {doneCount > 0 ? `${doneCount}/${ids.length} done` : "Not started"}
            </span>
          </div>
          <div
            className="pbar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${track.title} progress`}
          >
            <div className="pbar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      {inProgress.length > 0 && (
        <section className="rmi-section" aria-labelledby="rmi-continue">
          <div className="rmi-section-head">
            <h2 id="rmi-continue" className="rmi-section-title">
              Continue where you left off
            </h2>
            <button type="button" className="rmi-reset-btn" onClick={clearRoadmapProgress}>
              Reset progress
            </button>
          </div>
          <div className="rmi-grid">{inProgress.map(renderCard)}</div>
        </section>
      )}

      <section className="rmi-section" aria-labelledby="rmi-all">
        <h2 id="rmi-all" className="rmi-section-title">
          All roadmaps
        </h2>

        <div className="rmi-browse">
          <input
            type="search"
            className="rmi-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search roadmaps, skills or tools…"
            aria-label="Search roadmaps"
            spellCheck={false}
          />

          <label className="rmi-sort">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort roadmaps"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rmi-cats" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`rmi-cat${category === "all" ? " is-on" : ""}`}
            onClick={() => {
              setCategory("all");
              setShown(PAGE);
            }}
          >
            All <span className="rmi-cat-n">{TRACKS.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`rmi-cat${category === c.name ? " is-on" : ""}`}
              onClick={() => {
                setCategory(c.name);
                setShown(PAGE);
              }}
            >
              {c.name} <span className="rmi-cat-n">{c.count}</span>
            </button>
          ))}
        </div>

        <p className="rmi-count" aria-live="polite">
          {results.length === TRACKS.length
            ? `${TRACKS.length} roadmaps`
            : `${results.length} of ${TRACKS.length} roadmaps`}
        </p>

        {results.length === 0 ? (
          <p className="rmi-empty">
            Nothing matches that.{" "}
            <button type="button" className="rmi-reset-btn" onClick={resetBrowse}>
              Clear filters
            </button>
          </p>
        ) : (
          <>
            <div className="rmi-grid">{visible.map(renderCard)}</div>
            {remaining > 0 && (
              <button
                type="button"
                className="rmi-more"
                onClick={() => setShown((n) => n + PAGE)}
              >
                Show {Math.min(remaining, PAGE)} more · {remaining} left
              </button>
            )}
          </>
        )}
      </section>

      {totalDone > 0 && (
        <p className="rmi-reset">{totalDone} topics marked studied across all roadmaps.</p>
      )}
    </>
  );
}
