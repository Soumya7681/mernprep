# Chapter 02 — How MERN Interviews Run

## 📖 Definition

A MERN interview loop is a sequence of rounds, each checking a different skill: language fundamentals, framework depth, backend and database design, live coding, scenario reasoning, and communication. Knowing what each round is for lets you answer at the right depth.

## 🔍 The Typical Loop

| # | Round | Duration | What they check | Chapters |
|---|---|---|---|---|
| 1 | Screening / HR call | 15–30 min | Notice period, CTC, stack match, communication | HR & Behavioral |
| 2 | Online test (sometimes) | 60–90 min | MCQs on JS/React/Node + 1–2 coding problems | Coding Questions, DSA |
| 3 | Technical round 1 — fundamentals | 45–60 min | JavaScript internals, React basics, output questions | JavaScript, React, JS Predict-the-Output |
| 4 | Technical round 2 — depth | 60 min | Node, Express, MongoDB, auth, architecture of *your* project | Node, MongoDB, MERN + TS |
| 5 | Live coding / machine coding | 45–90 min | Build a component or an API while talking | React/Node Coding Questions, Machine Coding |
| 6 | Scenario / system design | 45–60 min | Debugging, production incidents, designing a feature | Scenario-Based Questions, System Design |
| 7 | Client / managerial round | 30–45 min | Ownership, communication, requirement handling | MERN Interview, HR |

> **Service companies and client interviews:** if you are on the bench and a client interviews you before allocation, rounds 3–4 are usually merged into one 45-minute call, followed by scenario questions about *their* project ("we have a slow dashboard, how would you approach it?"). Lead with your project experience and keep answers practical.

## 🧠 How Each Round Is Scored

### Fundamentals round
- **Correctness** — is the answer right?
- **Depth** — can you go one level deeper when asked "why?"
- **Precision** — do you use the right terms (microtask, closure, reconciliation)?

**Tip:** answer in the pattern *definition → example → where you used it*.

### Live coding round
- Clarifying questions before typing.
- A working solution first, optimisation second.
- Talking through your thinking.
- Handling edge cases (empty input, errors, loading state).
- Clean naming and small functions.

### Scenario round
Interviewers want a **structured approach**, not a single magic answer:

```text
1. Clarify     — what exactly is slow/broken? since when? for whom?
2. Measure     — logs, metrics, DevTools, explain(), profiler
3. Hypothesise — list likely causes, most likely first
4. Fix         — the smallest safe change, behind a flag if risky
5. Prevent     — test, alert, dashboard, post-mortem
```

### Client / managerial round
- Can you explain technical things to a non-technical person?
- Do you take ownership ("I" did, not only "we" did)?
- How do you handle pressure, ambiguity, and changing requirements?

## 💻 Example — Answering With Structure

**Question:** *"What is the difference between `useMemo` and `useCallback`?"*

❌ Weak: "useMemo is for values and useCallback is for functions."

✅ Strong:

```jsx
// useMemo caches the RESULT of a computation between renders
const sorted = useMemo(() => [...items].sort(byPrice), [items]);

// useCallback caches the FUNCTION itself (same reference between renders)
const onSelect = useCallback((id) => setSelected(id), []);

// useCallback(fn, deps) is equivalent to useMemo(() => fn, deps)
```

> "Both cache between renders until a dependency changes. `useMemo` stores a value, `useCallback` stores a function reference. I use `useCallback` mostly when passing a handler to a `React.memo` child or into another hook's dependency array — otherwise the new reference each render would defeat the memoisation. In my last project we had a product table with 2,000 rows and memoising the sort cut re-render time from ~120 ms to ~15 ms."

## 🗓️ The Day Before

- Re-read the job description and map it to chapters ([Chapter 01](01-mern-role-requirements.md)).
- Rehearse your self-introduction and one project deep-dive out loud.
- Do 10 output questions and 3 polyfills from memory.
- Prepare 2 questions to ask the interviewer (team structure, tech debt, release process).
- Test your camera, mic, screen sharing and an online editor (CodeSandbox / StackBlitz).

## 🌍 Real-World Use

Most rejections at mid-level come from three things: weak project explanations, shallow answers ("it just works like that"), and freezing in live coding. All three are fixed by practising **out loud**, not by reading more.

## 🎯 Likely Interview Questions

1. **Tell me about yourself.**
2. **Explain the project you are most proud of — draw the architecture.**
3. **What was the hardest bug you fixed and how did you find it?**
4. **How do you handle a requirement that changes mid-sprint?**
5. **Do you have any questions for us?**

---

[← MERN Role Requirements & Skill Matrix](01-mern-role-requirements.md) | [Index](../README.md) | [Next: 8-Week Study Plan →](03-study-plan.md)
