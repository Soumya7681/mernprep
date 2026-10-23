# Chapter 120 — Common HR & Behavioral Questions

## 📖 The Framework: STAR

For any behavioral question, structure your answer as:
- **Situation** — the context.
- **Task** — what you were responsible for.
- **Action** — what *you* did (not "we").
- **Result** — the outcome, ideally with numbers.

---

## 1. "Why are you looking for a change?"

### ✅ Good answer
> "I've grown a lot at Hyscaler over the last few years — I've owned features end-to-end across React and NestJS. Now I'm looking for a larger, more diverse engineering environment with exposure to a variety of domains and bigger codebases, which is what excites me about TCS."

### ❌ Avoid
- Bad-mouthing current employer.
- "Salary" as the primary reason.
- Vague answers ("for change").

---

## 2. "Why TCS?"

### ✅ Good answer
> "Three reasons. First, the **scale** — TCS works across BFSI, retail, healthcare, and more, so I'd get exposure to varied problem spaces. Second, the **structured learning** — TCS has a strong engineering culture and internal tracks. Third, the **global delivery model** means I'd be working with international clients and teams, which is the kind of breadth I want next in my career."

Customize with anything specific you know about the role or team.

---

## 3. "Tell me about your biggest achievement."

### ✅ Good answer (STAR)
> **Situation:** "Our user-uploaded media feature at Hyscaler was bottlenecked — all uploads went through our API server. As volume grew, CPU and memory spiked, and we started seeing timeouts."
>
> **Task:** "I was asked to scale the upload path while keeping security and validation strong."
>
> **Action:** "I redesigned the flow to use AWS S3 pre-signed URLs. The browser uploads directly to S3 once our API signs the URL. I implemented MIME-type validation server-side, kept the file-size limit at 5MB, and used randomized object keys. I also wired up CloudWatch metrics to track upload volume."
>
> **Result:** "Server CPU on the upload route dropped by ~50%. We handled 3× the upload volume without scaling out, and the p95 upload latency improved because traffic was no longer routed through our API."

---

## 4. "Tell me about a time you disagreed with a teammate."

### ✅ Good answer (STAR)
> **Situation:** "On a project at Hyscaler, a teammate wanted to introduce a new state management library mid-sprint. I felt it would slow us down."
>
> **Task:** "We needed to align before the architecture review meeting."
>
> **Action:** "Rather than push back, I asked them to walk me through their reasoning. Their main concern was prop drilling in a few specific places. I suggested we solve that locally with Context API first, and revisit the library if those pain points recurred. I prototyped a quick example in 30 minutes to show it."
>
> **Result:** "We avoided the bigger rewrite, shipped on time, and the lighter solution actually held up well. The teammate appreciated that I engaged with the *problem*, not just the *solution*."

The lesson: disagree on substance, not ego.

---

## 5. "Describe a difficult bug."

### ✅ Good answer (STAR)
> **Situation:** "Our dashboard occasionally showed stale data after a user updated their profile. It was intermittent — couldn't reproduce reliably."
>
> **Task:** "Find and fix the root cause."
>
> **Action:** "I added structured logging around the React Query cache, suspecting a stale-closure issue in our `useEffect` that handled the update. Looking at the logs, I found the effect was firing with an old `userId` because we'd forgotten to include it in the dependency array. The component captured the initial value in its closure."
>
> **Result:** "Fixed in a one-line dep-array change, plus I added an ESLint rule (`react-hooks/exhaustive-deps`) at the repo level to catch similar issues. We never saw the bug again."

---

## 6. "Tell me about a time you had to learn something new quickly."

### ✅ Good answer
> "When we migrated a service from Express to NestJS at Hyscaler, I had two weeks to ramp up on NestJS deeply. I worked through the official docs, built a small CRUD demo myself, then took on a small module of the real codebase end-to-end. The repetition of guards, interceptors, and modules clicked fast because I'd already used the Angular-style patterns. Two months later I was reviewing other devs' NestJS PRs."

---

## 7. "Leadership / Mentorship example."

### ✅ Good answer
> "I'm not formally a lead, but I've onboarded two juniors at Hyscaler. With one of them, I noticed they were struggling with async patterns. I paired with them for two 30-minute sessions on the event loop and Promise chaining, then gave them a small standalone task to apply it. By the third week they were submitting PRs without me. The lesson for me was that the fastest way to make someone independent is to invest a few focused hours up front."

---

## 8. "Where do you see yourself in 5 years?"

### ✅ Good answer
> "I'd like to grow into a senior or tech-lead role — owning architecture for non-trivial systems and mentoring others. Long-term I'm interested in moving into a Staff Engineer-style track rather than management, but I want to stay close to the code."

---

## 9. "What are your strengths and weaknesses?"

### Strengths (pick 2, with examples)
- **Ownership** — "I tend to take a problem end-to-end. On the upload work, I didn't stop at the API change — I added the monitoring and wrote the runbook so on-call could handle issues."
- **Communication** — "I document my work clearly, which has made my PRs easier to review."

### Weaknesses (pick 1, with a fix)
- "I sometimes spend too long polishing the first solution before showing it for feedback. I've been actively pushing myself to share earlier, even if it's rough — usually I get better feedback that way."

> ⚠️ Avoid clichés like "I'm a perfectionist." Be specific.

---

## 10. "Salary expectation?"

### ✅ Good answer
> "Based on my experience and current CTC of ₹X, and what I understand about market rates for this role, I'm looking for something in the range of ₹Y. That said, I'm flexible — if the role, growth, and learning are right, the total package matters more than just base."

Always have a number ready. Research **Glassdoor**, **LinkedIn Salary**, **levels.fyi** for India.

---

## 11. "Why should we hire you?"

### ✅ Good answer
> "Three reasons. One: I have **directly relevant experience** in the stack you're hiring for — React, NestJS, MongoDB, AWS. Two: I've already shipped the kind of features you'll need — auth, file uploads, performance work. Three: I'm at a point in my career where I'm hungry for the kind of scale and variety TCS offers, which means I'll be motivated."

---

## 12. "Do you have any questions for us?"

**Always say yes.** See `10-appendix.md` for the question bank. Pick 2–3.

---

## 🎯 General Behavioral Tips

- **Numbers > adjectives.** "Reduced latency by 40%" beats "improved performance significantly."
- **Use "I" not "we"** when describing your contribution — the interviewer is hiring *you*.
- **Show learning.** Frame failures as "here's what I'd do differently."
- **Be honest.** If you don't know, say so and offer how you'd find out.
- **Don't memorize verbatim.** Memorize the *structure*, fill in details fresh.

---

[← Self-Introduction](01-self-introduction.md) | [Index](../README.md) | [Next: Night-Before Revision →](../09-revision-sheet.md)
