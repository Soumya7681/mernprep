# Chapter 107 — Databases, Testing & Deployment

## 📖 Definition

A production FastAPI service usually has:

- **SQLAlchemy 2.0** (async) as the ORM, with **PostgreSQL** through the `asyncpg` driver. **SQLModel** (SQLAlchemy + Pydantic in one class, by FastAPI's author) is a lighter option. For MongoDB, use **Beanie** or **Motor / PyMongo async**.
- **Alembic** for schema migrations.
- **pytest** with FastAPI's `TestClient` (or `httpx.AsyncClient`) and **dependency overrides** for tests.
- **Uvicorn** workers inside **Docker**, behind a reverse proxy or load balancer.

The model, session and test code below is from the example blog API. Its test suite **passed** on FastAPI 0.162 + SQLAlchemy 2.1 + Pydantic 2.14 (using SQLite through `aiosqlite`; with Postgres, only the URL changes).

## 💻 SQLAlchemy 2.0 Models (Typed Style)

```bash
pip install "sqlalchemy[asyncio]" asyncpg alembic
```

```python
# app/db/models.py
from datetime import datetime
from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str]                         # NOT NULL, because it isn't Optional
    posts: Mapped[list["Post"]] = relationship(back_populates="author", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str]
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)   # index foreign keys
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    author: Mapped[User] = relationship(back_populates="posts")
```

`Mapped[str | None]` makes a column nullable. The type hints drive both the SQL schema and editor type checking.

### ORM model vs Pydantic schema

| | SQLAlchemy model | Pydantic schema |
|---|---|---|
| Represents | A database table | The shape of API input or output |
| Has | Relationships, DB constraints | Validation rules, examples |
| Example | `User` (with `hashed_password`) | `UserCreate`, `UserOut` (without it) |
| Bridge | `UserOut.model_validate(user)` with `from_attributes=True` | |

Keeping them separate means a database change doesn't silently change the API contract, and the other way round.

## 💻 Async Engine and Session

```python
# app/db/session.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://app:secret@localhost:5432/blog",
    pool_size=10, max_overflow=20, pool_pre_ping=True,     # connection pool settings
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with SessionLocal() as session:
        yield session

DB = Annotated[AsyncSession, Depends(get_db)]
```

`expire_on_commit=False` keeps attributes loaded after `commit()`, so you can return the object without another query. (In async code, an expired attribute would need a lazy load, which isn't allowed.)

## 💻 CRUD With SQLAlchemy 2.0 `select()`

```python
from sqlalchemy import select, func, update, delete
from sqlalchemy.orm import selectinload

# Create
@app.post("/posts", response_model=PostOut, status_code=201)
async def create_post(data: PostCreate, db: DB, user: CurrentUser):
    post = Post(**data.model_dump(), author_id=user.id)
    db.add(post)
    await db.commit()
    # load the author eagerly for the response (lazy loading isn't allowed in async)
    return await db.scalar(select(Post).options(selectinload(Post.author)).where(Post.id == post.id))

# Read a list with filter + pagination
@app.get("/posts", response_model=list[PostOut])
async def list_posts(db: DB, q: str | None = None, limit: int = 20, offset: int = 0):
    stmt = (
        select(Post)
        .options(selectinload(Post.author))          # 2 queries total, not 1 + N
        .order_by(Post.id.desc())
        .limit(limit).offset(offset)
    )
    if q:
        stmt = stmt.where(Post.title.ilike(f"%{q}%"))   # still a bound parameter: safe from injection
    return (await db.scalars(stmt)).all()

# Read one by primary key
post = await db.get(Post, post_id)

# Update (load-modify-save keeps ORM events and validation)
post.title = "New title"
await db.commit()

# Bulk update / delete in one SQL statement
await db.execute(update(Post).where(Post.author_id == uid).values(title=func.upper(Post.title)))
await db.execute(delete(Post).where(Post.created_at < cutoff))
await db.commit()

# Aggregates
count = await db.scalar(select(func.count()).select_from(Post).where(Post.author_id == uid))
rows = (await db.execute(
    select(User.name, func.count(Post.id).label("n"))
    .join(Post, isouter=True).group_by(User.id).order_by(func.count(Post.id).desc())
)).all()
```

### Loading strategies (the N+1 problem again)

| Strategy | SQL | Use for |
|---|---|---|
| Lazy (default) | A query each time you access the relation | ❌ in async (raises an error); causes N+1 in sync code |
| `selectinload(Post.author)` | 1 extra query: `WHERE id IN (...)` | **One-to-many and many-to-one collections** (the usual best choice) |
| `joinedload(Post.author)` | A `JOIN` in the same query | Many-to-one, single objects |
| `raiseload("*")` | Raises if anything lazy-loads | Catching N+1 in tests |

### Transactions

```python
async with db.begin():               # commits at the end, rolls back on an exception
    sender = await db.get(Account, 1, with_for_update=True)    # SELECT ... FOR UPDATE
    receiver = await db.get(Account, 2, with_for_update=True)
    if sender.balance < amount:
        raise HTTPException(400, "Insufficient balance")
    sender.balance -= amount
    receiver.balance += amount
```

### Repository / service layer

```python
class PostRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    async def get(self, post_id: int) -> Post | None:
        return await self.db.scalar(select(Post).options(selectinload(Post.author)).where(Post.id == post_id))
    async def add(self, post: Post) -> Post:
        self.db.add(post); await self.db.commit(); return post

def get_post_repo(db: DB) -> PostRepository:
    return PostRepository(db)

PostRepo = Annotated[PostRepository, Depends(get_post_repo)]

@app.get("/posts/{post_id}", response_model=PostOut)
async def get_post(post_id: int, repo: PostRepo):
    post = await repo.get(post_id)
    if not post:
        raise NotFoundError("Post", post_id)
    return post
```

Routes handle HTTP, services hold the business rules, and repositories handle queries. Each layer can be tested and mocked on its own.

## 💻 Migrations With Alembic

```bash
alembic init -t async migrations          # async template
```

```python
# migrations/env.py (key line)
from app.db.models import Base
target_metadata = Base.metadata           # so autogenerate can compare models with the DB
```

```bash
alembic revision --autogenerate -m "add posts table"   # writes migrations/versions/xxxx_add_posts_table.py
alembic upgrade head                                   # apply
alembic downgrade -1                                   # roll back one
alembic history
```

- **Always review** autogenerated migrations. They miss renames (a rename shows up as drop + add, which **loses data**), some constraint changes, and data migrations.
- In production, run `alembic upgrade head` as a deploy step **before** starting the new app version.
- Don't use `Base.metadata.create_all()` in production. It's fine for tests and demos only.
- Zero-downtime changes use **expand → migrate data → contract** (add the new column, backfill, switch the code over, then drop the old column).

## 💻 Testing

```python
# tests/test_posts.py
import asyncio
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db.models import Base
from app.db.session import get_db

# In-memory SQLite that every connection shares
test_engine = create_async_engine(
    "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)

async def override_get_db():
    async with TestSession() as session:
        yield session

async def reset_schema():                                  # a fresh, empty schema for every test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

@pytest.fixture
def client():
    asyncio.run(reset_schema())
    app.dependency_overrides[get_db] = override_get_db     # swap the real DB for the test DB
    with TestClient(app) as c:                             # "with" runs lifespan (startup and shutdown)
        yield c
    app.dependency_overrides.clear()

def auth_headers(client, email="asha@x.com"):
    client.post("/users", json={"email": email, "name": "Asha", "password": "secret123"})
    r = client.post("/auth/token", data={"username": email, "password": "secret123"})   # form data
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

def test_register_hides_password(client):
    r = client.post("/users", json={"email": "ravi@x.com", "name": "Ravi", "password": "secret123"})
    assert r.status_code == 201
    assert "hashed_password" not in r.json()

def test_duplicate_email_is_409(client):
    body = {"email": "dup@x.com", "name": "Dup", "password": "secret123"}
    client.post("/users", json=body)
    assert client.post("/users", json=body).status_code == 409

def test_validation_errors(client):
    r = client.post("/users", json={"email": "nope", "name": "R", "password": "x"})
    assert r.status_code == 422
    assert [e["loc"] for e in r.json()["detail"]] == [["body", "email"], ["body", "name"], ["body", "password"]]

def test_requires_auth(client):
    assert client.get("/users/me").status_code == 401

def test_only_author_can_delete(client):
    owner = auth_headers(client)
    pid = client.post("/posts", json={"title": "Hello FastAPI", "body": "..."}, headers=owner).json()["id"]
    other = auth_headers(client, "other@x.com")
    assert client.delete(f"/posts/{pid}", headers=other).status_code == 403
    assert client.delete(f"/posts/{pid}", headers=owner).status_code == 204

def test_query_limits(client):
    assert client.get("/posts?limit=500").status_code == 422   # le=100
    assert client.get("/posts/0").status_code == 422           # Path(gt=0)
```

```bash
pytest -q --cov=app
```

Testing tips:
- **`dependency_overrides`** replaces any dependency: the DB, the current user (`lambda: fake_user` to skip login), or external API clients.
- For async tests (e.g. calling async services directly), use `pytest-asyncio` or `anyio`, plus `httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")`.
- Use a real Postgres in CI (Docker / Testcontainers) for anything that depends on Postgres features. Wrap each test in a transaction that's rolled back, so tests stay isolated.

## 💻 Deployment

### Running in production

```bash
# Simple: uvicorn with several worker processes (one per CPU core is a good start)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers

# Or the FastAPI CLI (uses uvicorn)
fastapi run app/main.py --workers 4

# Or gunicorn as a process manager with uvicorn workers
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000
```

On Kubernetes or ECS, many teams run **one worker per container** and scale by adding containers (replicas), letting the orchestrator manage processes.

### Dockerfile

```dockerfile
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt     # cached layer: only rebuilds when deps change

COPY ./app ./app
RUN useradd --create-home appuser
USER appuser                                            # don't run as root

EXPOSE 8000
CMD ["fastapi", "run", "app/main.py", "--port", "8000"]
```

### Production checklist

| Area | What to do |
|---|---|
| Config | `pydantic-settings`; secrets from env or a secret manager; never commit `.env` |
| Docs | Turn off or protect `/docs` in public prod: `FastAPI(docs_url=None, redoc_url=None)`, or put them behind auth |
| CORS | An explicit list of origins |
| DB | Connection pool sized for the DB's limit; Alembic migrations in CI/CD; PgBouncer if needed |
| Async hygiene | No blocking calls in `async def`; reuse one `httpx.AsyncClient` (created in lifespan) |
| Health | `/health` (liveness) and `/ready` (checks the DB) for the load balancer and Kubernetes |
| Observability | Structured JSON logs with a request ID; OpenTelemetry tracing (`opentelemetry-instrumentation-fastapi`); Prometheus metrics |
| Security | HTTPS at the proxy, rate limiting, input size limits, dependency scanning (`pip-audit`) |
| Background jobs | Celery or ARQ workers deployed separately from the API |
| Graceful shutdown | Uvicorn finishes in-flight requests on SIGTERM; clean up in `lifespan` |

### Performance tips

- `async def` + async drivers (`asyncpg`, `httpx`, `redis.asyncio`) for I/O-heavy endpoints.
- `selectinload` to avoid N+1; add indexes; use keyset pagination for big tables.
- Cache hot reads in Redis. Return `ORJSONResponse` for very large JSON payloads.
- CPU-heavy work (image processing, ML inference) goes to a process pool, a task queue, or a separate service, never on the event loop.

## 🌍 Real-World Use

- FastAPI + Postgres + SQLAlchemy + Alembic + Docker is the standard Python API stack today.
- ML teams serve models with FastAPI behind a load balancer, with one model loaded per worker in `lifespan`.
- Next to a MERN app: the React frontend calls Node for most features and a FastAPI service for AI or data features. Both validate the same JWT.

## 🎯 Likely Interview Questions

1. **How do you connect FastAPI to PostgreSQL? Sync or async SQLAlchemy?**
2. **SQLAlchemy model vs Pydantic schema: why keep both?**
3. **How do you manage the DB session per request?** — A `yield` dependency.
4. **What is `expire_on_commit=False` and why use it with async?**
5. **What is the N+1 problem in SQLAlchemy and how do you fix it?** — `selectinload` / `joinedload`.
6. **How do you run a transaction? How do you lock a row?**
7. **How do database migrations work with Alembic? What can autogenerate miss?**
8. **How do you test FastAPI endpoints?** — `TestClient`, `dependency_overrides`, a test DB.
9. **How do you mock the current user in tests?**
10. **How do you deploy FastAPI? How many workers?**
11. **Uvicorn vs Gunicorn: why combine them?**
12. **How do you make zero-downtime schema changes?**
13. **What would you check before taking a FastAPI service to production?**
14. **SQLModel vs SQLAlchemy?** — SQLModel uses one class for both table and schema (less code); SQLAlchemy is more flexible for complex apps.

---

[← Dependency Injection, Auth & Middleware](02-dependency-injection-auth-middleware.md) | [Index](../README.md) | [Next: Caching, Rate Limiting, Idempotency & Background Jobs →](../32-fastapi-advanced/01-caching-rate-limiting-background-jobs.md)
