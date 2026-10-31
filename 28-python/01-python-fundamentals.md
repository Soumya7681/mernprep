# Chapter 92 — Python Fundamentals for JavaScript Developers

## 📖 Definition

**Python** is a high-level, **dynamically typed**, **strongly typed**, interpreted language. Its main ideas are clean, readable syntax and "batteries included" (a large standard library). It is the most common language for data, ML and AI work. With **FastAPI**, **Django** and **Flask**, it is also a popular backend choice next to Node.js.

- **Dynamically typed:** a variable's type is decided at run time, and you can rebind a name to a different type.
- **Strongly typed:** Python won't convert types silently. `"1" + 1` raises `TypeError` (JavaScript gives `"11"`).
- **Indentation is syntax:** blocks are set by indentation (4 spaces by convention), not `{}`.
- **CPython** is the standard interpreter. It compiles code to bytecode and runs it on a virtual machine.

## 🔍 Python vs JavaScript Cheat Sheet

| Concept | JavaScript | Python |
|---|---|---|
| Variable | `let x = 1; const y = 2` | `x = 1` (no keyword; `UPPER_CASE` for constants by convention) |
| Null | `null`, `undefined` | `None` (only one) |
| Booleans | `true`, `false` | `True`, `False` |
| Logic | `&&`, `\|\|`, `!` | `and`, `or`, `not` |
| Equality | `===` | `==` (value), `is` (same object) |
| String format | `` `Hi ${name}` `` | `f"Hi {name}"` |
| Array | `[1, 2, 3]` | `list`: `[1, 2, 3]` |
| Object / map | `{ a: 1 }`, `Map` | `dict`: `{"a": 1}` |
| Set | `new Set()` | `set()`, `{1, 2}` |
| Tuple | none | `(1, 2)` (immutable) |
| Function | `(a, b) => a + b` | `def add(a, b): return a + b` / `lambda a, b: a + b` |
| Loop over items | `for (const x of arr)` | `for x in arr:` |
| Loop with index | `arr.forEach((x, i) => ...)` | `for i, x in enumerate(arr):` |
| Map / filter | `arr.map(f).filter(g)` | `[f(x) for x in arr if g(x)]` |
| Length | `arr.length` | `len(arr)` |
| Spread | `[...a, ...b]`, `{...o}` | `[*a, *b]`, `{**o}` |
| Destructuring | `const [a, b] = arr` | `a, b = arr` |
| Error handling | `try / catch / finally` | `try / except / else / finally` |
| Throw | `throw new Error()` | `raise ValueError()` |
| Modules | `import x from "./x.js"` | `import x` / `from x import y` |
| Package manager | npm / pnpm | pip / Poetry / **uv** |
| Async | `async/await`, event loop built in | `async/await` with `asyncio` |
| Ternary | `a ? b : c` | `b if a else c` |

## 💻 Core Data Types

```python
# Numbers
n = 10            # int: unlimited size, no overflow
f = 3.14          # float (64-bit, like JS number)
c = 2 + 3j        # complex
print(7 / 2)      # 3.5   true division always returns float
print(7 // 2)     # 3     floor division
print(-7 // 2)    # -4    floors toward negative infinity
print(7 % 3, 2 ** 10)   # 1 1024
print(0.1 + 0.2 == 0.3) # False, same float issue as JS; use math.isclose or Decimal

# Strings are immutable unicode sequences
s = "hello"
print(s[0], s[-1], s[1:4])   # h o ell    negative index and slicing
print(s.upper(), s.replace("l", "L"), "a,b".split(","))
print(" ".join(["a", "b"]))  # "a b"
print(f"{3.14159:.2f} {42:05d} {'x':>4}")  # 3.14 00042    x
multi = """spans
lines"""
raw = r"C:\new"              # raw string, backslashes not escaped

# Booleans: subclass of int
print(True + True)           # 2
```

### Truthy and falsy

Falsy values: `None`, `False`, `0`, `0.0`, `""`, `[]`, `{}`, `set()`, `()`, `range(0)`.

**Different from JavaScript:** an **empty list or dict is falsy** in Python, but `[]` and `{}` are truthy in JS.

```python
items = []
if not items:
    print("empty")      # prints
```

## 💻 Collections

### list: ordered, mutable

```python
nums = [3, 1, 2]
nums.append(4)           # [3, 1, 2, 4]
nums.extend([5, 6])      # add many
nums.insert(0, 0)        # at index
nums.pop()               # removes and returns last → 6
nums.remove(3)           # removes first matching value
nums.sort()              # in place, returns None
sorted_copy = sorted(nums, reverse=True)   # new list
print(nums[::-1])        # reversed copy via slice
print(2 in nums)         # membership: O(n) for lists
```

### tuple: ordered, immutable

```python
point = (10, 20)
x, y = point             # unpacking
single = (5,)            # the comma makes it a tuple; (5) is just 5
first, *rest = (1, 2, 3, 4)   # first=1, rest=[2, 3, 4]
```

Tuples can be **dict keys** and **set members** because they are hashable (as long as their contents are too). Lists can't.

### dict: key → value, keeps insertion order (since 3.7)

```python
user = {"name": "Asha", "age": 25}
user["city"] = "Pune"
print(user.get("email"))             # None, no KeyError
print(user.get("email", "n/a"))      # default
for key, value in user.items():
    print(key, value)
merged = {**user, "age": 26}         # spread; later keys win
merged = user | {"age": 26}          # same, Python 3.9+
del user["city"]
```

### set: unique, unordered, O(1) membership

```python
a, b = {1, 2, 3}, {2, 3, 4}
print(a & b, a | b, a - b, a ^ b)    # {2, 3} {1, 2, 3, 4} {1} {1, 4}
unique = list(set([3, 1, 3, 2]))     # removes duplicates (order not kept)
unique_ordered = list(dict.fromkeys([3, 1, 3, 2]))   # [3, 1, 2], keeps order
```

### Time complexity you should know

| Operation | list | dict / set |
|---|---|---|
| Index / lookup by key | O(1) | O(1) average |
| `x in container` | **O(n)** | **O(1)** average |
| Append / add | O(1) amortised | O(1) average |
| Insert / delete at front | O(n) (use `collections.deque`) | n/a |
| Sort | O(n log n) (Timsort) | n/a |

## 💻 Comprehensions

```python
squares = [x * x for x in range(5)]                  # [0, 1, 4, 9, 16]
evens = [x for x in range(10) if x % 2 == 0]
labels = ["even" if x % 2 == 0 else "odd" for x in range(3)]
pairs = [(i, j) for i in range(2) for j in range(2)] # nested loops
by_id = {u["id"]: u for u in users}                  # dict comprehension
lengths = {len(w) for w in ["a", "bb", "cc"]}        # set comprehension: {1, 2}
total = sum(x * x for x in range(1_000_000))         # generator expression: lazy, no list in memory
```

## 💻 Control Flow

```python
for i in range(0, 10, 2):    # start, stop (exclusive), step
    if i == 6:
        break
else:
    print("runs only if the loop did NOT break")

while n > 0:
    n -= 1                   # no ++ / -- in Python

# match (Python 3.10+): structural pattern matching
def handle(event):
    match event:
        case {"type": "click", "x": x, "y": y}:
            return f"click at {x},{y}"
        case {"type": "key", "key": "Enter" | "Return"}:
            return "submit"
        case [first, *_]:
            return f"list starting with {first}"
        case _:
            return "unknown"

# Walrus operator (3.8+): assign inside an expression
if (n := len(items)) > 10:
    print(f"too many: {n}")
```

## 🔍 Mutability, References and Copies

Every variable is a **name bound to an object**. Assignment never copies.

```python
a = [1, 2, 3]
b = a            # same list
b.append(4)
print(a)         # [1, 2, 3, 4]

import copy
shallow = a.copy()          # or a[:] or list(a): new outer list, same inner objects
nested = [[1], [2]]
s = nested.copy()
s[0].append(99)
print(nested)               # [[1, 99], [2]]   inner list is shared
deep = copy.deepcopy(nested)
```

| Mutable | Immutable |
|---|---|
| `list`, `dict`, `set`, `bytearray`, most user classes | `int`, `float`, `str`, `tuple`, `frozenset`, `bytes`, `None` |

### `==` vs `is`

- `==` compares **values** (calls `__eq__`).
- `is` compares **identity** (same object in memory).
- Use `is` only with `None` and other singletons: `if x is None:`.

```python
a = [1, 2]; b = [1, 2]
print(a == b, a is b)   # True False
```

> CPython caches small integers (-5 to 256) and some strings, so `a is b` can be `True` for `256` and `False` for `257`. This is an implementation detail; never depend on it.

## 🔍 Functions and Arguments

```python
def greet(name, greeting="Hello", *args, sep="!", **kwargs):
    print(f"{greeting}, {name}{sep}", args, kwargs)

greet("Asha")                                # Hello, Asha! () {}
greet("Asha", "Hi", 1, 2, sep="?", role="admin")   # Hi, Asha? (1, 2) {'role': 'admin'}

def connect(host, port, /, *, timeout=5):    # / → positional-only, * → keyword-only after it
    ...
connect("db", 5432, timeout=10)

nums = [1, 2, 3]
print(max(*nums))                            # unpack a list into arguments
opts = {"sep": "-"}
greet("Ravi", **opts)                        # unpack a dict into keyword arguments
```

### The mutable default argument trap (very common interview question)

```python
def add_item(item, bucket=[]):     # the default list is created ONCE, when the function is defined
    bucket.append(item)
    return bucket

print(add_item(1))   # [1]
print(add_item(2))   # [1, 2]  ← the same list again!

def add_item(item, bucket=None):   # fix
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket
```

## 🔍 Scope: LEGB

Python looks up names in this order: **L**ocal → **E**nclosing function → **G**lobal (module) → **B**uilt-in.

```python
count = 0
def inc():
    global count        # needed to REASSIGN a module-level name
    count += 1

def outer():
    total = 0
    def inner():
        nonlocal total  # needed to reassign a variable from the enclosing function
        total += 1
        return total
    return inner
```

Unlike JS `var`/`let`, Python has **no block scope**. A variable made inside an `if` or `for` is still visible after the block, in the same function.

## 💻 Error Handling

```python
class InsufficientFunds(Exception):
    """Custom exceptions subclass Exception."""

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFunds(f"need {amount - balance} more")
    return balance - amount

try:
    withdraw(100, 150)
except InsufficientFunds as e:
    print("Error:", e)
except (ValueError, TypeError):
    print("bad input")
else:
    print("runs only if no exception")
finally:
    print("always runs")

try:
    int("abc")
except ValueError as e:
    raise RuntimeError("config is broken") from e   # chain the cause
```

Python style is **EAFP** ("Easier to Ask Forgiveness than Permission"): try the operation and catch the error, instead of checking first (LBYL, "Look Before You Leap").

### Context managers: `with`

```python
with open("data.txt", encoding="utf-8") as f:   # file is closed even if an error happens
    for line in f:
        print(line.strip())
```

`with` calls `__enter__` at the start and `__exit__` at the end. It is used for files, locks, DB sessions and transactions (see the next chapter for writing your own).

## 💻 Modules, Packages and Environments

```
myapp/
  pyproject.toml
  app/
    __init__.py        # makes "app" a package (optional since 3.3, still common)
    main.py
    utils/
      __init__.py
      strings.py
```

```python
from app.utils.strings import slugify
import json, os
from pathlib import Path

if __name__ == "__main__":     # True only when this file is run directly, not imported
    main()
```

Virtual environments keep each project's packages separate (like each project having its own `node_modules`):

```bash
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]"
pip freeze > requirements.txt

# Modern alternative: uv (very fast, handles venv + lockfile)
uv init myapp && uv add fastapi && uv run main.py
```

| Node.js | Python |
|---|---|
| `package.json` | `pyproject.toml` (or `requirements.txt`) |
| `package-lock.json` | `uv.lock` / `poetry.lock` |
| `node_modules` | `.venv` |
| `npx` | `uvx` / `pipx` |
| ESLint + Prettier | **Ruff** (lint + format), Black |
| TypeScript `tsc` | **mypy** / **pyright** (type checking) |
| Jest | **pytest** |

## 💻 Useful Standard Library

```python
from collections import Counter, defaultdict, deque, namedtuple
Counter("banana").most_common(1)       # [('a', 3)]
groups = defaultdict(list); groups["x"].append(1)   # no KeyError
q = deque([1, 2]); q.appendleft(0); q.popleft()      # O(1) at both ends

from itertools import chain, groupby, islice, combinations
list(combinations([1, 2, 3], 2))       # [(1, 2), (1, 3), (2, 3)]

from functools import lru_cache, reduce, partial
import heapq                            # min-heap: heappush, heappop, nlargest
import bisect                           # binary search on sorted lists
from datetime import datetime, timedelta, timezone
datetime.now(timezone.utc).isoformat()
import json; json.dumps({"a": 1}); json.loads('{"a": 1}')
```

## 🌍 Real-World Use

- **Backend APIs:** FastAPI, Django REST Framework, Flask.
- **Data & ML:** pandas, NumPy, scikit-learn, PyTorch; most AI and LLM tooling (LangChain, LlamaIndex, model SDKs) is Python-first.
- **Scripts & automation:** ETL jobs, cron tasks, DevOps scripts, scraping.
- In MERN teams, Python often shows up as a **separate service**: an ML model or data pipeline that the Node API calls.

## 🎯 Likely Interview Questions

1. **Is Python compiled or interpreted?** — CPython compiles to bytecode (`.pyc`), then the interpreter runs that bytecode.
2. **Dynamically typed vs strongly typed: what does each mean? Is Python both?**
3. **List vs tuple vs set vs dict?** When would you use each?
4. **Mutable vs immutable types?** Why can't a list be a dict key?
5. **`==` vs `is`?**
6. **Shallow copy vs deep copy?**
7. **What is the mutable default argument problem?**
8. **What are `*args` and `**kwargs`?**
9. **Explain LEGB scope. What do `global` and `nonlocal` do?**
10. **What is a list comprehension? How is a generator expression different?**
11. **What does `if __name__ == "__main__":` do?**
12. **What is a virtual environment and why use one?**
13. **What is the time complexity of `x in list` vs `x in set`?**
14. **What is the difference between `/` and `//`?**

---

[← GraphQL Interview Questions](../27-graphql/05-graphql-interview-questions.md) | [Index](../README.md) | [Next: Functions, Decorators & Generators →](02-functions-decorators-generators.md)
