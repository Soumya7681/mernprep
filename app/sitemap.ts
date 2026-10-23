import type { MetadataRoute } from "next";
import { FLAT } from "@/lib/manifest";
import { SITE_URL } from "@/lib/site";
import { TRACKS } from "@/lib/roadmaps";

// Static export emits this as /sitemap.xml at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_URL}${path}`;

  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "monthly", priority: 1 },
    { url: url("/start/"), changeFrequency: "weekly", priority: 0.9 },
    { url: url("/playground/"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/roadmaps/"), changeFrequency: "weekly", priority: 0.9 },
    // One entry per roadmap track — the area is updated more often than chapters.
    ...TRACKS.map((track) => ({
      url: url(`/roadmaps/${track.slug}/`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  const chapterPages: MetadataRoute.Sitemap = FLAT
    // README is served at /start, not under its own slug.
    .filter((f) => f.path !== "README.md")
    .map((f) => ({
      url: url(`/${f.slug.join("/")}/`),
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  return [...staticPages, ...chapterPages];
}
