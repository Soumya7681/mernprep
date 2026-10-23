import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoadmapMap from "@/components/RoadmapMap";
import { TRACKS, trackBySlug, trackNodeIds } from "@/lib/roadmaps";
import { SITE_NAME } from "@/lib/site";

export function generateStaticParams() {
  return TRACKS.map((track) => ({ slug: track.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const track = trackBySlug(slug);
  if (!track) return { title: "Roadmap not found" };

  const description = `${track.tagline} ${track.stages.length}-stage roadmap with ${
    trackNodeIds(track).length
  } topics, prerequisites, tools and portfolio projects.`;

  // "AI Engineer Roadmap · Prep Book" was ~205px — under the width Google
  // allows. Add the value proposition, with a guard for the longer role names.
  const long = `${track.title} Roadmap — Skills, Stages & Projects`;
  const title = long.length <= 56 ? long : `${track.title} Roadmap & Study Plan`;

  return {
    title,
    description,
    alternates: { canonical: `/roadmaps/${track.slug}/` },
    openGraph: {
      title: `${track.title} Roadmap`,
      description,
      url: `/roadmaps/${track.slug}/`,
      type: "article",
      siteName: SITE_NAME,
    },
  };
}

export default async function RoadmapTrackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const track = trackBySlug(slug);
  if (!track) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `${track.title} roadmap`,
    description: track.tagline,
    totalTime: track.timeline,
    step: track.stages.map((stage, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: stage.title,
      text: `${stage.goal} Topics: ${stage.nodes.map((n) => n.label).join(", ")}.`,
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
        <span className="breadcrumb-current">{track.shortTitle}</span>
      </div>
      <RoadmapMap track={track} />
    </>
  );
}
