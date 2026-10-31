# Chapter 108 — Caching, Rate Limiting, Idempotency & Background Jobs

## 📖 Definition

These are the four patterns that take a FastAPI service from "works" to "survives real traffic":

- **Caching:** keep the results of expensive reads in **Redis**, so most requests never touch the database.
- **Rate limiting:** cap how many requests a client can make in a time window (protects login, OTP and expensive endpoints).
- **Idempotency:** a retried request (double-click, network retry, mobile app resend) must not **charge twice** or **create two orders**.
- **Background jobs:** move slow or unreliable work (emails, PDFs, webhooks, ML inference) out of the request into a **task queue** like **Celery** or **ARQ**.

The cache, rate-limit and idempotency code below was run in a test suite against an in-memory Redis (`fakeredis`) on FastAPI 0.162, and **all tests pass**. The Celery and ARQ setup is standard configuration and wasn't run (it needs a broker).

## 💻 A Shared Redis Client

```bash
pip install "redis>=5"        # redis.asyncio is included
```

```python
from contextlib import asynccontextmanager
from typing import Annotated
import redis.asyncio as redis
from fastapi import Depends, FastAPI, Request

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = redis.from_url("redis://localhost:6379/0", decode_responses=True)  # one pool per worker
    yield
    await app.state.redis.aclose()

app = FastAPI(lifespan=lifespan)

def get_redis(request: Request) -> redis.Redis:
    return request.app.state.redis

Redis = Annotated[redis.Redis, Depends(get_redis)]
```

In tests, swap in a fake: `app.dependency_overrides[get_redis] = lambda: fakeredis.aioredis.FakeRedis(decode_responses=True)`.

---

## 1️⃣ Caching

### Cache-aside (lazy loading): the default pattern

```python
import json
from fastapi import Response

@app.get("/products/{product_id}")
async def get_product(product_id: int, r: Redis, response: Response):
    key = f"product:{product_id}"
    if cached := await r.get(key):                     # 1. try the cache
        response.headers["x-cache"] = "HIT"
        return json.loads(cached)
    product = await load_product_from_db(product_id)   # 2. miss → database
    await r.set(key, json.dumps(product), ex=300)      # 3. save with a TTL (5 min)
    response.headers["x-cache"] = "MISS"
    return product

@app.put("/products/{product_id}")
async def update_product(product_id: int, r: Redis):
    ...                                                # update the database FIRST
    await r.delete(f"product:{product_id}")            # then invalidate (don't try to update the cache)
    return {"ok": True}
```

Test result: the first GET is `MISS`, the second is `HIT` (the DB loader ran **once**), and after the PUT the next GET is `MISS` again.

### Caching strategies

| Strategy | How it works | Trade-off |
|---|---|---|
| **Cache-aside** | The app reads the cache, falls back to the DB, then fills the cache | Simple; the first request after a miss is slow; data can be stale until the TTL expires |
| **Write-through** | Write to the cache and DB together | Cache is always fresh; slower writes |
| **Write-behind** | Write to the cache; flush to the DB later | Fast writes; risk of data loss |
| **TTL only** | Never invalidate; let entries expire | Simplest; stale up to the TTL |

### Problems interviewers ask about

| Problem | What happens | Fix |
|---|---|---|
| **Stampede / thundering herd** | A hot key expires and 1,000 requests hit the DB at once | A lock (`SET lock NX EX 5`) so one request rebuilds the cache; or refresh early; or stale-while-revalidate |
| **Penetration** | Requests for IDs that don't exist always miss | Cache "not found" for a short TTL; validate IDs; a Bloom filter |
| **Avalanche** | Many keys expire together | Add random jitter to TTLs |
| **Stale data** | The DB changed but the cache wasn't invalidated | Invalidate on write; short TTLs; version keys (`product:7:v3`) |
| **Per-user data leak** | A cached response with user-specific fields is served to another user | Put the user ID in the key, or don't cache personalised data |

### HTTP caching (free, no Redis)

```python
@app.get("/categories")
async def categories(response: Response):
    response.headers["Cache-Control"] = "public, max-age=600"   # browsers and CDNs can cache it for 10 min
    return await load_categories()
```

For in-process caching of pure functions, use `functools.lru_cache` or `cachetools.TTLCache`. Remember that each worker process has its own copy.

---

## 2️⃣ Rate Limiting

### A fixed-window limiter as a dependency

```python
import time
from fastapi import HTTPException, status

class RateLimit:
    def __init__(self, limit: int, window_seconds: int):
        self.limit, self.window = limit, window_seconds

    async def __call__(self, request: Request, r: Redis) -> None:
        client = request.client.host if request.client else "unknown"
        bucket = int(time.time() // self.window)
        key = f"rl:{request.url.path}:{client}:{bucket}"
        count = await r.incr(key)                    # atomic, shared across all workers and instances
        if count == 1:
            await r.expire(key, self.window)
        if count > self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
                headers={"Retry-After": str(self.window)},
            )

@app.post("/auth/login", dependencies=[Depends(RateLimit(limit=5, window_seconds=60))])
async def login(): ...
```

Test result: 7 quick login attempts → `[200, 200, 200, 200, 200, 429, 429]`.

### Algorithms

| Algorithm | Idea | Pros / cons |
|---|---|---|
| **Fixed window** | Count per minute bucket (above) | Simple; allows a burst of up to 2× at the boundary between windows |
| **Sliding window log** | Store the timestamp of each request (Redis sorted set), count the last N seconds | Accurate; more memory |
| **Sliding window counter** | Weighted mix of the current and previous windows | Good accuracy, cheap |
| **Token bucket** | Tokens refill at a steady rate; each request uses one | Allows controlled bursts; used by most API gateways |
| **Leaky bucket** | Requests drain at a fixed rate | Smooth output |

Notes:
- **Limit by the right identity:** the user ID or API key for logged-in users, the IP for anonymous ones. Behind a proxy, read the real IP from `X-Forwarded-For` only from trusted proxies (`uvicorn --proxy-headers --forwarded-allow-ips`).
- **Libraries:** `slowapi` (decorators), `fastapi-limiter`. Or do it at the edge: Nginx, API Gateway, Cloudflare.
- **In-memory limiters break with several workers**, because each process counts separately. That's why the counter lives in Redis.

---

## 3️⃣ Idempotency Keys

The client generates a unique key (a UUID) per **logical** operation and sends it as an `Idempotency-Key` header. Retries reuse the same key, and the server makes sure the work happens **once**.

```python
import hashlib
from fastapi import Header
from pydantic import BaseModel

class PaymentIn(BaseModel):
    order_id: int
    amount: int

@app.post("/payments", status_code=201)
async def create_payment(
    body: PaymentIn,
    r: Redis,
    idempotency_key: Annotated[str, Header(min_length=8, max_length=64)],   # required header
):
    key = f"idem:{idempotency_key}"
    fingerprint = hashlib.sha256(body.model_dump_json().encode()).hexdigest()

    # Claim the key atomically: NX = only set it if it doesn't exist yet
    claimed = await r.set(key, json.dumps({"status": "processing", "fp": fingerprint}), nx=True, ex=86400)
    if not claimed:
        saved = json.loads(await r.get(key))
        if saved["fp"] != fingerprint:
            raise HTTPException(422, "Idempotency-Key reused with a different body")
        if saved["status"] == "processing":
            raise HTTPException(409, "Request with this key is still processing")
        return saved["response"]                      # replay the original response

    response = await charge_card(body)                # the real side effect, done once
    await r.set(key, json.dumps({"status": "done", "fp": fingerprint, "response": response}), ex=86400)
    return response
```

Test result: two identical requests with the same key both return 201 with the **same** body, and the card is charged **once**. The same key with a different amount → **422**. No key → **422** (the header is required).

For money, also add a **database unique constraint** (e.g. on `payments.order_id` or `idempotency_key`), so even a Redis failure can't create duplicates. If the side effect fails, delete the key so the client can retry.

---

## 4️⃣ Background Jobs

### `BackgroundTasks` vs a task queue

| | `BackgroundTasks` | Celery / ARQ / Dramatiq / RQ |
|---|---|---|
| Runs | In the API process, after the response | In **separate worker processes** |
| Survives a restart or deploy | ❌ Lost | ✅ The job waits in the broker |
| Retries, scheduling, priority | ❌ | ✅ |
| Monitoring | ❌ | ✅ (Flower for Celery) |
| Use for | Quick, non-critical work (a log entry, a cache warm-up) | Emails, PDFs, video, webhooks, ML, anything that must happen |

### Celery

```python
# app/worker.py
from celery import Celery

celery = Celery("shop", broker="redis://localhost:6379/1", backend="redis://localhost:6379/2")
celery.conf.update(task_acks_late=True, worker_prefetch_multiplier=1)   # don't lose jobs if a worker dies

@celery.task(bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=5)
def send_invoice_email(self, order_id: int) -> str:
    order = load_order(order_id)            # load fresh data by ID; don't pass whole objects
    pdf = render_invoice(order)
    send_email(order.email, pdf)
    return f"sent {order_id}"
```

```python
# FastAPI side: enqueue and return immediately
from celery.result import AsyncResult

@app.post("/orders/{order_id}/invoice", status_code=202)
def queue_invoice(order_id: int):
    job = send_invoice_email.delay(order_id)
    return {"job_id": job.id}

@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    res = AsyncResult(job_id, app=celery)
    return {"status": res.status, "result": res.result if res.successful() else None}
```

```bash
celery -A app.worker worker --concurrency=4 --loglevel=info
celery -A app.worker beat         # scheduled / periodic tasks (cron-like)
```

### ARQ (async-native, Redis-only, lightweight)

```python
# worker.py
from arq.connections import RedisSettings

async def send_welcome(ctx, email: str):
    await ctx["http"].post("https://mail.example.com/send", json={"to": email})

class WorkerSettings:
    functions = [send_welcome]
    redis_settings = RedisSettings()
    max_tries = 5
```

```python
# in FastAPI: pool = await arq.create_pool(RedisSettings()) during lifespan
await pool.enqueue_job("send_welcome", "asha@x.com")
```

### Rules for reliable jobs

1. **Jobs must be idempotent:** a retried job must not send two emails or charge twice. Check a "sent" flag or use idempotency keys with the provider.
2. Pass **IDs, not objects**, so the job reads fresh data.
3. **Outbox pattern** for "save to the DB and publish a job" consistency: write the event to an `outbox` table **in the same transaction**, and a relay publishes it to the queue. This avoids "order saved but email job lost" (or the reverse).
4. Set timeouts and retry limits, and send failed jobs to a **dead-letter** queue to look at later.

## 🌍 Real-World Use

- A product page API: cache-aside with a 5-minute TTL plus invalidation on update cuts DB reads by about 95%.
- Login and OTP endpoints: 5 attempts per minute per IP and per account, `429` with `Retry-After`.
- Payments: `Idempotency-Key` header (as in Stripe's API) + a unique constraint + replaying the stored response.
- Order placed → the API returns 201 quickly → Celery workers send the email, generate the invoice PDF, and notify the warehouse webhook with retries.

## 🎯 Likely Interview Questions

1. **How do you add caching to a FastAPI endpoint?** Which pattern and why?
2. **How do you invalidate a cache? Why delete instead of update?**
3. **What is a cache stampede and how do you prevent it?**
4. **What can go wrong with caching personalised responses?**
5. **How do you implement rate limiting across several workers or servers?** — A shared counter in Redis.
6. **Fixed window vs sliding window vs token bucket?**
7. **What do you return when a client is rate limited?** — `429` + `Retry-After`.
8. **What is an idempotency key? How do you implement one safely?** — Atomic `SET NX`, a body fingerprint, replay the stored response, plus a DB unique constraint.
9. **`BackgroundTasks` vs Celery: when do you use each?**
10. **How do you make Celery tasks reliable?** — Idempotent tasks, `acks_late`, retries with backoff, dead-letter queues.
11. **What is the outbox pattern?**
12. **How does the client find out when a background job is done?** — Polling a job-status endpoint, a webhook, SSE or WebSocket.

---

[← Databases, Testing & Deployment](../30-fastapi/03-databases-testing-deployment.md) | [Index](../README.md) | [Next: Streaming, SSE & Real-Time →](02-streaming-sse-realtime.md)
