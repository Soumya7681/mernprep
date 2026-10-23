"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RoadmapNode, RoadmapStage, RoadmapTrack } from "@/lib/roadmaps";
import {
  setRoadmapNodes,
  toggleRoadmapNode,
  useRoadmapProgress,
} from "@/lib/progress";
import { ArrowRight, ArrowUpRight, Check, X } from "lucide-react";

/**
 * The roadmap.sh-style map for one track: a vertical spine of stages, with
 * nodes branching left and right off it. Clicking a node opens the detail
 * panel; the checkbox marks it studied (persisted in localStorage).
 *
 * Progress is derived, never stored per track — the single node-id set in
 * localStorage is the source of truth, so the index cards and this page can
 * never disagree.
 */
export default function RoadmapMap({ track }: { track: RoadmapTrack }) {
  const done = useRoadmapProgress();
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  // The node button that opened the panel, so focus can go back to it on close.
  const triggerRef = useRef<HTMLElement | null>(null);

  const allIds = useMemo(
    () => track.stages.flatMap((s) => s.nodes.map((n) => n.id)),
    [track],
  );
  const doneCount = allIds.filter((id) => done.has(id)).length;
  const pct = allIds.length ? Math.round((doneCount / allIds.length) * 100) : 0;

  // Plain lookup rather than a memo: the search is over a few dozen nodes and
  // only matters while the panel is open.
  const openNode = findNode(track, openNodeId);

  const open = useCallback((id: string, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setOpenNodeId(id);
  }, []);

  const close = useCallback(() => {
    setOpenNodeId(null);
    // Return focus to the node that opened the panel, or the keyboard user is
    // dropped back at the top of the document.
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  // Escape closes the detail panel — it behaves as a dialog on mobile.
  useEffect(() => {
    if (!openNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNodeId, close]);

  // The scrim eats clicks on the page behind, so the page must not scroll
  // under it either.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "has-rm-detail-open",
      Boolean(openNodeId),
    );
    return () =>
      document.documentElement.classList.remove("has-rm-detail-open");
  }, [openNodeId]);

  return (
    <div className="rm">
      <header className="rm-head">
        <p className="rm-kicker">Career roadmap</p>
        <div className="rm-head-main">
          <span className="rm-mark" aria-hidden>
            {track.mark}
          </span>
          <div>
            <h1 className="rm-title">{track.title}</h1>
            <p className="rm-tagline">{track.tagline}</p>
          </div>
        </div>

        <div className="rm-headbar">
          <dl className="rm-facts">
            <div>
              <dt>Time</dt>
              <dd>{track.timeline}</dd>
            </div>
            <div>
              <dt>Entry bar</dt>
              <dd>{track.entryBar}</dd>
            </div>
            <div>
              <dt>Stages</dt>
              <dd>
                {track.stages.length} · {allIds.length} topics
              </dd>
            </div>
          </dl>

          <div className="rm-progress">
            <div className="rm-progress-row">
              <span>
                <strong>{doneCount}</strong>/{allIds.length} studied
              </span>
              <span className="rm-progress-pct">{pct}%</span>
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
        </div>

        <div className="rm-head-links">
          {/* Only some tracks have a long-form chapter written for them. */}
          {track.chapter && (
            <Link href={track.chapter.href} className="btn btn-secondary btn-sm">
              Read the full guide
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          <Link href="/roadmaps" className="rm-link-quiet">
            All roadmaps
          </Link>
        </div>
      </header>

      <section className="rm-prereq" aria-labelledby="rm-prereq-title">
        <h2 id="rm-prereq-title" className="rm-prereq-label">
          Before you start {track.shortTitle}
        </h2>
        <ul className="rm-chiplist">
          {track.prerequisites.map((p) => (
            <li key={p} className="rm-chip">
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* ============ The map ============ */}
      <div className="rm-map">
        {track.stages.map((stage, stageIndex) => (
          <StageBlock
            key={stage.id}
            stage={stage}
            index={stageIndex}
            done={done}
            activeId={openNodeId}
            onOpen={open}
          />
        ))}
        <div className="rm-spine-end" aria-hidden>
          ▼
        </div>
      </div>

      <section className="rm-after" aria-labelledby="rm-after-title">
        <h2 id="rm-after-title" className="rm-section-title">
          {track.shortTitle} tools on your CV
        </h2>
        <ul className="rm-chiplist">
          {track.tools.map((t) => (
            <li key={t} className="rm-chip rm-chip-mono">
              {t}
            </li>
          ))}
        </ul>

        <h2 className="rm-section-title rm-section-title-spaced">
          What {track.shortTitle} employers ask to see
        </h2>
        <ul className="rm-proof">
          {track.proofOfWork.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>

        <p className="rm-market">{track.market}</p>

        <p className="rm-updated">
          Content last reviewed {track.updated}. Guidance only — no institute or paid placement
          is endorsed anywhere in this book.
        </p>
      </section>

      {openNode && (
        <NodeDetail
          node={openNode.node}
          stage={openNode.stage}
          done={done.has(openNode.node.id)}
          onClose={close}
        />
      )}
    </div>
  );
}

/** Locate a node and its stage by id, or null when nothing is open. */
function findNode(track: RoadmapTrack, nodeId: string | null) {
  if (!nodeId) return null;
  for (const stage of track.stages) {
    const node = stage.nodes.find((n) => n.id === nodeId);
    if (node) return { node, stage };
  }
  return null;
}

function StageBlock({
  stage,
  index,
  done,
  activeId,
  onOpen,
}: {
  stage: RoadmapStage;
  index: number;
  done: ReadonlySet<string>;
  activeId: string | null;
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  const ids = stage.nodes.map((n) => n.id);
  const doneCount = ids.filter((id) => done.has(id)).length;
  const complete = doneCount === ids.length;

  return (
    <section className="rm-stage" aria-labelledby={`${stage.id}-title`}>
      {/* Stage marker sits on the spine; the goal hangs off it as an aside. */}
      <div className="rm-row">
        <div className="rm-stage-head">
          <span className={`rm-stage-num${complete ? " is-complete" : ""}`} aria-hidden>
            {complete ? "\u2713" : index + 1}
          </span>
          <h2 id={`${stage.id}-title`} className="rm-stage-title">
            {stage.title}
          </h2>
          <p className="rm-stage-meta">
            {stage.duration} · {doneCount}/{ids.length} topics
          </p>
          <button
            type="button"
            className="rm-stage-bulk"
            onClick={() => setRoadmapNodes(ids, !complete)}
          >
            {complete ? "Untick stage" : "Tick all"}
          </button>
        </div>
        <p className="rm-stage-goal">{stage.goal}</p>
      </div>

      <ol className="rm-nodes">
        {stage.nodes.map((node) => {
          const isDone = done.has(node.id);
          const kind = node.kind ?? "core";
          const topics = node.topics ?? [];
          return (
            <li key={node.id} className="rm-row rm-node-row">
              {/* Left of the spine: the prose note and the cross-link. */}
              {(node.summary || node.ref) && (
                <div className="rm-aside">
                  {node.summary && <p className="rm-note">{node.summary}</p>}
                  {node.ref && (
                    <Link href={node.ref.href} className="rm-xlink">
                      {node.ref.label}
                    </Link>
                  )}
                </div>
              )}

              <button
                type="button"
                className={[
                  "rm-node",
                  `is-${kind}`,
                  isDone ? "is-done" : "",
                  activeId === node.id ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-haspopup="dialog"
                aria-expanded={activeId === node.id}
                onClick={(e) => onOpen(node.id, e.currentTarget)}
              >
                <span
                  className="rm-node-tick"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Mark ${node.label} studied`}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRoadmapNode(node.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleRoadmapNode(node.id);
                    }
                  }}
                >
                  {isDone ? "\u2713" : ""}
                </span>
                <span className="rm-node-label">{node.label}</span>
                {kind !== "core" && <span className="rm-node-kind">{kind}</span>}
              </button>

              {/* Right of the spine: the sub-topics, on a dotted bracket. */}
              {topics.length > 0 && (
                <ul className="rm-branches">
                  {topics.map((t) => (
                    <li key={t} className="rm-branch">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <div className="rm-row">
        <p className="rm-stage-build">
          <span className="rm-stage-build-tag">Build</span>
          {stage.build}
        </p>
      </div>
    </section>
  );
}

function NodeDetail({
  node,
  stage,
  done,
  onClose,
}: {
  node: RoadmapNode;
  stage: RoadmapStage;
  done: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Move focus into the panel on open, so the next Tab lands inside it rather
  // than in the page hidden behind the scrim.
  useEffect(() => {
    closeRef.current?.focus();
  }, [node.id]);

  // Keep Tab inside the panel while it is open — it is modal, the rest of the
  // page is inert behind the scrim.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const kind = node.kind ?? "core";

  return (
    <>
      <div className="rm-detail-scrim" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        className="rm-detail"
        role="dialog"
        aria-modal="true"
        aria-label={node.label}
        onKeyDown={onKeyDown}
      >
        <div className="rm-detail-grip" aria-hidden />

        <div className="rm-detail-head">
          <div className="rm-detail-headtext">
            <p className="rm-detail-stage">{stage.title}</p>
            <h3 className="rm-detail-title">{node.label}</h3>
            <div className="rm-detail-tags">
              <span className={`rm-detail-tag is-${kind}`}>{kind}</span>
              <span className={`rm-detail-tag is-status${done ? " is-done" : ""}`}>
                {done ? "Studied" : "Not started"}
              </span>
            </div>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="rm-detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="rm-detail-body">
          <button
            type="button"
            className={`rm-detail-toggle${done ? " is-done" : ""}`}
            onClick={() => toggleRoadmapNode(node.id)}
          >
            {done ? (
              <>
                <Check aria-hidden="true" /> Marked studied
              </>
            ) : (
              "Mark as studied"
            )}
          </button>

          {node.summary && <p className="rm-detail-summary">{node.summary}</p>}

          {node.topics && node.topics.length > 0 && (
            <section className="rm-detail-sec">
              <p className="rm-detail-label">Learn</p>
              <ul className="rm-detail-topics">
                {node.topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {node.ref && (
            <section className="rm-detail-sec">
              <p className="rm-detail-label">In this book</p>
              <Link href={node.ref.href} className="rm-detail-ref">
                <span>{node.ref.label}</span>
                <ArrowRight className="rm-detail-go" aria-hidden="true" />
              </Link>
            </section>
          )}

          {node.links && node.links.length > 0 && (
            <section className="rm-detail-sec">
              <p className="rm-detail-label">Free references</p>
              <ul className="rm-detail-links">
                {node.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      <span>{l.label}</span>
                      <ArrowUpRight className="rm-detail-go" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
