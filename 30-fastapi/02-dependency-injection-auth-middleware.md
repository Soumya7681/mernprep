# Chapter 106 — Dependency Injection, Auth & Middleware

## 📖 Definition

- **Dependency injection (DI)** in FastAPI means declaring **what an endpoint needs** (a DB session, the current user, settings, pagination parameters) with `Depends(...)`. FastAPI then **creates and passes** those values for each request. Dependencies can depend on other dependencies, and they're cached within a request.
- **Authentication** is usually **OAuth2 password flow + JWT bearer tokens**, built from FastAPI's security dependencies.
- **Middleware** runs code **around every request** (logging, request IDs, CORS, timing). Similar to Express middleware.
- **Exception handlers**, **background tasks** and **lifespan events** complete the request lifecycle.

All the code in this chapter comes from the example blog API, which was run end to end with tests on FastAPI 0.162, Pydantic 2.14 and SQLAlchemy 2.1.

## 💻 `Depends`: The Basics

```python
from typing import Annotated
from fastapi import Depends, FastAPI, Query

app = FastAPI()

# A dependency is any callable: function, async function or class
def pagination(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    return {"limit": limit, "offset": offset}

Page = Annotated[dict, Depends(pagination)]     # reusable type alias

@app.get("/posts")
async def list_posts(page: Page):
    return page                                 # its query parameters also show up in /docs

@app.get("/users")
async def list_users(page: Page):
    return page
```

### Why DI?

| Without DI | With `Depends` |
|---|---|
| Every route parses the token, opens a session and closes it | Declared once, reused everywhere |
| Hard to test (globals, imports) | `app.dependency_overrides[get_db] = fake_db` in tests |
| Validation logic repeated | A dependency's parameters are validated and documented too |

### Dependencies with `yield`: setup and teardown

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(settings.database_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with SessionLocal() as session:      # opened before the endpoint runs
        yield session                          # the endpoint uses it
    # closed after the response, even if the endpoint raised an error

DB = Annotated[AsyncSession, Depends(get_db)]
```

This is the same idea as a context manager. Code after `yield` runs after the endpoint, which makes it the place to commit, roll back or close.

### Sub-dependencies and caching

```python
async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DB) -> User: ...
async def get_admin(user: Annotated[User, Depends(get_current_user)]) -> User: ...

@app.delete("/users/{uid}")
async def delete_user(uid: int, admin: Annotated[User, Depends(get_admin)], db: DB): ...
```

FastAPI builds the **dependency graph**: `delete_user → get_admin → get_current_user → (oauth2_scheme, get_db)`. Within **one request**, each dependency runs **once**, and its result is cached and shared. So `get_db` here gives the same session to both `get_current_user` and `delete_user`. Use `Depends(fn, use_cache=False)` to turn this off.

### Class dependencies and parameterised dependencies

```python
class RequireRole:
    def __init__(self, *roles: str):
        self.roles = roles

    def __call__(self, user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in self.roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

@app.get("/admin/stats", dependencies=[Depends(RequireRole("admin"))])   # result not needed
async def stats(): ...
```

### Where dependencies can be attached

```python
@app.get("/x", dependencies=[Depends(verify_api_key)])         # one route
router = APIRouter(dependencies=[Depends(get_current_user)])    # every route in a router
app = FastAPI(dependencies=[Depends(log_request)])              # the whole app
```

## 💻 Settings with pydantic-settings

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    database_url: str = "sqlite+aiosqlite:///./dev.db"
    jwt_secret: str                       # required: the app won't start without JWT_SECRET
    jwt_expire_minutes: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]

@lru_cache                                # read the env once
def get_settings() -> Settings:
    return Settings()
```

Environment variables are matched case-insensitively (`JWT_SECRET` → `jwt_secret`) and **converted to the right type**, so a missing or wrong value fails at startup, not in the middle of a request.

## 💻 Authentication: OAuth2 Password Flow + JWT

```bash
pip install pyjwt "pwdlib[argon2]"     # passlib is unmaintained; pwdlib is the modern choice
```

```python
from datetime import datetime, timedelta, timezone
import jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()               # Argon2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")   # reads "Authorization: Bearer <token>"

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.jwt_secret, algorithm="HS256")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DB) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])  # checks signature + exp
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise credentials_error
    user = await db.get(User, user_id)
    if user is None:
        raise credentials_error
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]
```

```python
@app.post("/auth/token", response_model=Token)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    # OAuth2 spec: form fields "username" and "password" (send the email as username)
    user = await db.scalar(select(User).where(User.email == form.username))
    if not user or not password_hash.verify(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")   # same message: don't reveal which part was wrong
    return Token(access_token=create_access_token(user.id))

@app.get("/users/me", response_model=UserOut)
async def read_me(user: CurrentUser):
    return user
```

Because `tokenUrl` is declared, the **Authorize** button in `/docs` works: log in once and every request sends the token.

### The request flow

```
POST /auth/token (form: username, password)
  → verify the Argon2 hash → sign a JWT {sub, exp}           → { access_token, token_type: "bearer" }

GET /users/me   Authorization: Bearer eyJ...
  → oauth2_scheme pulls out the token (no header → 401 automatically)
  → get_current_user decodes it, loads the user              → endpoint gets a User object
```

### Production notes

- Use a **strong secret** of at least 32 bytes. PyJWT warns about short HMAC keys. Use RS256 with a key pair when other services need to verify tokens.
- Use **short-lived access tokens** (15–30 min) plus a **refresh token** in an `httpOnly`, `Secure`, `SameSite` cookie, rotated on each use.
- Logout or revocation: keep a deny-list of token IDs (`jti`) in Redis, or a token version on the user.
- **Scopes:** `Security(get_current_user, scopes=["posts:write"])` with `SecurityScopes` for fine-grained permissions.
- API keys: `APIKeyHeader(name="X-API-Key")`. Or use a provider (Auth0, Cognito, Keycloak) and verify their JWTs with JWKS.

## 💻 Middleware

```python
import time, uuid
from fastapi import Request

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    start = time.perf_counter()
    response = await call_next(request)            # runs the rest of the app
    response.headers["x-request-id"] = request_id
    response.headers["x-process-time"] = f"{time.perf_counter() - start:.4f}"
    return response
```

### CORS (needed when React on :5173 calls FastAPI on :8000)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://app.example.com"],   # never ["*"] together with credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Other built-in middleware: `GZipMiddleware`, `TrustedHostMiddleware`, `HTTPSRedirectMiddleware`. Rate limiting usually comes from `slowapi` or the API gateway.

### Middleware vs dependency

| | Middleware | Dependency |
|---|---|---|
| Runs for | **Every** request (including 404s and static files) | Only routes that declare it |
| Has access to | Raw request / response | Parsed, validated parameters; can return values to the endpoint |
| Shows in OpenAPI | No | Yes (its params and security) |
| Use for | Logging, timing, request IDs, CORS, compression | Auth, DB session, permissions, pagination |

Middleware added later wraps the ones added earlier, so the **last one added runs first** on the way in.

## 💻 Exception Handlers

```python
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

class NotFoundError(Exception):
    def __init__(self, entity: str, entity_id: int):
        self.entity, self.entity_id = entity, entity_id

@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": f"{exc.entity} {exc.entity_id} not found"})

@app.exception_handler(RequestValidationError)        # customise the 422 format
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "VALIDATION_FAILED",
                 "fields": {".".join(map(str, e["loc"][1:])): e["msg"] for e in exc.errors()}},
    )

@app.get("/posts/{post_id}")
async def get_post(post_id: int, db: DB):
    post = await db.get(Post, post_id)
    if post is None:
        raise NotFoundError("Post", post_id)          # → 404 {"detail": "Post 999 not found"}
    return post
```

Domain code raises **domain exceptions**, and the handlers turn them into HTTP responses. That keeps services free of HTTP details.

Register handlers when the app is defined, as above. Starlette builds its handler stack when the app starts, so a handler added with `app.add_exception_handler(...)` after startup has no effect.

## 💻 Background Tasks

```python
from fastapi import BackgroundTasks

def send_welcome_email(email: str) -> None:
    ...   # SMTP / SES call

@app.post("/users", response_model=UserOut, status_code=201)
async def register(data: UserCreate, db: DB, background: BackgroundTasks):
    user = ...                                          # create and commit
    background.add_task(send_welcome_email, user.email) # runs AFTER the response is sent
    return user
```

`BackgroundTasks` runs **in the same process** after the response. It's good for quick fire-and-forget work. It is **not** durable: if the process restarts, the task is lost, and there are no retries. For important or heavy jobs, use **Celery / ARQ / Dramatiq / RQ** with Redis or RabbitMQ.

## 💻 Lifespan: Startup and Shutdown

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: runs once before the first request
    app.state.http = httpx.AsyncClient(timeout=10)       # a shared connection pool
    app.state.model = load_ml_model("model.pkl")         # load heavy things once
    yield
    # shutdown
    await app.state.http.aclose()
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

`@app.on_event("startup")` is **deprecated**. Use `lifespan`.

## 💻 WebSockets

```python
from fastapi import WebSocket, WebSocketDisconnect

class Hub:
    def __init__(self):
        self.clients: set[WebSocket] = set()
    async def broadcast(self, msg: str):
        for ws in list(self.clients):
            await ws.send_text(msg)

hub = Hub()

@app.websocket("/ws/chat")
async def chat(ws: WebSocket):
    await ws.accept()
    hub.clients.add(ws)
    try:
        while True:
            await hub.broadcast(await ws.receive_text())
    except WebSocketDisconnect:
        hub.clients.discard(ws)
```

With several workers, each process has its own `Hub`. Use Redis Pub/Sub to broadcast between them, the same problem as Socket.IO's Redis adapter.

## 🔍 The Request Lifecycle

```
Request
 → middleware (last added first)
 → routing (find the path operation)
 → resolve dependencies (validate path/query/header/body, run Depends graph; yield deps run their setup)
 → endpoint function
 → response_model validation + serialisation
 → yield-dependency teardown (after the endpoint finishes)
 → middleware (in reverse)
 → Response sent
 → BackgroundTasks run
```

Any `HTTPException` or custom exception is caught by the matching exception handler and turned into a response.

## 🌍 Real-World Use

- `get_db` + `get_current_user` + `RequireRole(...)` cover the auth and data access of most CRUD APIs.
- Multi-tenant SaaS apps resolve a `tenant` dependency from the subdomain or JWT, and every query filters on it.
- An ML service loads its model in `lifespan`, validates input with Pydantic, and logs request IDs in middleware.

## 🎯 Likely Interview Questions

1. **What is dependency injection in FastAPI? Why is it useful?**
2. **How do `yield` dependencies work? When does the code after `yield` run?**
3. **Are dependencies cached? How many times does `get_db` run in one request?**
4. **How do you require authentication on every route in a router?**
5. **How do you implement JWT auth in FastAPI?** Walk through `OAuth2PasswordBearer` and `get_current_user`.
6. **How do you store passwords?** — Argon2 or bcrypt hashing (pwdlib); never plain text or a fast hash like SHA-256.
7. **How do you implement role-based access control?**
8. **Middleware vs dependency: when do you use each?**
9. **How do you configure CORS for a React frontend?**
10. **How do you return custom error formats?** — `exception_handler`, `RequestValidationError`.
11. **BackgroundTasks vs Celery?**
12. **How do you run code at startup and shutdown?** — `lifespan` (`on_event` is deprecated).
13. **How do you manage configuration and secrets?** — `pydantic-settings` + env vars.
14. **How do you scale FastAPI WebSockets across workers?**

---

[← FastAPI Fundamentals](01-fastapi-fundamentals.md) | [Index](../README.md) | [Next: Databases, Testing & Deployment →](03-databases-testing-deployment.md)
