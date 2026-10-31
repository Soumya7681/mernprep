# Chapter 134 — FastAPI Coding Questions

## 📖 Definition

FastAPI coding rounds ask you to **build a small piece of an API live**: CRUD with partial updates, search with pagination, an auth dependency, consistent error responses, file uploads, bulk endpoints, background jobs, webhook verification and health checks. Interviewers look at **Pydantic models**, **correct status codes**, **dependencies** for reusable logic, and **security details** (validating input, signatures, never trusting the client).

**All 10 tasks are from one app with a pytest suite of 11 tests, and every test passes** on FastAPI 0.162 + Pydantic 2.14. The responses shown are real test output. Data is kept in memory so each task stays short; in a real service, the dicts would be SQLAlchemy repositories.

## 🧠 Checklist While Coding

- Separate models: `XIn` (create), `XUpdate` (all optional), `X` / `XOut` (response).
- Status codes: **201** created, **202** accepted (async job), **204** deleted, **207** mixed results, **401 / 403**, **404**, **409** conflict, **413** too large, **415** wrong media type, **422** validation, **503** not ready.
- Put "load it or 404" and "check permissions" in **dependencies**, not copied into every route.
- Never let the client choose raw SQL or sort columns. Use an `Enum`.
- Mention how you'd test it: `TestClient` + `dependency_overrides`.

---

## Task 1: CRUD With Partial Updates (PATCH)

```python
import itertools
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI()

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    price: int = Field(ge=0, description="paise")
    category: str
    stock: int = Field(default=0, ge=0)

class ProductUpdate(BaseModel):                      # every field optional for PATCH
    name: str | None = Field(default=None, min_length=2, max_length=100)
    price: int | None = Field(default=None, ge=0)
    category: str | None = None
    stock: int | None = Field(default=None, ge=0)

class Product(ProductIn):
    id: int

PRODUCTS: dict[int, Product] = {}
NEXT_ID = itertools.count(1)          # never reuses an id, even after deletes

def get_product_or_404(product_id: int) -> Product:
    product = PRODUCTS.get(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return product

ExistingProduct = Annotated[Product, Depends(get_product_or_404)]   # reused by every /{product_id} route

@app.post("/products", response_model=Product, status_code=201)
def create_product(data: ProductIn):
    product = Product(id=next(NEXT_ID), **data.model_dump())
    PRODUCTS[product.id] = product
    return product

@app.patch("/products/{product_id}", response_model=Product)
def update_product(data: ProductUpdate, product: ExistingProduct):
    changes = data.model_dump(exclude_unset=True)       # ONLY the fields the client sent
    updated = product.model_copy(update=changes)
    PRODUCTS[product.id] = updated
    return updated

@app.delete("/products/{product_id}", status_code=204)
def delete_product(product: ExistingProduct):
    del PRODUCTS[product.id]
```

```text
PATCH /products/2  {"price": 180}
→ 200 {"name": "Notebook", "price": 180, "category": "Stationery", "stock": 40, "id": 2}   other fields kept
PATCH /products/2  {"price": -1}   → 422
PATCH /products/99 {"price": 1}    → 404
DELETE /products/3 → 204, then again → 404
```

**Why `exclude_unset=True`:** without it, `{"price": 180}` would also send `name: None`, `stock: None`, … and wipe out the other fields.

**Why a counter for IDs:** `len(PRODUCTS) + 1` looks fine, but after deleting product 1, the next product would get an ID that **already exists** and overwrite it. One of the tests deletes a product, then checks that the next ID is 4.

## Task 2: Search With Filters, Safe Sorting and a Generic Page Model

```python
from enum import Enum
from typing import Generic, TypeVar
from fastapi import Query

T = TypeVar("T")

class Page(BaseModel, Generic[T]):                   # reusable response envelope
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

class SortField(str, Enum):                          # whitelist: the client can't sort by anything else
    name = "name"
    price = "price"

def page_params(page: Annotated[int, Query(ge=1)] = 1,
                size: Annotated[int, Query(ge=1, le=100)] = 20):
    return {"page": page, "size": size}

@app.get("/products", response_model=Page[Product])
def search_products(
    params: Annotated[dict, Depends(page_params)],
    q: Annotated[str | None, Query(max_length=50)] = None,
    category: str | None = None,
    min_price: Annotated[int | None, Query(ge=0)] = None,
    sort: SortField = SortField.name,
    desc: bool = False,
):
    rows = list(PRODUCTS.values())
    if q:
        rows = [p for p in rows if q.lower() in p.name.lower()]
    if category:
        rows = [p for p in rows if p.category == category]
    if min_price is not None:
        rows = [p for p in rows if p.price >= min_price]
    rows.sort(key=lambda p: getattr(p, sort.value), reverse=desc)
    page, size = params["page"], params["size"]
    start = (page - 1) * size
    return Page[Product](items=rows[start:start + size], total=len(rows),
                         page=page, size=size, pages=(len(rows) + size - 1) // size)
```

```text
GET /products?category=Stationery&sort=price&desc=true  → items: Notebook (200), Pen (50); total 2
GET /products?size=2&page=2                              → items: [Pen]; total 3; pages 2
GET /products?sort=id; DROP TABLE x                      → 422 "Input should be 'name' or 'price'"
```

With SQLAlchemy, the enum maps to columns: `order_by(getattr(Product, sort.value).desc() if desc else ...)`. User input is never put into SQL text.

## Task 3: API-Key Authentication With Roles

```python
from fastapi.security import APIKeyHeader

API_KEYS = {"key-admin-123": {"client": "dashboard", "role": "admin"},
            "key-read-456":  {"client": "partner",   "role": "reader"}}   # in real life: hashed, in a DB

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)   # shows an "Authorize" box in /docs

def get_client(key: Annotated[str | None, Depends(api_key_header)]) -> dict:
    if key is None or key not in API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return API_KEYS[key]

def require_role(*roles: str):                       # dependency factory
    def checker(client: Annotated[dict, Depends(get_client)]) -> dict:
        if client["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return client
    return checker

@app.get("/admin/report")
def admin_report(client: Annotated[dict, Depends(require_role("admin"))]):
    return {"client": client["client"], "products": len(PRODUCTS)}
```

```text
no header            → 401
X-API-Key: reader    → 403
X-API-Key: admin     → 200 {"client": "dashboard", "products": 0}
```

Production notes: store only **hashes** of API keys (like passwords), compare with `hmac.compare_digest`, let keys be rotated, and rate-limit per key.

## Task 4: Domain Errors → RFC 9457 `problem+json`

```python
from fastapi import Request
from fastapi.responses import JSONResponse

class DomainError(Exception):
    status_code = 400
    title = "Bad request"
    def __init__(self, detail: str):
        self.detail = detail

class OutOfStock(DomainError):
    status_code = 409
    title = "Out of stock"

@app.exception_handler(DomainError)                 # catches every subclass too
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(
        status_code=exc.status_code,
        media_type="application/problem+json",
        content={"type": f"https://errors.example.com/{type(exc).__name__}", "title": exc.title,
                 "status": exc.status_code, "detail": exc.detail, "instance": request.url.path},
    )

class ReserveIn(BaseModel):
    quantity: int = Field(gt=0)

@app.post("/products/{product_id}/reserve", response_model=Product)
def reserve(data: ReserveIn, product: ExistingProduct):
    if product.stock < data.quantity:
        raise OutOfStock(f"Only {product.stock} left of {product.name}")   # no HTTP details in business code
    updated = product.model_copy(update={"stock": product.stock - data.quantity})
    PRODUCTS[product.id] = updated
    return updated
```

```text
POST /products/3/reserve {"quantity": 10}
→ 409  content-type: application/problem+json
  {"type": "https://errors.example.com/OutOfStock", "title": "Out of stock", "status": 409,
   "detail": "Only 5 left of Backpack", "instance": "/products/3/reserve"}
POST /products/3/reserve {"quantity": 2} → 200, stock 3
```

(With a real database, the reserve step is the atomic `UPDATE ... WHERE stock >= :qty` from the SQL coding chapter.)

## Task 5: Image Upload With Real Validation

```python
from fastapi import File, UploadFile

MAX_BYTES = 1 * 1024 * 1024
ALLOWED = {"image/png", "image/jpeg"}
PNG_MAGIC, JPEG_MAGIC = b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff"

@app.post("/products/{product_id}/image", status_code=201)
async def upload_image(product: ExistingProduct, file: Annotated[UploadFile, File()]):
    if file.content_type not in ALLOWED:                      # the header can be faked...
        raise HTTPException(415, "Only PNG or JPEG images are allowed")
    data = await file.read(MAX_BYTES + 1)                     # read at most limit+1 bytes
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image larger than 1 MB")
    if not (data.startswith(PNG_MAGIC) or data.startswith(JPEG_MAGIC)):   # ...so check the real bytes
        raise HTTPException(415, "File content is not a real PNG/JPEG")
    return {"product_id": product.id, "filename": file.filename, "bytes": len(data)}
```

```text
a real PNG                 → 201 {"product_id": 1, "filename": "a.png", "bytes": 108}
a GIF                      → 415
an .exe renamed to .png    → 415 (magic bytes don't match)
a PNG over 1 MB            → 413
```

Mention: never use the client's filename as a storage path (path traversal). Generate a UUID key. For large files, return an **S3 pre-signed URL** instead of passing the bytes through the API.

## Task 6: Bulk Create With Per-Item Results (207 Multi-Status)

```python
from pydantic import ValidationError

@app.post("/products/bulk", status_code=207)
def bulk_create(rows: Annotated[list[dict], Field(max_length=500)]):     # cap the batch size
    results = []
    for index, row in enumerate(rows):
        try:
            data = ProductIn.model_validate(row)                         # validate each item separately
        except ValidationError as e:
            results.append({"index": index, "ok": False,
                            "errors": [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]})
            continue
        product = Product(id=next(NEXT_ID), **data.model_dump())
        PRODUCTS[product.id] = product
        results.append({"index": index, "ok": True, "id": product.id})
    return {"created": sum(r["ok"] for r in results),
            "failed": sum(not r["ok"] for r in results), "results": results}
```

```json
{"created": 1, "failed": 2, "results": [
  {"index": 0, "ok": true, "id": 1},
  {"index": 1, "ok": false, "errors": ["name: String should have at least 2 characters",
                                        "price: Input should be greater than or equal to 0"]},
  {"index": 2, "ok": false, "errors": ["name: Field required", "category: Field required"]}]}
```

If the body were typed `list[ProductIn]`, **one** bad row would reject the whole request with a 422. Ask which behaviour the business wants: **all-or-nothing** (one DB transaction) or **best effort** (above).

## Task 7: Start a Background Export and Poll Its Status

```python
import uuid
from fastapi import BackgroundTasks

JOBS: dict[str, dict] = {}

def build_export(job_id: str) -> None:
    JOBS[job_id]["status"] = "running"
    rows = [p.model_dump() for p in PRODUCTS.values()]
    JOBS[job_id].update(status="done", result={"rows": len(rows)})

@app.post("/exports", status_code=202)                # 202 Accepted: work continues after the response
def start_export(background: BackgroundTasks):
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "queued", "result": None}
    background.add_task(build_export, job_id)
    return {"job_id": job_id, "status_url": f"/exports/{job_id}"}

@app.get("/exports/{job_id}")
def export_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Unknown job")
    return JOBS[job_id]
```

```text
POST /exports            → 202 {"job_id": "...", "status_url": "/exports/..."}
GET  /exports/{job_id}   → {"status": "done", "result": {"rows": 3}}
```

Then say: "In production, the job and its status live in **Celery/ARQ + Redis or the DB**, because `BackgroundTasks` and an in-memory dict disappear on restart and aren't shared between workers."

## Task 8: Verify a Signed Webhook (HMAC, Replay and Duplicate Protection)

```python
import hashlib, hmac, json, time
from fastapi import Header

WEBHOOK_SECRET = b"whsec_test_secret"
SEEN_EVENTS: set[str] = set()                        # in production: a DB unique constraint or Redis SET NX

@app.post("/webhooks/payments")
async def payment_webhook(
    request: Request,
    x_signature: Annotated[str, Header()],
    x_timestamp: Annotated[int, Header()],
):
    if abs(time.time() - x_timestamp) > 300:          # reject old requests (replay attacks)
        raise HTTPException(400, "Stale webhook")
    body = await request.body()                       # sign the RAW bytes, not re-serialised JSON
    expected = hmac.new(WEBHOOK_SECRET, f"{x_timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_signature):    # constant-time comparison
        raise HTTPException(401, "Bad signature")
    event = json.loads(body)
    if event["id"] in SEEN_EVENTS:                    # providers retry, so de-duplicate by event id
        return {"status": "duplicate"}
    SEEN_EVENTS.add(event["id"])
    return {"status": "processed", "type": event["type"]}
```

```text
valid signature             → {"status": "processed", "type": "payment.captured"}
same event again            → {"status": "duplicate"}   (still 200, so the provider stops retrying)
wrong signature             → 401
valid signature, 10 min old → 400
```

## Task 9: Liveness and Readiness Endpoints

```python
from fastapi.responses import JSONResponse

class Database:
    async def ping(self) -> bool: ...                 # e.g. SELECT 1

def get_database() -> Database:
    return db

@app.get("/health")                                   # liveness: "the process is up"; no dependencies
def health():
    return {"status": "ok"}

@app.get("/ready")                                    # readiness: "send me traffic"; checks dependencies
async def ready(database: Annotated[Database, Depends(get_database)]):
    if not await database.ping():
        return JSONResponse(status_code=503, content={"status": "unavailable", "db": "down"})
    return {"status": "ready", "db": "up"}
```

```text
GET /ready                         → 200 {"status": "ready", "db": "up"}
GET /ready (DB overridden as down) → 503 {"status": "unavailable", "db": "down"}
```

The test swaps the database with `app.dependency_overrides[get_database] = lambda: Down()`. Liveness must **not** check the database: if the DB has a blip, Kubernetes would restart every pod for nothing.

## Task 10: Versioned API With a Deprecated v1

```python
from fastapi import APIRouter

v1 = APIRouter(prefix="/api/v1", tags=["v1"])
v2 = APIRouter(prefix="/api/v2", tags=["v2"])

@v1.get("/users/{user_id}", deprecated=True)          # crossed out in /docs
def get_user_v1(user_id: int):
    return {"id": user_id, "name": "Asha Rao"}

class UserV2(BaseModel):
    id: int
    first_name: str
    last_name: str

@v2.get("/users/{user_id}", response_model=UserV2)
def get_user_v2(user_id: int):
    return UserV2(id=user_id, first_name="Asha", last_name="Rao")

app.include_router(v1)
app.include_router(v2)
```

```text
GET /api/v1/users/7 → {"id": 7, "name": "Asha Rao"}
GET /api/v2/users/7 → {"id": 7, "first_name": "Asha", "last_name": "Rao"}
openapi.json marks the v1 route "deprecated": true
```

Both versions should call the **same service layer**; only the request and response shapes differ.

---

## 🧪 How These Were Tested (Show This in the Interview)

Two tests written in the same style as the suite. Being able to write tests like these on the spot is a strong signal.

```python
from fastapi.testclient import TestClient

client = TestClient(app)

def test_patch_keeps_other_fields():
    client.post("/products", json={"name": "Notebook", "price": 200, "category": "Stationery", "stock": 40})
    r = client.patch("/products/1", json={"price": 180})
    assert r.status_code == 200
    assert r.json()["stock"] == 40                  # untouched

def test_ready_returns_503_when_db_is_down():
    class Down:
        async def ping(self): return False
    app.dependency_overrides[get_database] = lambda: Down()
    try:
        assert client.get("/ready").status_code == 503
    finally:
        app.dependency_overrides.clear()
```

## 🎯 Likely Interview Questions

1. **Why separate create, update and response models?**
2. **What does `exclude_unset=True` do in a PATCH handler?**
3. **How do you stop a client from sorting or filtering by arbitrary columns?**
4. **How do you build a reusable paginated response type?** — A generic `Page[T]` Pydantic model.
5. **Where should "load or 404" and permission checks live?** — In dependencies.
6. **How do you validate an uploaded file properly?** — Type header + size limit + magic bytes + safe storage name.
7. **When is 207 appropriate? All-or-nothing vs best effort for bulk endpoints?**
8. **How do you verify webhooks?** — HMAC over the raw body + timestamp, `compare_digest`, de-duplicate by event ID.
9. **Liveness vs readiness?**
10. **How would you version this API?**

---

[← SQL Coding Questions](08-sql-coding-questions.md) | [Index](../README.md) | [Next: GraphQL Coding Questions →](10-graphql-coding-questions.md)
