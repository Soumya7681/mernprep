# Chapter 95 — Async, Concurrency & the GIL

## 📖 Definition

Python has three ways to do more than one thing at a time:

| Model | Module | Runs on | Best for |
|---|---|---|---|
| **Async I/O** | `asyncio` | One thread, one event loop | Many network calls / connections (APIs, DB, websockets) |
| **Threads** | `threading`, `concurrent.futures.ThreadPoolExecutor` | Many OS threads, one interpreter | Blocking I/O with libraries that aren't async |
| **Processes** | `multiprocessing`, `ProcessPoolExecutor` | Many interpreters, many CPU cores | **CPU-heavy** work (image processing, number crunching) |

The **GIL (Global Interpreter Lock)** is a lock in CPython that lets only **one thread run Python bytecode at a time**. It's the main reason this table looks the way it does.

## 🔍 The GIL Explained

- CPython's memory management (reference counting) isn't thread-safe. The GIL protects it with one big lock.
- **Effect:** threads **don't speed up CPU-bound Python code**. Two threads doing maths take about as long as one, or longer.
- **But** the GIL is **released during blocking I/O** (network, disk, `time.sleep`) and inside many C extensions (NumPy, hashlib, image libraries). So **threads do help with I/O-bound work**.
- **For CPU-bound work, use processes.** Each process has its own interpreter and its own GIL.
- **Free-threaded Python:** PEP 703 added an optional build without the GIL (`python3.13t`, experimental in 3.13 and officially supported in 3.14). It isn't the default build yet, and some C extensions don't support it.

### Compared with Node.js

| | Node.js | Python |
|---|---|---|
| Default model | Single thread + event loop, always on | Synchronous by default; asyncio is opt-in |
| Async I/O | Built in to every API | Only with async libraries (`httpx`, `asyncpg`, `aiofiles`) |
| CPU parallelism | `worker_threads`, cluster | `multiprocessing`, or free-threaded build |
| Blocking call in async code | Blocks the loop (e.g. `fs.readFileSync`) | Blocks the loop (e.g. `requests.get`, `time.sleep`) |

## 💻 asyncio Basics

```python
import asyncio
import time

async def fetch(name: str, delay: float) -> str:   # "async def" makes a coroutine function
    await asyncio.sleep(delay)                      # non-blocking: hands control back to the loop
    return f"{name} done"

async def main():
    start = time.perf_counter()

    # Sequential: about 3 s
    a = await fetch("a", 1)
    b = await fetch("b", 2)

    # Concurrent: about 2 s (the longest one)
    results = await asyncio.gather(fetch("x", 1), fetch("y", 2))
    print(results)                                  # ['x done', 'y done']  same order as passed in

    print(f"{time.perf_counter() - start:.1f}s")

asyncio.run(main())    # creates the event loop, runs main(), closes the loop
```

Important points:
- Calling `fetch("a", 1)` **doesn't run it**. It creates a **coroutine object**. It runs only when awaited or scheduled. (A JS Promise starts running immediately; a Python coroutine doesn't.)
- `await` can only be used inside `async def` (or at the top level of the asyncio REPL or a Jupyter notebook).

### Tasks: start now, await later

```python
async def main():
    task = asyncio.create_task(fetch("bg", 2))   # scheduled at once
    await do_other_work()
    result = await task
```

### TaskGroup (Python 3.11+): structured concurrency

```python
async def main():
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch("a", 1))
        t2 = tg.create_task(fetch("b", 2))
    # here, both are done; if one fails, the others are cancelled and an ExceptionGroup is raised
    print(t1.result(), t2.result())
```

### gather vs TaskGroup vs wait

| | On error | Use when |
|---|---|---|
| `gather(*aws)` | Raises the first error; **other tasks keep running** | Simple fan-out |
| `gather(*aws, return_exceptions=True)` | Returns errors as values in the result list | Like JS `Promise.allSettled` |
| `TaskGroup` | Cancels the siblings, raises an `ExceptionGroup` | Modern default; safest |
| `asyncio.wait(..., return_when=FIRST_COMPLETED)` | Manual control | Racing tasks (like `Promise.race`) |

### Timeouts, limits and cancellation

```python
import httpx

async def get_json(client: httpx.AsyncClient, url: str, sem: asyncio.Semaphore):
    async with sem:                                  # at most N requests at the same time
        async with asyncio.timeout(5):               # 3.11+; older: asyncio.wait_for(coro, 5)
            r = await client.get(url)
            r.raise_for_status()
            return r.json()

async def main(urls):
    sem = asyncio.Semaphore(10)
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(*(get_json(client, u, sem) for u in urls), return_exceptions=True)
```

### Running blocking code without freezing the loop

```python
import requests   # a blocking library

async def handler():
    # Bad: blocks the whole event loop, so every other request waits
    # requests.get("https://example.com")

    # Good: run it in a thread from the default pool
    resp = await asyncio.to_thread(requests.get, "https://example.com")
    return resp.status_code
```

For CPU-heavy work, use `loop.run_in_executor(ProcessPoolExecutor(), fn, arg)`.

## 💻 Threads (I/O-bound work)

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

urls = [f"https://httpbin.org/delay/1?i={i}" for i in range(10)]

with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(requests.get, u): u for u in urls}
    for fut in as_completed(futures):
        print(futures[fut], fut.result().status_code)
# About 1 s total, not 10, because the GIL is released while waiting on the network
```

### Race conditions still exist with the GIL

```python
import threading

counter = 0
lock = threading.Lock()

def work():
    global counter
    for _ in range(100_000):
        with lock:            # without the lock, `counter += 1` (read, add, write) can lose updates
            counter += 1

threads = [threading.Thread(target=work) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)                # 400000
```

The GIL makes **single bytecode steps** atomic, but `counter += 1` is **several** steps. A thread switch can happen between them.

## 💻 Processes (CPU-bound work)

```python
from concurrent.futures import ProcessPoolExecutor
import math

def is_prime(n: int) -> bool:
    if n < 2: return False
    return all(n % i for i in range(2, math.isqrt(n) + 1))

if __name__ == "__main__":          # required: child processes re-import this module
    nums = range(10_000_000, 10_000_200)
    with ProcessPoolExecutor() as pool:            # one worker per CPU core by default
        primes = [n for n, ok in zip(nums, pool.map(is_prime, nums, chunksize=20)) if ok]
    print(len(primes))
```

Arguments and results are **pickled** (serialised) between processes, so send small data, not huge objects. For background work in web apps, a task queue like **Celery**, **RQ**, **Dramatiq** or **ARQ** with Redis is usually better than raw processes, because it survives restarts and can retry.

## 🔍 Choosing the Right Tool

```
Is the work waiting on I/O (network, DB, disk)?
├── Yes → Are the libraries async (httpx, asyncpg, motor)?
│         ├── Yes → asyncio
│         └── No  → threads (or asyncio.to_thread)
└── No, it's CPU-heavy → processes / task queue (or NumPy, which releases the GIL)
```

## 🔍 How This Applies to FastAPI

- `async def` endpoints run **on the event loop**. Inside them, **only use non-blocking calls** (`await db.execute`, `await httpx...`).
- Plain `def` endpoints run **in a thread pool** automatically, so blocking code there is safe.
- A blocking `time.sleep(5)` or `requests.get` inside an `async def` endpoint **freezes the whole server**. This is the most common FastAPI performance bug.
- Run several worker **processes** (`uvicorn --workers 4` or `gunicorn -k uvicorn.workers.UvicornWorker`) to use every CPU core.

## 🌍 Real-World Use

- **asyncio:** FastAPI servers, websocket gateways, scrapers making thousands of HTTP calls, async DB drivers.
- **Threads:** calling legacy SDKs that block (boto3, requests) in parallel.
- **Processes / Celery:** PDF generation, video encoding, ML inference, reports.

## 🎯 Likely Interview Questions

1. **What is the GIL? Why does CPython have it?**
2. **Does the GIL make multithreading useless?** — No: threads help with I/O-bound work because the GIL is released while waiting.
3. **Threads vs processes vs asyncio: when do you use each?**
4. **What is a coroutine? What does `await` do?**
5. **What happens if you call an async function without `await`?** — You get a coroutine object; it never runs, and Python warns "coroutine was never awaited".
6. **`asyncio.gather` vs `TaskGroup`?**
7. **How do you limit concurrency in asyncio?** — `asyncio.Semaphore`.
8. **How do you run blocking code inside async code?** — `asyncio.to_thread` / `run_in_executor`.
9. **Can race conditions happen with the GIL? Show one.**
10. **Python asyncio vs the Node.js event loop?**
11. **In FastAPI, `def` vs `async def` endpoints: what's the difference?**
12. **What is free-threaded Python (PEP 703)?**

---

[← OOP, Dataclasses & Type Hints](../28-python/03-oop-dataclasses-typing.md) | [Index](../README.md) | [Next: Python Internals & Metaprogramming →](02-python-internals-metaprogramming.md)
