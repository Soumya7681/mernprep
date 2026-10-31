# Chapter 105 — FastAPI Fundamentals

## 📖 Definition

**FastAPI** is a modern, high-performance Python web framework for building APIs. It uses standard **Python type hints** to:

- **validate and convert** request data (path, query, headers, body),
- **serialise** responses,
- **generate OpenAPI docs** automatically (Swagger UI at `/docs`, ReDoc at `/redoc`),
- support editor autocomplete and type checking.

It's built on two libraries:

- **Starlette:** the ASGI web toolkit (routing, middleware, WebSockets, requests and responses).
- **Pydantic (v2):** data validation and serialisation (its core is written in Rust).

It runs on an **ASGI server** such as **Uvicorn**.

## 🔍 Explanation

### WSGI vs ASGI

| | WSGI | ASGI |
|---|---|---|
| Model | Synchronous, one request per worker thread | **Async**, many connections per worker |
| Frameworks | Flask, Django (classic) | **FastAPI**, Starlette, Django (async views), Quart |
| Servers | Gunicorn, uWSGI | **Uvicorn**, Hypercorn, Granian |
| WebSockets | No | Yes |

### FastAPI vs Express vs Flask vs Django

| | Express (Node) | Flask | Django + DRF | **FastAPI** |
|---|---|---|---|---|
| Validation | Manual / Zod / Joi | Manual / Marshmallow | Serializers | **Built in (Pydantic, from type hints)** |
| API docs | Manual Swagger | Plugins | Plugins | **Automatic OpenAPI** |
| Async | Native | Limited | Partial | **Native** |
| DI | None (middleware) | None | None | **`Depends()`** |
| ORM | Any (Prisma, Mongoose) | Any | Django ORM, built in | Any (SQLAlchemy, SQLModel, Tortoise, Beanie for MongoDB) |
| Batteries (admin, auth) | Few | Few | **Many** | Few |
| Best for | JS/TS teams | Small apps | Full products with an admin panel | **APIs, ML model serving, microservices** |

### Why it's fast

- **ASGI + async**: one worker handles thousands of I/O-bound connections.
- **Pydantic v2** validation runs in Rust.
- It's among the fastest Python frameworks, close to Node and Go for I/O-bound work. CPU-bound work is still limited by Python and the GIL, so scale it with multiple worker processes.

## 💻 Code Example: Hello FastAPI

```bash
pip install "fastapi[standard]"      # includes uvicorn, the fastapi CLI, httpx, email-validator
```

```python
# main.py
from fastapi import FastAPI

app = FastAPI(title="Blog API", version="1.0.0")

@app.get("/")
def root():
    return {"message": "Hello FastAPI"}      # dicts, lists and Pydantic models become JSON
```

```bash
fastapi dev main.py            # development: auto-reload, http://127.0.0.1:8000
fastapi run main.py            # production mode
uvicorn main:app --reload      # the same thing, with uvicorn directly
```

Open **http://127.0.0.1:8000/docs** for interactive Swagger UI, generated from your code.

## 💻 Path, Query, Header and Body Parameters

FastAPI decides **where each parameter comes from** by looking at the function signature:

| Declared as | Comes from |
|---|---|
| A name that appears in the path `{post_id}` | **Path** |
| A simple type (`int`, `str`, `bool`, …) not in the path | **Query string** |
| A Pydantic model | **JSON body** |
| `Header()`, `Cookie()`, `Form()`, `File()` | Those parts of the request |

```python
from typing import Annotated
from fastapi import FastAPI, Path, Query, Header, HTTPException

app = FastAPI()

@app.get("/posts/{post_id}")
async def get_post(
    post_id: Annotated[int, Path(gt=0)],                         # /posts/abc → 422; /posts/0 → 422
    include_comments: bool = False,                              # ?include_comments=true
    user_agent: Annotated[str | None, Header()] = None,          # User-Agent header
):
    return {"id": post_id, "comments": include_comments, "ua": user_agent}

@app.get("/posts")
async def list_posts(
    q: Annotated[str | None, Query(min_length=2, max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    tags: Annotated[list[str], Query()] = [],                    # ?tags=a&tags=b
):
    return {"q": q, "limit": limit, "offset": offset, "tags": tags}
```

- `Annotated[type, metadata]` is the **recommended style**. The type stays a normal type, and the extra validation rules go in the metadata.
- A parameter with **no default is required**. `X | None = None` makes it optional.
- Bad input gets an automatic **422 Unprocessable Entity** with details about each problem.

### Route order matters

```python
@app.get("/users/me")            # must come BEFORE /users/{user_id}
async def me(): ...

@app.get("/users/{user_id}")     # otherwise "me" would be matched as user_id and fail int parsing
async def get_user(user_id: int): ...
```

## 💻 Request Bodies with Pydantic v2

```python
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict

class Role(str, Enum):
    user = "user"
    admin = "admin"

class Address(BaseModel):
    city: str
    pin: str = Field(pattern=r"^\d{6}$")

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8)
    confirm_password: str
    role: Role = Role.user
    tags: list[str] = Field(default_factory=list, max_length=5)
    address: Address | None = None                      # nested model

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip().title()

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("passwords do not match")
        return self

@app.post("/users", status_code=201)
async def create_user(user: UserCreate):
    data = user.model_dump(exclude={"password", "confirm_password"})   # Pydantic v2 (v1: .dict())
    return data
```

Sending `{"email": "nope", "name": "R", "password": "x"}` gives a **422** with one entry per problem. This is the real output from the example app:

```json
{
  "detail": [
    { "type": "value_error",      "loc": ["body", "email"],    "msg": "value is not a valid email address: An email address must have an @-sign.", "input": "nope" },
    { "type": "string_too_short", "loc": ["body", "name"],     "msg": "String should have at least 2 characters", "input": "R" },
    { "type": "string_too_short", "loc": ["body", "password"], "msg": "String should have at least 8 characters", "input": "x" }
  ]
}
```

### Pydantic v1 → v2 changes interviewers ask about

| v1 | v2 |
|---|---|
| `.dict()`, `.json()` | `.model_dump()`, `.model_dump_json()` |
| `parse_obj()` | `model_validate()` |
| `@validator` | `@field_validator` |
| `@root_validator` | `@model_validator` |
| `class Config: orm_mode = True` | `model_config = ConfigDict(from_attributes=True)` |
| Pure Python | Rust core (`pydantic-core`), 5–50× faster |

## 💻 Response Models: Never Leak Fields

```python
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)    # read from ORM objects (user.email), not just dicts
    id: int
    email: EmailStr
    name: str

@app.post("/users", response_model=UserOut, status_code=201)
async def register(data: UserCreate, db: DB):
    user = User(email=data.email, name=data.name, hashed_password=hash_pw(data.password))
    ...
    return user       # an ORM object with hashed_password, but the response only has id, email, name
```

`response_model` (or a return-type annotation like `-> UserOut`):
1. **filters** the output to the declared fields (so `hashed_password` is never sent),
2. **validates** the output,
3. **documents** the response schema in OpenAPI.

Other options: `response_model_exclude_none=True`, `response_model_exclude_unset=True` (useful for PATCH).

**Common pattern:** separate models per use: `UserCreate` (input with password), `UserUpdate` (all fields optional), `UserOut` (public output), `UserInDB` (internal).

## 💻 Status Codes, Errors and Responses

```python
from fastapi import status, HTTPException, Response
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse, FileResponse

@app.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(post_id: int):
    if not await repo.exists(post_id):
        raise HTTPException(status_code=404, detail="Post not found")   # → {"detail": "Post not found"}
    await repo.delete(post_id)

@app.get("/report.csv")
def report():
    def rows():
        yield "id,title\n"
        for p in fetch_posts_lazily():         # a generator: streams with no big memory use
            yield f"{p.id},{p.title}\n"
    return StreamingResponse(rows(), media_type="text/csv")
```

## 💻 Form Data and File Uploads

```python
from fastapi import UploadFile, File, Form   # needs python-multipart

@app.post("/avatar")
async def upload_avatar(
    user_id: Annotated[int, Form()],
    file: Annotated[UploadFile, File(description="PNG or JPEG, max 2 MB")],
):
    if file.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(415, "Only PNG/JPEG allowed")
    content = await file.read()               # UploadFile is spooled: kept in memory, or on disk if large
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(413, "File too large")
    return {"filename": file.filename, "size": len(content)}
```

For large files in production, use **S3 pre-signed URLs**, so the client uploads directly to storage.

## 🔍 `async def` vs `def` Endpoints (Most-Asked FastAPI Question)

```python
@app.get("/async")
async def async_endpoint():
    data = await httpx_client.get("https://api.example.com")   # ✅ non-blocking
    return data.json()

@app.get("/sync")
def sync_endpoint():
    data = requests.get("https://api.example.com")             # ✅ fine: runs in a thread pool
    return data.json()

@app.get("/broken")
async def broken():
    time.sleep(5)                                              # ❌ blocks the event loop: EVERY request waits
    return {"ok": True}
```

| | Runs on | Use when |
|---|---|---|
| `async def` | The event loop (main thread) | Every call inside is `await`-able (async DB driver, `httpx.AsyncClient`) |
| `def` | An external **thread pool** (AnyIO, 40 threads by default) | You use blocking libraries (`requests`, sync SQLAlchemy, `boto3`) |

Rule: **if you can't `await` it, don't call it inside `async def`**. Use `def`, or wrap it with `await run_in_threadpool(fn)` / `asyncio.to_thread(fn)`. The same rule applies to dependencies.

## 💻 Organising a Bigger App: APIRouter

```
app/
  main.py
  core/config.py          # settings (pydantic-settings)
  core/security.py        # hashing, JWT
  db/session.py           # engine, SessionLocal, get_db
  models/                 # SQLAlchemy models
  schemas/                # Pydantic models
  routers/users.py, posts.py
  services/               # business logic
  tests/
```

```python
# app/routers/posts.py
from fastapi import APIRouter

router = APIRouter(prefix="/posts", tags=["posts"])

@router.get("/")
async def list_posts(): ...

@router.get("/{post_id}")
async def get_post(post_id: int): ...
```

```python
# app/main.py
from fastapi import FastAPI
from app.routers import posts, users

app = FastAPI()
app.include_router(users.router)
app.include_router(posts.router, prefix="/api/v1")   # → /api/v1/posts
```

`APIRouter` is FastAPI's version of `express.Router()`. Routers can also have their own `dependencies=[Depends(...)]`, for example to require auth on every route in them.

## 🌍 Real-World Use

- **ML and AI model serving:** load the model once at startup, and expose `/predict` with a validated Pydantic input. FastAPI is the standard tool for this.
- **Microservices** next to a MERN app: the Node API calls a Python FastAPI service for recommendations, PDF parsing or LLM calls.
- **Internal tools and BFFs**, because the OpenAPI docs come for free and can generate TypeScript clients (`openapi-typescript`, `orval`).
- Netflix, Uber and Microsoft are among the companies that have used it publicly.

## 🎯 Likely Interview Questions

1. **What is FastAPI and why is it fast?**
2. **What are Starlette, Pydantic and Uvicorn, and how do they fit together?**
3. **WSGI vs ASGI?**
4. **How does FastAPI know whether a parameter is path, query or body?**
5. **What happens when validation fails?** — 422 with a `detail` list.
6. **What is `response_model` and why use it?**
7. **`async def` vs `def` endpoints: how does FastAPI run each one?**
8. **What happens if you call `time.sleep()` inside an `async def` endpoint?**
9. **How do you get automatic API docs? Where are they?**
10. **What changed from Pydantic v1 to v2?**
11. **`field_validator` vs `model_validator`?**
12. **How do you structure a large FastAPI project?** — `APIRouter`, schemas vs models, services.
13. **Why does route order matter?**
14. **How do you handle file uploads?**
15. **FastAPI vs Flask vs Django: when would you pick each?**

---

[← SQL Interview Questions](../29-sql/05-sql-interview-questions.md) | [Index](../README.md) | [Next: Dependency Injection, Auth & Middleware →](02-dependency-injection-auth-middleware.md)
