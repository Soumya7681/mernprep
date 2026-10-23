# Chapter 82 — TypeScript Essentials for MERN

## 📖 Definition

**TypeScript** is a statically typed superset of JavaScript that compiles to plain JS. In a MERN app it lets you describe the *shape* of data once — a `User`, an `Order`, an API response — and have the compiler check every place that data flows: the Mongoose model, the Express handler, the fetch call, and the React component that renders it.

> Types exist only at compile time. At runtime it is still JavaScript — which is why you **also** need runtime validation (express-validator or custom type guards — see Typed Express Server) at every trust boundary.

## 🔍 Why TypeScript in a MERN Stack?

| Without TS | With TS |
|-----------|---------|
| `user.emial` → `undefined` at runtime | Compile error: *Property 'emial' does not exist* |
| Backend renames `name` → `fullName`, frontend silently breaks | Shared type changes → every consumer goes red |
| "What does this endpoint return?" → read the code | Hover the function, see the type |
| Refactors are scary | Rename symbol across client + server safely |

Interviewers expect you to know **why** (safety, refactoring, self-documenting contracts) and the **limits** (no runtime guarantees, `any` leaks, type-only imports vanish).

## 💻 Code Example — `type` vs `interface`

```ts
// interface — extendable, can be re-opened (declaration merging)
interface User {
  id: string;
  email: string;
}
interface User {           // merges with the one above
  role: "admin" | "user";
}

interface Admin extends User {
  permissions: string[];
}

// type — can express unions, tuples, mapped & conditional types
type Role = "admin" | "user";
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
type Point = [x: number, y: number];
```

**Rule of thumb:** `interface` for object shapes you expect to extend (and for augmenting libraries like Express's `Request`); `type` for unions, utility compositions and everything else. Both are fine — consistency matters more.

## 💻 Code Example — Generics

```ts
// A generic paginated response used by every list endpoint
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

// Generic constraint: T must have an _id
function indexById<T extends { _id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((item) => [item._id, item]));
}

// Generic with default
type ApiResponse<T = unknown> = { success: boolean; data: T; message?: string };
```

## 💻 Code Example — Utility Types You Will Actually Use

```ts
interface User {
  _id: string;
  email: string;
  name: string;
  password: string;
  role: "admin" | "user";
  createdAt: Date;
}

type PublicUser    = Omit<User, "password">;                  // response DTO
type CreateUserDto = Pick<User, "email" | "name" | "password">;
type UpdateUserDto = Partial<Omit<User, "_id" | "createdAt">>; // PATCH body
type ReadonlyUser  = Readonly<User>;
type RoleCount     = Record<User["role"], number>;            // { admin: number; user: number }

type Fn = (id: string) => Promise<User>;
type FnReturn = Awaited<ReturnType<Fn>>;                      // User
type FnArgs   = Parameters<Fn>;                               // [id: string]

type MaybeNull = string | null | undefined;
type Sure      = NonNullable<MaybeNull>;                      // string
```

## 💻 Code Example — Narrowing & Discriminated Unions

```ts
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

function render(state: FetchState<User[]>): string {
  switch (state.status) {
    case "idle":    return "Nothing yet";
    case "loading": return "Loading…";
    case "success": return `${state.data.length} users`;   // data is available here
    case "error":   return state.error;                    // error is available here
    default: {
      const _exhaustive: never = state;                    // compile error if a case is missed
      return _exhaustive;
    }
  }
}
```

Other narrowing tools:

```ts
if (typeof x === "string") {}            // typeof guard
if (err instanceof AppError) {}          // instanceof guard
if ("data" in res) {}                    // in-operator guard

// Custom type guard
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "email" in v;
}

// Assertion function
function assertDefined<T>(v: T, msg: string): asserts v is NonNullable<T> {
  if (v == null) throw new Error(msg);
}
```

## 💻 Code Example — `any` vs `unknown` vs `never`

```ts
let a: any = JSON.parse(raw);
a.foo.bar.baz();                 // compiles — and crashes at runtime. any turns checking OFF.

let u: unknown = JSON.parse(raw);
// u.foo;                        // ❌ error: must narrow first
if (typeof u === "object" && u !== null && "foo" in u) { /* ok */ }

function fail(msg: string): never {   // never returns
  throw new Error(msg);
}
```

> In catch blocks, `err` is `unknown` under `strict` (`useUnknownInCatchVariables`). Narrow with `err instanceof Error` before reading `.message`.

## 💻 Code Example — `as const`, `satisfies`, and Enums

```ts
// as const → literal, readonly types; great replacement for enums
export const ROLES = ["admin", "user", "guest"] as const;
export type Role = (typeof ROLES)[number];          // "admin" | "user" | "guest"

export const ORDER_STATUS = {
  Pending: "pending",
  Paid: "paid",
  Shipped: "shipped",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// satisfies → checks the shape WITHOUT widening the inferred type
const routes = {
  home: "/",
  user: "/users/:id",
} satisfies Record<string, string>;
routes.user;   // type is still the literal "/users/:id", and typos in keys are caught
```

Why many teams avoid `enum`: numeric enums are not type-safe (`Status.A = 99` compiles in older versions), they generate runtime code, and they don't work with `erasableSyntaxOnly` / Node's native type stripping. `as const` objects + union types give the same ergonomics with zero runtime cost.

## 💻 Code Example — Mapped & Conditional Types (Senior-level)

```ts
// Make every field of T optional AND nullable
type Nullable<T> = { [K in keyof T]?: T[K] | null };

// Pick only the keys of T whose values are strings
type StringKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];
type UserStringFields = StringKeys<User>;  // "_id" | "email" | "name" | "password" | "role"

// Unwrap an array element
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type R = ElementOf<typeof ROLES>;          // "admin" | "user" | "guest"

// Template-literal types — typed event names
type Entity = "user" | "order";
type EventName = `${Entity}:${"created" | "deleted"}`;  // "user:created" | ...
```

## 💻 Code Example — A Strict `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",              // server; use "ESNext" + "Bundler" resolution for Vite/React
    "moduleResolution": "NodeNext",
    "strict": true,                    // strictNullChecks, noImplicitAny, etc.
    "noUncheckedIndexedAccess": true,  // arr[0] is T | undefined
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,      // forces `import type` for type-only imports
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src"]
}
```

`import type { User } from "./types"` is erased completely at compile time — important for avoiding circular runtime imports and for bundle size.

## 🌍 Real-World Impact

- One shared `types` package means a backend change produces compile errors in the React app *before* deploy, not bug reports after.
- Discriminated unions make impossible UI states (loading **and** error) unrepresentable.
- `strict` + `noUncheckedIndexedAccess` catches the classic `Cannot read properties of undefined` at build time.

## 🎯 Likely Interview Questions

1. **`type` vs `interface` — when do you use each?** — Interface for extendable object shapes and declaration merging (augmenting Express `Request`); type for unions, tuples, mapped/conditional types.
2. **`any` vs `unknown`?** — `any` disables checking; `unknown` forces you to narrow before use. Prefer `unknown` for untrusted input.
3. **What is a discriminated union and why use it?** — A union with a shared literal field (`status`) so TS narrows by checking it; enables exhaustive `switch` with `never`.
4. **Explain `Partial`, `Pick`, `Omit`, `Record`.** — Give the DTO examples above.
5. **What does `satisfies` do differently from a type annotation?** — Validates against a type but keeps the narrower inferred type.
6. **Does TypeScript validate API input at runtime?** — No. Types are erased; validate at boundaries with express-validator, class-validator (NestJS) or hand-written type guards.
7. **What is `never` used for?** — Unreachable code, functions that throw, and exhaustiveness checks.
8. **Why avoid `enum`?** — Runtime output, numeric-enum unsafety, incompatible with type-stripping; use `as const` unions.

---

[← MongoDB Rapid-Fire Q&A](../05-mongodb/13-mongodb-interview-questions.md) | [Index](../README.md) | [Next: Project Setup & Architecture →](02-project-setup-architecture.md)
