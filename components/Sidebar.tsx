"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MANIFEST } from "@/lib/manifest";
import { COMPILER_URL } from "@/lib/site";
import { TRACKS } from "@/lib/roadmaps";
import { ChevronRight, Code2, ExternalLink, Map as MapIcon, Search } from "lucide-react";

function slugHref(folder: string, file: string) {
  const base = file.replace(/\.md$/, "").toLowerCase();
  if (!folder && base === "readme") return "/start";
  return folder ? `/${folder}/${base}` : `/${base}`;
}

function withActiveSection(
  prev: Record<string, boolean>,
  pathname: string,
): Record<string, boolean> {
  const next = { ...prev };
  MANIFEST.forEach((sec) => {
    const hasActive = sec.chapters.some((ch) => {
      const href = slugHref(sec.folder, ch.file);
      return pathname === href || pathname === href + "/";
    });
    if (hasActive) next[sec.title] = true;
  });
  // Default to expanding the first section if nothing is expanded
  if (Object.keys(next).length === 0) next[MANIFEST[0].title] = true;
  return next;
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock background scroll when the mobile drawer is open
  useEffect(() => {
    document.body.classList.toggle("has-drawer-open", open);
    return () => document.body.classList.remove("has-drawer-open");
  }, [open]);

  // Auto-expand the section containing the active path. Adjusted during render
  // when the path changes (React's "storing information from previous renders"
  // pattern) rather than in an effect, which would render twice.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    withActiveSection({}, pathname),
  );
  const [expandedFor, setExpandedFor] = useState(pathname);
  if (expandedFor !== pathname) {
    setExpandedFor(pathname);
    setExpanded((prev) => withActiveSection(prev, pathname));
  }

  const toggleSection = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isSearching = q.length > 0;

  const showPractice =
    !q || ["practice", "playground", "compiler", "javascript", "js"].some((k) => k.includes(q) || q.includes(k));

  // The roadmap area is not part of MANIFEST (it is data-driven, not markdown)
  // and is deliberately one entry, not one per track: the catalogue is meant to
  // grow, and the sidebar is for the book. Track names still match the search so
  // typing "backend" surfaces the way in.
  const showRoadmaps =
    !q ||
    "roadmaps career tracks".includes(q) ||
    TRACKS.some(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.shortTitle.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );

  const sections = MANIFEST.map((sec) => {
    const matched = sec.chapters.filter(
      (ch) =>
        !q ||
        ch.title.toLowerCase().includes(q) ||
        sec.title.toLowerCase().includes(q),
    );
    return { ...sec, matched };
  }).filter((s) => s.matched.length > 0);

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}

      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Chapters">
        <label className="search-field">
          <Search className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapters"
            aria-label="Search chapters"
            className="search-input"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        {(showRoadmaps || showPractice) && (
          <div className="section-group">
            {showRoadmaps && (
              <Link
                href="/roadmaps"
                className={`chap-link chap-link-tool ${
                  pathname === "/roadmaps" || pathname.startsWith("/roadmaps/") ? "is-active" : ""
                }`}
              >
                <MapIcon className="chap-icon" aria-hidden="true" />
                <span>Career roadmaps</span>
              </Link>
            )}
            {showPractice && (
              <>
                <Link
                  href="/playground"
                  className={`chap-link chap-link-tool ${
                    pathname === "/playground" || pathname === "/playground/" ? "is-active" : ""
                  }`}
                >
                  <Code2 className="chap-icon" aria-hidden="true" />
                  <span>JS playground</span>
                </Link>
                <a
                  href={COMPILER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chap-link chap-link-tool"
                >
                  <ExternalLink className="chap-icon" aria-hidden="true" />
                  <span>Online compiler</span>
                </a>
              </>
            )}
          </div>
        )}

        {sections.length === 0 && !showPractice && !showRoadmaps && (
          <p className="sidebar-empty">No chapters match &ldquo;{query}&rdquo;.</p>
        )}

        {sections.map((sec) => {
          const isExpanded = isSearching || expanded[sec.title];

          return (
            <div key={sec.title} className="section-group">
              <button
                type="button"
                className="section-label"
                aria-expanded={isExpanded}
                onClick={() => toggleSection(sec.title)}
                disabled={isSearching}
              >
                <ChevronRight
                  className={`section-caret${isExpanded ? " is-open" : ""}`}
                  aria-hidden="true"
                />
                <span className="section-title">{sec.title}</span>
                <span className="section-badge">{sec.matched.length}</span>
              </button>

              {isExpanded && (
                <div className="section-items">
                  {sec.matched.map((ch) => {
                    const href = slugHref(sec.folder, ch.file);
                    const isActive = pathname === href || pathname === href + "/";

                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`chap-link ${isActive ? "is-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="chap-num">{ch.num}</span>
                        <span>{ch.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </aside>
    </>
  );
}
