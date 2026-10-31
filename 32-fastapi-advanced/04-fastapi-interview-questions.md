# Chapter 111 — FastAPI Interview Questions (Detailed Answers)

## 📖 How to Use This Chapter

These are FastAPI questions for Python backend and full-stack roles, grouped from basic to senior. The full code for each topic is in the **FastAPI** and **FastAPI Advanced** chapters before this one. The example apps in those chapters were run and tested on FastAPI 0.162, Pydantic 2.14 and SQLAlchemy 2.1.

---

## 1️⃣ Basics

### 1. What is FastAPI?

A modern Python framework for building APIs, built on **Starlette** (ASGI web layer) and **Pydantic** (validation). You declare parameters and models with Python **type hints**, and FastAPI uses them to validate and convert input, serialise output, and generate **OpenAPI** docs (Swagger UI at `/docs`, ReDoc at `/redoc`) automatically. It supports `async`/`await` natively and runs on an ASGI server like Uvicorn.

### 2. Why is FastAPI fast?

- It's **ASGI and async**, so one worker can serve many concurrent I/O-bound requests while others wait on the database or network.
- It sits on the lightweight Starlette toolkit.
- **Pydantic v2** validation runs in Rust.

"Fast" also means **fast to develop**: less boilerplate, validation and docs for free, and editor autocomplete.

### 3. What is ASGI and how is it different from WSGI?

WSGI (used by Flask and classic Django) is a **synchronous** interface: one request per worker thread at a time, with no WebSockets. ASGI is its **asynchronous** successor. It supports `async` handlers, long-lived connections (WebSockets, SSE) and lifespan events. FastAPI is an ASGI app; Uvicorn, Hypercorn and Granian are ASGI servers.

### 4. What are Starlette, Pydantic and Uvicorn?

- **Starlette:** routing, requests and responses, middleware, WebSockets, background tasks, the test client.
- **Pydantic:** data models, validation, serialisation, settings.
- **Uvicorn:** the server process that listens on a port and runs the ASGI app.

FastAPI adds dependency injection, parameter parsing from type hints, and OpenAPI generation on top.

### 5. FastAPI vs Flask vs Django?

- **Flask:** minimal and synchronous (WSGI), with no built-in validation or docs. Good for small apps.
- **Django:** batteries included (ORM, admin, auth, templates). Great for full products with an admin panel; DRF adds APIs.
- **FastAPI:** API-first, async, typed, with automatic validation and docs. Great for REST/JSON APIs, microservices and ML model serving. You bring your own ORM and auth.

### 6. How does FastAPI decide where a parameter comes from?

- A name that appears in the path template → **path parameter**.
- A plain type (`int`, `str`, `bool`, `list[str]` with `Query`) → **query parameter**.
- A **Pydantic model** → **JSON body**.
- Explicit markers override this: `Header()`, `Cookie()`, `Form()`, `File()`, `Body()`.
- A parameter with a default is optional; one without a default is required.

### 7. What happens when a request fails validation?

FastAPI returns **422 Unprocessable Entity** with a `detail` array. Each item has `type`, `loc` (e.g. `["body", "email"]`), `msg` and `input`, and **every** problem is reported in one response. You can change the format with an exception handler for `RequestValidationError`.

### 8. What is `Annotated` and why is it recommended?

`Annotated[int, Query(ge=1, le=100)]` attaches FastAPI metadata to a type without changing the type itself. Benefits:
- The function signature stays plain Python (the default value is a real default).
- You can reuse aliases like `DB = Annotated[AsyncSession, Depends(get_db)]`.
- Type checkers understand it.

It's the recommended style in the current FastAPI docs.

### 9. What is `response_model`?

It declares the output schema (or you can use a return annotation like `-> UserOut`). FastAPI **filters** the returned object to exactly those fields (so a `hashed_password` is never leaked), **validates** it, converts it to JSON, and **documents** it in OpenAPI. Options like `response_model_exclude_none` / `exclude_unset` control what's included.

### 10. How do you return different status codes?

Set `status_code=201` (or `status.HTTP_201_CREATED`) on the decorator for the success case. Raise `HTTPException(status_code=404, detail="...")` for errors. Return a `Response` / `JSONResponse` with an explicit status when you need full control. Document extra responses with the `responses={404: {...}}` argument.

---

## 2️⃣ Pydantic

### 11. What is Pydantic and why does FastAPI depend on it?

Pydantic validates and converts data into typed Python objects using type hints, and turns them back into JSON. FastAPI uses it to parse request bodies, query and path values, and settings, to filter responses, and to produce the JSON Schema used in the OpenAPI docs.

### 12. What changed between Pydantic v1 and v2?

The core was rewritten in Rust (`pydantic-core`), so validation is much faster. The API was renamed:
- `.dict()` → `.model_dump()`, `.json()` → `.model_dump_json()`, `parse_obj` → `model_validate`
- `@validator` → `@field_validator`, `@root_validator` → `@model_validator`
- `class Config: orm_mode = True` → `model_config = ConfigDict(from_attributes=True)`

Strict mode and better error types were also added. Current FastAPI requires v2.

### 13. `field_validator` vs `model_validator`?

`@field_validator("name")` validates or transforms **one field** (e.g. strip whitespace, check a format). `@model_validator(mode="after")` sees the **whole model** for checks across fields (e.g. `password == confirm_password`, or `start < end`). `mode="before"` runs on the raw input, before the fields are parsed.

### 14. What does `from_attributes=True` do?

It lets a Pydantic model be built from **objects with attributes** (like SQLAlchemy ORM instances), not just dicts. FastAPI needs it to turn an ORM object returned from an endpoint into the `response_model`.

### 15. How do you handle partial updates (PATCH)?

Make an update schema where every field is optional (`title: str | None = None`), then use `data.model_dump(exclude_unset=True)` to get **only the fields the client actually sent**, and apply those to the DB object. This way, leaving a field out doesn't overwrite it with `None`.

```python
@app.patch("/posts/{post_id}", response_model=PostOut)
async def patch_post(post_id: int, data: PostUpdate, db: DB, user: CurrentUser):
    post = await get_owned_post(db, post_id, user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    await db.commit()
    return post
```

---

## 3️⃣ Async & Performance

### 16. `async def` vs `def` endpoints: what's the difference?

`async def` endpoints run **directly on the event loop**, so they must only `await` non-blocking I/O. Plain `def` endpoints run in a **thread pool** (AnyIO's, 40 threads by default), so blocking libraries like `requests`, sync DB drivers and `boto3` are safe there. Dependencies follow the same rule.

### 17. What happens if you call blocking code inside `async def`?

It **blocks the event loop**, so every other request on that worker freezes until it finishes. This is the most common FastAPI performance bug: `time.sleep`, `requests.get`, sync SQLAlchemy, or heavy CPU work inside `async def`. Fixes:
- Make the endpoint plain `def`.
- Use async libraries (`httpx.AsyncClient`, `asyncpg`).
- Offload it with `await run_in_threadpool(fn)` / `asyncio.to_thread(fn)`.
- Use a process pool or task queue for CPU work.

### 18. How do you handle CPU-heavy tasks (image processing, ML inference)?

Don't run them on the event loop. Options:
- A `ProcessPoolExecutor` via `run_in_executor`, for short work.
- A task queue (**Celery / ARQ / Dramatiq**) where the API returns `202 Accepted` with a job ID and the client polls or gets a webhook or WebSocket update.
- A separate inference service.

Also scale with several Uvicorn workers or containers, so you use every core.

### 19. How do you make many outgoing HTTP calls concurrently?

Use one shared `httpx.AsyncClient` (created in `lifespan`, so connections are pooled) and `asyncio.gather` or a `TaskGroup` over the calls. Limit how many run at once with an `asyncio.Semaphore`, and set timeouts on every call.

### 20. How do you scale a FastAPI app?

- **Vertically:** several worker processes per machine (`--workers N`, or gunicorn with `UvicornWorker`).
- **Horizontally:** stateless containers behind a load balancer.

Keep state out of the process (sessions and cache in Redis, files in S3). Use DB connection pooling (and PgBouncer), Redis caching, background workers for slow jobs, and async I/O. Measure with tracing before tuning.

---

## 4️⃣ Dependency Injection

### 21. What is dependency injection in FastAPI?

You declare what an endpoint needs with `Depends(callable)`. FastAPI calls that callable for each request (resolving its own parameters, including other dependencies) and passes the result in. It's used for DB sessions, the current user, permissions, pagination and settings. It removes duplicated code, documents the parameters, and makes testing easy with `app.dependency_overrides`.

### 22. How do `yield` dependencies work?

Code before `yield` runs before the endpoint. The yielded value is injected. Code **after** `yield` runs once the endpoint has finished, even if it raised an error (use `try/finally` or a context manager). This is the standard pattern for a DB session per request:

```python
async def get_db():
    async with SessionLocal() as session:
        yield session
```

### 23. Are dependencies cached?

Yes, **per request**. If several dependencies in one request depend on `get_db`, it runs once, and they all share the same session. Use `Depends(fn, use_cache=False)` to get a new value each time. Nothing is cached **between** requests (use `lru_cache` or app state for that, e.g. for settings).

### 24. Where can dependencies be declared?

- On a **parameter** (you get its value).
- In a decorator's `dependencies=[Depends(...)]` (it runs for its side effects, like an auth check, and the value is ignored).
- On an **`APIRouter(dependencies=[...])`** for every route in the router.
- On **`FastAPI(dependencies=[...])`** for the whole app.

### 25. Middleware vs dependencies?

Middleware wraps **every** request at the ASGI level: logging, timing, request IDs, CORS, gzip. It only sees the raw request and response. Dependencies run only for routes that declare them, receive **validated** parameters, can return values to the endpoint, and appear in the OpenAPI docs. Use them for auth, the DB session, permissions and business inputs.

---

## 5️⃣ Security

### 26. How do you implement JWT authentication in FastAPI?

1. `POST /auth/token` takes `OAuth2PasswordRequestForm` (`username`, `password`), checks the password hash (Argon2 or bcrypt via `pwdlib`), and returns a signed JWT with `sub` (user ID) and `exp`.
2. `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")` pulls the token out of `Authorization: Bearer ...` (no header → automatic 401).
3. The `get_current_user` dependency decodes and verifies the JWT (signature + expiry), loads the user, and raises 401 if anything fails.
4. Protected routes declare `user: Annotated[User, Depends(get_current_user)]`.

### 27. How do you implement role-based access control?

Use a dependency that sits on top of `get_current_user` and checks the role, raising **403** if it doesn't match. A class dependency allows parameters: `Depends(RequireRole("admin", "editor"))`. For finer control, use OAuth2 **scopes** with `Security()` and `SecurityScopes`. Always check **ownership** (`post.author_id == user.id`) for resource-level rules.

### 28. 401 vs 403?

**401 Unauthorized** means "we don't know who you are": no token, or an invalid or expired one. It should include `WWW-Authenticate: Bearer`. **403 Forbidden** means "we know who you are, but you're not allowed to do this."

### 29. How do you store passwords securely?

Hash them with a slow, salted algorithm: **Argon2id** (`pwdlib`'s recommended default) or bcrypt. Never store plain text, and never use fast hashes like MD5 or SHA-256. Return the same error for "unknown email" and "wrong password", and rate-limit login attempts.

### 30. How do you handle refresh tokens and logout?

Use short-lived access tokens (15–30 min) and a long-lived **refresh token** stored in an `httpOnly`, `Secure`, `SameSite` cookie. Rotate the refresh token on every use, and save its hash or ID in the database or Redis, so it can be revoked. Logout deletes or revokes the refresh token. To kill access tokens immediately, keep a deny-list of `jti` values in Redis, or a token version on the user.

### 31. How do you configure CORS?

`app.add_middleware(CORSMiddleware, allow_origins=[...], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`. List the exact frontend origins. Browsers reject a wildcard `*` origin together with credentials. CORS is enforced by the **browser**: it isn't security for server-to-server calls.

### 32. What other security measures matter for a FastAPI service?

- HTTPS (at the proxy).
- Request size limits.
- Rate limiting (`slowapi` or the gateway).
- Parameterised queries (the ORM does this).
- `response_model` to avoid leaking fields.
- Turning off or protecting `/docs` in public production.
- Secrets in env or a secret manager.
- Dependency scanning (`pip-audit`).
- `TrustedHostMiddleware`.
- Validating uploaded file types and sizes.

---

## 6️⃣ Database & Architecture

### 33. How do you integrate SQLAlchemy with FastAPI?

Create an engine (`create_async_engine("postgresql+asyncpg://...")`) and an `async_sessionmaker`, and provide a session per request through a `yield` dependency. Define models with SQLAlchemy 2.0's typed `Mapped[...]` and `mapped_column` style, and query with `select()`. Keep Pydantic schemas separate for input and output, and manage the schema with **Alembic** migrations.

### 34. Why use separate SQLAlchemy models and Pydantic schemas?

They do different jobs. ORM models describe **storage** (tables, relationships, internal columns like `hashed_password`). Schemas describe the **API contract** (input validation, public output). Keeping them separate stops accidental data leaks, lets you have several API views of one table (create / update / out), and lets the DB and API change independently. **SQLModel** merges them when simplicity matters more.

### 35. How do you avoid N+1 queries in SQLAlchemy?

Load relationships **eagerly**: `select(Post).options(selectinload(Post.author))` (one extra `IN` query) or `joinedload` (a JOIN). In async SQLAlchemy, lazy loading raises an error anyway. In tests, use `raiseload("*")` to catch accidental lazy loads, and log the SQL (`echo=True`) to count the queries.

### 36. How do you structure a large FastAPI project?

Split by layer and/or feature:
- `routers/` (thin HTTP handlers, using `APIRouter`)
- `schemas/` (Pydantic)
- `models/` (ORM)
- `services/` (business logic)
- `repositories/` (queries)
- `core/` (config, security)
- `db/` (session)
- `tests/`

Wire them together with dependencies. Larger codebases often group by feature (`users/`, `orders/`, each with its own router, schemas and service).

### 37. How do you handle background work?

Use `BackgroundTasks` for small fire-and-forget jobs **after the response** (sending an email, writing a log). It runs in the same process with no retries or persistence. For anything important, slow or that needs retries, use **Celery / ARQ / Dramatiq / RQ** workers with Redis or RabbitMQ, and return a job ID.

### 38. How do you run code at startup and shutdown?

Use the **`lifespan`** async context manager passed to `FastAPI(lifespan=...)`. Code before `yield` runs at startup (create the HTTP client, load the ML model, warm caches), and code after it runs at shutdown (close connections, `engine.dispose()`). `@app.on_event("startup")` is deprecated.

### 39. How do you version an API in FastAPI?

URL versioning with routers is the most common: `app.include_router(v1_router, prefix="/api/v1")` and `/api/v2` side by side, sharing services. Header versioning is possible, but less visible. Deprecate old routes with `deprecated=True` (shown in the docs) before removing them.

### 40. How do you implement pagination?

For simple cases, use limit and offset query parameters with bounds (`Query(ge=1, le=100)`), often grouped in a reusable dependency. For large or fast-changing tables, use **keyset/cursor** pagination (`WHERE id < :cursor ORDER BY id DESC LIMIT :n`) and return `next_cursor`. The `fastapi-pagination` library has ready-made helpers.

---

## 7️⃣ Testing & Deployment

### 41. How do you test FastAPI apps?

Use `TestClient(app)` (built on httpx) with pytest. Use it as a context manager (`with TestClient(app) as c`) so `lifespan` runs. Override dependencies with `app.dependency_overrides[get_db] = override_get_db` (a test DB) or `[get_current_user] = lambda: fake_user` (skip login). For async tests, use `httpx.AsyncClient` with `ASGITransport` and `pytest-asyncio` / `anyio`. Run against a real Postgres in CI for Postgres-specific behaviour.

### 42. How do you deploy FastAPI to production?

Build a Docker image (slim Python base, install dependencies first for layer caching, run as a non-root user), and run `fastapi run` / `uvicorn --workers N` (or gunicorn with `UvicornWorker`). Put it behind a reverse proxy or load balancer that handles TLS. Run Alembic migrations as a deploy step. Configure with env vars, add `/health` and `/ready` endpoints, structured logs, tracing and metrics. On Kubernetes, use one worker per pod and scale replicas.

### 43. How many workers should you run?

Start with about **one worker per CPU core** for async apps (more doesn't help, because each worker can already handle many concurrent I/O requests). Then load-test. Keep the total DB connections (`workers × pool_size × instances`) under the database's limit.

### 44. How do you add WebSockets?

`@app.websocket("/ws")` with `await ws.accept()`, then `receive_text`/`send_text` in a loop, catching `WebSocketDisconnect`. Authenticate with a token in the query string or the first message. With several workers or instances, broadcast through **Redis Pub/Sub**, because each process only knows its own connections.

### 45. How would you serve an ML model with FastAPI?

Load the model **once** in `lifespan` (stored on `app.state`). Define a Pydantic input schema (shape, ranges) and an output schema. Run inference in a thread or process pool if it's CPU-heavy, or use `def` endpoints. Batch requests if the model benefits. Add timeouts, request size limits and metrics (latency, errors). Scale with workers or replicas, and put GPU models behind a dedicated inference server if needed.

---

## 8️⃣ Advanced Topics

### 46. How do you cache responses in FastAPI, and how do you keep the cache correct?

Use **cache-aside** with Redis: try `GET key`, fall back to the database on a miss, then `SET key value EX ttl`. On writes, update the database **first**, then **delete** the key (don't try to update it). Protect hot keys from a stampede with a short lock (`SET lock NX EX 5`) or stale-while-revalidate, add jitter to TTLs, and never cache personalised data under a shared key. Use one shared async Redis client, created in `lifespan` and injected with a dependency.

### 47. How do you implement rate limiting that works across several workers?

Keep the counter in **Redis**, not in process memory, because every worker and instance must see the same count. A dependency like `RateLimit(limit=5, window_seconds=60)` runs `INCR` on a key per client and window, sets `EXPIRE` on the first hit, and raises **429** with `Retry-After` when the count goes over the limit. Limit by user ID or API key when logged in, and by the real client IP (from trusted proxy headers) otherwise. Token bucket or sliding window algorithms avoid bursts at window boundaries.

### 48. How do you make a payment endpoint safe to retry?

Require an `Idempotency-Key` header. Atomically claim it with `SET key "processing" NX EX 86400`, store a fingerprint of the request body, do the side effect once, then save the response under the key. A retry with the same key and body gets the **stored response** back. The same key with a different body gets 422; a retry while the first is still running gets 409. Back it up with a **unique constraint** in the database.

### 49. How do you stream an LLM response to a React app through FastAPI?

FastAPI calls the provider with streaming turned on (`httpx.AsyncClient.stream`), and forwards each chunk as it arrives, either with `StreamingResponse` or as **SSE** (`response_class=EventSourceResponse` + `yield ServerSentEvent(...)`). Check `await request.is_disconnected()` so you stop paying for tokens when the user leaves. React reads it with `EventSource` (GET only) or `fetch` + `res.body.getReader()` (for POST with an auth header). Keep the provider key on the server, and rate-limit per user.

### 50. How would you add a FastAPI service next to an existing Node/Express backend?

Route `/ai/*` to FastAPI and `/api/*` to Node through one gateway (no CORS issues). Have FastAPI **verify the same JWT** (a shared HS256 secret, or RS256 with JWKS). Give each collection one owner service. Use HTTP with timeouts for calls that need an immediate answer, and events (Redis Streams, RabbitMQ) for async work. Generate TypeScript types for React from FastAPI's OpenAPI spec, and propagate one request ID or trace across both services.

---

## 🧪 Live Coding Task: A Small CRUD API

> "Build a to-do API with create, list (filter by done), toggle and delete. Validate input and return proper status codes."

```python
from typing import Annotated
from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field

app = FastAPI()

class TodoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)

class Todo(TodoIn):
    id: int
    done: bool = False

db: dict[int, Todo] = {}
next_id = 1

@app.post("/todos", response_model=Todo, status_code=status.HTTP_201_CREATED)
def create_todo(data: TodoIn):
    global next_id
    todo = Todo(id=next_id, **data.model_dump())
    db[next_id] = todo
    next_id += 1
    return todo

@app.get("/todos", response_model=list[Todo])
def list_todos(done: bool | None = None, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    items = [t for t in db.values() if done is None or t.done == done]
    return items[:limit]

@app.patch("/todos/{todo_id}/toggle", response_model=Todo)
def toggle(todo_id: int):
    todo = db.get(todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo.done = not todo.done
    return todo

@app.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(todo_id: int):
    if db.pop(todo_id, None) is None:
        raise HTTPException(status_code=404, detail="Todo not found")
```

Things to mention while you code:
- The endpoints are plain `def` because there's no async I/O; the in-memory dict would be a database in real life.
- `response_model` keeps the output shape fixed.
- Missing items return **404**, and bad input returns **422** automatically.
- What you'd add next: a DB with a `yield` session dependency, auth, and tests using `TestClient`.

---

## ⚡ Rapid-Fire Round

| Question | Answer |
|---|---|
| Default docs URLs? | `/docs` (Swagger UI), `/redoc`, `/openapi.json` |
| Validation error status? | 422 |
| Run in development? | `fastapi dev main.py` (or `uvicorn main:app --reload`) |
| FastAPI's version of Express Router? | `APIRouter` |
| Read a header? | `Annotated[str \| None, Header()]` (`user_agent` → `User-Agent`) |
| Read a cookie? | `Annotated[str \| None, Cookie()]` |
| Form data needs? | `python-multipart` |
| Startup/shutdown hook? | `lifespan` |
| Override a dependency in tests? | `app.dependency_overrides[dep] = fake` |
| Stream a large response? | `StreamingResponse(generator)` |
| Serve static files? | `app.mount("/static", StaticFiles(directory="static"))` |
| Get the raw request? | Add a `request: Request` parameter |
| Return a custom header? | `response: Response` parameter → `response.headers["X"] = "y"` |
| Hide an endpoint from the docs? | `include_in_schema=False` |
| Mark an endpoint deprecated? | `deprecated=True` |
| MongoDB with FastAPI? | Beanie (ODM) or PyMongo's async client / Motor |

---

[← FastAPI in a MERN Architecture](03-fastapi-in-mern-architecture.md) | [Index](../README.md) | [Next: TypeScript Essentials →](../15-mern-typescript/01-typescript-essentials.md)
