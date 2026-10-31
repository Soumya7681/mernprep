# Chapter 135 — GraphQL Coding Questions

## 📖 Definition

GraphQL coding rounds ask you to **write schema and resolvers live**, then fix the problems a senior reviewer would point out: **N+1 queries** (DataLoader), **pagination** (cursor connections), **field-level auth**, **custom scalars**, **unions**, **errors as data**, **query depth limits**, **safelisting**, and calling an API **without a client library**.

**All 10 tasks share one Apollo Server app, tested with `node:test`. All 10 tests pass** (Node 24, graphql 16.14, @apollo/server 5.5, dataloader 2.2), and the results shown are real. Tests call `server.executeOperation()`, which runs the full parse → validate → execute pipeline without HTTP. Task 10 starts a real HTTP server.

## 🧠 Checklist While Coding

- Write the **SDL first** and talk through nullability (`!`) as you go.
- Resolvers stay thin: arguments → service/DB → return. **Authorisation** goes in the resolver or service, not the client.
- Any field that loads data per parent object → **DataLoader**, created **per request**.
- Lists → limits or pagination, always.
- Expected failures (validation, "not found") → consider **result unions**; unexpected ones → `GraphQLError` with `extensions.code`.

## 💻 The Shared Schema and Fake Database

```js
import { ApolloServer } from "@apollo/server";
import DataLoader from "dataloader";
import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

export const db = {
  queries: 0,                                         // counts "database" round trips
  users: [
    { id: "1", name: "Asha", email: "asha@x.com", role: "ADMIN" },
    { id: "2", name: "Ravi", email: "ravi@x.com", role: "USER" },
  ],
  posts: Array.from({ length: 7 }, (_, i) => ({
    id: String(i + 1), title: `Post ${i + 1}`, authorId: i % 2 ? "2" : "1",
    createdAt: new Date(Date.UTC(2026, 0, i + 1)),
  })),
  todos: [],
  async findUsersByIds(ids) { this.queries++; return this.users.filter((u) => ids.includes(u.id)); },
  async findUserById(id)    { this.queries++; return this.users.find((u) => u.id === id) ?? null; },
};

export const typeDefs = `#graphql
  scalar DateTime
  enum Role { USER ADMIN }

  type User { id: ID!  name: String!  email: String  role: Role!  posts: [Post!]! }
  type Post { id: ID!  title: String!  author: User!  createdAt: DateTime! }
  type Todo { id: ID!  title: String!  done: Boolean! }

  type PostEdge { cursor: String!  node: Post! }
  type PageInfo { hasNextPage: Boolean!  endCursor: String }
  type PostConnection { edges: [PostEdge!]!  pageInfo: PageInfo!  totalCount: Int! }

  union SearchResult = User | Post

  type ValidationError { field: String!  message: String! }
  union AddTodoResult = Todo | ValidationError

  type Query {
    todos(done: Boolean): [Todo!]!
    posts(first: Int = 3, after: String): PostConnection!
    me: User
    search(term: String!): [SearchResult!]!
    postsSince(since: DateTime!): [Post!]!
  }

  type Mutation {
    addTodo(title: String!): AddTodoResult!
    toggleTodo(id: ID!): Todo
  }
`;

export function createServer({ plugins = [], validationRules = [depthLimit(5)] } = {}) {
  return new ApolloServer({ typeDefs, resolvers, plugins, validationRules });
}

// How the tests run an operation (no HTTP):
const res = await server.executeOperation(
  { query, variables },
  { contextValue: { loaders: createLoaders(), user } },
);
const { data, errors } = res.body.singleResult;
```

---

## Task 1: Queries and Mutations for a To-Do List

```js
Query: {
  todos: (_p, { done }) =>
    done === undefined || done === null ? db.todos : db.todos.filter((t) => t.done === done),
},
Mutation: {
  toggleTodo: (_p, { id }) => {
    const todo = db.todos.find((t) => t.id === id);
    if (!todo) return null;                 // nullable return type: "not found" is null, not an error
    todo.done = !todo.done;
    return todo;                            // return the changed object, so client caches update
  },
  // addTodo: see Task 7
},
```

```graphql
mutation { addTodo(title: "Learn GraphQL") { ... on Todo { id } } }
mutation { addTodo(title: "Write tests")   { ... on Todo { id } } }
mutation { toggleTodo(id: "1") { id done } }
{ done: todos(done: true) { title }  open: todos(done: false) { title } }    # aliases
```

```json
{ "done": [{ "title": "Learn GraphQL" }], "open": [{ "title": "Write tests" }] }
```

## Task 2: Fix the N+1 With DataLoader

```js
// ❌ Before: one DB call per post
Post: { author: (post) => db.findUserById(post.authorId) }

// ✅ After
export function createLoaders() {
  return {
    userById: new DataLoader(async (ids) => {
      const users = await db.findUsersByIds(ids);              // ONE query: WHERE id IN (...)
      const byId = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => byId.get(id) ?? new Error(`User ${id} not found`));   // same order and length as ids
    }),
  };
}

Post: { author: (post, _a, ctx) => ctx.loaders.userById.load(post.authorId) },
```

```graphql
{ posts(first: 7) { edges { node { title author { name } } } } }
```

**Result:** 7 posts with authors `Asha, Ravi, Asha, Ravi, Asha, Ravi, Asha` → **1** database query (the counter in the test). Before the fix it was 7.

Say: loaders are created **per request** in the context function, so the cache never leaks between users.

## Task 3: Cursor Pagination (Relay Connection)

```js
const encodeCursor = (post) => Buffer.from(`post:${post.id}`).toString("base64url");   // opaque to clients
const decodeCursor = (cursor) => Buffer.from(cursor, "base64url").toString().replace(/^post:/, "");

posts: (_p, { first, after }) => {
  if (first < 1 || first > 50) {
    throw new GraphQLError("first must be between 1 and 50", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const sorted = [...db.posts].sort((a, b) => Number(a.id) - Number(b.id));
  const start = after ? sorted.findIndex((p) => p.id === decodeCursor(after)) + 1 : 0;
  const slice = sorted.slice(start, start + first + 1);     // fetch ONE extra to know if there's a next page
  const hasNextPage = slice.length > first;
  const nodes = slice.slice(0, first);
  return {
    edges: nodes.map((node) => ({ cursor: encodeCursor(node), node })),
    pageInfo: { hasNextPage, endCursor: nodes.length ? encodeCursor(nodes.at(-1)) : null },
    totalCount: sorted.length,
  };
},
```

```text
posts(first: 3)                       → ids 1, 2, 3   hasNextPage: true   endCursor: "cG9zdDoz" (post:3)
posts(first: 3, after: "cG9zdDo2")    → id 7          hasNextPage: false   (cursor "post:6")
posts(first: 500)                     → error, code BAD_USER_INPUT
```

With MongoDB, the cursor would hold `createdAt + _id`, and the query would be `find({ $or: [{ createdAt: { $lt } }, ...] }).sort(...).limit(first + 1)` on an index.

## Task 4: Field-Level Authorisation (Who Can See `email`)

```js
Query: {
  me: (_p, _a, ctx) => (ctx.user ? db.findUserById(ctx.user.id) : null),
},
User: {
  email: (user, _a, ctx) =>
    ctx.user && (ctx.user.id === user.id || ctx.user.role === "ADMIN") ? user.email : null,
},
```

```graphql
{ me { name email }  search(term: "a") { ... on User { name email } } }
```

| Caller | `me` | Asha's email | Ravi's email |
|---|---|---|---|
| Anonymous | `null` | `null` | `null` |
| Ravi (USER) | Ravi, ravi@x.com | `null` | ravi@x.com |
| Asha (ADMIN) | Asha, asha@x.com | asha@x.com | ravi@x.com |

`email` is **nullable** in the schema on purpose, so hiding it doesn't break the response (a `String!` field returning null would null out the parent object).

## Task 5: A `DateTime` Custom Scalar

```js
export const DateTime = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 date-time",
  serialize(value) {                                     // server → client
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw new GraphQLError("DateTime cannot represent an invalid date");
    return d.toISOString();
  },
  parseValue(value) {                                    // client variables → server
    const d = new Date(value);
    if (typeof value !== "string" || Number.isNaN(d.getTime())) throw new GraphQLError("Invalid DateTime");
    return d;
  },
  parseLiteral(ast) {                                    // value written inline in the query
    if (ast.kind !== Kind.STRING) throw new GraphQLError("DateTime must be a string");
    return this.parseValue(ast.value);
  },
});

// resolvers: { DateTime, Query: { postsSince: (_p, { since }) => db.posts.filter((p) => p.createdAt >= since) } }
```

```text
postsSince(since: "2026-01-06T00:00:00Z") → posts 6 and 7, createdAt "2026-01-06T00:00:00.000Z", ...
postsSince(since: "not-a-date")           → error "Invalid DateTime" (rejected before the resolver runs)
```

## Task 6: Search Returning a Union

```js
search: (_p, { term }) => {
  const t = term.toLowerCase();
  return [
    ...db.users.filter((u) => u.name.toLowerCase().includes(t)),
    ...db.posts.filter((p) => p.title.toLowerCase().includes(t)),
  ];
},
SearchResult: { __resolveType: (obj) => ("title" in obj ? "Post" : "User") },
```

```graphql
{ search(term: "ra") { __typename ... on User { name } ... on Post { title } } }
```

**Result:** `"ra"` → `[{ "__typename": "User", "name": "Ravi" }]` · `"post 7"` → `[{ "__typename": "Post", "title": "Post 7" }]`

## Task 7: Return Validation Errors as Data (Result Union)

```js
addTodo: (_p, { title }) => {
  const clean = title.trim();
  if (clean.length < 3) {
    return { __typename: "ValidationError", field: "title", message: "Title must be at least 3 characters" };
  }
  const todo = { id: String(db.todos.length + 1), title: clean, done: false };
  db.todos.push(todo);
  return { __typename: "Todo", ...todo };
},
AddTodoResult: { __resolveType: (obj) => obj.__typename },
```

```graphql
mutation {
  addTodo(title: "  hi ") {
    __typename
    ... on Todo { id title }
    ... on ValidationError { field message }
  }
}
```

```json
{ "addTodo": { "__typename": "ValidationError", "field": "title", "message": "Title must be at least 3 characters" } }
```

There's **no `errors` array**: the failure is a typed part of the API, so the client must handle it (TypeScript codegen makes it a discriminated union). Use `GraphQLError` for unexpected failures; use result unions for **expected business outcomes**.

## Task 8: Write a Query-Depth Limit Validation Rule

```js
export function depthLimit(maxDepth) {
  return (context) => {
    const fragments = Object.fromEntries(
      context.getDocument().definitions
        .filter((d) => d.kind === Kind.FRAGMENT_DEFINITION)
        .map((d) => [d.name.value, d]),
    );

    const depthOf = (selectionSet, depth, seen) => {
      if (!selectionSet) return depth;
      let max = depth;
      for (const sel of selectionSet.selections) {
        if (sel.kind === Kind.FIELD) {
          if (sel.name.value.startsWith("__")) continue;               // ignore __typename / introspection
          max = Math.max(max, depthOf(sel.selectionSet, depth + 1, seen));
        } else if (sel.kind === Kind.INLINE_FRAGMENT) {
          max = Math.max(max, depthOf(sel.selectionSet, depth, seen)); // fragments don't add depth
        } else if (sel.kind === Kind.FRAGMENT_SPREAD && !seen.has(sel.name.value)) {
          const frag = fragments[sel.name.value];
          max = Math.max(max, depthOf(frag?.selectionSet, depth, new Set([...seen, sel.name.value])));
        }
      }
      return max;
    };

    return {
      OperationDefinition(node) {
        const depth = depthOf(node.selectionSet, 0, new Set());
        if (depth > maxDepth) {
          context.reportError(new GraphQLError(`Query depth ${depth} exceeds maximum of ${maxDepth}`, { nodes: [node] }));
        }
      },
    };
  };
}

new ApolloServer({ typeDefs, resolvers, validationRules: [depthLimit(5)] });
```

```text
{ me { posts { author { posts { author { posts { title } } } } } } }      → "Query depth 7 exceeds maximum of 5"
{ me { ...P } }  fragment P on User { posts { author { posts { author { name } } } } }
                                                                          → "Query depth 6 exceeds maximum of 5"
{ me { posts { author { name } } } }                                      → runs normally (depth 4)
```

Validation rules run **before any resolver**, so an abusive query costs almost nothing. The `seen` set protects against fragments that spread each other in a loop. In production, use `graphql-depth-limit` plus **cost analysis**.

## Task 9: Safelist Plugin (Only Allow Known Operations)

```js
import { createHash } from "node:crypto";

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function safelistPlugin(allowedHashes) {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ request }) {
          if (!allowedHashes.has(sha256(request.query ?? ""))) {
            throw new GraphQLError("Operation not in safelist", {
              extensions: { code: "PERSISTED_QUERY_NOT_ALLOWED", http: { status: 403 } },
            });
          }
        },
      };
    },
  };
}

const allowed = `{ todos { id } }`;
createServer({ plugins: [safelistPlugin(new Set([sha256(allowed)]))] });
```

```text
{ todos { id } }         → runs
{ todos { id title } }   → "Operation not in safelist" (PERSISTED_QUERY_NOT_ALLOWED)
```

In real projects, the allowed hashes come from a **build step** that extracts every operation from the React app (GraphQL Codegen / Apollo's persisted-query manifest). Apollo Router and GraphOS offer this as "trusted documents".

## Task 10: A GraphQL Client With Only `fetch`

```js
export async function gqlRequest(url, query, variables = {}, { token, timeoutMs = 5000 } = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),           // never hang forever
  });
  const body = await res.json().catch(() => null);   // a proxy error page isn't JSON
  if (!body) throw new Error(`HTTP ${res.status}: response was not JSON`);
  if (body.errors?.length) {                          // GraphQL errors can arrive with HTTP 200
    const err = new Error(body.errors.map((e) => e.message).join("; "));
    err.codes = body.errors.map((e) => e.extensions?.code);
    err.partialData = body.data ?? null;              // keep partial data for the caller
    throw err;
  }
  return body.data;
}
```

Tested against a real `startStandaloneServer` on a random port:

```text
gqlRequest(url, "query { me { name email } }", {}, { token: "admin-token" })
  → { me: { name: "Asha", email: "asha@x.com" } }
gqlRequest(url, "{ posts(first: 0) { totalCount } }")
  → throws "first must be between 1 and 50", codes ["BAD_USER_INPUT"]
gqlRequest(url, "{ nope }")
  → throws 'Cannot query field "nope" on type "Query".', codes ["GRAPHQL_VALIDATION_FAILED"]
```

The point interviewers want: **checking `res.ok` isn't enough**. GraphQL usually reports errors inside a 200 response, so you must read `errors`.

---

## 🎯 Likely Interview Questions

1. **How do you prove that DataLoader fixed the N+1?** — Count the DB calls in a test, or look at the query log.
2. **Why must the batch function return results in the same order as the keys?**
3. **Why is `email` nullable in this schema?**
4. **Where does validation happen for a custom scalar?** — `parseValue` / `parseLiteral`, before any resolver runs.
5. **When would you return a result union instead of throwing?**
6. **How does a validation rule stop an expensive query before it runs?**
7. **Persisted queries vs a safelist?**
8. **Why can't a GraphQL client rely on the HTTP status code?**
9. **How do you test resolvers without starting an HTTP server?** — `server.executeOperation()`.

---

[← FastAPI Coding Questions](09-fastapi-coding-questions.md) | [Index](../README.md) | [Next: JavaScript Scenarios →](../24-scenario-questions/01-javascript-scenarios.md)
