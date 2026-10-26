# MERNPrep: The MERN Stack Interview Prep Book

<img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version 1.0.0" width="90" height="20">
<img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License MIT" width="78" height="20">

> A structured, open-source preparation guide for **MERN stack / JavaScript full-stack** roles — from what the job description asks for, through JavaScript, React, Node.js, Express, NestJS and MongoDB in depth, to coding rounds and scenario-based questions with model answers.

## 🌟 About This Book

**MERNPrep** focuses on one stack and goes deep. It is a static Next.js site built from the Markdown chapters in this repository.

**What is inside**

- **Role Requirements:** what MERN job descriptions actually ask for, decoded into a skill matrix for fresher, mid-level and senior roles; how the interview loop runs; and an 8-week study plan.
- **JavaScript, core and advanced:** closures, `this`, prototypes, the event loop and promises, then execution context and memory, iterators and generators, Proxy/Reflect, ESM vs CommonJS, functional patterns, design patterns, advanced async control and browser performance.
- **React, core and advanced:** hooks and rendering, then React 19 (Actions, `use`, Server Components), concurrent rendering and Suspense, advanced component patterns, server state with TanStack Query, forms and routing, testing, security and accessibility. Plus Redux Toolkit and RTK Query.
- **Node.js, core and advanced:** middleware, auth, REST, errors, uploads, pagination and rate limiting, then streams and backpressure, cluster and worker threads, WebSockets, Redis caching and BullMQ queues, OWASP security, observability and graceful shutdown, performance and memory leaks, and API testing.
- **Express / NestJS and MongoDB:** dependency injection, DTOs and guards; MongoDB data modelling, indexing, aggregation, transactions, replication and sharding, with 25 query problems.
- **MERN + TypeScript:** the whole stack wired together with types, end to end.
- **Coding Questions:** 45 predict-the-output puzzles (every answer verified by running it), 20 polyfills, 22 problem-solving exercises, 16 React components and 13 Node/Express tasks — all with working solutions.
- **Scenario-Based Questions:** JavaScript, React, Node, MongoDB, production incidents and MERN system design — each with a structured answer.
- **Special Questions:** React and Node.js questions shared by the MERN STACK TI group from real interviews, with simple answers.
- **MERN Interview, Machine Coding, System Design, DSA tracker, HR and a night-before revision sheet.**

Every concept chapter follows the same pattern:

> **Definition → Explanation → Code Example → Real-World Use → Likely Interview Questions**

---

## 🗺️ Reading Order

| Part | Sections |
|------|----------|
| **0 · Know the role** | Role Requirements |
| **1 · Core + advanced** | JavaScript → JavaScript Advanced → React → React Advanced → Redux → Node.js → Node.js Advanced → Express / NestJS → MongoDB |
| **2 · Putting it together** | MERN Stack + TypeScript |
| **3 · Interview rounds** | Coding Questions → Scenario-Based Questions → MERN Interview → Special Questions → Machine Coding → System Design → DSA & Coding → HR & Behavioral |
| **4 · Revision** | Night-Before Revision, Documents & Q&A |

Every chapter ends with Previous / Next links, so you can read it straight through. Start with [Chapter 01 — MERN Role Requirements & Skill Matrix](00-requirements/01-mern-role-requirements.md).

---

## 🎯 How to Use This Book

### Eight weeks out
Follow the [8-Week Study Plan](00-requirements/03-study-plan.md): one section a week, with coding practice every day.

### One week out
- Revise **JavaScript Advanced**, **React Advanced** and **Node.js Advanced**.
- Do the **Predict-the-Output** and **Polyfills** chapters from memory.

### Two days out
- Solve the **React** and **Node & Express** coding questions with a timer.
- Answer five **scenario** questions out loud, using the clarify → hypothesise → verify → fix → prevent structure.

### One day out
- Skim **System Design** and **MERN System Design Scenarios**.
- Rehearse your self-introduction and project walkthrough from **MERN Interview** and **HR & Behavioral**.

### The morning of
- Read **only** the Night-Before Revision sheet.

---

## 🛠️ Running the Site Locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export to out/
```

After adding or reordering chapters in `lib/manifest.ts`, run:

```bash
node scripts/renumber-chapters.mjs     # updates chapter numbers and Previous/Next links
node scripts/check-roadmap-links.mjs   # validates roadmap links into the book
```

See [DEPLOY.md](DEPLOY.md) for hosting on Cloudflare Pages.

---

> **Final note:** Lead with **specific stories and numbers** from your own projects. Textbook answers everyone has; your projects are your differentiator.

**Good luck — go own it.**
