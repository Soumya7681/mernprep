import type { Metadata } from "next";
import Link from "next/link";
import RoadmapIndex from "@/components/RoadmapIndex";
import { ROADMAP_PRINCIPLES, TRACKS, totalNodeCount } from "@/lib/roadmaps";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "MERN Career Roadmaps — Frontend, Backend & Full-Stack",
  description:
    "Interactive, stage-by-stage roadmaps for the three roles a MERN developer is hired into: frontend, backend and full-stack engineer. Free, with progress tracking.",
  alternates: { canonical: "/roadmaps/" },
  openGraph: {
    title: "MERN Career Roadmaps",
    description:
      "What to learn, in what order, and what to build — frontend, backend and full-stack engineer.",
    url: "/roadmaps/",
    type: "website",
    siteName: SITE_NAME,
  },
};

export default function RoadmapsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MERN career roadmaps",
    itemListElement: TRACKS.map((track, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${track.title} roadmap`,
      url: `/roadmaps/${track.slug}/`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="breadcrumb">
        <span>Career Roadmaps</span>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <span className="breadcrumb-current">All tracks</span>
      </div>

      <header className="rmi-head">
        <p className="rmi-kicker">
          {TRACKS.length} tracks · {totalNodeCount()} topics
        </p>
        <h1 className="rmi-title">Career Roadmaps</h1>
        <p className="rmi-sub">
          What to learn, in what order, and what to build at each stage — for the
          frontend, backend and full-stack roles a MERN developer is hired into. Tick a topic and your progress is
          kept in this browser.
        </p>
      </header>

      <RoadmapIndex />

      <section className="rmi-rules" aria-labelledby="rmi-rules-title">
        <h2 id="rmi-rules-title" className="rm-section-title">
          Rules that apply to every track
        </h2>
        <ul className="rm-proof">
          {ROADMAP_PRINCIPLES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="rmi-guide-link">
          What employers list for each level, in detail:{" "}
          <Link href="/00-requirements/01-mern-role-requirements">
            Ch 01 — MERN Role Requirements &amp; Skill Matrix
          </Link>
        </p>
      </section>
    </>
  );
}
