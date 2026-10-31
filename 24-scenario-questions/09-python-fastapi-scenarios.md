# Chapter 142 — Python & FastAPI Scenarios

## 📖 Definition

Python and FastAPI scenario questions describe a production problem in a Python service (a frozen event loop, growing memory, a stuck worker, a broken deploy, slow ML inference) and ask how you'd handle it. Answer with **clarify → hypothesise → verify → fix → prevent**, and name the tools: `py-spy`, `tracemalloc`, request tracing, `asyncio` debug mode, Celery's Flower, the SQLAlchemy echo log.

---

### Scenario 1 — "When one slow request runs, every other request to the FastAPI service hangs."

**Hypothesis:** the **event loop is blocked**. An `async def` endpoint or dependency calls blocking code: `time.sleep`, `requests.get`, sync SQLAlchemy, `boto3`, a slow regex, or heavy CPU work (PDF, image, pandas).

**Verify**
- `py-spy dump --pid <worker>` while it's hung → the main thread is stuck inside `requests` / `socket.recv` / your CPU function, called from an `async def`.
- `PYTHONASYNCIODEBUG=1` (or `loop.slow_callback_duration`) logs callbacks that block for more than 100 ms.

**Fix**
- Use async libraries in `async def` (`httpx.AsyncClient`, `asyncpg`, `redis.asyncio`).
- Or make the endpoint plain `def` (FastAPI runs it in a thread pool).
- Or wrap the call: `await asyncio.to_thread(fn, ...)`.
- CPU-heavy work → a process pool or a Celery task.

**Prevent:** a lint rule / code review check for blocking calls in `async def` (Ruff's `ASYNC` rules); an event-loop-lag metric with an alert.

---

### Scenario 2 — "Memory of our Python workers grows all day until they get OOM-killed."

**Clarify:** every worker or one? Linked to traffic, or to a specific endpoint or job?

**Verify**
- Compare `tracemalloc` snapshots taken minutes apart (or use `memray`) → the line whose allocations keep growing.
- Look for: module-level dicts or lists used as caches, `@lru_cache` with no `maxsize` (or on methods, which keeps `self` alive), giant query results loaded into lists, objects captured by callbacks or closures.

**Fix:** a bounded cache (`maxsize`, `TTLCache`, or Redis); stream results (`yield_per`, generators, `StreamingResponse`); close resources.

**Short-term safety net:** gunicorn `--max-requests 1000 --max-requests-jitter 100` / Celery `worker_max_tasks_per_child` so workers restart before they run out of memory. **This hides the leak; it doesn't fix it.** Say both.

---

### Scenario 3 — "Our FastAPI service was fine at 50 requests/second but times out at 300."

**Verify:** is CPU at 100%? Are DB pool waits high? Is the outbound HTTP pool exhausted? Is the event loop lagging?

**Common causes and fixes**
- **One worker process** → run `--workers N` (about one per core) or more replicas.
- **DB pool too small**, or sessions held too long → tune `pool_size` / `max_overflow`, keep sessions per request, add PgBouncer.
- **A new `httpx.AsyncClient` per request** (no connection reuse, TLS handshake every time) → create **one** client in `lifespan`.
- **N+1 queries** → `selectinload`.
- **Big JSON serialisation** → return only the needed fields, paginate, use `ORJSONResponse`.
- Missing **timeouts** on outbound calls, so slow dependencies tie up every worker.

**Prevent:** load tests (Locust / k6) in CI before big launches; RED metrics per route.

---

### Scenario 4 — "After deploying, every request returns 500, but it worked in staging."

**Checklist**
1. Read the logs for the traceback (structured logs + request ID).
2. **Config:** a missing or different env var. Make settings fail at **startup** with `pydantic-settings` (required fields, typed values) instead of failing on the first request.
3. **Migrations:** the code expects a column that `alembic upgrade head` hasn't created yet → run migrations as a deploy step **before** starting the new version.
4. **Dependencies:** an unpinned package installed a new major version → use a lockfile (`uv.lock`) and `uv sync --frozen` in the Docker build.
5. **Python version** differences between the image and staging.
6. **Network/permissions:** DB allow-list, IAM role, secrets manager access.

**Prevent:** identical images for staging and production; a `/ready` check that verifies the DB and config; canary or rolling deploys that stop on errors.

---

### Scenario 5 — "Celery tasks are piling up; some run twice, some never run."

**Causes and fixes**
- **Workers too few or blocked** → scale workers; separate queues for slow and fast tasks (`-Q emails` vs `-Q reports`) so one doesn't starve the other.
- **Running twice:** with `acks_late=True`, a task is re-delivered if a worker dies mid-task, or if it runs longer than the broker's visibility timeout (Redis / SQS). → Make tasks **idempotent** (check "already sent" / use idempotency keys with providers), and set the visibility timeout above the longest task.
- **Never running:** tasks published before the transaction committed read data that doesn't exist yet (or the transaction rolled back) → publish **after commit** (`transaction.on_commit`, or the **outbox pattern**).
- **Lost on deploy:** `BackgroundTasks` or `acks_late=False` with killed workers → use real queue semantics and graceful worker shutdown (`SIGTERM` lets the current task finish).

**Monitor:** queue length, task age, failure rate (Flower, Prometheus exporter); dead-letter queues for tasks that fail repeatedly.

---

### Scenario 6 — "Users get logged out randomly, or get 401s right after logging in."

**Clarify:** only some instances? Only after deploys? Only mobile?

**Causes**
- **Different JWT secrets** on different instances or services (an env var not set everywhere) → tokens signed by one aren't valid on another.
- **Clock skew** between servers → tokens look "not yet valid" or expired → allow `leeway=30` seconds when decoding.
- Access token expiry shorter than expected, with **no refresh flow** in the client.
- Cookies: missing `SameSite=None; Secure` for cross-site setups, or a domain mismatch between `api.` and `app.`.

**Fix:** secrets from one secret manager; RS256 + JWKS when several services verify tokens; a refresh token with rotation; log the decode error **reason** (expired / bad signature / audience), not just "401".

---

### Scenario 7 — "Our LLM chat endpoint is slow, expensive, and sometimes hangs forever."

**Fix**
- **Stream** tokens (SSE / `StreamingResponse`), so the first words appear in ~1 s even if the full answer takes 15 s.
- **Timeouts** on the provider call, plus retries **only** on safe errors (429/5xx) with backoff.
- **Stop on disconnect** (`await request.is_disconnected()`), so you don't pay for answers nobody reads.
- **Per-user rate limits and token budgets**; cache answers to identical prompts where that's safe.
- Keep the provider key on the server only; log prompt and response sizes and cost per request.
- Move long jobs (summarising 200 PDFs) to a **queue** with progress updates.

---

### Scenario 8 — "The ML model endpoint handles only 5 requests/second."

**Verify:** profile one request. Is the time spent loading the model, in pre-processing, or in inference?

**Fix**
- **Load the model once** at startup in `lifespan`, never per request.
- Don't run CPU inference in `async def` on the event loop: use a `def` endpoint (thread pool; many ML libraries release the GIL), or a process pool.
- **Batch** requests (micro-batching), because models are much faster per item in batches.
- Scale **horizontally** (workers/replicas; GPU instances for big models), or move the model to a dedicated inference server (Triton, TorchServe, vLLM for LLMs) with FastAPI as a thin API in front.
- Vectorise pre-processing with NumPy; cache embeddings for repeated inputs.

---

### Scenario 9 — "Our Node/Express app needs a Python feature (OCR / recommendations). How do you add it?"

**Answer outline**
1. Build a separate **FastAPI service** that owns only that feature, and route `/ai/*` to it through the same gateway (no CORS issues).
2. **Shared auth:** FastAPI verifies the same JWT Node issues (a shared HS256 secret, or RS256 + JWKS).
3. **Calls:** synchronous HTTP with timeouts for quick results; **events / queues** for slow work (OCR on upload → Redis Stream → Python worker → result saved → client notified).
4. **Data ownership:** Python writes only its own collections or tables; it reads shared data read-only.
5. **Contracts:** generate TypeScript types from FastAPI's OpenAPI spec, so React and Node catch breaking changes at build time.
6. **Ops:** one request ID / trace across both services; separate dashboards and alerts.

Also say when **not** to: if it's one LLM API call, Node can do it with the provider's JS SDK, without a second service to run.

---

### Scenario 10 — "Tests pass locally but fail randomly in CI."

**Causes**
- **Shared state between tests:** module-level dicts, `app.dependency_overrides` not cleared, a database not reset → use per-test fixtures, clear overrides in `finally`, and roll back a transaction per test.
- **Time-dependent code** (`datetime.now()`, TTLs) → inject a clock / use `freezegun` / `time-machine`.
- **Test order:** install `pytest-randomly` so tests run in random order, which exposes hidden dependencies between them.
- **Real network calls** to third parties → mock them with `respx` (httpx) or `responses` (requests).
- **Async leaks:** tasks not awaited, event loops shared between tests → use `pytest-asyncio` with the right loop scope, and await everything.
- **Different services in CI** (SQLite locally, Postgres in CI) → use Testcontainers or Docker Compose for the same database everywhere.

---

### Scenario 11 — "Python is too slow for our nightly data job (4 hours)."

**Measure first:** `cProfile` / `py-spy record` → where does the time go?

**Fixes, in order of impact**
1. **Push work into the database:** one SQL `GROUP BY` instead of loading 10 million rows into Python loops.
2. **Better algorithms and data structures:** `set` / `dict` lookups instead of nested loops over lists.
3. **Vectorise:** Polars / pandas / NumPy instead of row-by-row Python code.
4. **Parallelise:** split by date or customer across processes (`ProcessPoolExecutor`) or Celery tasks; for I/O-bound steps, use asyncio with a semaphore.
5. **Batch I/O:** bulk inserts (`COPY`, `insert_many`) and fewer round trips.
6. Only then: Cython / Rust extensions, or PyPy.

Report results like: "4 h → 12 min: 80% from moving the aggregation into SQL, the rest from Polars and 8 processes."

---

### Scenario 12 — "A circular import broke the app after a refactor (`ImportError: cannot import name 'User' from partially initialized module`)."

**Cause:** `models.py` imports `services.py`, which imports `models.py`. One of them sees the other half-initialised.

**Fix**
- Move shared types into a lower-level module that imports nothing from the app (`app/domain/types.py`).
- Import the **module** instead of names (`from app import models` → `models.User` at call time).
- For type hints only: `from typing import TYPE_CHECKING` + `if TYPE_CHECKING: from app.models import User`, with string annotations.
- Fix the **dependency direction**: routers → services → repositories → models, never backwards.

---

## 🎯 What Interviewers Are Scoring

- You know Python-specific failure modes: **blocking the event loop, the GIL and CPU work, unbounded caches, pool exhaustion, duplicate task runs, circular imports**.
- You **measure** (`py-spy`, `tracemalloc`, tracing, load tests) before changing code.
- Your fixes include **prevention**: startup config validation, lockfiles, idempotent tasks, outbox, isolated tests, alerts.

---

[← SQL Scenarios](08-sql-scenarios.md) | [Index](../README.md) | [Next: Production Incident Scenarios →](05-production-incident-scenarios.md)
