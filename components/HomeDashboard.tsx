"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MANIFEST } from "@/lib/manifest";
import { useDsaProgress } from "@/lib/progress";

function firstChapterHref(folder: string, file: string) {
  const base = file.replace(/\.md$/, "").toLowerCase();
  if (!folder && base === "readme") return "/start";
  return folder ? `/${folder}/${base}` : `/${base}`;
}

export default function HomeDashboard({ dsaTotal }: { dsaTotal: number }) {
  const checked = useDsaProgress();
  const done = [...checked].filter((id) => id >= 1 && id <= dsaTotal).length;
  const pct = dsaTotal ? Math.round((done / dsaTotal) * 100) : 0;

  // Sections worth linking to (skip the single-page "Getting Started" home entry).
  const sections = MANIFEST.filter((s) => s.title !== "Getting Started");

  return (
    <section className="dash" aria-label="Study overview">
      <h2 className="dash-title">Study dashboard</h2>
      <p className="dash-sub">
        Pick a section to start, or carry on with the DSA tracker. Progress stays in this browser.
      </p>

      <div className="dash-progress">
        <div className="dash-progress-head">
          <div>
            <p className="dash-progress-title">DSA coding tracker</p>
            <p className="dash-progress-count">
              <strong>{done}</strong> of {dsaTotal} questions solved
            </p>
          </div>
          <span className="dash-progress-pct">{pct}%</span>
        </div>
        <div
          className="pbar"
          role="progressbar"
          aria-label="DSA questions solved"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="pbar-fill" style={{ width: `${pct}%` }} />
        </div>
        <Link href="/11-dsa-coding-questions/" className="btn btn-primary btn-sm dash-cta">
          {done ? "Continue tracker" : "Open tracker"}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <h2 className="dash-section-title">Sections</h2>
      <nav className="dash-list" aria-label="Sections">
        {sections.map((sec, i) => {
          const first = sec.chapters[0];
          if (!first) return null;
          return (
            <Link
              key={sec.title}
              href={firstChapterHref(sec.folder, first.file)}
              className="dash-row"
            >
              <span className="dash-row-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="dash-row-title">{sec.title}</span>
              <span className="dash-row-meta">
                {sec.chapters.length} {sec.chapters.length === 1 ? "page" : "pages"}
              </span>
              <ArrowRight className="dash-row-go" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
