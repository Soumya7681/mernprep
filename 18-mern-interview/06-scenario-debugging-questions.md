# Chapter 109 — MERN Interview: Scenario & Debugging Questions

## 📖 Why Scenario Questions Matter

Experienced interviewers ask "what would you do if…" questions to see how you **think** in real situations. Answer in steps: **understand → check → fix → prevent**. Mention tools you'd actually use.

---

### 1. "The application is slow. How do you find the problem?"

1. **Find where**: browser DevTools Network tab — is it a slow API, a big JS bundle, or slow rendering?
2. **Slow API**: check logs/APM for response time per endpoint; check MongoDB with `explain()` for `COLLSCAN`; check for N+1 queries; check external API calls.
3. **Slow frontend**: React Profiler for unnecessary re-renders, Lighthouse for bundle size and images.
4. **Fix**: indexes, pagination, projection/`.lean()`, caching (Redis/RTK Query), code splitting, memoization, image optimisation.
5. **Prevent**: performance budgets, monitoring alerts on p95 latency.

### 2. "An API works locally but fails in production."

Check: environment variables (missing/wrong), CORS origin, HTTPS/secure cookie settings, database network access (Atlas IP allow-list), different Node version, file paths/case sensitivity, build step (TypeScript compiled?), and logs/Sentry for the actual error.

### 3. "Users are randomly logged out."

Possible causes: access token expiry without working refresh flow; refresh cookie not sent (`SameSite`/`secure`/domain/`credentials: "include"` issues); multiple parallel 401s triggering multiple refreshes and token rotation conflicts; clock skew; JWT secret differs between server instances. Fix by checking network requests, cookie attributes, and sharing one refresh promise on the client.

### 4. "We get CORS errors after deploying the frontend to a new domain."

Add the new origin to the server's CORS allow-list (exact origin, with `credentials: true` if cookies are used), make sure the server responds to `OPTIONS` preflight, and that the proxy/load balancer doesn't strip headers.

### 5. "Duplicate orders are being created."

Causes: user double-clicks, client retries after timeout, webhook delivered twice. Fix: disable the button while submitting; **idempotency key** on order/payment creation with a unique index; make webhook handlers idempotent (check if already processed).

### 6. "The Node server crashes with 'JavaScript heap out of memory'."

Look for loading large data into memory (e.g. `find()` on a whole collection, big file reads) → use pagination, cursors and streams. Check for memory leaks with heap snapshots (unbounded caches, event listeners). Temporary relief: increase `--max-old-space-size`, but fix the cause.

### 7. "One API call blocks all other requests."

A CPU-heavy synchronous operation is blocking the event loop (big JSON parsing, image processing, sync crypto, large loops). Move it to a worker thread or a background job queue; use async APIs; split the work.

### 8. "MongoDB CPU is at 100%."

Check slow queries (profiler, Atlas Performance Advisor) → missing indexes or regex scans; heavy aggregations running too often → cache or pre-compute; too many connections → reuse one connection pool per process.

### 9. "A React page shows old data after saving."

Cache isn't updated: with RTK Query check `invalidatesTags`/`providesTags`; with manual Redux, update the slice after the mutation; check HTTP caching headers; check that the API actually returns the updated document (`new: true` in Mongoose).

### 10. "The search box sends a request on every keystroke and results appear in the wrong order."

Debounce the input (300 ms), cancel the previous request with `AbortController`, or ignore responses that aren't the latest.

### 11. "A third-party payment API is sometimes slow or down."

Timeouts on calls, retries with exponential backoff for safe operations, idempotency keys, circuit breaker, queue for retrying later, show the user a clear "processing" status, and rely on webhooks for final status.

### 12. "You need to send 1 lakh (100,000) emails."

Don't loop in the API request. Put jobs in a queue (BullMQ), process with workers at a controlled rate respecting the provider's limits, track status, retry failures, and use the provider's batch API.

### 13. "How would you export 5 lakh orders to Excel/CSV?"

Run as a background job; stream from MongoDB with a cursor and write the CSV as a stream (not in memory); upload to S3; notify the user with a download link.

### 14. "A user reports they can see another user's order."

Treat it as a security incident: verify, fix immediately by checking ownership in the query (`{ _id, userId: req.user.id }`), return 404 for others' data, review other endpoints for the same bug (IDOR), add tests, check logs to see if data was accessed, inform the lead/security team.

### 15. "The app works on Chrome but not on Safari / older phones."

Check unsupported JavaScript/CSS features, date parsing (`new Date("2026-10-22 10:00")` fails on Safari — use ISO format), cookie restrictions (third-party cookies), and test using BrowserStack or real devices; configure browserslist/polyfills.

### 16. "Deployment caused errors; what do you do?"

Roll back first to restore service, then investigate logs/Sentry, find the root cause, fix with a test, redeploy, and write a short post-mortem. Future: canary deployments, health checks, feature flags.

### 17. "How would you add real-time order status updates?"

Socket.IO (or Server-Sent Events): authenticate the socket with JWT, join a room per user, emit an event when the order status changes; with multiple servers use the Redis adapter. Fallback: polling every 15–30 s.

### 18. "A file upload of 500 MB fails."

Use direct-to-S3 uploads with pre-signed URLs and **multipart upload** (chunks, resumable), increase timeouts only where needed, show progress, validate file type and size, process the file asynchronously.

### 19. "How do you handle a requirement change in the middle of a sprint?"

Understand the impact, discuss with the product owner/lead, estimate the change, decide together whether it replaces something in the sprint or goes to the next one, and update the ticket. Avoid silently absorbing big changes.

### 20. "Your teammate's PR has a bug you found during review."

Leave a clear, polite comment explaining the issue and a suggested fix or test case; if it's complex, discuss on a call. Focus on the code, not the person.

---

[← MongoDB & Mongoose Questions](05-mongodb-questions.md) | [Index](../README.md) | [Next: Live Coding Tasks →](07-live-coding-tasks.md)
