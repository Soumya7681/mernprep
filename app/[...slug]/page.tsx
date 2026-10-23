import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FLAT, findBySlug, DSA_PATH, type FlatChapter } from "@/lib/manifest";
import { loadChapterHtml, pagerFor, tocFromHtml } from "@/lib/content";
import { loadDsaContent } from "@/lib/dsa";
import Pager from "@/components/Pager";
import ReadAloud from "@/components/ReadAloud";
import DsaChecklist from "@/components/DsaChecklist";
import Toc from "@/components/Toc";

/**
 * Chapter titles in the manifest are bare nouns ("Scope", "TCS"), which produced
 * titles like "TCS · Prep Book" — far under the pixel width Google allows and
 * carrying no keyword. Build a descriptive title from the section context, with
 * a length guard so the long section names do not overflow the SERP.
 */
function seoTitle(entry: FlatChapter): string {
  const name = entry.title.replace(/`/g, "");
  switch (entry.section) {
    case "Company Specific Questions":
      return `${name} Interview Questions & Answers`;
    case "HR & Behavioral":
      return `${name} — HR Interview Questions`;
    case "Career Roadmaps":
      return `${name} — Career Roadmap Guide`;
    case "Getting Started":
    case "Reference":
    case "DSA & Coding":
      return name;
    default: {
      const withSection = `${name} in ${entry.section} — Interview Questions`;
      return withSection.length <= 58 ? withSection : `${name} — Interview Questions`;
    }
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string[] }> }
): Promise<Metadata> {
  const { slug } = await params;
  const entry = findBySlug(slug);
  if (!entry) return {};

  return {
    title: seoTitle(entry),
    description: `Deep dive into ${entry.title}: Master real-world full-stack concepts, architecture, and coding questions to crack your next interview.`,
    // Every chapter page was shipping without a canonical. Next appends the
    // trailing slash to match `trailingSlash: true`.
    alternates: { canonical: `/${entry.slug.join("/")}` },
  };
}

export async function generateStaticParams() {
  return FLAT
    // Home (README) is served at "/", not under /[...slug]
    .filter((f) => f.path !== "README.md")
    .map((f) => ({ slug: f.slug }));
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const entry = findBySlug(slug);
  if (!entry || entry.path === "README.md") notFound();

  const { prev, next } = pagerFor(entry);

  // The DSA chapter renders as an interactive, progress-tracking checklist
  // rather than static markdown.
  if (entry.path === DSA_PATH) {
    const dsa = await loadDsaContent();
    return (
      <>
        <div className="breadcrumb">
          <span>{entry.section}</span>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">{entry.title}</span>
        </div>
        <article className="md">
          <h1>{dsa.title}</h1>
          {dsa.intro && <p className="dsa-intro">{dsa.intro}</p>}
        </article>
        <DsaChecklist categories={dsa.categories} total={dsa.total} />
        <Pager prev={prev} next={next} />
      </>
    );
  }

  const html = await loadChapterHtml(entry);

  return (
    <div className="doc-layout">
      <div className="doc-main">
        <div className="doc-topbar">
          <div className="breadcrumb">
            <span>{entry.section}</span>
            <span className="breadcrumb-sep" aria-hidden="true">/</span>
            <span className="breadcrumb-current">{entry.title}</span>
          </div>
          <ReadAloud />
        </div>
        <article className="md" dangerouslySetInnerHTML={{ __html: html }} />
        <Pager prev={prev} next={next} />
      </div>
      <aside className="doc-rail">
        <Toc items={tocFromHtml(html)} />
      </aside>
    </div>
  );
}
