// Central site config — reused by metadata, the landing page, and the sitemap.
// Update SITE_URL to your real deployed domain so OG tags and the sitemap are absolute.
export const SITE_URL = "https://mernprep.soureetech.com";

export const GITHUB_REPO = "https://github.com/Soumya7681/mernprep";
// Repo root rather than /stargazers: that path returns 404 to non-browser
// clients, which crawlers report as a broken link. Starring happens here anyway.
export const GITHUB_STARS_URL = GITHUB_REPO;

// Online code playground used across the site (navbar, playground page,
// per-code-block "Run in compiler" links, and the landing CTA).
export const COMPILER_NAME = "Programiz JavaScript Compiler";
export const COMPILER_URL = "https://www.programiz.com/javascript/online-compiler/";

/** Google AdSense publisher id. Used by both the verification meta tag and the ad script. */
export const ADSENSE_CLIENT = "ca-pub-2142314669046516";

/** Product name. Shown in the app header and as the landing-page masthead. */
export const BRAND = "MERNPrep";

export const SITE_NAME = "MERN Stack Interview Prep Book";
export const SITE_TAGLINE =
  "Free, in-depth MERN stack interview preparation: JavaScript (core + advanced), React, Redux, Node.js, Express, NestJS, MongoDB and TypeScript, with role requirements, coding questions and scenario-based questions.";

// Keyword list for <meta name="keywords"> and OpenGraph.
export const SEO_KEYWORDS: string[] = [
  "MERN stack interview questions",
  "MERN stack interview preparation",
  "MERN developer requirements",
  "advanced JavaScript interview questions",
  "JavaScript output based questions",
  "JavaScript polyfill interview questions",
  "JavaScript coding interview questions",
  "React interview questions",
  "advanced React interview questions",
  "React coding interview questions",
  "React scenario based questions",
  "Redux Toolkit interview questions",
  "Node.js interview questions",
  "advanced Node.js interview questions",
  "Node.js scenario based questions",
  "Express.js interview questions",
  "NestJS interview questions",
  "MongoDB interview questions",
  "MongoDB scenario based questions",
  "MERN stack with TypeScript",
  "MERN system design interview",
  "full stack JavaScript developer interview",
];
