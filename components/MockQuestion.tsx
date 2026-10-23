"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, RotateCw } from "lucide-react";

/**
 * Hero card on the landing page: one real question from the book at a time,
 * answer hidden until asked for, the way it feels across the table. Every
 * question and answer is taken from the "Likely Interview Questions" or body
 * of the linked chapter.
 */
const QUESTIONS = [
  {
    round: "JavaScript",
    q: "How can closures cause memory leaks?",
    a: "A closure keeps a reference to its outer scope. If something long-lived, like an event listener or a global handler, closes over a large object, the garbage collector cannot free it until the listener is removed.",
    href: "/01-javascript/01-closures",
    chapter: "Ch 1 · Closures",
  },
  {
    round: "React",
    q: "Why shouldn't the useEffect callback itself be async?",
    a: "An effect must return nothing or a cleanup function. An async function always returns a Promise, so React would treat it as the cleanup. Define the async function inside the effect and call it.",
    href: "/02-react/03-useeffect",
    chapter: "Ch 13 · useEffect",
  },
  {
    round: "Node.js",
    q: "What happens if you put while(true) inside a request handler?",
    a: "It blocks the event loop. Node runs your JavaScript on one thread, so every other request waits until that loop ends, which it never does.",
    href: "/03-nodejs/01-event-loop",
    chapter: "Ch 22 · Event Loop",
  },
  {
    round: "MongoDB",
    q: "In what order should fields go in a compound index?",
    a: "Follow the ESR rule: Equality filters first, then Sort fields, then Range filters. Getting the order wrong forces an in-memory sort or scans far more keys than needed.",
    href: "/05-mongodb/02-indexing",
    chapter: "Ch 38 · Indexing",
  },
  {
    round: "System design",
    q: "A hot cache key expires and the database falls over. What happened?",
    a: "A cache stampede: hundreds of concurrent requests miss at the same moment and all hit the database. Prevent it with a lock and retry, stale-while-revalidate, or request coalescing.",
    href: "/07-system-design/03-caching",
    chapter: "Ch 46 · Caching",
  },
];

export default function MockQuestion() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const item = QUESTIONS[index];

  const next = () => {
    setIndex((i) => (i + 1) % QUESTIONS.length);
    setRevealed(false);
  };

  return (
    <figure className="mq" aria-label="Sample interview question">
      <div className="mq-head">
        <span className="mq-round">{item.round}</span>
        <span className="mq-count">
          {index + 1} / {QUESTIONS.length}
        </span>
      </div>

      <p className="mq-asks">Interviewer asks</p>
      <blockquote className="mq-q" aria-live="polite">
        {item.q}
      </blockquote>

      <div className={`mq-answer${revealed ? " is-revealed" : ""}`} aria-hidden={!revealed}>
        <p className="mq-asks">Strong answer</p>
        <p className="mq-a">{item.a}</p>
        <Link href={item.href} className="mq-source" tabIndex={revealed ? 0 : -1}>
          From {item.chapter}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="mq-actions">
        {!revealed ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setRevealed(true)}>
            <Eye aria-hidden="true" />
            Reveal answer
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={next}>
            <RotateCw aria-hidden="true" />
            Next question
          </button>
        )}
        {!revealed && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={next}>
            Skip
          </button>
        )}
      </div>
    </figure>
  );
}
