"use client";

import { useMemo, useState } from "react";
import type { DsaCategory } from "@/lib/dsa";
import { DSA_DETAILS } from "@/lib/dsa-details";
import { useDsaProgress, toggleDsa, clearDsa } from "@/lib/progress";
import { ChevronRight } from "lucide-react";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="pbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="pbar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DsaChecklist({
  categories,
  total,
}: {
  categories: DsaCategory[];
  total: number;
}) {
  // External store: empty on the server, real values on the client after
  // hydration (handled by useSyncExternalStore — no flicker, no effect).
  const checked = useDsaProgress();
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCollapse = (title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const reset = () => {
    if (!window.confirm("Clear all checked questions? This can't be undone.")) return;
    clearDsa();
  };

  const doneCount = useMemo(
    () => categories.reduce((sum, c) => sum + c.items.filter((i) => checked.has(i.id)).length, 0),
    [categories, checked],
  );

  return (
    <div className="dsa">
      <section className="dsa-overall" aria-label="Overall progress">
        <div className="dsa-overall-top">
          <span className="dsa-overall-count">
            <strong>{doneCount}</strong> of {total} solved
          </span>
          <span className="dsa-overall-pct">
            {total ? Math.round((doneCount / total) * 100) : 0}%
          </span>
        </div>
        <ProgressBar done={doneCount} total={total} />
        <div className="dsa-toolbar">
          <label className="dsa-switch">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
            />
            Hide completed
          </label>
          <button type="button" className="dsa-reset" onClick={reset} disabled={doneCount === 0}>
            Reset progress
          </button>
        </div>
      </section>

      {categories.map((cat) => {
        const catDone = cat.items.filter((i) => checked.has(i.id)).length;
        const isCollapsed = collapsed.has(cat.title);
        const visibleItems = hideDone
          ? cat.items.filter((i) => !checked.has(i.id))
          : cat.items;
        const allDone = catDone === cat.items.length;

        // When hiding completed, skip fully-finished categories entirely.
        if (hideDone && visibleItems.length === 0) return null;

        return (
          <section key={cat.title} className="dsa-cat">
            {/* The heading wraps the control, per the ARIA accordion pattern.
                It also gives the page the <h2> section structure it lacked. */}
            <h2 className="dsa-cat-heading">
            <button
              type="button"
              className="dsa-cat-head"
              aria-expanded={!isCollapsed}
              onClick={() => toggleCollapse(cat.title)}
            >
              <ChevronRight className={`dsa-caret ${isCollapsed ? "is-collapsed" : ""}`} aria-hidden="true" />
              <span className="dsa-cat-title">{cat.title}</span>
              <span className={`dsa-cat-count ${allDone ? "is-complete" : ""}`}>
                {catDone}/{cat.items.length}
              </span>
              <span className="dsa-cat-bar">
                <ProgressBar done={catDone} total={cat.items.length} />
              </span>
            </button>
            </h2>

            {!isCollapsed && (
              <ul className="dsa-list">
                {visibleItems.map((item) => {
                  const isChecked = checked.has(item.id);
                  const detail = DSA_DETAILS[item.id];
                  const isOpen = expanded.has(item.id);
                  return (
                    <li key={item.id}>
                      <div
                        className={`dsa-row ${isChecked ? "is-done" : ""} ${detail ? "is-clickable" : ""}`}
                        role={detail ? "button" : undefined}
                        tabIndex={detail ? 0 : undefined}
                        aria-expanded={detail ? isOpen : undefined}
                        onClick={() => detail && toggleExpand(item.id)}
                        onKeyDown={(e) => {
                          if (detail && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            toggleExpand(item.id);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDsa(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Mark "${item.label}" solved`}
                        />
                        <span className="dsa-row-num">{item.id}</span>
                        <span className="dsa-row-label">{item.label}</span>
                        {detail && (
                          <ChevronRight className={`dsa-row-caret ${isOpen ? "is-open" : ""}`} aria-hidden="true" />
                        )}
                      </div>

                      {detail && isOpen && (
                        <div className="dsa-detail">
                          <p className="dsa-d-statement">{detail.statement}</p>
                          <div className="dsa-d-example">
                            <div className="dsa-d-line">
                              <span className="dsa-d-key">Input</span>
                              <code>{detail.input}</code>
                            </div>
                            <div className="dsa-d-line">
                              <span className="dsa-d-key">Output</span>
                              <code>{detail.output}</code>
                            </div>
                            <div className="dsa-d-line">
                              <span className="dsa-d-key">Why</span>
                              <span>{detail.why}</span>
                            </div>
                          </div>
                          <p className="dsa-d-approach">
                            <span className="dsa-d-key">Approach</span>
                            <span>{detail.approach}</span>
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
