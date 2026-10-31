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

## ➕ Add-On Weeks: GraphQL, SQL, Python & FastAPI

Many MERN job descriptions also list **GraphQL**, **SQL/PostgreSQL** or **Python/FastAPI**. If yours does, add these weeks after week 7 (or swap them in for parts of weeks 5–7 that the role doesn't need). Each week uses the same ~15 hours.

| Week | Focus | Read | Practise | Build / prove |
|---|---|---|---|---|
| A | GraphQL | GraphQL (all 5) | GraphQL Coding Questions, GraphQL Scenarios | Add a `/graphql` endpoint to your Express API with DataLoader, cursor pagination and a depth limit; move one React screen to Apollo Client |
| B | SQL | SQL (all 5) | SQL Query Practice, SQL Coding Questions, SQL Scenarios | Model orders and payments in Postgres; write the monthly revenue, top-N per group and retention queries; show `EXPLAIN ANALYZE` before and after an index |
| C | Python | Python, Python Advanced | Python Coding Questions, the predict-the-output puzzles | Rewrite three of your JS utilities in Python (retry, TTL cache, concurrency-limited fetch) with pytest tests |
| D | FastAPI | FastAPI, FastAPI Advanced | FastAPI Coding Questions, Python & FastAPI Scenarios | A FastAPI "AI service" next to your Node API: shared JWT, Redis cache, a rate limit, one SSE endpoint, Docker Compose |

Only doing one? **SQL** is the most widely useful, because it comes up even in MongoDB-heavy interviews ("why not Postgres?"). Do **Python** before **FastAPI**; FastAPI assumes type hints, decorators and async.

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
- **Add-on A (GraphQL):** explain the N+1 problem and DataLoader; say why GraphQL errors come back with HTTP 200.
- **Add-on B (SQL):** write a top-3-per-department query and explain `RANK` vs `DENSE_RANK`; explain the isolation levels.
- **Add-on C (Python):** explain the GIL and when to use threads vs processes vs asyncio; write a decorator from memory.
- **Add-on D (FastAPI):** explain `async def` vs `def` endpoints; walk through `Depends` for the DB session and the current user.

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
| *(Add-on)* GraphQL product feed | Schema design, DataLoader, cursor pagination, Apollo cache |
| *(Add-on)* Orders and payments in Postgres | Joins, transactions, `FOR UPDATE`, window-function reports |
| *(Add-on)* FastAPI AI service | Pydantic, dependency injection, shared JWT with Node, SSE streaming |

## 🎯 Likely Interview Questions This Plan Prepares You For

1. **What did you learn recently, and how?**
2. **Walk me through the project on your CV.**
3. **What would you improve in it today?**
4. **How do you keep up with changes in React and Node?**

---

[← How MERN Interviews Run](02-interview-process.md) | [Index](../README.md) | [Next: Closures →](../01-javascript/01-closures.md)
