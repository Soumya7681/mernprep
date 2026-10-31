# Chapter 98 — Testing, Packaging & Tooling

## 📖 Definition

Professional Python projects share a standard toolchain:

| Job | Tool | Node.js equivalent |
|---|---|---|
| Tests | **pytest** (+ `pytest-cov`, `pytest-asyncio`, `pytest-mock`) | Jest / Vitest |
| Mocks | `unittest.mock`, pytest `monkeypatch` | `jest.fn()`, `jest.mock()` |
| Project config | **`pyproject.toml`** | `package.json` |
| Environments and dependencies | **uv** (or Poetry, pip + venv) | npm / pnpm |
| Lint and format | **Ruff** | ESLint + Prettier |
| Type checking | **mypy** / **pyright** | `tsc` |
| Git hooks | **pre-commit** | husky + lint-staged |
| Logging | `logging` / **structlog** | pino / winston |

All the tests in this chapter were run together and **pass (8 passed)** on Python 3.14 with pytest.

## 💻 pytest Basics

```
shop/
  pricing.py
  rates.py
  orders.py
tests/
  conftest.py          # shared fixtures, discovered automatically
  test_shop.py         # files named test_*.py, functions named test_*
```

```python
# shop/pricing.py
from datetime import date

GST_RATE = 0.18

def final_price(amount: int, coupon: str | None = None) -> int:
    """Amount in paise. Applies a coupon, then GST."""
    if amount < 0:
        raise ValueError("amount must be >= 0")
    if coupon == "NEW10":
        amount = amount * 90 // 100
    return round(amount * (1 + GST_RATE))

def is_sale_day(today: date | None = None) -> bool:
    today = today or date.today()          # inject "today" so tests don't depend on the clock
    return today.weekday() == 4            # Friday
```

```python
# tests/test_shop.py
from datetime import date
import pytest
from shop.pricing import final_price, is_sale_day

@pytest.mark.parametrize(
    "amount, coupon, expected",
    [
        (10000, None, 11800),
        (10000, "NEW10", 10620),
        (0, None, 0),
    ],
)
def test_final_price(amount, coupon, expected):
    assert final_price(amount, coupon) == expected      # plain assert: pytest shows both values on failure

def test_negative_amount_raises():
    with pytest.raises(ValueError, match="must be >= 0"):
        final_price(-1)

def test_sale_day_is_friday():
    assert is_sale_day(date(2026, 10, 30)) is True      # a Friday
    assert is_sale_day(date(2026, 10, 31)) is False
```

```bash
pytest -q                          # run everything
pytest tests/test_shop.py::test_final_price -v
pytest -k "price and not negative" # select by name
pytest -x --lf                     # stop at the first failure; rerun only the last failures
pytest --cov=shop --cov-report=term-missing
```

## 💻 Fixtures

A fixture is a function that provides test data or resources. Tests ask for a fixture **by naming it as a parameter**, which is dependency injection, like FastAPI's `Depends`.

```python
# tests/conftest.py
import pytest

class FakeRepo:
    def __init__(self):
        self.rows = []
    def save(self, row):
        self.rows.append(row)
        return len(self.rows)

@pytest.fixture
def repo():
    return FakeRepo()                  # a new one for every test (function scope)
```

```python
@pytest.fixture
def db_conn():
    conn = {"open": True}              # setup
    yield conn                         # the test runs here
    conn["open"] = False               # teardown always runs, even if the test fails

def test_yield_fixture(db_conn):
    assert db_conn["open"]
```

| Scope | Created | Use for |
|---|---|---|
| `function` (default) | Once per test | Most fixtures, so tests stay isolated |
| `class` / `module` | Once per class or file | Moderately expensive setup |
| `session` | Once per test run | A DB engine, a Docker container, an app instance |

Built-in fixtures: `tmp_path` (a temporary folder), `monkeypatch`, `capsys` (captured output), `caplog` (captured logs).

## 💻 Mocking

### `monkeypatch`: replace something for one test

```python
# shop/rates.py
import httpx

def fetch_usd_rate() -> float:
    r = httpx.get("https://api.example.com/usd-inr", timeout=5)
    r.raise_for_status()
    return r.json()["rate"]

def to_usd(paise: int) -> float:
    return round(paise / 100 / fetch_usd_rate(), 2)
```

```python
from shop import rates

def test_to_usd_with_monkeypatch(monkeypatch):
    monkeypatch.setattr(rates, "fetch_usd_rate", lambda: 85.0)   # no real HTTP call
    assert rates.to_usd(850000) == 100.0
```

`monkeypatch.setenv("JWT_SECRET", "x" * 32)` sets environment variables. Everything is undone after the test.

### `Mock`: record and check calls

```python
# shop/orders.py
class OrderService:
    def __init__(self, repo, mailer):          # dependencies passed in → easy to test
        self.repo = repo
        self.mailer = mailer

    def place(self, user_email: str, amount: int) -> int:
        order_id = self.repo.save({"email": user_email, "amount": amount})
        self.mailer.send(user_email, f"Order {order_id} confirmed")
        return order_id
```

```python
from unittest.mock import Mock
from shop.orders import OrderService

def test_place_order_sends_email(repo):            # "repo" fixture from conftest.py
    mailer = Mock()
    service = OrderService(repo, mailer)
    order_id = service.place("asha@x.com", 5000)

    assert order_id == 1
    assert repo.rows == [{"email": "asha@x.com", "amount": 5000}]
    mailer.send.assert_called_once_with("asha@x.com", "Order 1 confirmed")
```

### `patch`: patch where it's used, not where it's defined

```python
# shop/report.py:   from shop.rates import fetch_usd_rate
from unittest.mock import patch

with patch("shop.report.fetch_usd_rate", return_value=85.0):    # ✅ the name inside report.py
    ...
with patch("shop.rates.fetch_usd_rate", return_value=85.0):     # ❌ report.py already has its own reference
    ...
```

This is the most common mocking bug, and a favourite interview question. Other `Mock` features: `side_effect=Exception(...)` to simulate failures, `side_effect=[1, 2, 3]` for a different value per call, `AsyncMock` for `async` functions, and `spec=RealClass` so mistyped attribute names fail.

**Prefer fakes and dependency injection over patching** where you can (as with `OrderService` above). Tests that patch many internals break whenever you refactor.

### Async tests

```python
import pytest

@pytest.mark.asyncio                   # pytest-asyncio (or use @pytest.mark.anyio)
async def test_fetch_user(user_service):
    user = await user_service.get(1)
    assert user.name == "Asha"
```

## 🔍 What to Test (the Test Pyramid)

| Level | Speed | Example | Proportion |
|---|---|---|---|
| **Unit** | ms | `final_price`, a service with fake repositories | Most |
| **Integration** | 100s of ms | FastAPI `TestClient` + a real Postgres (Testcontainers) | Some |
| **End-to-end** | Seconds | Playwright through the React UI against a running stack | Few |

Also: **property-based testing** with `hypothesis` generates hundreds of inputs automatically (e.g. "`decode(encode(x)) == x` for any string").

## 💻 Project Setup with `pyproject.toml` and uv

```toml
# pyproject.toml
[project]
name = "shop"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "sqlalchemy>=2.0",
  "httpx>=0.27",
]

[project.optional-dependencies]
dev = ["pytest", "pytest-cov", "pytest-asyncio", "ruff", "mypy"]

[project.scripts]
shop-cli = "shop.cli:main"            # installs a "shop-cli" command (like "bin" in package.json)

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100
[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]   # pycodestyle, pyflakes, isort, bugbear, pyupgrade

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q --strict-markers"

[tool.mypy]
strict = true
```

```bash
uv init shop && cd shop          # create a project
uv add fastapi sqlalchemy        # add dependencies (updates pyproject.toml + uv.lock)
uv add --dev pytest ruff mypy
uv sync                          # create .venv and install exactly what's in the lockfile (like npm ci)
uv run pytest                    # run inside the project's environment
uv python install 3.13           # uv can also install Python versions
uv build && uv publish           # build a wheel/sdist and upload to PyPI
```

| File | Purpose |
|---|---|
| `pyproject.toml` | Metadata, dependencies, tool config (PEP 517/518/621) |
| `uv.lock` / `poetry.lock` | Exact, reproducible versions; **commit it** for apps |
| `requirements.txt` | Older flat list; still common in Docker builds (`uv pip compile` generates one) |
| Wheel (`.whl`) | A built, installable package |
| sdist (`.tar.gz`) | A source distribution |

**src layout** (`src/shop/...`) stops tests from importing the package from the working folder by accident, so they test the installed version. It's recommended for libraries.

## 💻 Code Quality: Ruff, mypy, pre-commit

```bash
ruff check . --fix      # lint and auto-fix (replaces flake8, isort, pyupgrade, and more)
ruff format .           # format (Black-compatible)
mypy src                # type check
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

Run `pre-commit install` once, and the hooks run on every `git commit`. Run the same checks plus `pytest` in CI (GitHub Actions).

## 💻 Logging (Not `print`)

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)        # one logger per module

def charge(order_id: int, amount: int):
    logger.info("charging order", extra={"order_id": order_id, "amount": amount})
    try:
        ...
    except Exception:
        logger.exception("charge failed for order %s", order_id)   # logs the traceback too
        raise
```

- Use `%s`-style arguments (`logger.info("x=%s", x)`), not f-strings, so the string is only built if the level is enabled.
- In production, log **structured JSON** (`structlog` or `python-json-logger`) with a request ID (via `contextvars`) so logs can be searched in ELK, Loki or CloudWatch.
- **Never log** passwords, tokens or full card numbers.

## 🌍 Real-World Use

- CI pipeline: `uv sync --frozen` → `ruff check` → `ruff format --check` → `mypy` → `pytest --cov` (with a coverage threshold) → build the Docker image.
- Services take their dependencies (repo, mailer, HTTP client) as constructor arguments, so unit tests use fakes, and only integration tests hit real infrastructure.
- Internal libraries are published to a private index (AWS CodeArtifact, GitHub Packages) and installed with `uv add`.

## 🎯 Likely Interview Questions

1. **pytest vs unittest?** — pytest: plain `assert`, fixtures, parametrize, plugins; less boilerplate.
2. **What are fixtures? What fixture scopes exist?**
3. **How does a `yield` fixture do teardown?**
4. **What is `conftest.py`?**
5. **How do you parametrize a test?**
6. **`monkeypatch` vs `unittest.mock.patch`?**
7. **Why must you "patch where it's used"?**
8. **`Mock` vs `MagicMock` vs `AsyncMock`? What does `spec` do?**
9. **How do you test code that depends on the current time or an external API?** — Inject the clock / client, or patch it.
10. **What is `pyproject.toml`? How is it different from `requirements.txt`?**
11. **Why commit a lockfile?**
12. **What does Ruff replace?**
13. **How do you set up logging properly? Why not `print`?**
14. **What is a wheel?**

---

[← Performance, Memory & Profiling](03-performance-memory-profiling.md) | [Index](../README.md) | [Next: Python Interview Questions →](05-python-interview-questions.md)
