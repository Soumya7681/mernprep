# Chapter 93 — Functions, Decorators & Generators

## 📖 Definition

In Python, **functions are first-class objects**. You can store them in variables, pass them as arguments, return them from other functions, and attach attributes to them. Three of the most-asked Python topics are built on this:

- **Closures:** an inner function that remembers variables from the function that created it.
- **Decorators:** functions that take a function and return a new, "wrapped" function. Written with `@decorator`.
- **Generators:** functions that use `yield` to produce values **lazily**, one at a time, pausing between them.

## 💻 First-Class Functions and Lambdas

```python
def shout(text):
    return text.upper()

speak = shout                      # no call: just another name for the function
print(speak("hi"))                 # HI

def apply(fn, value):
    return fn(value)
print(apply(len, "hello"))         # 5

users = [{"name": "Ravi", "age": 30}, {"name": "Asha", "age": 25}]
users.sort(key=lambda u: u["age"])           # lambda: a one-expression anonymous function
names = list(map(lambda u: u["name"], users))
adults = list(filter(lambda u: u["age"] >= 18, users))
```

Comprehensions are usually more "Pythonic" than `map`/`filter` with lambdas: `[u["name"] for u in users]`.

## 💻 Closures

```python
def make_counter():
    count = 0
    def increment():
        nonlocal count          # without this, `count += 1` raises UnboundLocalError
        count += 1
        return count
    return increment

c = make_counter()
print(c(), c(), c())            # 1 2 3
print(c.__closure__[0].cell_contents)   # 3: the captured variable
```

### The late-binding trap (same idea as `var` in a JS loop)

```python
funcs = [lambda: i for i in range(3)]
print([f() for f in funcs])     # [2, 2, 2]  each lambda looks up i when CALLED

funcs = [lambda i=i: i for i in range(3)]   # fix: bind the value as a default argument
print([f() for f in funcs])     # [0, 1, 2]
```

## 💻 Decorators

A decorator is just this:

```python
@my_decorator
def f(): ...

# is exactly the same as
def f(): ...
f = my_decorator(f)
```

### A basic decorator

```python
import functools
import time

def timer(fn):
    @functools.wraps(fn)        # keep fn's __name__, __doc__ (important!)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__} took {time.perf_counter() - start:.4f}s")
    return wrapper

@timer
def slow_add(a, b):
    """Add two numbers slowly."""
    time.sleep(0.1)
    return a + b

slow_add(1, 2)                   # slow_add took 0.1001s
print(slow_add.__name__)         # slow_add   (it would be "wrapper" without @wraps)
```

### A decorator with arguments (three levels)

```python
def retry(times=3, exceptions=(Exception,), delay=0.5):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as e:
                    if attempt == times:
                        raise
                    print(f"attempt {attempt} failed: {e}; retrying")
                    time.sleep(delay * 2 ** (attempt - 1))   # exponential backoff
        return wrapper
    return decorator

@retry(times=3, exceptions=(ConnectionError,))
def fetch_rates():
    ...
```

`@retry(times=3)` first **calls** `retry(...)`, which returns the real decorator, which is then applied to the function.

### Decorators for async functions

```python
def async_timer(fn):
    @functools.wraps(fn)
    async def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = await fn(*args, **kwargs)
        print(f"{fn.__name__}: {time.perf_counter() - start:.3f}s")
        return result
    return wrapper
```

### Stacking decorators

```python
@a
@b
def f(): ...
# f = a(b(f)): b is applied first, a wraps the result; at call time a's code runs first
```

### Built-in and standard decorators

| Decorator | Purpose |
|---|---|
| `@functools.lru_cache(maxsize=128)` / `@functools.cache` | Memoise results by arguments (arguments must be hashable) |
| `@property` | Turn a method into a read-only attribute (with `@x.setter` for writing) |
| `@staticmethod` | Method with no `self` or `cls` |
| `@classmethod` | Method that gets the class (`cls`), used for alternative constructors |
| `@dataclasses.dataclass` | Generate `__init__`, `__repr__`, `__eq__` |
| `@functools.wraps` | Copy metadata onto a wrapper |
| `@contextlib.contextmanager` | Build a context manager from a generator |
| `@app.get("/")` (FastAPI), `@pytest.fixture` | Framework registration decorators |

```python
@functools.lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(100))                  # instant: 354224848179261915075
print(fib.cache_info())
```

### A class-based decorator (keeps state)

```python
class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):     # makes instances callable
        self.calls += 1
        return self.fn(*args, **kwargs)

@CountCalls
def hello():
    return "hi"

hello(); hello()
print(hello.calls)               # 2
```

## 💻 Iterators

An **iterable** is anything you can loop over (it has `__iter__`). An **iterator** is the object that produces the values: it has `__next__` and raises `StopIteration` when it's done.

```python
nums = [1, 2]
it = iter(nums)          # calls nums.__iter__()
print(next(it))          # 1
print(next(it))          # 2
next(it)                 # StopIteration

class Countdown:
    def __init__(self, start):
        self.current = start
    def __iter__(self):
        return self
    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1

print(list(Countdown(3)))   # [3, 2, 1]
```

A `for` loop calls `iter()` once, then calls `next()` until it sees `StopIteration`.

## 💻 Generators

A function with `yield` returns a **generator object** when you call it. The body doesn't run until you ask for a value. Each `yield` **pauses** the function and keeps all its local state.

```python
def countdown(n):
    print("starting")
    while n > 0:
        yield n
        n -= 1

gen = countdown(3)       # nothing printed yet
print(next(gen))         # starting \n 3
print(list(gen))         # [2, 1]
print(list(gen))         # []  generators can be used only ONCE
```

### Why generators: memory

```python
# Reads a 10 GB log file using about one line of memory at a time
def error_lines(path):
    with open(path) as f:
        for line in f:
            if "ERROR" in line:
                yield line.rstrip()

def take(n, iterable):
    for i, item in enumerate(iterable):
        if i == n:
            return
        yield item

for line in take(5, error_lines("app.log")):   # stops reading after 5 matches
    print(line)
```

```python
import sys
print(sys.getsizeof([x for x in range(1_000_000)]))   # ~8 MB
print(sys.getsizeof((x for x in range(1_000_000))))   # ~200 bytes
```

### Pipelines (like Node streams)

```python
def read(path):
    with open(path) as f:
        yield from f                     # delegate to another iterable

def parse(lines):
    for line in lines:
        ts, level, msg = line.split(" ", 2)
        yield {"ts": ts, "level": level, "msg": msg.strip()}

def only(level, records):
    return (r for r in records if r["level"] == level)

for r in only("ERROR", parse(read("app.log"))):
    print(r)
```

### Infinite generators, `send`, and `return`

```python
import itertools

def ids():
    n = 1
    while True:
        yield n
        n += 1

print(list(itertools.islice(ids(), 3)))   # [1, 2, 3]

def running_avg():
    total, count, avg = 0, 0, None
    while True:
        value = yield avg                 # gets the value passed to send()
        total += value; count += 1
        avg = total / count

g = running_avg(); next(g)                # "prime" it: run to the first yield
print(g.send(10), g.send(20))             # 10.0 15.0
```

## 💻 Context Managers

```python
from contextlib import contextmanager
import time

@contextmanager
def timed(label):
    start = time.perf_counter()
    try:
        yield                             # the body of the `with` block runs here
    finally:
        print(f"{label}: {time.perf_counter() - start:.3f}s")

with timed("query"):
    run_query()
```

The class form:

```python
class Transaction:
    def __init__(self, conn):
        self.conn = conn
    def __enter__(self):
        self.conn.execute("BEGIN")
        return self.conn
    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.conn.execute("COMMIT")
        else:
            self.conn.execute("ROLLBACK")
        return False                      # False = let the exception keep propagating
```

## 🌍 Real-World Use

- **FastAPI** route registration (`@app.get`), **pytest** fixtures, **Celery** tasks (`@app.task`) and **click** CLI commands are all decorators.
- **Generators** stream big CSV exports, paginate through API results lazily, and power `StreamingResponse` in FastAPI.
- `yield` dependencies in FastAPI (open a DB session, `yield` it, close it) are context managers.
- `lru_cache` memoises expensive pure functions, like loading settings once.

## 🎯 Likely Interview Questions

1. **What does "functions are first-class objects" mean?**
2. **What is a closure? Why do you need `nonlocal`?**
3. **What is a decorator? Write a timing or logging decorator.**
4. **Why use `functools.wraps`?**
5. **How do you write a decorator that takes arguments?** — Three levels: factory → decorator → wrapper.
6. **In what order are stacked decorators applied?**
7. **Iterable vs iterator?**
8. **What is a generator? How is `yield` different from `return`?**
9. **Generator expression vs list comprehension: when would you use each?**
10. **What does `yield from` do?**
11. **How do you write a context manager? What does `__exit__` returning `True` do?** — It swallows the exception.
12. **Why does `[lambda: i for i in range(3)]` return 2 three times?**
13. **What does `lru_cache` do, and what are its limits?** — Arguments must be hashable; it's per process; it has no TTL.

---

[← Python Fundamentals for JavaScript Developers](01-python-fundamentals.md) | [Index](../README.md) | [Next: OOP, Dataclasses & Type Hints →](03-oop-dataclasses-typing.md)
