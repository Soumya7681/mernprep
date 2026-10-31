# Chapter 97 — Performance, Memory & Profiling

## 📖 Definition

Python performance work follows one rule: **measure first, then optimise the hot spot**. The tools:

- **`timeit`**: micro-benchmarks of small snippets.
- **`cProfile` / `pstats`**: which functions take the time (deterministic profiler, in the standard library).
- **`py-spy`**: a **sampling** profiler that attaches to a **running** process with no code changes. Safe in production.
- **`tracemalloc`**: which lines allocate the memory (standard library).
- **`memray` / `objgraph` / `gc`**: deeper memory and leak analysis.

The usual big wins aren't clever tricks. They are **better algorithms and data structures**, **less I/O** (batching, caching, async), and **moving hot loops into C** (built-ins, NumPy, or a compiled extension).

## 🔍 How Much Do the Classic Tricks Actually Help?

These timings were measured on Python 3.14 on one laptop. The ratios matter, not the exact numbers.

| Comparison | Result | Takeaway |
|---|---|---|
| `9_999 in list` vs `in set` (10,000 items, 2,000 lookups) | 0.30 s vs **0.0002 s** | **~1000×**. Data structure choice beats everything else. |
| `sum(range(1_000_000))` vs a manual `for` loop (5 runs) | 0.10 s vs 0.36 s | **~3.5×**. Built-ins run in C. |
| List comprehension vs `for` + `.append` (100k items, 50 runs) | 0.39 s vs 0.43 s | **~10%**. Nice, but not a game-changer. |
| `"".join(list)` vs `s += str(i)` (10k pieces, 200 runs) | 0.30 s vs 0.43 s | **~1.4×**. CPython optimises `+=` on strings in many cases, but `join` is the reliable choice. |

Lesson for interviews: say "**I'd profile first**". Then fix the O(n²) membership check or the N+1 queries before you micro-tune loops.

## 💻 `timeit`

```python
import timeit

data = list(range(10_000))
s = set(data)
print(timeit.timeit(lambda: 9_999 in data, number=2000))   # ~0.3 s
print(timeit.timeit(lambda: 9_999 in s, number=2000))      # ~0.0002 s
```

```bash
python -m timeit -s "xs = list(range(1000))" "sum(xs)"
```

In Jupyter or IPython, use `%timeit expr`.

## 💻 `cProfile`: Where Does the Time Go?

```bash
python -m cProfile -o out.prof app.py      # profile a whole script
python -m pstats out.prof                  # interactive: sort cumulative, stats 20
snakeviz out.prof                          # pip install snakeviz → a flame-style view in the browser
```

```python
import cProfile, pstats

with cProfile.Profile() as pr:
    build_report()
pstats.Stats(pr).sort_stats("cumulative").print_stats(10)
```

How to read it:
- **`cumtime`** is the time inside the function **including** the functions it calls. Start here to find the slow branch.
- **`tottime`** is the time inside the function **itself**. This finds the actual hot loop.
- **`ncalls`**: a surprisingly large number (e.g. 10,000 calls to `get_user`) points to N+1 queries or a missing cache.

## 💻 `py-spy`: Profiling a Live Server

```bash
pip install py-spy
py-spy top --pid 12345                     # live "top" view of the hottest functions
py-spy record -o profile.svg --pid 12345   # flame graph
py-spy dump --pid 12345                    # stack of every thread right now: "where is it stuck?"
```

It takes samples from outside the process, so it's safe for a production FastAPI or Celery worker that's stuck at 100% CPU or frozen.

## 💻 Memory: Finding What Grows

```python
import tracemalloc

tracemalloc.start()
cache = []

def leaky(x):
    cache.append(bytearray(10_000))   # a global list that only grows
    return x

for i in range(1000):
    leaky(i)

top = tracemalloc.take_snapshot().statistics("lineno")[0]
print(top)    # app.py:7: size=9830 KiB, count=2001, average=5030 B   ← points at the leaking line
```

Compare two snapshots (`snap2.compare_to(snap1, "lineno")`) taken a few minutes apart in a long-running service to see **what is growing**.

### Common causes of memory leaks in Python services

| Cause | Fix |
|---|---|
| Module-level dict or list used as a cache that's never cleared | `functools.lru_cache(maxsize=...)`, `cachetools.TTLCache`, or Redis |
| `@lru_cache` with no limit on functions with many different arguments | Set `maxsize`; also, caching an instance method keeps `self` alive forever |
| Reference cycles involving objects with `__del__` or C resources | Break the cycle, use `weakref`, close resources explicitly |
| Large objects kept by closures / callbacks / event listeners | Remove listeners; don't capture big objects |
| Reading a whole file or query result into memory | Generators, `yield_per` in SQLAlchemy, streaming responses |
| Fragmentation in long-running workers | Restart workers periodically (`--max-requests` in gunicorn; `max_tasks_per_child` in Celery) |

### Measuring object size

```python
import sys
sys.getsizeof([0] * 1000)          # the list itself (~8 KB), NOT the objects inside it
# For deep size: pympler.asizeof.asizeof(obj)
```

## 💻 Optimisation Toolbox (In Order of Impact)

### 1. Algorithm and data structure

```python
# O(n·m): "x in list" inside a loop
common = [x for x in a if x in b]            # b is a list

# O(n + m)
b_set = set(b)
common = [x for x in a if x in b_set]
```

Use `collections.deque` for queues, `heapq` for top-k, `bisect` for sorted lookups, `Counter` for counting, and dicts for indexing by key.

### 2. Do less I/O

- **Batch** database queries (`WHERE id IN (...)`, `selectinload`) instead of N+1.
- **Cache** expensive results (`lru_cache` in the process, Redis across processes).
- **Concurrency for I/O:** `asyncio.gather` or a thread pool for many network calls.
- **Stream** large data with generators, instead of building huge lists.

### 3. Push loops into C

```python
import numpy as np

prices = np.array(price_list)
total = (prices * 1.18).sum()        # vectorised: one C loop, often 10–100× faster than Python loops
```

Other ways: built-ins (`sum`, `min`, `max`, `sorted`, `any`, `all`, `map`), `itertools`, `str.join`; **Polars / pandas** for tabular data; **Cython / mypyc / Rust (PyO3)** for custom hot spots.

### 4. Small Python-level wins (only after profiling)

- Comprehensions instead of `append` loops.
- Look up attributes and globals into local variables inside very hot loops.
- `__slots__` for millions of small objects.
- `str.join` for building strings.
- Avoid repeated work inside loops (move invariant calculations out).

### 5. Use more cores or a faster runtime

- `multiprocessing` / `ProcessPoolExecutor` for CPU-bound work (each process has its own GIL).
- **PyPy** (a JIT compiler) can make pure-Python CPU code several times faster. Check that your C extensions support it.
- CPython 3.13+ has an experimental JIT (`PYTHON_JIT=1`) and a free-threaded build.

## 🔍 Garbage Collector Basics

- **Reference counting** frees most objects immediately.
- The **cyclic GC** runs automatically, based on allocation counts, to find cycles. It has traditionally been **generational** (young objects are checked often, old ones rarely). Python 3.14 made it **incremental**: the old generation is collected in small steps, which cuts long pauses on big heaps.
- `gc.collect()` forces a collection. `gc.freeze()` (3.7+) is used before forking workers, so the parent's objects aren't touched and copy-on-write memory stays shared.
- Turning off the GC (`gc.disable()`) is a rare, specialised trick (Instagram used to do it). Don't suggest it unless you can explain the trade-off.

## 🌍 Real-World Use

- A FastAPI endpoint at 2 s p95: `py-spy` shows 80% of the time in an ORM loop → N+1 → `selectinload` → 120 ms.
- A Celery worker's memory grows to 4 GB overnight: `tracemalloc` snapshots point to an unbounded module-level cache → switch to `TTLCache(maxsize=10_000)` and set `max_tasks_per_child`.
- A data export takes 40 s: moving from row-by-row Python loops to SQL aggregation or Polars → 2 s.

## 🎯 Likely Interview Questions

1. **How do you find out why a Python program is slow?** — Measure: `cProfile` / `py-spy`, then fix the hot spot.
2. **`cumtime` vs `tottime` in cProfile?**
3. **How do you profile a running production process?** — `py-spy` (sampling, attaches by PID).
4. **How do you find a memory leak in Python?** — `tracemalloc` snapshots compared over time; check caches and closures.
5. **What are common causes of memory leaks in long-running Python services?**
6. **Why is a set membership check faster than a list's?**
7. **Why are built-ins and NumPy faster than Python loops?**
8. **Is string concatenation in a loop slow? What should you use?**
9. **How would you speed up CPU-bound Python code?** — A better algorithm, vectorising, multiprocessing, PyPy, Cython/Rust.
10. **How does Python's garbage collector work? What changed in 3.14?** — Reference counting plus a cyclic GC, which became incremental in 3.14.
11. **When does `lru_cache` cause a memory leak?**
12. **What does `sys.getsizeof` measure and what does it miss?**

---

[← Python Internals & Metaprogramming](02-python-internals-metaprogramming.md) | [Index](../README.md) | [Next: Testing, Packaging & Tooling →](04-testing-packaging-tooling.md)
