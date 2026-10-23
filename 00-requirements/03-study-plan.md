# Chapter 03 — 8-Week Study Plan

## 📖 Definition

A week-by-week plan through this book for someone with a day job: about **1.5 hours on weekdays and 4 hours on weekends** (~15 hours a week). Compress it to 4 weeks if you are preparing full-time; stretch it to 12 if you are starting from fresher level.

## 🗓️ The Plan

| Week | Focus | Read | Practise | Build / prove |
|---|---|---|---|---|
| 1 | JavaScript core | JavaScript (all 11) | 20 output questions | Write `debounce`, `throttle`, `curry` from memory |
| 2 | JavaScript advanced | JavaScript Advanced (all 8) | 10 polyfills (`bind`, `Promise.all`, `flat`…) | A promise pool that runs N tasks at a time |
| 3 | React core | React (all 10) | 5 React coding questions | Todo + search with debounce + pagination |
| 4 | React advanced + Redux | React Advanced, Redux | 5 more React coding questions, React scenarios | Add RTK Query or TanStack Query and tests to the app |
| 5 | Node + Express | Node.js, Express / NestJS | Node coding questions 1–6 | REST API with auth, validation, error handler |
| 6 | Node advanced | Node.js Advanced | Node scenarios, remaining Node coding questions | Add Redis cache, rate limiting, a BullMQ job, graceful shutdown |
| 7 | MongoDB + TypeScript | MongoDB, MERN + TS | Query Practice, MongoDB scenarios | Convert the API to TypeScript; add indexes and an aggregation report |
| 8 | Interview mode | Scenario-Based, System Design, MERN Interview, HR | 2 mock interviews, production + system design scenarios | Deploy the full app; write the README and architecture diagram |

## ✅ Daily Routine (90 minutes)

```text
00–10  Revise yesterday's notes (active recall: close the page, explain it aloud)
10–50  Read one chapter; type out every code example and run it
50–80  Solve 2–3 questions from the Coding or Scenario sections
80–90  Write 3 bullet notes + 1 question you could not answer
```

## 🧪 Self-Check at the End of Each Week

You are ready to move on when you can, **without notes**:

- **Week 1:** explain the event loop with an output example; explain closures with a real use.
- **Week 2:** implement `Promise.all` and a deep clone; explain ESM vs CommonJS.
- **Week 3:** explain why a component re-renders and three ways to stop it.
- **Week 4:** explain server vs client state; write a custom hook with a test.
- **Week 5:** draw the request lifecycle through middleware to the error handler.
- **Week 6:** explain streams + backpressure; explain cluster vs worker threads.
- **Week 7:** design a schema for orders and explain your indexes using `explain()` output.
- **Week 8:** answer 5 random scenario questions in the 5-step structure from [Chapter 02](02-interview-process.md).

## 🧰 The Portfolio Project That Covers Everything

Build one app and you will have a story for almost every interview question. Example: **"ShopLite" — a small e-commerce app**.

| Feature | Concepts it proves |
|---|---|
| Sign up / login with refresh tokens | JWT, cookies, bcrypt, middleware, RBAC |
| Product list with search, filters, pagination | Debounce, query params, indexes, cursor pagination |
| Cart and checkout | Redux Toolkit / Zustand, optimistic UI, MongoDB transactions, idempotency keys |
| Image upload | Multer, S3 pre-signed URLs, streams |
| Order status updates | Socket.IO, rooms |
| Admin sales report | Aggregation pipeline, CSV export with streams |
| Order confirmation email | BullMQ job queue, retries |
| Tests and CI | Vitest/Jest, RTL, Supertest, GitHub Actions |
| Deployment | Docker, environment config, health checks, logging |

## 🎯 Likely Interview Questions This Plan Prepares You For

1. **What did you learn recently, and how?**
2. **Walk me through the project on your CV.**
3. **What would you improve in it today?**
4. **How do you keep up with changes in React and Node?**

---

[← How MERN Interviews Run](02-interview-process.md) | [Index](../README.md) | [Next: Closures →](../01-javascript/01-closures.md)
