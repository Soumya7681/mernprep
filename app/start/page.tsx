import type { Metadata } from "next";
import { loadReadme, pagerFor } from "@/lib/content";
import { FLAT } from "@/lib/manifest";
import { loadDsaContent } from "@/lib/dsa";
import Pager from "@/components/Pager";
import HomeDashboard from "@/components/HomeDashboard";

export const metadata: Metadata = {
  title: "Start Preparing — Study Dashboard",
  description:
    "Track your progress and jump into any topic: JavaScript, React, Node.js, NestJS, MongoDB, system design, machine coding, DSA, and HR rounds.",
  alternates: { canonical: "/start" },
};

export default async function StartPage() {
  const html = await loadReadme();
  const dsa = await loadDsaContent();
  const readmeEntry = FLAT[0]; // README is registered first in the manifest
  const { prev, next } = pagerFor(readmeEntry);

  return (
    <>
      <div className="breadcrumb">
        <span>Getting Started</span>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <span className="breadcrumb-current">Dashboard</span>
      </div>
      <HomeDashboard dsaTotal={dsa.total} />
      <article className="md" dangerouslySetInnerHTML={{ __html: html }} />
      <Pager prev={prev} next={next} />
    </>
  );
}
