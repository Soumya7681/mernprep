# Chapter 99 — Python Interview Questions (Detailed Answers)

## 📖 How to Use This Chapter

These are the Python questions asked most often of full-stack and backend developers, especially in teams that pair a MERN frontend with Python services. They cover both the **Python** and **Python Advanced** sections. There are four parts:

1. **Concept questions** with answers you can say out loud.
2. **Predict-the-output** puzzles. **Every output was checked by running it on Python 3.14.**
3. **Coding problems** with short Pythonic solutions (also run and checked).
4. A **rapid-fire** table.

---

## 1️⃣ Concept Questions

### 1. What are Python's key features?

It's interpreted (compiled to bytecode and run by the CPython VM), dynamically and strongly typed, garbage collected, and multi-paradigm (OOP, functional, procedural). It has very readable, indentation-based syntax, a huge standard library, and a huge package ecosystem (PyPI). It's the main language for data and AI, and is strong for APIs (FastAPI, Django), automation and scripting.

### 2. How is Python code executed?

Source code (`.py`) → **compiled to bytecode** (cached as `.pyc` in `__pycache__`) → run by the **Python Virtual Machine** in CPython. Other implementations exist: **PyPy** (JIT compiled, often much faster for pure Python code), Jython, and MicroPython. CPython 3.13+ also has an experimental JIT.

### 3. What is the difference between a list and a tuple?

- A **list** is mutable, has more methods, and uses a little more memory. Use it for collections that change.
- A **tuple** is immutable, hashable if its contents are, a bit faster and smaller. Use it for fixed records (`(lat, lng)`), dict keys, and returning several values from a function.

### 4. List vs set vs dict: when do you use each?

- **list:** ordered, allows duplicates, accessed by index.
- **set:** unique items with O(1) membership tests (`x in s`); good for removing duplicates and for intersection or union.
- **dict:** key → value lookup in O(1); keeps insertion order since 3.7.

If you write `if x in big_list` inside a loop, switching to a set often turns O(n²) into O(n).

### 5. What are mutable and immutable types? Why does it matter?

Immutable objects (`int`, `str`, `tuple`, `frozenset`) can't change after they're created, so "changing" one creates a new object. Mutable ones (`list`, `dict`, `set`) change in place.

It matters because:
- Only hashable (usually immutable) objects can be dict keys or set members.
- Mutable default arguments are shared between calls.
- Passing a list to a function lets the function change the caller's list.

### 6. Is Python pass-by-value or pass-by-reference?

Neither. It's **"pass by object reference"** (also called call-by-sharing). The function gets a reference to the same object. **Mutating** it (`lst.append`) is visible to the caller. **Rebinding** the parameter (`lst = [ ]`) isn't, because it only changes the local name.

### 7. Explain `*args` and `**kwargs`.

`*args` collects extra **positional** arguments into a tuple. `**kwargs` collects extra **keyword** arguments into a dict. They're used for flexible APIs and for decorators that pass everything through to the wrapped function: `wrapper(*args, **kwargs): return fn(*args, **kwargs)`. The same `*` and `**` **unpack** lists and dicts when calling a function.

### 8. What is the mutable default argument problem?

Default values are evaluated **once, when the function is defined**, not on each call. So `def f(x, items=[])` shares one list across every call that doesn't pass `items`. Fix: `items=None`, then `if items is None: items = []`.

### 9. Shallow copy vs deep copy?

A **shallow copy** (`lst.copy()`, `lst[:]`, `dict(d)`, `copy.copy`) creates a new outer container, but the **inner objects are shared**. A **deep copy** (`copy.deepcopy`) copies everything, all the way down. Changing a nested list inside a shallow copy also changes the original.

### 10. What is the difference between `==` and `is`?

`==` checks if values are **equal** (`__eq__`). `is` checks if both names point to the **same object** (`id(a) == id(b)`). Use `is` for `None`, `True` and `False` checks, and `==` for everything else.

### 11. What are decorators? Give a real example.

A decorator is a function that takes a function and returns a new function that wraps it, adding behaviour before or after the call. You apply it with `@` syntax. Real examples: `@app.get("/users")` in FastAPI registers a route; `@lru_cache` memoises; a custom `@retry` or `@timer`; `@login_required` in Django. Always use `functools.wraps` inside, so the wrapped function keeps its name and docstring.

### 12. What are generators and why use them?

A function with `yield` returns a **generator**: a lazy iterator that produces one value at a time and pauses between them, keeping its local state. Generators use **constant memory**, so they're good for big files, streams, infinite sequences and pipelines. The downside: you can only go through a generator **once**, and you can't index it or get its length.

### 13. Iterator vs iterable?

An **iterable** has `__iter__()` and can be looped over (list, str, dict, file). An **iterator** has `__next__()` and also `__iter__()` returning itself; it remembers its position and raises `StopIteration` at the end. `iter(iterable)` gives you an iterator. Every generator is an iterator.

### 14. What is a lambda? What are its limits?

An anonymous function with a **single expression** and no statements: `lambda x: x * 2`. It's good for short `key=` functions in `sorted`, `max` and `min`. You can't use assignments, `try`, or several statements in it. If it needs a name, use `def`.

### 15. What are list, dict and set comprehensions?

Short syntax for building collections from iterables with an optional filter: `[f(x) for x in xs if cond]`, `{k: v for k, v in pairs}`, `{x for x in xs}`. They're usually faster and clearer than loops with `.append()`. With round brackets you get a lazy **generator expression**.

### 16. Explain LEGB, `global` and `nonlocal`.

Name lookup order: **Local, Enclosing, Global, Built-in**. Reading an outer variable just works. To **assign** to one, you must declare it: `global x` for a module-level variable, `nonlocal x` for a variable in the enclosing function. Without that, assigning makes the name local to the **whole** function, so reading it earlier raises `UnboundLocalError`.

### 17. What is `__init__`? Is it a constructor?

`__init__` is the **initialiser**. It sets up an object that has already been created. The real constructor is `__new__`, which creates and returns the instance. You only override `__new__` for immutable types or singletons.

### 18. `@staticmethod` vs `@classmethod`?

A `@classmethod` gets the class as `cls`. It's used for alternative constructors (`User.from_json(...)`) and works correctly with subclasses. A `@staticmethod` gets nothing; it's a plain function placed in the class's namespace.

### 19. What is MRO?

The **Method Resolution Order** is the order Python searches classes for a method in multiple inheritance. It's computed with C3 linearisation (see `Class.__mro__`). `super()` calls the **next class in the MRO**, which lets cooperative multiple inheritance (mixins) work and solves the diamond problem.

### 20. What are dunder methods?

Special methods with double underscores that hook into built-in syntax: `__init__`, `__repr__`, `__str__`, `__eq__`, `__hash__`, `__lt__`, `__len__`, `__getitem__`, `__iter__`, `__contains__`, `__call__`, `__enter__` and `__exit__`, `__add__`. They let your objects work with `len()`, `==`, `for`, `with`, `+` and so on.

### 21. `__str__` vs `__repr__`?

`__repr__` is unambiguous and meant for developers. Ideally it looks like code that would recreate the object: `User(id=1, name='Asha')`. `__str__` is the readable version for users. `print()` uses `__str__`, and falls back to `__repr__` if there's no `__str__`.

### 22. How does Python manage memory?

**Reference counting** frees an object as soon as nothing refers to it. A **generational cyclic garbage collector** finds and frees reference cycles. Small objects come from **pymalloc** memory pools. Common causes of memory leaks: global caches that keep growing, reference cycles that involve `__del__`, unbounded `lru_cache`, and closures holding on to big objects.

### 23. What is the GIL?

The Global Interpreter Lock lets only one thread run Python bytecode at a time in CPython. It protects reference counting. CPU-bound threads don't run in parallel, but I/O-bound threads do overlap, because the GIL is released while waiting. Use **multiprocessing** for CPU work and **asyncio or threads** for I/O. PEP 703 added an optional free-threaded build (officially supported from 3.14, not the default yet).

### 24. Multithreading vs multiprocessing vs asyncio?

- **Threads:** share memory, low overhead, limited by the GIL; good for blocking I/O.
- **Processes:** separate memory and their own GIL, so they give real CPU parallelism, but data is pickled between them.
- **asyncio:** one thread and cooperative multitasking; it handles thousands of concurrent I/O tasks, but every library in the path must be async, and any blocking call freezes everything.

### 25. What does `async`/`await` do in Python?

`async def` defines a coroutine function. Calling it returns a coroutine object that doesn't run yet. `await` suspends the current coroutine until the awaited one finishes, and lets the event loop run other tasks meanwhile. `asyncio.run()` starts the loop. `gather` or `TaskGroup` run coroutines concurrently.

### 26. What is a context manager?

An object used with `with`. It runs setup in `__enter__` and **guaranteed** cleanup in `__exit__`, even when an error happens. It's used for files, locks, DB transactions and sessions, and timers. You can write one as a class or with `@contextlib.contextmanager` around a generator.

### 27. How do exceptions work? What do `else` and `finally` do?

`try` runs the code. Matching `except` blocks handle errors (catch specific exceptions, not a bare `except:`). `else` runs **only if no exception happened**. `finally` **always** runs. Use `raise ... from e` to chain the cause. Custom exceptions subclass `Exception`.

### 28. What are type hints? Are they enforced?

Annotations like `def f(x: int) -> str`. They're **not enforced** by Python at run time. Static tools (mypy, pyright) check them, editors use them for autocomplete, and libraries like **Pydantic and FastAPI read them at run time** to validate and convert data and to generate API docs.

### 29. What is a virtual environment?

An isolated folder with its own Python interpreter link and site-packages, so each project has its own dependency versions. Create one with `python -m venv .venv` and activate it. Modern tools: **uv**, Poetry, pipenv. Pin versions in `requirements.txt` or a lockfile.

### 30. What does `if __name__ == "__main__":` mean?

`__name__` is `"__main__"` when the file is **run directly**, and the module's name when it's **imported**. The guard keeps script-only code (like starting a server or running a CLI) from running on import. It's also required with `multiprocessing` on Windows and macOS.

### 31. What is pickling? Is it safe?

`pickle` turns Python objects into bytes and back. **Never unpickle data you don't trust**: it can run arbitrary code. For data exchange, use JSON (or msgpack / protobuf).

### 32. What is monkey patching?

Changing a class or module at run time, e.g. `module.func = fake_func`. It's used in tests (`unittest.mock.patch`, pytest's `monkeypatch`). In production code it's risky and hard to debug.

### 33. How do you test Python code?

Use **pytest**: plain `assert` statements, fixtures for setup (`@pytest.fixture`, with `yield` for teardown), `@pytest.mark.parametrize` for table-driven tests, `unittest.mock` / `pytest-mock` for mocks, `pytest-asyncio` for async code, and `pytest-cov` for coverage. FastAPI provides `TestClient` / `httpx.AsyncClient` for API tests.

```python
import pytest

@pytest.mark.parametrize("raw, expected", [("Hello World", "hello-world"), ("  A  ", "a")])
def test_slugify(raw, expected):
    assert slugify(raw) == expected
```

### 34. What is a descriptor, and where have you used one without noticing?

An object with `__get__` (and maybe `__set__`) stored as a class attribute; Python calls it when the attribute is read or set. `@property`, methods (functions are descriptors that bind `self`), `classmethod`, `staticmethod`, and ORM fields like SQLAlchemy's `Mapped` columns are all descriptors. **Data descriptors** (with `__set__`) take priority over the instance `__dict__`; non-data descriptors don't.

### 35. What is a metaclass? Would you write one?

The class of a class (`type` by default). It controls how classes are created or called; Django models, `ABCMeta`, `EnumMeta` and Pydantic's `ModelMetaclass` use one. In app code, I'd reach for a class decorator or `__init_subclass__` first, and only use a metaclass when those can't do the job.

### 36. How would you find out why a Python service is slow or using too much memory?

Measure before changing anything. For CPU: `cProfile` locally (sort by `cumtime`, then look at `tottime`), or `py-spy top/record --pid` on the live process. For memory: compare `tracemalloc` snapshots taken minutes apart to see which lines keep allocating. Usual culprits: N+1 queries, list-membership checks inside loops, unbounded caches, and loading whole result sets instead of streaming them.

### 37. What is the difference between `monkeypatch` and `mock.patch`, and what does "patch where it's used" mean?

Both temporarily replace an attribute for one test and undo it afterwards. `monkeypatch` is pytest's fixture (also handles env vars and dict items); `mock.patch` comes from `unittest.mock` and works as a decorator or context manager. If `report.py` does `from rates import fetch_rate`, you must patch `report.fetch_rate`, because `report` holds its own reference; patching `rates.fetch_rate` changes nothing there.

### 38. How do you structure and ship a modern Python project?

`pyproject.toml` for metadata, dependencies and tool config; **uv** (or Poetry) for environments with a committed lockfile; Ruff for lint and format; mypy or pyright for types; pytest with coverage; pre-commit hooks; and the same checks in CI. Apps are shipped as Docker images; libraries are built into wheels (`uv build`) and published to PyPI or a private index.

---

## 2️⃣ Predict the Output

Each of these was run on Python 3.14. Try to answer before you read the solution.

### Q1

```python
a = [1, 2, 3]
b = a
b += [4]
print(a)
```

**Output:** `[1, 2, 3, 4]`. `b` is the same list as `a`, and `+=` on a list **changes it in place** (it calls `extend`).

### Q2

```python
t = (1, 2, [3])
try:
    t[2] += [4]
except TypeError:
    print("TypeError")
print(t)
```

**Output:**
```
TypeError
(1, 2, [3, 4])
```
`+=` first extends the inner list (that works, because lists are mutable), **then** tries to assign the result back to `t[2]`. That fails, because tuples are immutable. So you get **both** the error and the change.

### Q3

```python
def f(x, l=[]):
    l.append(x)
    return l

print(f(1), f(2), f(3, []), f(4))
```

**Output:** `[1, 2, 4] [1, 2, 4] [3] [1, 2, 4]`

The default list is shared. All four calls run **before** `print` shows anything, so the first, second and fourth results are the same list object, which by then holds `[1, 2, 4]`.

### Q4

```python
m = [[0] * 2] * 2
m[0][0] = 1
print(m)
```

**Output:** `[[1, 0], [1, 0]]`. `* 2` copies the **reference** to the same inner list. Fix: `[[0] * 2 for _ in range(2)]`.

### Q5

```python
x = 10
def g():
    print(x)
    x = 5
g()
```

**Output:** `UnboundLocalError`. Because `x` is assigned somewhere in `g`, Python treats `x` as local to the **whole** function. So reading it before the assignment fails.

### Q6

```python
print(bool([]), bool([0]), bool(""), bool(" "), bool(0.0))
```

**Output:** `False True False True False`. An empty container is falsy; a list with one item (even `0`) is truthy; a space is a non-empty string.

### Q7

```python
d = {True: "a", 1: "b", 1.0: "c"}
print(d)
```

**Output:** `{True: 'c'}`. `True == 1 == 1.0`, and they have the same hash, so they are **the same key**. The first key object (`True`) is kept, and the last value wins.

### Q8

```python
def h():
    try:
        return "try"
    finally:
        return "finally"
print(h())
```

**Output:** `finally`. A `return` in `finally` replaces the earlier return value, and would also silently hide any exception. Python 3.14 shows a `SyntaxWarning` for this pattern (PEP 765). Don't write it.

### Q9

```python
print(sorted([3, 1, 2]), [3, 1, 2].sort())
```

**Output:** `[1, 2, 3] None`. `sorted()` returns a new list. `.sort()` sorts in place and returns `None`.

### Q10

```python
s = "hello"
print(s[::-1], s[10:], s[-3:])
```

**Output:** `olleh  llo`. Slicing past the end gives an empty string, not an error (but `s[10]` would raise `IndexError`).

### Q11

```python
print(0.1 + 0.2, round(2.5), round(3.5), int(-3.7), -7 // 2, -7 % 2)
```

**Output:** `0.30000000000000004 2 4 -3 -4 1`

- `round` uses **banker's rounding** (round half to even), so `2.5 → 2` and `3.5 → 4`.
- `int()` cuts toward zero.
- `//` floors toward negative infinity.
- `%` takes the sign of the divisor.

### Q12

```python
gen = (x * x for x in range(3))
print(sum(gen), sum(gen))
```

**Output:** `5 0`. The generator is used up by the first `sum`.

### Q13

```python
a = 256; b = 256
print(a is b, [1] is [1], None is None)
```

**Output:** `True False True`. Small integers are cached (an implementation detail). Two list literals are always different objects. `None` is a singleton.

### Q14

```python
class A:
    items = []
    def add(self, x):
        self.items.append(x)

p, q = A(), A()
p.add(1); q.add(2)
print(p.items, A.items)
```

**Output:** `[1, 2] [1, 2]`. `items` is a **class attribute**, shared by every instance. Create it in `__init__` (`self.items = []`) instead.

### Q15

```python
x = [1, 2, 3]
for i in x:
    if i == 2:
        x.remove(i)
print(x)
```

**Output:** `[1, 3]`. It looks right, but removing an item while looping **skips the next element** (3 is never checked). Loop over a copy (`for i in x[:]`) or build a new list with a comprehension.

### Q16

```python
print(list(zip([1, 2, 3], "ab")), dict(zip("ab", [1, 2])))
```

**Output:** `[(1, 'a'), (2, 'b')] {'a': 1, 'b': 2}`. `zip` stops at the **shortest** input (use `zip(..., strict=True)` to raise an error instead).

### Q17

```python
funcs = [lambda: i for i in range(3)]
print([fn() for fn in funcs])
```

**Output:** `[2, 2, 2]`. Closures look up `i` when they're **called**, not when they're created. Fix: `lambda i=i: i`.

### Q18

```python
a, *b, c = range(5)
print(a, b, c)
print(*[1, 2, 3], sep="-")
```

**Output:**
```
0 [1, 2, 3] 4
1-2-3
```

### Q19

```python
print("1" * 3, [1] * 3, 1 < 2 > 1.5, "abc".find("z"), "a,b,,c".split(","))
```

**Output:** `111 [1, 1, 1] True -1 ['a', 'b', '', 'c']`. Comparisons chain (`1 < 2 and 2 > 1.5`). `find` returns `-1` (but `index` raises an error).

### Q20

```python
print(any([]), all([]), max("apple"), min([3, 1, 2], key=lambda v: -v))
```

**Output:** `False True p 3`. `all([])` is `True` ("no item is false"). `max` of a string compares characters. `min` with a negated key returns the largest value.

---

## 3️⃣ Coding Problems

Every solution below was run and returned the result shown.

### 1. Two Sum: O(n) with a dict

```python
def two_sum(nums, target):
    seen = {}                                  # value → index
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []

two_sum([2, 7, 11, 15], 9)   # [0, 1]
```

### 2. Group anagrams

```python
from collections import defaultdict

def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)
    return list(groups.values())

group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"])
# [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']]
```

### 3. Flatten a nested list (generator)

```python
def flatten(items):
    for x in items:
        if isinstance(x, (list, tuple)):
            yield from flatten(x)
        else:
            yield x

list(flatten([1, [2, [3, [4]], 5]]))   # [1, 2, 3, 4, 5]
```

### 4. Balanced brackets

```python
def is_balanced(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack

is_balanced("{[()]}"), is_balanced("([)]")   # (True, False)
```

### 5. LRU cache (asked very often)

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.data = OrderedDict()

    def get(self, key):
        if key not in self.data:
            return -1
        self.data.move_to_end(key)             # mark as most recently used
        return self.data[key]

    def put(self, key, value):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)      # remove the least recently used

c = LRUCache(2)
c.put(1, "a"); c.put(2, "b"); c.get(1); c.put(3, "c")
c.get(2), c.get(1), c.get(3)                   # (-1, 'a', 'c')
```

### 6. Merge overlapping intervals

```python
def merge_intervals(intervals):
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged

merge_intervals([[1, 3], [8, 10], [2, 6], [15, 18]])   # [[1, 6], [8, 10], [15, 18]]
```

### 7. First non-repeating character

```python
from collections import Counter

def first_unique(s):
    counts = Counter(s)
    return next((ch for ch in s if counts[ch] == 1), None)

first_unique("swiss")   # 'w'
```

### 8. Top-k most frequent words

```python
from collections import Counter
Counter("the cat and the hat and the bat".split()).most_common(2)
# [('the', 3), ('and', 2)]
```

### 9. Chunk a list, check a palindrome, reverse words

```python
def chunk(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]

def is_palindrome(s):
    cleaned = [ch.lower() for ch in s if ch.isalnum()]
    return cleaned == cleaned[::-1]

def reverse_words(s):
    return " ".join(reversed(s.split()))

chunk([1, 2, 3, 4, 5], 2)                        # [[1, 2], [3, 4], [5]]
is_palindrome("A man, a plan, a canal: Panama")  # True
reverse_words("  hello   world  ")               # 'world hello'
```

### 10. Second-largest unique number

```python
def second_largest(nums):
    unique = sorted(set(nums), reverse=True)
    return unique[1] if len(unique) > 1 else None

second_largest([4, 1, 4, 3])   # 3
```

### 11. A caching decorator with a TTL

```python
import functools, time

def ttl_cache(ttl):
    def decorator(fn):
        cache = {}
        @functools.wraps(fn)
        def wrapper(*args):
            now = time.monotonic()
            if args in cache and now - cache[args][1] < ttl:
                return cache[args][0]
            result = fn(*args)
            cache[args] = (result, now)
            return result
        return wrapper
    return decorator

@ttl_cache(ttl=60)
def square(n):
    return n * n
# The second square(4) within 60 s comes from the cache; the function body runs once
```

---

## ⚡ Rapid-Fire Round

| Question | Answer |
|---|---|
| Python's `null`? | `None` |
| Integer overflow? | Never; `int` has unlimited size |
| `7 / 2` vs `7 // 2`? | `3.5` vs `3` |
| Is `str` mutable? | No |
| Remove duplicates, keep order? | `list(dict.fromkeys(xs))` |
| Swap two variables? | `a, b = b, a` |
| Reverse a list? | `xs[::-1]` (copy) or `xs.reverse()` (in place) |
| Merge two dicts? | `{**a, **b}` or `a \| b` |
| Read a file safely? | `with open(path, encoding="utf-8") as f:` |
| Format a string? | f-strings: `f"{name!r} {price:.2f}"` |
| Is `dict` ordered? | Yes, insertion order (3.7+) |
| Main loop over index + value? | `enumerate(xs)` |
| Default package installer? | `pip` (`uv` is the fast modern option) |
| Linter / formatter? | Ruff (or flake8 + Black) |
| What is PEP 8? | The Python style guide (snake_case, 4 spaces, ≤ 79/99 chars) |
| `deque` vs `list`? | `deque` has O(1) appends and pops at both ends |
| How to make a class immutable? | `@dataclass(frozen=True)` or `NamedTuple` |
| `pass` vs `...`? | Both are "do nothing" placeholders |

---

[← Testing, Packaging & Tooling](04-testing-packaging-tooling.md) | [Index](../README.md) | [Next: SQL Fundamentals & Joins →](../29-sql/01-sql-fundamentals-joins.md)
