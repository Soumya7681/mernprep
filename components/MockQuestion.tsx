"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, RotateCw } from "lucide-react";
import { FLAT } from "@/lib/manifest";

/**
 * Hero card on the landing page: one real question from the book at a time,
 * answer hidden until asked for, the way it feels across the table. Every
 * question and answer is taken from the "Likely Interview Questions" or body
 * of the linked chapter. The "From Ch N · Title" label is looked up in the
 * manifest, so it stays correct when chapters are renumbered.
 */
const QUESTIONS = [
  {
    round: "JavaScript",
    q: "How can closures cause memory leaks?",
    a: "A closure keeps a reference to its outer scope. If something long-lived, like an event listener or a global handler, closes over a large object, the garbage collector cannot free it until the listener is removed.",
    href: "/01-javascript/01-closures",
  },
  {
    round: "React",
    q: "Why shouldn't the useEffect callback itself be async?",
    a: "An effect must return nothing or a cleanup function. An async function always returns a Promise, so React would treat it as the cleanup. Define the async function inside the effect and call it.",
    href: "/02-react/03-useeffect",
  },
  {
    round: "Node.js",
    q: "What happens if you put while(true) inside a request handler?",
    a: "It blocks the event loop. Node runs your JavaScript on one thread, so every other request waits until that loop ends, which it never does.",
    href: "/03-nodejs/01-event-loop",
  },
  {
    round: "MongoDB",
    q: "In what order should fields go in a compound index?",
    a: "Follow the ESR rule: Equality filters first, then Sort fields, then Range filters. Getting the order wrong forces an in-memory sort or scans far more keys than needed.",
    href: "/05-mongodb/02-indexing",
  },
  {
    round: "System design",
    q: "A hot cache key expires and the database falls over. What happened?",
    a: "A cache stampede: hundreds of concurrent requests miss at the same moment and all hit the database. Prevent it with a lock and retry, stale-while-revalidate, or request coalescing.",
    href: "/07-system-design/03-caching",
  },
  {
    round: "GraphQL",
    q: "What is the N+1 problem in GraphQL, and how do you fix it?",
    a: "A list query returns N items and each item's nested resolver, like Post.author, makes its own database call: 1 query for the list plus N more. DataLoader fixes it by batching every load() in the same tick into one WHERE id IN (...) query, with a new loader created for each request.",
    href: "/27-graphql/03-graphql-advanced-server",
  },
  {
    round: "Python",
    q: "Why does def add(item, bucket=[]) keep remembering old items?",
    a: "Default values are evaluated once, when the function is defined, so every call that doesn't pass bucket shares the same list. Use bucket=None and create a new list inside the function.",
    href: "/28-python/01-python-fundamentals",
  },
  {
    round: "SQL",
    q: "Why can WHERE id NOT IN (SELECT dept_id FROM employees) return no rows at all?",
    a: "If the subquery returns even one NULL, every comparison becomes id <> NULL, which is UNKNOWN, so no row passes the filter. Use NOT EXISTS, or filter the NULLs out of the subquery.",
    href: "/29-sql/02-aggregation-subqueries-window-functions",
  },
  {
    round: "FastAPI",
    q: "What happens if you call time.sleep(5) inside an async def endpoint?",
    a: "It blocks the event loop, so every other request on that worker waits five seconds. Use await asyncio.sleep, async libraries, or a plain def endpoint, which FastAPI runs in a thread pool.",
    href: "/30-fastapi/01-fastapi-fundamentals",
  },
];

function chapterLabel(href: string): string {
  const ch = FLAT.find((f) => `/${f.slug.join("/")}` === href);
  return ch ? `Ch ${Number(ch.num)} · ${ch.title.replace(/`/g, "")}` : "the book";
}

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
          From {chapterLabel(item.href)}
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
