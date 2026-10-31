# Chapter 94 — OOP, Dataclasses & Type Hints

## 📖 Definition

Python is **multi-paradigm**: you can write procedural, functional or object-oriented code. Everything is an object, even `int`, functions and classes themselves.

- A **class** is a blueprint. An **instance** is an object made from it.
- **Dunder methods** ("double underscore", e.g. `__init__`, `__repr__`) let your objects work with built-in syntax like `+`, `len()`, `==`, `for` and `with`.
- **Dataclasses** and **Pydantic models** remove boilerplate for classes that mainly hold data.
- **Type hints** are optional annotations. Python doesn't enforce them at run time, but tools like mypy or pyright check them, and **FastAPI and Pydantic use them** to validate data.

## 💻 Classes, Instances and `self`

```python
class Account:
    bank = "MERN Bank"                 # class attribute: shared by all instances

    def __init__(self, owner: str, balance: float = 0):
        self.owner = owner             # instance attributes
        self._balance = balance        # leading underscore = "internal, please don't touch"

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        self._balance += amount

    @property
    def balance(self) -> float:        # read like an attribute: acc.balance
        return self._balance

    @classmethod
    def from_dict(cls, data: dict) -> "Account":     # alternative constructor
        return cls(data["owner"], data.get("balance", 0))

    @staticmethod
    def validate_owner(name: str) -> bool:           # no self or cls; just grouped here
        return bool(name.strip())

    def __repr__(self) -> str:         # for developers, shown in the REPL and logs
        return f"Account(owner={self.owner!r}, balance={self._balance})"

    def __str__(self) -> str:          # for users: print(), str()
        return f"{self.owner}: ₹{self._balance:,.2f}"

acc = Account.from_dict({"owner": "Asha", "balance": 500})
acc.deposit(250)
print(acc.balance, repr(acc), str(acc))
```

`self` is just the first parameter. `acc.deposit(250)` is the same as `Account.deposit(acc, 250)`. Python passes it explicitly, where JavaScript has an implicit `this`.

### Method types

| | First argument | Called on | Use for |
|---|---|---|---|
| Instance method | `self` | Instance | Most behaviour |
| `@classmethod` | `cls` | Class or instance | Factory constructors, class-level config |
| `@staticmethod` | none | Class or instance | Helpers that logically belong to the class |

### Access control is by convention

| Name | Meaning |
|---|---|
| `name` | Public |
| `_name` | Internal; please don't use from outside (not enforced) |
| `__name` | **Name mangling**: becomes `_ClassName__name`, so subclasses don't clash with it by accident |
| `__name__` | Dunder: reserved for Python's special methods |

## 💻 Inheritance, `super()` and MRO

```python
class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        raise NotImplementedError

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)         # call the parent's constructor
        self.breed = breed
    def speak(self):
        return f"{self.name} says woof"

print(isinstance(Dog("Rex", "lab"), Animal))  # True
print(issubclass(Dog, Animal))                # True
```

### Multiple inheritance and the MRO

```python
class A:
    def hi(self): return "A"
class B(A):
    def hi(self): return "B" + super().hi()
class C(A):
    def hi(self): return "C" + super().hi()
class D(B, C):
    def hi(self): return "D" + super().hi()

print(D().hi())                 # DBCA
print([k.__name__ for k in D.__mro__])   # ['D', 'B', 'C', 'A', 'object']
```

The **Method Resolution Order** uses **C3 linearisation**. `super()` means "the **next class in the MRO**", not "my parent". That's why `B`'s `super()` calls `C` here. This fixes the "diamond problem".

**Mixins** are small classes that add one behaviour, like `class JsonMixin: def to_json(self): ...`, combined with multiple inheritance.

## 💻 Abstract Classes and Protocols

```python
from abc import ABC, abstractmethod

class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount: int) -> str: ...

class Razorpay(PaymentGateway):
    def charge(self, amount: int) -> str:
        return "rzp_123"

PaymentGateway()          # TypeError: Can't instantiate abstract class
```

```python
from typing import Protocol

class SupportsCharge(Protocol):          # structural typing ("duck typing" for type checkers)
    def charge(self, amount: int) -> str: ...

def checkout(gateway: SupportsCharge):   # any object with a matching charge() passes the check
    return gateway.charge(499)
```

Use an **ABC** when you want inheritance and a run-time check. Use a **Protocol** when you only want the type checker to make sure the right methods exist. This is like a TypeScript interface.

## 💻 Dunder (Magic) Methods

```python
class Money:
    def __init__(self, paise: int):
        self.paise = paise
    def __add__(self, other):  return Money(self.paise + other.paise)   # a + b
    def __eq__(self, other):   return isinstance(other, Money) and self.paise == other.paise
    def __lt__(self, other):   return self.paise < other.paise          # enables sorted()
    def __hash__(self):        return hash(self.paise)                  # needed with __eq__ to use in sets/dicts
    def __bool__(self):        return self.paise != 0
    def __repr__(self):        return f"Money({self.paise})"

class Cart:
    def __init__(self): self.items = []
    def __len__(self): return len(self.items)               # len(cart)
    def __getitem__(self, i): return self.items[i]          # cart[0], also makes it iterable
    def __contains__(self, x): return x in self.items       # x in cart
    def __iter__(self): return iter(self.items)             # for x in cart
    def __call__(self, item): self.items.append(item)       # cart("apple")
```

| Dunder | Triggered by |
|---|---|
| `__init__` / `__new__` | Creating an object (`__new__` creates, `__init__` initialises) |
| `__repr__` / `__str__` | `repr()` / `str()`, `print()` |
| `__eq__`, `__lt__`, … | `==`, `<`, … |
| `__hash__` | `hash()`, dict keys, sets |
| `__len__`, `__getitem__`, `__contains__`, `__iter__` | `len()`, `[]`, `in`, `for` |
| `__enter__` / `__exit__` | `with` |
| `__call__` | `obj()` |
| `__getattr__` | Accessing an attribute that doesn't exist |

> If you define `__eq__` but not `__hash__`, Python sets `__hash__ = None`, and the objects can't be used in sets or as dict keys.

## 💻 `__slots__`

```python
class Point:
    __slots__ = ("x", "y")      # no per-instance __dict__: less memory, faster attribute access
    def __init__(self, x, y):
        self.x, self.y = x, y

p = Point(1, 2)
p.z = 3                         # AttributeError
```

Useful when you create millions of small objects.

## 💻 Dataclasses

```python
from dataclasses import dataclass, field, asdict

@dataclass(frozen=True, slots=True)       # frozen → immutable and hashable
class Address:
    city: str
    pin: str

@dataclass(order=True)
class User:
    id: int
    name: str
    email: str
    roles: list[str] = field(default_factory=list)   # never use a mutable default directly
    address: Address | None = None

    def __post_init__(self):                         # runs after the generated __init__
        self.email = self.email.lower()

u = User(1, "Asha", "ASHA@x.com", address=Address("Pune", "411001"))
print(u)            # User(id=1, name='Asha', email='asha@x.com', roles=[], address=Address(...))
print(asdict(u))    # nested dict
print(u == User(1, "Asha", "asha@x.com", address=Address("Pune", "411001")))   # True
```

### Dataclass vs NamedTuple vs Pydantic vs TypedDict

| | Validates at run time | Mutable | Best for |
|---|---|---|---|
| `@dataclass` | No | Yes (unless `frozen`) | Internal domain objects |
| `NamedTuple` | No | No | Light, tuple-like records |
| `TypedDict` | No | It's a dict | Typing dicts / JSON shapes |
| **Pydantic `BaseModel`** | **Yes**, converts and validates | Yes | **API input/output**, settings, parsing untrusted data |

```python
from pydantic import BaseModel, EmailStr, Field

class SignUp(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    age: int = Field(ge=18)

SignUp(name="Asha", email="a@x.com", age="21")   # age "21" → 21 (converted)
SignUp(name="A", email="bad", age=10)            # ValidationError listing all 3 problems
```

## 💻 Type Hints

```python
from typing import Any, Callable, Literal, Optional, TypeVar, Generic, Iterator
from collections.abc import Sequence, Mapping

def total(prices: list[float], tax: float = 0.18) -> float: ...
def find(users: dict[int, str], uid: int) -> str | None: ...     # 3.10+: X | None == Optional[X]
def first(items: Sequence[str]) -> str: ...                      # accept any sequence, not just list
Status = Literal["pending", "paid", "failed"]                    # like a TS string union
Handler = Callable[[str, int], bool]                             # function type

T = TypeVar("T")
def head(xs: list[T]) -> T:          # generic: return type follows the input
    return xs[0]

def numbers() -> Iterator[int]:
    yield 1

# Python 3.12+ generic syntax
def last[T](xs: list[T]) -> T:
    return xs[-1]

class Box[T]:
    def __init__(self, item: T) -> None:
        self.item = item
```

- Hints are **not enforced** by Python at run time: `total("oops")` still runs and fails inside.
- **mypy / pyright** check them statically, like `tsc`.
- **Pydantic and FastAPI read them at run time** to validate and convert request data and to generate OpenAPI docs. That's why type hints matter so much in FastAPI.

## 🔍 Memory Management (Often Asked)

- CPython uses **reference counting**: each object counts how many names refer to it, and is freed at once when the count reaches 0.
- A **cyclic garbage collector** (`gc` module, generational) cleans up reference cycles, like two objects that point to each other.
- `del x` removes a **name**, not necessarily the object.
- `weakref` lets you refer to an object without keeping it alive (used for caches).

## 🌍 Real-World Use

- **FastAPI request and response models** are Pydantic classes; **SQLAlchemy models** are classes with typed `Mapped[...]` attributes.
- **Service and repository classes** organise business logic; ABCs or Protocols define gateways that tests can swap out.
- `@dataclass(frozen=True)` for value objects (Money, Address), events and config.

## 🎯 Likely Interview Questions

1. **What is `self`? Why is it explicit?**
2. **`@staticmethod` vs `@classmethod` vs an instance method?**
3. **What is `__init__` vs `__new__`?**
4. **`__str__` vs `__repr__`?**
5. **How does Python handle private attributes? What is name mangling?**
6. **Explain MRO and how `super()` works with multiple inheritance.**
7. **What are dunder methods? Give examples of operator overloading.**
8. **Why must `__hash__` be consistent with `__eq__`?**
9. **What is `@property` and why use it instead of getters and setters?**
10. **Dataclass vs Pydantic model: when would you use each?**
11. **ABC vs Protocol?**
12. **Are type hints enforced at run time? How does FastAPI use them?**
13. **How does Python manage memory?** — Reference counting plus a cyclic GC.
14. **What is `__slots__`?**

---

[← Functions, Decorators & Generators](02-functions-decorators-generators.md) | [Index](../README.md) | [Next: Async, Concurrency & the GIL →](../31-python-advanced/01-async-concurrency-gil.md)
