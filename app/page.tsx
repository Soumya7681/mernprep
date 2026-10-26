import type { Metadata } from "next";
import Link from "next/link";
import hljs from "highlight.js";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";
import { MANIFEST, FLAT } from "@/lib/manifest";
import { loadDsaContent } from "@/lib/dsa";
import { TRACKS, totalNodeCount } from "@/lib/roadmaps";
import {
  SITE_NAME,
  SITE_TAGLINE,
  SEO_KEYWORDS,
  GITHUB_REPO,
} from "@/lib/site";
import StarButton from "@/components/StarButton";
import CompilerButton from "@/components/CompilerButton";
import MockQuestion from "@/components/MockQuestion";

/**
 * The landing-page FAQ. The visible list and the FAQPage JSON-LD are both
 * rendered from this array, so the structured data cannot drift from the copy
 * a reader actually sees — which is what Google penalises.
 */
const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is this MERN interview prep really free?",
    a: "Yes. Every chapter — JavaScript, React, Redux, Node.js, Express, NestJS, MongoDB, TypeScript, coding questions and scenario questions — is open source and free, with no sign-up.",
  },
  {
    q: "Who is this book for?",
    a: "Developers interviewing for MERN, React or Node.js roles, from freshers to engineers with 5+ years. It starts with what employers actually list in MERN job descriptions, then goes from fundamentals to advanced internals, so you can stop at the level your target role asks for.",
  },
  {
    q: "What is the difference between the coding and the scenario sections?",
    a: "Coding questions are things you write: predict-the-output puzzles, polyfills, problem solving, React components and Express endpoints, each with a working solution. Scenario questions are things you talk through: a slow page, a memory leak, duplicate orders, a production outage — with the structured answer an interviewer wants to hear.",
  },
  {
    q: "Do I need NestJS?",
    a: "Not for most MERN roles — Express is the default. NestJS is covered because many enterprise teams and client projects use it, and knowing its dependency injection, guards and DTOs is a strong advantage in senior backend rounds.",
  },
  {
    q: "Do I need an account, and how is my progress saved?",
    a: "There is no account. Ticked topics and roadmap progress are stored in your own browser using localStorage, so nothing is uploaded. Clearing your browser data resets your progress.",
  },
  {
    q: "Can I run the code examples?",
    a: "Yes. The JavaScript playground runs your code in a sandboxed frame in your browser, and every JavaScript code block has a link to an online compiler.",
  },
];

export const metadata: Metadata = {
  title: "MERN Stack Interview Prep — JavaScript, React, Node.js, Express & MongoDB",
  description: SITE_TAGLINE,
  keywords: SEO_KEYWORDS,
  alternates: { canonical: "/" },
  openGraph: {
    title: "MERN Stack Interview Prep Book",
    description: SITE_TAGLINE,
    url: "/",
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "MERN Stack Interview Prep Book",
    description: SITE_TAGLINE,
  },
};

function firstHrefOf(folder: string, file: string) {
  const base = file.replace(/\.md$/, "").toLowerCase();
  if (!folder && base === "readme") return "/start";
  return folder ? `/${folder}/${base}` : `/${base}`;
}

// The book's sections grouped by the interview round they prepare for, in the
// order a typical full-stack loop runs. Titles must match MANIFEST.
const ROUNDS: Array<{ name: string; checks: string; sections: string[] }> = [
  { name: "Know the role", checks: "What the job description really asks for at your level.", sections: ["Role Requirements"] },
  { name: "JavaScript", checks: "Can you explain the language, its internals and its async model?", sections: ["JavaScript", "JavaScript Advanced"] },
  { name: "Frontend", checks: "Hooks, rendering, React 19, state and a component built live.", sections: ["React", "React Advanced", "Redux"] },
  { name: "Backend", checks: "APIs, auth, streams, scaling, security and data modelling.", sections: ["Node.js", "Node.js Advanced", "Express / NestJS", "MongoDB", "MERN Stack + TypeScript"] },
  { name: "Coding", checks: "Output puzzles, polyfills and features written under a timer.", sections: ["Coding Questions", "Machine Coding", "DSA & Coding"] },
  { name: "Scenarios", checks: "Debugging, production incidents and design trade-offs, out loud.", sections: ["Scenario-Based Questions", "System Design", "MERN Interview", "Special Questions"] },
  { name: "HR", checks: "Your story, your project, and why this team.", sections: ["HR & Behavioral"] },
];

// Real excerpt from Chapter 1, used for the annotated page.
const SAMPLE_CODE = `function createCounter() {
  let count = 0;
  return () => ++count;   // closes over count
}
const next = createCounter();
next(); // 1
next(); // 2`;

export default async function LandingPage() {
  const learningSections = MANIFEST.filter((s) => s.title !== "Getting Started");
  const totalChapters = FLAT.filter((f) => f.path !== "README.md").length;
  const dsa = await loadDsaContent();
  const sampleHtml = hljs.highlight(SAMPLE_CODE, { language: "javascript" }).value;
  const sectionByTitle = new Map(MANIFEST.map((s) => [s.title, s]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: SITE_NAME,
    description: SITE_TAGLINE,
    educationalLevel: "Professional",
    teaches: [...learningSections.map((s) => s.title), ...TRACKS.map((t) => `${t.title} roadmap`)],
    isAccessibleForFree: true,
    keywords: SEO_KEYWORDS.join(", "),
    learningResourceType: "Interview preparation guide",
    url: GITHUB_REPO,
  };

  return (
    <div className="lp">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero: the promise on the left, a real question on the right. */}
      <section className="lp-hero lp-bg-dots">
        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-copy">
            <h1 className="lp-title">
              Walk into the interview having <mark className="hl">already heard</mark> the
              questions.
            </h1>
            <p className="lp-lede">
              A MERN-only prep book: JavaScript from closures to generators, React to
              React 19, Node.js to streams and clusters, Express, NestJS and MongoDB — plus
              coding rounds and scenario questions with model answers.
            </p>
            <div className="lp-actions">
              <Link href="/start" className="btn btn-primary btn-lg">
                Start with chapter 1
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/23-coding-questions/01-js-output-questions" className="btn btn-secondary btn-lg">
                Practise coding questions
              </Link>
            </div>
          </div>

          <MockQuestion />
        </div>
      </section>

      {/* Facts strip: what is in the book, at a glance. */}
      <section className="lp-strip" aria-label="What is inside">
        <dl className="lp-container lp-strip-grid">
          <div>
            <dt>chapters</dt>
            <dd>{totalChapters}</dd>
          </div>
          <div>
            <dt>DSA questions, tracked</dt>
            <dd>{dsa.total}</dd>
          </div>
          <div>
            <dt>career roadmaps</dt>
            <dd>{TRACKS.length}</dd>
          </div>
          <div>
            <dt>open source, no sign-up</dt>
            <dd>Free</dd>
          </div>
        </dl>
      </section>

      {/* The interview loop: contents grouped by round. */}
      <section className="lp-section lp-bg-lines" aria-labelledby="lp-loop">
        <div className="lp-container">
          <header className="lp-head">
            <div>
              <h2 id="lp-loop" className="lp-h2">Organised around the interview loop</h2>
              <p className="lp-sub">
                Seven stages, in the order most MERN loops run. Each one lists what the
                interviewer is checking and the chapters that cover it.
              </p>
            </div>
          </header>

          <ol className="loop">
            {ROUNDS.map((round, i) => (
              <li key={round.name} className="loop-round">
                <div className="loop-marker" aria-hidden="true">
                  <span>{i + 1}</span>
                </div>
                <div className="loop-body">
                  <h3 className="loop-name">{round.name}</h3>
                  <p className="loop-checks">{round.checks}</p>
                  <ul className="loop-links">
                    {round.sections.map((title) => {
                      const sec = sectionByTitle.get(title);
                      const first = sec?.chapters[0];
                      if (!sec || !first) return null;
                      return (
                        <li key={title}>
                          <Link href={firstHrefOf(sec.folder, first.file)}>
                            <span>{title}</span>
                            <span className="loop-n">{sec.chapters.length}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Annotated page: the five-part chapter format, on a real chapter. */}
      <section className="lp-section lp-bg-paper" aria-labelledby="lp-format">
        <div className="lp-container">
          <header className="lp-head">
            <div>
              <h2 id="lp-format" className="lp-h2">Every chapter reads the same way</h2>
              <p className="lp-sub">
                Five parts, always in this order, so revising a topic the night before takes
                minutes. Here is chapter 1, trimmed.
              </p>
            </div>
          </header>

          <div className="anno">
            <div className="anno-row">
              <p className="anno-label"><span>1</span>Definition</p>
              <div className="anno-body">
                <p className="anno-title">Closures</p>
                <p>
                  A closure is a function that remembers the variables from the scope it was
                  created in, even after that scope has finished executing.
                </p>
              </div>
            </div>
            <div className="anno-row">
              <p className="anno-label"><span>2</span>Explanation</p>
              <div className="anno-body">
                <p>
                  Every function carries a hidden reference, <code>[[Environment]]</code>, to
                  the scope it was defined in. Call it from anywhere later and it can still
                  reach those variables.
                </p>
              </div>
            </div>
            <div className="anno-row">
              <p className="anno-label"><span>3</span>Code</p>
              <div className="anno-body">
                <pre className="anno-code">
                  <code className="hljs language-javascript" dangerouslySetInnerHTML={{ __html: sampleHtml }} />
                </pre>
              </div>
            </div>
            <div className="anno-row">
              <p className="anno-label"><span>4</span>Real-world use</p>
              <div className="anno-body">
                <p>
                  Express middleware closes over its config:{" "}
                  <code>app.use(authMiddleware(config))</code>.
                </p>
              </div>
            </div>
            <div className="anno-row">
              <p className="anno-label"><span>5</span>Likely questions</p>
              <div className="anno-body">
                <p className="anno-q">What&rsquo;s the output of the classic setTimeout loop?</p>
                <p className="anno-q">How can closures cause memory leaks?</p>
                <Link href="/01-javascript/01-closures" className="anno-more">
                  Read the full chapter
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmaps: a table, because people compare tracks by length. */}
      <section className="lp-section lp-bg-grid" aria-labelledby="lp-roadmaps">
        <div className="lp-container">
          <header className="lp-head">
            <div>
              <h2 id="lp-roadmaps" className="lp-h2">Not sure what to learn next?</h2>
              <p className="lp-sub">
                Frontend, backend and full-stack roadmaps — {totalNodeCount()} topics. Each stage says
                what to learn and which project proves you learned it.
              </p>
            </div>
          </header>

          <div className="rt">
            <div className="rt-row rt-headrow" aria-hidden="true">
              <span>Track</span>
              <span>Stages</span>
              <span>Time</span>
            </div>
            {TRACKS.slice(0, 8).map((track) => (
              <Link key={track.slug} href={`/roadmaps/${track.slug}`} className="rt-row">
                <span className="rt-name">
                  <span className="rt-mark" aria-hidden="true">{track.mark}</span>
                  {track.shortTitle}
                </span>
                <span className="rt-stages" aria-label={`${track.stages.length} stages`}>
                  {track.stages.map((st) => (
                    <i key={st.title} aria-hidden="true" />
                  ))}
                </span>
                <span className="rt-time">{track.timeline}</span>
              </Link>
            ))}
            <Link href="/roadmaps" className="rt-all">
              See all {TRACKS.length} roadmaps
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Playground: shown as a console, because that is what it is. */}
      <section className="lp-section lp-inverse" aria-labelledby="lp-playground">
        <div className="lp-container pgx">
          <div>
            <header className="lp-head lp-head-tight">
              <div>
                <h2 id="lp-playground" className="lp-h2">Change the example. Run it again.</h2>
                <p className="lp-sub">
                  The JavaScript playground runs in a sandboxed frame in your browser. No server,
                  no account, and your code never leaves your machine.
                </p>
              </div>
            </header>
            <div className="lp-actions">
              <Link href="/playground" className="btn btn-primary">
                <Play aria-hidden="true" />
                Open playground
              </Link>
              <CompilerButton variant="hero" label="Other languages" className="btn-md" />
            </div>
          </div>
          <div className="console" aria-hidden="true">
            <div className="console-bar">
              <span>playground.js</span>
              <span className="console-run">Run</span>
            </div>
            <pre className="console-code">
              <code
                className="hljs language-javascript"
                dangerouslySetInnerHTML={{
                  __html: hljs.highlight(
                    `for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i));\n}`,
                    { language: "javascript" },
                  ).value,
                }}
              />
            </pre>
            <div className="console-out">
              <span>3</span>
              <span>3</span>
              <span>3</span>
              <span className="console-hint">swap var for let and run again</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section lp-bg-subtle" aria-labelledby="lp-faq">
        <div className="lp-container">
          <header className="lp-head">
            <div>
              <h2 id="lp-faq" className="lp-h2">Before you start</h2>
              <p className="lp-sub">
                Something missing?{" "}
                <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                  Open an issue on GitHub
                  <ArrowUpRight aria-hidden="true" className="inline-icon" />
                </a>
              </p>
            </div>
          </header>
          <div className="lp-faq">
            {FAQS.map((item) => (
              <details key={item.q} className="lp-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span>{SITE_NAME} · MIT licensed</span>
          <div className="lp-footer-links">
            <Link href="/start">Book</Link>
            <Link href="/roadmaps">Roadmaps</Link>
            <Link href="/playground">Playground</Link>
            <StarButton variant="hero" className="btn-md" />
          </div>
        </div>
      </footer>
    </div>
  );
}
