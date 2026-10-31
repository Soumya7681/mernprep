# Chapter 96 — Python Internals & Metaprogramming

## 📖 Definition

**Metaprogramming** is code that creates or changes other code (classes, functions, attributes) while the program runs. In Python, the main tools are:

- **Descriptors:** objects that control what happens when an attribute is read, set or deleted. `@property`, methods, `classmethod` and ORM columns are all descriptors.
- **Attribute hooks:** `__getattr__`, `__getattribute__`, `__setattr__`.
- **Class creation hooks:** class decorators, `__init_subclass__`, and **metaclasses** (the "class of a class").
- **Runtime internals:** bytecode, the import system, `contextvars`.

You rarely write these in app code. But frameworks you use every day (**Pydantic, SQLAlchemy, Django ORM, FastAPI, dataclasses, pytest**) are built on them, and senior interviews ask how they work.

Every output below was checked by running it on Python 3.14.

## 💻 Descriptors

A descriptor is any object whose class defines `__get__`, and optionally `__set__` / `__delete__`. When it's stored as a **class attribute**, Python calls those methods on attribute access.

```python
class Positive:
    def __set_name__(self, owner, name):          # called once, when the class is created
        self.private = "_" + name

    def __get__(self, obj, objtype=None):
        if obj is None:                           # accessed on the class: Product.price
            return self
        return getattr(obj, self.private)

    def __set__(self, obj, value):
        if value <= 0:
            raise ValueError(f"{self.private[1:]} must be positive")
        setattr(obj, self.private, value)

class Product:
    price = Positive()
    stock = Positive()

    def __init__(self, price, stock):
        self.price = price                        # goes through Positive.__set__
        self.stock = stock

p = Product(499, 10)
print(p.price, p.__dict__)    # 499 {'_price': 499, '_stock': 10}
p.stock = 0                   # ValueError: stock must be positive
```

This is how **SQLAlchemy columns** (`User.email == "x"` builds SQL on the class, while `user.email` returns a value on an instance) and **Django model fields** work.

### Data vs non-data descriptors: attribute lookup order

| Kind | Defines | Priority vs the instance `__dict__` |
|---|---|---|
| **Data descriptor** | `__get__` + `__set__` (or `__delete__`) | **Wins** over the instance dict |
| **Non-data descriptor** | Only `__get__` (e.g. plain functions/methods) | **Loses** to the instance dict |

```python
class D:                                   # data descriptor
    def __get__(self, o, t=None): return "data descriptor"
    def __set__(self, o, v): pass

class N:                                   # non-data descriptor
    def __get__(self, o, t=None): return "non-data descriptor"

class C:
    d = D()
    n = N()

c = C()
c.__dict__["d"] = "instance dict"
c.__dict__["n"] = "instance dict"
print(c.d, "|", c.n)          # data descriptor | instance dict
```

What happens for `obj.attr`, roughly:
1. A **data descriptor** on the class (or its MRO) → call its `__get__`.
2. Otherwise, `obj.__dict__["attr"]`.
3. Otherwise, a non-data descriptor or plain class attribute.
4. Otherwise, `__getattr__` if it's defined → else `AttributeError`.

**Why methods work:** functions are non-data descriptors. `obj.method` calls `function.__get__(obj)`, which returns a **bound method** with `self` already filled in.

## 💻 `__getattr__` vs `__getattribute__`

```python
class Config:
    def __init__(self, data):
        self._data = data

    def __getattr__(self, name):              # only called when normal lookup FAILS
        try:
            return self._data[name]
        except KeyError:
            raise AttributeError(name) from None   # must raise AttributeError, so hasattr() works

cfg = Config({"debug": True})
print(cfg.debug, hasattr(cfg, "port"))   # True False
```

| | `__getattr__` | `__getattribute__` |
|---|---|---|
| Called | Only for **missing** attributes | For **every** attribute access |
| Typical use | Proxies, lazy loading, dynamic config | Logging/tracing all access (rare) |
| Risk | Low | Easy infinite recursion: use `super().__getattribute__(name)` inside |

## 💻 Building Classes

### Class decorators

```python
def register_route(path):
    def decorator(cls):
        cls.path = path
        return cls
    return decorator

@register_route("/users")
class UserView:
    pass

print(UserView.path)    # /users
```

`@dataclass` is a class decorator. It reads the type annotations and **generates** `__init__`, `__repr__` and `__eq__`.

### `__init_subclass__`: a hook for subclass creation (simpler than a metaclass)

```python
class Plugin:
    registry = {}

    def __init_subclass__(cls, name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        Plugin.registry[name or cls.__name__.lower()] = cls

class CsvExporter(Plugin, name="csv"): pass
class PdfExporter(Plugin): pass

print(Plugin.registry)
# {'csv': <class '__main__.CsvExporter'>, 'pdfexporter': <class '__main__.PdfExporter'>}
```

It's used for plugin registries, and to check that subclasses define required attributes.

### Metaclasses

Classes are objects too, and their type is **`type`** by default. A **metaclass** is a subclass of `type` that controls how classes are **created** (`__new__`/`__init__`) or **called** (`__call__`).

```python
class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):       # runs on Settings()
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Settings(metaclass=SingletonMeta):
    def __init__(self):
        print("loading settings")

a, b = Settings(), Settings()     # "loading settings" printed once
print(a is b)                     # True
print(type(Settings))             # <class '__main__.SingletonMeta'>
print(type(type))                 # <class 'type'>   type is its own metaclass
```

```python
# type(name, bases, namespace) creates a class at run time
Point = type("Point", (), {"x": 0, "show": lambda self: f"x={self.x}"})
print(Point().show())             # x=0
```

**Where metaclasses show up:** Django `Model`, SQLAlchemy's declarative base (older versions), `abc.ABCMeta`, `enum.EnumMeta`, and Pydantic v1. Pydantic v2 still uses a metaclass (`ModelMetaclass`) to collect fields from annotations.

**Which tool to use**, from simplest to most powerful: **decorator → `__init_subclass__` → metaclass**. Use the simplest one that works. "If you wonder whether you need a metaclass, you don't."

### `__new__` for immutable types

```python
class UpperStr(str):
    def __new__(cls, value):                  # str is immutable: the value must be set in __new__
        return super().__new__(cls, value.upper())

print(UpperStr("hello"), isinstance(UpperStr("x"), str))   # HELLO True
```

## 🔍 How CPython Runs Your Code

```python
import dis

def add(a, b):
    return a + b

print([i.opname for i in dis.get_instructions(add)])
# Python 3.14: ['RESUME', 'LOAD_FAST_BORROW_LOAD_FAST_BORROW', 'BINARY_OP', 'RETURN_VALUE']
```

- Source → tokens → AST → **bytecode** (cached in `__pycache__/*.pyc`) → run by the evaluation loop in `ceval.c`.
- Opcode names change between versions (3.11 added "specialising" adaptive opcodes, so hot code speeds itself up). Don't depend on the exact list.
- Each `+` becomes `BINARY_OP`, which calls `__add__`. That's why operator overloading works for any object.
- Use `dis.dis(fn)` to answer "which is faster?" questions by comparing instruction counts. Then measure with `timeit`.

## 🔍 The Import System

```python
import sys, json
print("json" in sys.modules)          # True: modules are cached after the first import
import json as j2
print(j2 is sys.modules["json"])      # True: importing again returns the SAME module object
```

- The first `import x` finds the module (`sys.path`, using finders and loaders), **runs it from top to bottom once**, and stores it in `sys.modules`.
- So module-level code (like creating a DB engine) runs once per process. Modules work as natural **singletons**.
- **Circular imports:** if module A imports B while B imports A, one of them sees the other half-initialised (`ImportError: cannot import name ...`). Fixes: move shared code into a third module, import inside the function, or import the module instead of names (`import app.models` rather than `from app.models import User`).
- `importlib.import_module("plugins." + name)` loads modules by name at run time (plugin systems). `importlib.reload` exists, but it's rarely safe.
- Packages: a folder with `__init__.py`; relative imports with `from . import utils`.

## 💻 `contextvars`: Per-Request State in Async Code

Thread-locals don't work with asyncio, because many requests share one thread. `ContextVar` gives each **task** its own value:

```python
import asyncio, contextvars

request_id = contextvars.ContextVar("request_id", default="-")

async def handle(rid):
    request_id.set(rid)
    await asyncio.sleep(0.01)              # other tasks run in between
    return f"{rid}:{request_id.get()}"     # still sees its own value

async def main():
    return await asyncio.gather(handle("A"), handle("B"))

print(asyncio.run(main()), request_id.get())   # ['A:A', 'B:B'] -
```

This is how logging libraries attach a **request ID** to every log line in FastAPI without passing it through every function.

## 💻 Memory Helpers: `__slots__` and `weakref`

```python
class A:
    def __init__(self): self.x = 1; self.y = 2

class B:
    __slots__ = ("x", "y")
    def __init__(self): self.x = 1; self.y = 2

print(hasattr(A(), "__dict__"), hasattr(B(), "__dict__"))   # True False
```

```python
import weakref, gc

class Big: pass
obj = Big()
r = weakref.ref(obj)          # refers to obj without keeping it alive
print(r() is obj)             # True
del obj; gc.collect()
print(r())                    # None: the object was freed
```

`weakref.WeakValueDictionary` makes caches that don't stop objects from being garbage collected.

## 🌍 Real-World Use

| Feature | Built on |
|---|---|
| `@property`, `@classmethod`, methods | Descriptors |
| SQLAlchemy `Mapped[...]` columns, Django fields | Descriptors + metaclass / `__init_subclass__` |
| Pydantic models collecting fields from annotations | A metaclass + annotation introspection |
| `@dataclass`, `@app.get` | Decorators |
| pytest fixtures and plugin discovery | Introspection (`inspect.signature`), the import system |
| FastAPI dependency injection | `inspect.signature` + `typing.get_type_hints` on your functions |
| Request IDs in async logs | `contextvars` |

## 🎯 Likely Interview Questions

1. **What is a descriptor? Name some built-in descriptors.**
2. **Data vs non-data descriptor? What's the attribute lookup order?**
3. **How does `@property` work under the hood?**
4. **How do methods get bound to `self`?** — Functions are non-data descriptors; `__get__` returns a bound method.
5. **`__getattr__` vs `__getattribute__`?**
6. **What is a metaclass? Give a real use.**
7. **Metaclass vs class decorator vs `__init_subclass__`: which would you use?**
8. **What is `type`? How do you create a class dynamically?**
9. **`__new__` vs `__init__`: when must you override `__new__`?**
10. **How does Python's import system work? Why does module code run only once?**
11. **How do you fix a circular import?**
12. **What is bytecode? How do you inspect it?**
13. **Why use `contextvars` instead of thread-locals in async code?**
14. **What does `weakref` solve?**

---

[← Async, Concurrency & the GIL](01-async-concurrency-gil.md) | [Index](../README.md) | [Next: Performance, Memory & Profiling →](03-performance-memory-profiling.md)
