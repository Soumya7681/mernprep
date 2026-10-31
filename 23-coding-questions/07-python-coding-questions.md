# Chapter 132 — Python Coding Questions

## 📖 Definition

Python coding rounds for backend and full-stack roles mix **data-wrangling utilities** (flatten, merge, group, batch), **reliability helpers** (retry, rate limiter, TTL cache), **async control** (limit concurrency) and a few **classic data-structure problems**. Interviewers look for idiomatic Python (comprehensions, `collections`, generators, type hints), edge cases, and clear complexity reasoning.

For pure language puzzles (predict the output, mutable defaults, closures), see [Python Interview Questions](../31-python-advanced/05-python-interview-questions.md).

**All 15 solutions were run on Python 3.14, and the outputs shown are real.**

## 🧠 Checklist While Coding

- Say the **input / output contract** and edge cases first (empty input, duplicates, `None`, very large input).
- Add **type hints**; they make your intent obvious to the interviewer.
- Reach for the standard library: `collections` (`Counter`, `defaultdict`, `deque`), `itertools`, `heapq`, `functools`.
- Don't mutate the caller's arguments unless asked; return new objects.
- Inject the **clock** (`clock=time.monotonic`) into time-based classes, so they can be tested without sleeping.
- State the time and space complexity at the end.

---

## 1. Flatten a Nested Dict to Dot-Notation Keys

```python
def flatten_dict(d: dict, parent: str = "", sep: str = ".") -> dict:
    out = {}
    for key, value in d.items():
        path = f"{parent}{sep}{key}" if parent else key
        if isinstance(value, dict) and value:          # empty dicts are kept as values
            out.update(flatten_dict(value, path, sep))
        else:
            out[path] = value
    return out

cfg = {"db": {"host": "localhost", "port": 5432}, "debug": True, "tags": {}}
flatten_dict(cfg)
# {'db.host': 'localhost', 'db.port': 5432, 'debug': True, 'tags': {}}
```

**O(n)** in the total number of keys. Used for config files, Mongo `$set` paths, and analytics events.

## 2. Unflatten Dot-Notation Keys Back to a Nested Dict

```python
def unflatten_dict(flat: dict, sep: str = ".") -> dict:
    root: dict = {}
    for path, value in flat.items():
        node = root
        *parents, last = path.split(sep)
        for p in parents:
            node = node.setdefault(p, {})              # create the level if it's missing
        node[last] = value
    return root

unflatten_dict({"db.host": "localhost", "db.port": 5432, "debug": True})
# {'db': {'host': 'localhost', 'port': 5432}, 'debug': True}
```

## 3. Deep-Merge Two Dicts (Later Wins)

```python
def deep_merge(a: dict, b: dict) -> dict:
    result = dict(a)                                   # don't mutate the inputs
    for key, value in b.items():
        if isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

defaults = {"db": {"host": "localhost", "port": 5432}, "debug": False}
overrides = {"db": {"host": "prod.db"}, "debug": True}
deep_merge(defaults, overrides)
# {'db': {'host': 'prod.db', 'port': 5432}, 'debug': True}
```

`{**a, **b}` and `a | b` are **shallow**: they would replace the whole `db` dict and lose `port`.

## 4. Group Items by a Key Function

```python
from collections import defaultdict
from collections.abc import Callable, Iterable
from typing import Any, TypeVar

T = TypeVar("T")

def group_by(items: Iterable[T], key: Callable[[T], Any]) -> dict[Any, list[T]]:
    groups: dict[Any, list[T]] = defaultdict(list)
    for item in items:
        groups[key(item)].append(item)
    return dict(groups)

orders = [{"id": 1, "status": "PAID"}, {"id": 2, "status": "PENDING"}, {"id": 3, "status": "PAID"}]
group_by(orders, key=lambda o: o["status"])
# {'PAID': [{'id': 1, 'status': 'PAID'}, {'id': 3, 'status': 'PAID'}],
#  'PENDING': [{'id': 2, 'status': 'PENDING'}]}
```

Follow-up: `itertools.groupby` only groups **consecutive** equal keys, so you must sort first. This is a common trap.

## 5. Split an Iterable Into Batches (Lazily)

```python
from collections.abc import Iterator
from itertools import islice

def batched(iterable: Iterable[T], n: int) -> Iterator[tuple[T, ...]]:
    if n < 1:
        raise ValueError("n must be >= 1")
    it = iter(iterable)
    while batch := tuple(islice(it, n)):
        yield batch

list(batched(range(7), 3))     # [(0, 1, 2), (3, 4, 5), (6,)]
```

It works on generators and huge files without loading everything into memory. It's used for bulk DB inserts (`insert_many` in chunks of 1,000). Python 3.12+ has `itertools.batched` built in. Say so, then write it anyway.

## 6. Retry Decorator With Exponential Backoff (Sync and Async)

```python
import asyncio, functools, inspect, random, time

def retry(times: int = 3, exceptions: tuple[type[BaseException], ...] = (Exception,), base_delay: float = 0.1):
    def decorator(fn):
        if inspect.iscoroutinefunction(fn):            # asyncio.iscoroutinefunction is deprecated in 3.14
            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                for attempt in range(1, times + 1):
                    try:
                        return await fn(*args, **kwargs)
                    except exceptions:
                        if attempt == times:
                            raise
                        await asyncio.sleep(base_delay * 2 ** (attempt - 1) * random.uniform(0.5, 1.5))
            return async_wrapper

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions:
                    if attempt == times:
                        raise                          # re-raise the last error, with its traceback
                    time.sleep(base_delay * 2 ** (attempt - 1) * random.uniform(0.5, 1.5))   # backoff + jitter
        return wrapper
    return decorator
```

```python
calls = {"n": 0}

@retry(times=3, exceptions=(ConnectionError,), base_delay=0.001)
def flaky():
    calls["n"] += 1
    if calls["n"] < 3:
        raise ConnectionError("down")
    return "ok"

flaky(), calls["n"]        # ('ok', 3)

@retry(times=2, exceptions=(TimeoutError,), base_delay=0.001)
async def always_fails():
    raise TimeoutError("slow")

asyncio.run(always_fails())   # raises TimeoutError after 2 attempts
```

Talking points:
- Only retry **transient** errors (timeouts, 503s), never `ValueError` or a 400.
- Only retry **idempotent** operations.
- **Jitter** stops many clients from retrying at exactly the same moment.

## 7. Run Async Tasks With a Concurrency Limit (Keep the Order)

```python
from collections.abc import Awaitable

async def gather_limited(limit: int, coros: Iterable[Awaitable[T]]) -> list[T]:
    sem = asyncio.Semaphore(limit)

    async def run(coro):
        async with sem:                                # at most `limit` run at the same time
            return await coro

    return await asyncio.gather(*(run(c) for c in coros))   # gather keeps the input order

async def demo():
    running = peak = 0
    async def job(i):
        nonlocal running, peak
        running += 1; peak = max(peak, running)
        await asyncio.sleep(0.01 * (5 - i))            # later jobs finish first
        running -= 1
        return i * i
    results = await gather_limited(2, [job(i) for i in range(5)])
    return results, peak

asyncio.run(demo())       # ([0, 1, 4, 9, 16], 2)   ordered results, never more than 2 at once
```

The Python version of a JS "promise pool" question. It's used to call a rate-limited API for 10,000 items.

## 8. Token-Bucket Rate Limiter

```python
class TokenBucket:
    def __init__(self, rate: float, capacity: int, clock: Callable[[], float] = time.monotonic):
        self.rate, self.capacity, self.clock = rate, capacity, clock
        self.tokens = float(capacity)
        self.updated = clock()

    def allow(self) -> bool:
        now = self.clock()
        # refill based on the time that has passed, up to capacity
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

t = [0.0]
bucket = TokenBucket(rate=1, capacity=3, clock=lambda: t[0])    # fake clock: no sleeping in tests
[bucket.allow() for _ in range(4)]    # [True, True, True, False]   burst of 3, then blocked
t[0] = 2.0                            # 2 seconds later → 2 tokens refilled
[bucket.allow() for _ in range(3)]    # [True, True, False]
```

**O(1)** per call. For several servers, keep the state in Redis (see [Caching, Rate Limiting, Idempotency & Background Jobs](../32-fastapi-advanced/01-caching-rate-limiting-background-jobs.md)).

## 9. TTL Cache

```python
class TTLCache:
    def __init__(self, ttl: float, clock: Callable[[], float] = time.monotonic):
        self.ttl, self.clock = ttl, clock
        self._data: dict[Any, tuple[Any, float]] = {}

    def set(self, key, value) -> None:
        self._data[key] = (value, self.clock() + self.ttl)

    def get(self, key, default=None):
        item = self._data.get(key)
        if item is None:
            return default
        value, expires = item
        if self.clock() >= expires:                   # expired: remove it on read (lazy)
            del self._data[key]
            return default
        return value

t = [0.0]
cache = TTLCache(ttl=10, clock=lambda: t[0])
cache.set("user:1", "Asha")
cache.get("user:1")                 # 'Asha'
t[0] = 10.0
cache.get("user:1", "expired")      # 'expired'
```

Follow-ups: add a **max size** (combine with the `OrderedDict` LRU from the Python interview chapter); a background sweep for keys that are never read again; thread safety with a `threading.Lock`.

## 10. Event Emitter With `on`, `once` and Unsubscribe

```python
class EventEmitter:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = defaultdict(list)

    def on(self, event: str, handler: Callable) -> Callable[[], None]:
        self._handlers[event].append(handler)
        return lambda: self._handlers[event].remove(handler)    # returns an "off" function

    def once(self, event: str, handler: Callable) -> None:
        def wrapper(*args, **kwargs):
            off()
            handler(*args, **kwargs)
        off = self.on(event, wrapper)

    def emit(self, event: str, *args, **kwargs) -> int:
        handlers = list(self._handlers[event])        # copy: handlers may unsubscribe during emit
        for h in handlers:
            h(*args, **kwargs)
        return len(handlers)

em, seen = EventEmitter(), []
off = em.on("order", lambda o: seen.append(("a", o)))
em.once("order", lambda o: seen.append(("once", o)))
em.emit("order", 1)
off()
em.emit("order", 2)
seen        # [('a', 1), ('once', 1)]
```

The **copy before looping** is the detail interviewers look for: without it, `once` removing itself during the loop would skip the next handler.

## 11. Parse an Access Log: Top IPs Causing 5xx Errors

```python
import re
from collections import Counter

LOG_RE = re.compile(r'^(?P<ip>\S+) .* "(?P<method>[A-Z]+) (?P<path>\S+) [^"]*" (?P<status>\d{3})')

def top_error_ips(lines: Iterable[str], k: int = 2) -> list[tuple[str, int]]:
    counts = Counter(
        m["ip"] for line in lines
        if (m := LOG_RE.match(line)) and m["status"].startswith("5")   # skips lines that don't match
    )
    return counts.most_common(k)

logs = [
    '10.0.0.1 - - [31/Oct/2026:10:00:01] "GET /api/users HTTP/1.1" 200 512',
    '10.0.0.2 - - [31/Oct/2026:10:00:02] "POST /api/orders HTTP/1.1" 500 87',
    '10.0.0.2 - - [31/Oct/2026:10:00:03] "POST /api/orders HTTP/1.1" 502 87',
    '10.0.0.3 - - [31/Oct/2026:10:00:04] "GET /api/cart HTTP/1.1" 503 10',
    'garbage line',
]
top_error_ips(logs)       # [('10.0.0.2', 2), ('10.0.0.3', 1)]
```

Pass an open file (`with open("access.log") as f: top_error_ips(f)`). The generator expression reads it **line by line**, so a 10 GB log uses almost no memory.

## 12. Top-K Most Frequent Numbers

```python
import heapq

def top_k_frequent(nums: list[int], k: int) -> list[int]:
    counts = Counter(nums)
    return [n for n, _ in heapq.nlargest(k, counts.items(), key=lambda kv: kv[1])]

top_k_frequent([4, 1, 1, 2, 2, 2, 3], 2)    # [2, 1]
```

**O(n log k)** with the heap, versus O(n log n) for sorting everything. `Counter.most_common(k)` does the same thing internally.

## 13. Paginate a List With Metadata

```python
def paginate(items: list[T], page: int, size: int) -> dict:
    if page < 1 or size < 1:
        raise ValueError("page and size must be >= 1")
    total = len(items)
    start = (page - 1) * size
    return {
        "items": items[start:start + size],
        "page": page, "size": size, "total": total,
        "pages": (total + size - 1) // size,          # ceiling division without math.ceil
        "has_next": start + size < total,
    }

paginate(list(range(1, 24)), page=3, size=10)
# {'items': [21, 22, 23], 'page': 3, 'size': 10, 'total': 23, 'pages': 3, 'has_next': False}
```

## 14. In-Memory Repository With Keyword Filters

```python
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    role: str
    active: bool = True

class InMemoryRepo:
    def __init__(self):
        self._rows: dict[int, User] = {}

    def add(self, user: User) -> User:
        if user.id in self._rows:
            raise ValueError(f"duplicate id {user.id}")
        self._rows[user.id] = user
        return user

    def find(self, **filters) -> list[User]:
        return [u for u in self._rows.values()
                if all(getattr(u, k) == v for k, v in filters.items())]

repo = InMemoryRepo()
for u in [User(1, "Asha", "admin"), User(2, "Ravi", "user"), User(3, "Meera", "user", active=False)]:
    repo.add(u)

[u.name for u in repo.find(role="user")]               # ['Ravi', 'Meera']
[u.name for u in repo.find(role="user", active=True)]  # ['Ravi']
repo.add(User(1, "Dup", "user"))                        # ValueError: duplicate id 1
```

This is the "fake repository" you would use in unit tests for a FastAPI service layer.

## 15. Min Stack: `push`, `pop` and `min` in O(1)

```python
class MinStack:
    def __init__(self):
        self._items: list[tuple[int, int]] = []        # (value, minimum so far)

    def push(self, x: int) -> None:
        current_min = min(x, self._items[-1][1]) if self._items else x
        self._items.append((x, current_min))

    def pop(self) -> int:
        return self._items.pop()[0]

    def min(self) -> int:
        return self._items[-1][1]

s = MinStack()
for x in [5, 3, 7, 2]:
    s.push(x)
s.min()      # 2
s.pop()
s.min()      # 3
```

Storing the running minimum with each item gives O(1) for all operations, at the cost of O(n) extra space.

---

## 🎯 Likely Interview Questions

1. **How would you make the TTL cache thread-safe? Bounded in size?**
2. **How do you retry only safe operations? Why add jitter?**
3. **Why does `gather_limited` keep the order even though jobs finish out of order?**
4. **Token bucket vs fixed window: which allows bursts?**
5. **How would you process a 10 GB log file in Python?** — Iterate the file lazily with generators; never call `.read()` on the whole file.
6. **What's the trap with `itertools.groupby`?**
7. **Why inject a clock instead of calling `time.time()` directly?**
8. **What is the time complexity of each solution, and how would you improve it?**

---

[← Node & Express Coding Questions](05-node-express-coding.md) | [Index](../README.md) | [Next: SQL Coding Questions →](08-sql-coding-questions.md)
