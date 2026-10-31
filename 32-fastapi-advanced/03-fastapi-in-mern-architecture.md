# Chapter 110 — FastAPI in a MERN Architecture

## 📖 Definition

Many MERN teams add Python **without rewriting the Node backend**. A FastAPI service sits next to Express or NestJS and owns the work that Python does best: **AI / LLM features, ML models, data processing, PDF and document parsing, analytics**.

This chapter covers how the pieces fit together:

- how requests are routed,
- how both services trust the **same login**,
- how they talk to each other (HTTP and events),
- how they share **MongoDB** or keep separate data,
- how the React app gets **type-safe clients** for both.

## 🔍 A Typical Layout

```
                ┌──────────────┐
  React (Vite) ─►  Nginx / API │── /api/*     ──► Node (Express/Nest) ──► MongoDB
                │   Gateway    │── /ai/*      ──► FastAPI (Python)    ──► MongoDB / Postgres / vector DB
                └──────────────┘                     ▲      │
                                                     │      └──► LLM provider, ML model
                       Node ──── HTTP (internal) ────┘
                       Node ──── events (Redis / RabbitMQ / Kafka) ───► FastAPI workers
```

| Concern | Node service | FastAPI service |
|---|---|---|
| Users, auth, orders, payments | ✅ Owns them | Trusts Node's tokens |
| AI chat, recommendations, OCR, reports | Calls FastAPI | ✅ Owns them |
| Database | MongoDB (Mongoose) | Its own collections or DB, or reads shared data **read-only** |

**Rule:** each piece of data has **one owner service** that writes it. Two services writing the same collection with different validation rules is how data gets corrupted.

## 💻 Routing With Nginx (or an API Gateway)

```nginx
location /api/ {
    proxy_pass http://node:3000/;
}
location /ai/ {
    proxy_pass http://fastapi:8000/;
    proxy_buffering off;                 # needed for SSE / streaming LLM responses
    proxy_read_timeout 300s;
}
```

To the browser it's one origin, so there's **no CORS** and cookies work for both services.

## 💻 One Login, Two Services: Sharing JWT Verification

### Option A: shared secret (HS256). Simple, for a small team

Node signs:

```js
// Node (jsonwebtoken)
const token = jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "15m",
  issuer: "shop-api",
  audience: "shop",
});
```

FastAPI verifies, with the same secret, algorithm, issuer and audience:

```python
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

bearer = HTTPBearer()

class TokenUser(BaseModel):
    id: str
    role: str

def current_user(creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)]) -> TokenUser:
    try:
        claims = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],          # always pin the algorithm list
            issuer="shop-api",
            audience="shop",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return TokenUser(id=claims["sub"], role=claims.get("role", "user"))
```

FastAPI **doesn't need the users table** to authorise most requests; the claims are enough. Remember that MongoDB `_id`s are strings in the token, not integers.

### Option B: key pair (RS256 / ES256) with JWKS. Better as services grow

Only the auth service has the **private key**. Every other service verifies with the **public key**, fetched from a JWKS URL (`/.well-known/jwks.json`). A leaked verifier can't create tokens. This is also how you verify tokens from Auth0, Cognito, Clerk or Keycloak:

```python
from jwt import PyJWKClient

jwks = PyJWKClient("https://auth.example.com/.well-known/jwks.json")   # caches keys

def verify(token: str) -> dict:
    key = jwks.get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=["RS256"], audience="shop", issuer="https://auth.example.com/")
```

### Service-to-service auth

When **Node calls FastAPI by itself** (not on behalf of a user), use a separate credential: a short-lived service JWT (`sub: "node-api"`, `aud: "ai-service"`), an internal API key checked with `APIKeyHeader`, or mTLS / a service mesh. When it calls **on behalf of a user**, pass the user's token on, so FastAPI still checks that user's permissions.

## 💻 Node Calling FastAPI Over HTTP

```js
// Node: call the AI service with a timeout and pass on the request ID
async function summarise(text, { requestId, token }) {
  const res = await fetch(`${process.env.AI_URL}/summaries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Request-ID": requestId,                    // the same ID in both services' logs
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),           // never wait forever
  });
  if (!res.ok) throw new Error(`AI service ${res.status}`);
  return res.json();
}
```

```python
# FastAPI side
class SummaryIn(BaseModel):
    text: str = Field(min_length=20, max_length=50_000)

class SummaryOut(BaseModel):
    summary: str
    model: str

@app.post("/summaries", response_model=SummaryOut)
async def create_summary(body: SummaryIn, user: Annotated[TokenUser, Depends(current_user)]):
    summary = await summariser.run(body.text)       # LLM call, ML model, etc.
    return SummaryOut(summary=summary, model="v3")
```

Calls between services need the same protections as calls to any third-party API: **timeouts, retries with backoff only for safe or idempotent calls, a circuit breaker, and a fallback** (e.g. "summary unavailable" instead of failing the whole page).

## 💻 Events Instead of Calls (Async Work)

When Node doesn't need an answer right away (e.g. "a PDF was uploaded, extract its text"), **publish an event** and let FastAPI workers consume it.

```js
// Node: after saving the upload in a MongoDB transaction
await redis.xAdd("documents", "*", { docId: String(doc._id), s3Key: doc.s3Key });
```

```python
# Python worker (a separate process from the FastAPI web server)
import redis.asyncio as redis

async def consume():
    r = redis.from_url(REDIS_URL, decode_responses=True)
    try:
        await r.xgroup_create("documents", "extractors", id="0", mkstream=True)
    except redis.ResponseError:
        pass                                            # the group already exists
    while True:
        batches = await r.xreadgroup("extractors", "worker-1", {"documents": ">"}, count=10, block=5000)
        for _stream, messages in batches or []:
            for msg_id, fields in messages:
                await extract_text(fields["docId"], fields["s3Key"])   # must be idempotent
                await r.xack("documents", "extractors", msg_id)        # ack only after success
```

Redis Streams with consumer groups give you at-least-once delivery and the ability to replay. For more volume or guarantees, use RabbitMQ, Kafka or SQS. Celery is fine too, if only Python consumes the jobs.

## 💻 MongoDB From FastAPI

PyMongo now has an **async API** (`AsyncMongoClient`, PyMongo 4.9+), which replaces Motor. **Beanie** is an ODM on top that uses Pydantic models, like Mongoose with type hints.

```python
from pymongo import AsyncMongoClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.mongo = AsyncMongoClient(settings.mongo_uri)
    app.state.db = app.state.mongo.get_default_database()
    yield
    await app.state.mongo.close()

@app.get("/recommendations/{user_id}")
async def recommendations(user_id: str, request: Request):
    db = request.app.state.db
    orders = await db.orders.find(
        {"userId": ObjectId(user_id)}, {"items.productId": 1}
    ).sort("createdAt", -1).limit(50).to_list()
    return await recommender.for_orders(orders)
```

```python
# Beanie (ODM)
from beanie import Document, init_beanie

class Product(Document):
    name: str
    price: int
    tags: list[str] = []

    class Settings:
        name = "products"            # the same collection Mongoose uses

# at startup: await init_beanie(database=db, document_models=[Product])
cheap = await Product.find(Product.price < 50000).sort(-Product.price).to_list()
```

Gotchas when Python reads collections that Mongoose writes:
- Mongoose stores `_id` as `ObjectId` and pluralises collection names (`Product` → `products`).
- Mongoose `timestamps` are `createdAt` / `updatedAt` in camelCase.
- `ObjectId` and `datetime` need explicit conversion in Pydantic output models.
- Mongoose schema validation **doesn't apply** to Python writes, which is another reason to keep one writer per collection.

## 💻 Type-Safe Clients for React: OpenAPI → TypeScript

FastAPI already publishes `/openapi.json`. Generate TypeScript types from it, so the React app breaks at **compile time** when the Python API changes:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/ai-schema.ts
```

```ts
import createClient from "openapi-fetch";
import type { paths } from "./api/ai-schema";

const ai = createClient<paths>({ baseUrl: "/ai" });

const { data, error } = await ai.POST("/summaries", { body: { text } });
//       ^ typed as SummaryOut; body is checked against SummaryIn
```

Run this in CI against the deployed spec, so a renamed field fails the frontend build instead of production. (Orval and Hey API also generate clients and TanStack Query hooks.)

## 💻 Local Development With Docker Compose

```yaml
services:
  mongo:
    image: mongo:8
    ports: ["27017:27017"]
  redis:
    image: redis:7
  node:
    build: ./server
    environment:
      MONGO_URI: mongodb://mongo:27017/shop
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      AI_URL: http://fastapi:8000
    depends_on: [mongo, redis]
  fastapi:
    build: ./ai
    command: fastapi dev app/main.py --host 0.0.0.0
    environment:
      MONGO_URI: mongodb://mongo:27017/shop
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}            # same secret as Node (Option A)
    depends_on: [mongo, redis]
  ai-worker:
    build: ./ai
    command: python -m app.worker
    depends_on: [redis]
  web:
    build: ./client
    ports: ["5173:5173"]
```

## 🔍 Observability Across Two Languages

- **One request ID** from the gateway → `X-Request-ID` → logged by both Node (pino) and FastAPI (structlog + `contextvars`).
- **Distributed tracing** with OpenTelemetry on both sides (`@opentelemetry/auto-instrumentations-node`, `opentelemetry-instrumentation-fastapi`). The W3C `traceparent` header links the spans, so one trace shows React → Node → FastAPI → MongoDB.
- Separate dashboards per service, with **RED metrics** (Rate, Errors, Duration) and alerts on the AI service's latency and cost.

## 🔍 When NOT to Add a Python Service

- The feature is simple CRUD that Node already handles well.
- The team has nobody to own and run a second language in production.
- The "AI feature" is one HTTP call to an LLM provider, which Node can make just as well with the provider's JS SDK.

A second service brings its own deploys, monitoring, on-call and network failures. **Add one when Python's libraries (ML, data, document processing) are the reason**, not for variety.

## 🌍 Real-World Use

- An e-commerce MERN app adds a FastAPI "AI service" for product description generation and semantic search over a vector index. Node keeps auth, cart and payments.
- An HR tool sends uploaded résumés from Node to a Redis Stream; Python workers parse PDFs and store structured data; React polls or gets SSE updates.
- Analytics: FastAPI with Polars reads a MongoDB replica (read-only) or a warehouse to build reports, so heavy queries never touch the primary.

## 🎯 Likely Interview Questions

1. **Why would a MERN team add a FastAPI service? When would you advise against it?**
2. **How do Node and FastAPI share authentication?** — The same JWT, verified with a shared HS256 secret, or RS256 + JWKS.
3. **HS256 vs RS256 for tokens shared between services?**
4. **How do services authenticate to each other?**
5. **Sync HTTP calls vs events between services: when do you use each?**
6. **What should every call between services have?** — Timeouts, retries only for idempotent calls, a circuit breaker, a fallback, request ID propagation.
7. **Should both services write to the same MongoDB collection?**
8. **How do you use MongoDB from Python?** — PyMongo's async client, or Beanie.
9. **How does the React app stay type-safe with a Python API?** — Generate TS types from FastAPI's OpenAPI spec.
10. **How do you trace one user request across Node and Python services?**
11. **How do you route `/api` and `/ai` to different services without CORS problems?**
12. **What changes in Nginx for streaming responses?** — `proxy_buffering off`, long read timeouts.

---

[← Streaming, SSE & Real-Time](02-streaming-sse-realtime.md) | [Index](../README.md) | [Next: FastAPI Interview Questions →](04-fastapi-interview-questions.md)
