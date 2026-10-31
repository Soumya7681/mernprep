# Chapter 91 — GraphQL Interview Questions (Detailed Answers)

## 📖 How to Use This Chapter

These are the GraphQL questions asked most often in MERN and full-stack interviews, grouped from easy to hard. Each answer is written so you can say it out loud in 30–90 seconds. The chapters before this one have the full code.

- **Fresher / 0–2 years:** sections 1–3 are usually enough.
- **Mid-level / 2–5 years:** expect sections 4–6 (N+1, security, caching).
- **Senior:** expect section 7 (scenarios and design) and section 8 (live coding).

---

## 1️⃣ Basics

### 1. What is GraphQL?

GraphQL is a **query language for APIs** and a **server runtime** that runs those queries against a **typed schema**. The client sends one request saying exactly which fields it wants, and gets back JSON in that same shape. It usually runs over a single HTTP endpoint, `/graphql`. Facebook created it in 2012 for its mobile app and open-sourced it in 2015.

### 2. Is GraphQL a database or a replacement for MongoDB?

No. GraphQL is **only the API layer**. It doesn't store anything. Resolvers fetch data from wherever it lives: MongoDB, SQL, Redis, other REST services, or files. In a MERN app, GraphQL takes the place of the Express REST routes, not MongoDB.

### 3. What problems does GraphQL solve compared to REST?

1. **Over-fetching:** REST returns fixed responses, often with fields you don't need. GraphQL returns only the fields you ask for, which helps mobile users on slow networks.
2. **Under-fetching / many round trips:** one screen may need `/user`, `/user/posts` and `/posts/:id/comments`. GraphQL gets nested data in one request.
3. **No strong contract:** the schema is a typed, self-documenting contract that the server checks for every request.
4. **Versioning:** instead of `/v2`, you add fields and deprecate old ones.

### 4. What are the disadvantages of GraphQL?

- **HTTP caching is harder** (one URL, mostly POST).
- **Expensive queries are easy to write**, so you need depth and cost limits.
- **N+1 queries** if you don't use DataLoader.
- **File uploads** aren't in the spec.
- **Errors usually come back with HTTP 200**, so normal HTTP monitoring misses them.
- **More setup and learning** than REST for a simple CRUD app.
- **Rate limiting per request doesn't work well**, because one request can be cheap or very costly.

### 5. GraphQL vs REST: when would you choose each?

Choose **GraphQL** when you have several clients (web, iOS, Android) that need different shapes of related data, screens with lots of nested data, or a gateway in front of many microservices.

Choose **REST** for simple CRUD, public APIs that benefit from CDN caching, file streaming, webhooks, or a small team with one client.

Many real apps use **both**: GraphQL for screens, REST for uploads, webhooks and health checks.

### 6. What are the three operation types?

- **Query:** reads data. Top-level fields may run in parallel.
- **Mutation:** changes data. Top-level fields run **one after another**, so `a: createX, b: updateX` is safe in order.
- **Subscription:** a long-lived stream of events from the server, usually over WebSocket.

### 7. Does GraphQL need HTTP? Which method does it use?

The spec doesn't depend on any transport. In practice it's HTTP: **POST** with a JSON body `{ query, variables, operationName }`. **GET** with query-string parameters also works for queries (useful for CDN caching), but mutations should never run over GET. Subscriptions usually use WebSocket (`graphql-ws`) or SSE.

### 8. What is a schema and what is SDL?

The **schema** describes everything the API can do: its types, fields, arguments, and the root `Query`, `Mutation` and `Subscription` types. **SDL** (Schema Definition Language) is the text syntax for writing it, like `type User { id: ID! name: String! }`.

---

## 2️⃣ Schema & Types

### 9. What are the built-in scalar types?

`Int` (32-bit signed), `Float`, `String`, `Boolean` and `ID`. `ID` is serialised as a string and means "a unique identifier, not meant to be read by people". Anything else, like `DateTime`, `Email` or `JSON`, is a **custom scalar**.

### 10. What does `!` mean? Explain `[String!]!`.

`!` means **non-null**. The server promises the value is never `null`.

- `[String!]!`: the list is always there and has no null items (it can be empty).
- `[String]!`: the list is always there, but items can be null.
- `[String!]`: the list itself can be null, but if it's there, its items can't be.

### 11. What is null propagation (null bubbling)?

If a **non-null** field resolves to `null` or throws, GraphQL can't return `null` there, so it sets the **closest nullable parent** to `null` and adds an entry to `errors`. If every parent up to `data` is non-null, `data` itself becomes `null`.

Lesson: making everything `!` makes your API **fragile**. Leave fields that call unreliable services nullable.

### 12. What is the difference between `type` and `input`?

`type` describes **output** objects. Their fields can have arguments and resolvers, and can point to other types (even in loops). `input` describes **arguments**. Its fields can only be scalars, enums, or other inputs, with no resolvers. They're kept separate because input must be fully known and checked before execution, and some output fields (like computed ones) make no sense as input.

### 13. What is an enum?

A fixed set of allowed values, e.g. `enum Role { USER ADMIN }`. GraphQL checks enum arguments for you and documents the allowed values in the schema.

### 14. Interface vs union?

- An **interface** defines **shared fields** that implementing types must have (`interface Node { id: ID! }`). You can query those shared fields directly.
- A **union** is "one of these types" with **no shared fields** (`union SearchResult = User | Post`). You must use inline fragments (`... on User { name }`) for every field.

Both need `__resolveType` on the server to pick the concrete type.

### 15. How do you create a custom scalar?

Create a `GraphQLScalarType` with three functions:
- `serialize`: server value → JSON sent to the client.
- `parseValue`: value from **variables** → server value.
- `parseLiteral`: value written **inline in the query** (an AST node) → server value.

Then add `scalar DateTime` to the SDL and the scalar to the resolver map. In real projects, use `graphql-scalars`.

### 16. What are directives?

Annotations that start with `@`. Built-in ones: `@include(if:)` and `@skip(if:)` (used in queries), `@deprecated(reason:)` and `@specifiedBy(url:)` (used in schemas). You can also define custom schema directives like `@auth(requires: ADMIN)` or `@cacheControl(maxAge: 60)`, which are put into effect by transforming the schema or with plugins.

### 17. What are fragments? What are aliases?

- A **fragment** is a reusable set of fields: `fragment PostCard on Post { id title }`, used as `...PostCard`. It's used for colocating data needs with components and for type conditions on unions.
- An **alias** renames a field in the response, so you can query the same field with different arguments: `drafts: posts(status: DRAFT) { id }` and `live: posts(status: PUBLISHED) { id }`.

### 18. Why use variables instead of putting values directly in the query?

1. **Safety:** values are typed and checked, so there's no string-joining injection.
2. **Reuse:** the query text stays the same, so it can be **cached, persisted and hashed**.
3. **Tooling:** clients and codegen can type the variables.

### 19. How do you version a GraphQL API?

You usually don't use versions. You **evolve** the schema:
- **Add** new fields and types freely (adding is not a breaking change).
- Mark old fields `@deprecated(reason: "Use fullName")`.
- **Track field usage** (Apollo GraphOS, logs) until nobody uses the old field, then remove it.

Breaking changes are things like removing a field, changing its type, making an argument required, or making a nullable field non-null in an input.

### 20. What is introspection? Should it be on in production?

Introspection is the built-in ability to query the schema itself (`__schema`, `__type`, `__typename`). GraphiQL, autocomplete and codegen depend on it.

For **private** APIs, turn it **off in production** and also turn off field suggestions, so attackers can't easily map the API. Generate client types from the schema file in CI instead. Public APIs (like GitHub's) leave it on on purpose.

---

## 3️⃣ Resolvers & Server

### 21. What is a resolver? What are its arguments?

A resolver is a function that returns the data for one field: `(parent, args, context, info)`.
- `parent`: the result of the parent field.
- `args`: this field's arguments.
- `context`: a per-request object shared by all resolvers (user, loaders, data sources).
- `info`: execution details (field name, path, AST of the selected fields).

It can return a value or a promise.

### 22. What is the default resolver?

If you don't write a resolver for a field, GraphQL returns `parent[fieldName]` (and calls it if it's a function). That's why scalar fields that match document properties need no code.

### 23. How does execution work, step by step?

1. **Parse** the query string into an AST.
2. **Validate** it against the schema: fields exist, types match, variables are correct. Invalid queries are rejected before any resolver runs.
3. **Execute:** start at the root type, call each selected field's resolver, pass each result down as `parent` to its children, wait for promises, and put together a response in the query's shape.

The response is `{ data, errors? }`.

### 24. What is the `context` object used for and how is it created?

It's built **once per request** by the server's context function, usually from the HTTP request. It typically holds the **authenticated user** (from the JWT), **new DataLoaders**, database models or data sources, and a request ID for logging. It must not be shared between requests.

### 25. How do you handle authentication and authorisation?

- **Authentication** goes in the **context function**: read the `Authorization` header, verify the JWT, and attach `user` (or `null`). Don't throw here, because public queries and `login` must still work.
- **Authorisation** goes in **resolvers or the service layer**: check `ctx.user` and roles or ownership, and throw `GraphQLError` with `UNAUTHENTICATED` or `FORBIDDEN`. For field-level rules (e.g. only the owner sees `email`), check in that field's resolver.
- You can also use schema directives (`@auth`) or `graphql-shield` for rules in one place.

GraphQL's guidance is to keep authorisation in the **business logic layer**, so REST and GraphQL share the same rules.

### 26. How does error handling work in GraphQL?

Errors appear in a top-level `errors` array, each with `message`, `path`, `locations` and `extensions` (e.g. `extensions.code`). The response is usually **HTTP 200** and can contain **partial data**.

Best practices:
- Throw `GraphQLError` with a clear `extensions.code`.
- Mask internal errors in production with `formatError`.
- For **expected** business errors (e.g. "email taken"), many teams return **result unions** (`User | EmailTakenError`) so clients handle them with types.

### 27. Why does GraphQL return 200 even when there's an error?

One request can have many fields, and some may succeed while others fail. A single HTTP status can't describe that. So the transport says "the request was processed" (200), and the details go in `errors`.

Servers do return non-200 for problems before execution: invalid JSON, a parse or validation failure (often 400 under the GraphQL-over-HTTP spec), or an auth failure if you choose to.

### 28. How do you set up GraphQL in an existing Express app?

Install `@apollo/server`, `graphql` and the Express integration. Create `new ApolloServer({ typeDefs, resolvers })`, `await server.start()`, then mount `expressMiddleware(server, { context })` at `/graphql` after `cors()` and `express.json()`.

Reuse the existing Mongoose models, services and JWT logic inside resolvers. Keep REST routes for uploads and webhooks.

### 29. Schema-first vs code-first?

- **Schema-first:** write SDL, then resolvers (Apollo, Yoga). The schema is easy to read and to discuss in API reviews, but it can drift from resolvers (fix this with codegen types).
- **Code-first:** write TypeScript classes or builders, and the SDL is generated (NestJS, TypeGraphQL, Pothos). There's one source of truth with strong typing.

Either is fine. Say which one you used and why.

### 30. How does GraphQL work in NestJS?

`GraphQLModule.forRoot({ driver: ApolloDriver, autoSchemaFile: true })`. You define types with `@ObjectType` / `@Field`, inputs with `@InputType`, and resolvers with `@Resolver`, `@Query`, `@Mutation`, `@ResolveField`. Guards and interceptors work, but they read the request through `GqlExecutionContext.create(ctx).getContext()`.

---

## 4️⃣ Performance: N+1 & DataLoader

### 31. What is the N+1 problem?

When you query a list of N items and each item's nested field resolver does its own database lookup, you get **1 query for the list + N queries for the children**. For example, 50 posts → 50 separate `User.findById` calls for authors. It happens because each resolver only sees its own parent.

### 32. How does DataLoader solve it?

DataLoader **batches** all `.load(key)` calls made during the same event-loop tick into **one** call to your batch function (`User.find({ _id: { $in: keys } })`). It also **caches** by key for the rest of the request, so the same key is fetched only once. The batch function must return results **in the same order and length as the keys**.

### 33. Why create DataLoaders per request?

The cache inside DataLoader has no expiry and doesn't know about permissions. A global loader would **serve stale data**, **leak one user's data to another**, and **grow memory forever**. Creating new loaders in the context function keeps the cache limited to one request.

### 34. Other ways to solve N+1 besides DataLoader?

- Read `info` to see the requested child fields, then `populate` or `$lookup` in the parent resolver.
- Denormalise often-used fields (e.g. store `authorName` on the post).
- Cache hot entities in Redis.
- With SQL, use joins (e.g. Prisma, or Join Monster-style query planning).

### 35. How would you implement pagination?

Use **cursor-based pagination** with the Relay **connection** shape: `posts(first, after)` returns `{ edges { cursor node }, pageInfo { hasNextPage endCursor } }`.

The cursor is an opaque base64 string of the sort key (`createdAt + _id`). Query with `$lt` on an index, and fetch `limit + 1` to know if there's a next page. Offset pagination (`limit` / `offset`) is fine for small admin tables with page numbers.

### 36. How do you make a slow GraphQL query faster?

1. Turn on **per-field tracing** (Apollo GraphOS / OpenTelemetry) and find the slow resolver.
2. Fix **N+1** with DataLoader.
3. Add **MongoDB indexes** for resolver filters and sorts; check with `explain()`.
4. Make expensive fields **lazy** (only computed if requested), and paginate lists.
5. Cache with Redis or response caching, plus the client cache.
6. Use `@defer` for slow parts of the response.

---

## 5️⃣ Security

### 37. What are the main security risks specific to GraphQL?

Deeply nested queries, very wide queries (large lists inside lists), alias and batching abuse (1,000 login attempts in one request), introspection exposing the schema, and the usual API risks: injection, IDOR, broken authorisation, and CSRF.

### 38. How do you protect against expensive or malicious queries?

- **Depth limiting** (e.g. max depth 8).
- **Query cost / complexity analysis** with a budget per request, and per client over time (Shopify and GitHub do this).
- **Pagination caps** (`first` ≤ 100).
- **Timeouts.**
- **Limits on aliases and batches.**
- **Rate limiting by cost or operation**, not by HTTP request.
- **Body size limits.**
- **Persisted queries / safelisting** for first-party clients.
- Introspection off in production.

### 39. What are persisted queries? APQ vs safelisting?

- **Automatic Persisted Queries (APQ):** the client sends a SHA-256 hash. If the server doesn't recognise it, the client sends the full query once, and the server saves it. This saves bandwidth and allows GET/CDN caching. It does **not** stop new, unknown queries.
- **Trusted documents / safelisting:** every allowed operation is registered at build time, and the server **rejects anything else**. It's the strongest protection for private APIs.

### 40. How do you prevent injection in GraphQL?

Always use **variables** (typed and checked). Validate input with Zod or Joi. Never pass raw args as Mongo filter objects (so `{ "$gt": "" }` can't be injected). Avoid `$where`. Escape user input used in `RegExp`. Enum and scalar types also help by limiting what values are accepted.

### 41. How do you prevent CSRF on a GraphQL endpoint?

Require `Content-Type: application/json` (HTML forms can't send it without a CORS preflight). Apollo Server's built-in CSRF prevention does this. Use `SameSite=Lax/Strict` cookies, or send tokens in the `Authorization` header instead of cookies, and set a strict CORS origin list. Never allow mutations over GET.

---

## 6️⃣ Caching & Client

### 42. Why is caching harder in GraphQL than in REST?

REST caches by URL and method with standard HTTP headers, so browsers and CDNs work automatically. GraphQL uses one URL, mostly POST, and every query has a different shape. So caching happens elsewhere:

- a **normalised client cache** (Apollo / urql)
- **DataLoader** per request
- **response caching** with `@cacheControl` hints
- **GET + persisted query hashes** for CDNs
- Redis in the data layer

### 43. How does Apollo Client's cache work?

`InMemoryCache` **normalises** responses. Every object with `__typename` and `id` is stored once under `Type:id`, and queries keep references to those objects. When any query or mutation returns an updated `Post:1`, every component showing `Post:1` re-renders. Types without `id` need `keyFields` in `typePolicies`.

### 44. I added an item with a mutation, but the list didn't update. Why?

The normalised cache updates **existing** objects automatically, but it can't know that a **new** object belongs in a particular list (or that a deleted one should leave it). The fixes:
- `refetchQueries: ["Feed"]` (simplest)
- an `update` function using `cache.modify` to add the reference
- `cache.evict` + `cache.gc()` for deletes
- a subscription that pushes the change

### 45. What are fetch policies?

They control how a query uses the cache:
- `cache-first` (default)
- `cache-and-network`: show cached data, then refresh
- `network-only`: always fetch, save in cache
- `no-cache`: always fetch, don't save
- `cache-only`
- `standby`

### 46. How do you implement optimistic UI with Apollo?

Pass `optimisticResponse` to the mutation, shaped exactly like the expected server result (including `__typename` and `id`). Apollo writes it to a temporary cache layer, so the UI updates at once. When the server answers, the real result replaces it. If there's an error, it rolls back.

### 47. How do subscriptions work end to end?

The client opens a WebSocket using the `graphql-ws` protocol and sends the token in `connectionParams`. It sends a `subscription` operation. The server's subscription resolver returns an **async iterator** from a PubSub.

When a mutation saves data, it calls `pubsub.publish(...)`. `withFilter` sends the event only to matching subscribers (e.g. the same `postId`). With several server instances, swap the in-memory PubSub for **Redis** Pub/Sub. On the client, a `split` link sends subscriptions over WebSocket and everything else over HTTP.

### 48. How do you get type safety between your GraphQL schema and React/TypeScript?

Use **GraphQL Code Generator**. The `client-preset` reads the schema and your `graphql()` documents and generates typed documents, so `useQuery` knows the exact types of `data` and `variables`. On the server, `typescript-resolvers` types each resolver's `parent`, `args` and return value. Run codegen in CI so breaking schema changes fail the build.

---

## 7️⃣ Scenarios & Design

### 49. Your mobile app is slow because the home screen makes 7 REST calls. How would GraphQL help, and what would you watch out for?

Add a GraphQL **BFF** (backend-for-frontend) that exposes one `homeScreen` query. Its resolvers call the existing REST services in parallel and through DataLoaders. The app makes **one round trip** and gets only the fields it shows.

Watch out for: N+1 calls to the downstream services, timeouts (make slow sections nullable, so one failure doesn't break the whole screen), caching (DataLoader + Redis), and auth (pass the user's token to the downstream services).

### 50. Design the GraphQL schema for an e-commerce cart and checkout.

```graphql
type Product @key(fields: "id") { id: ID!, name: String!, price: Money!, stock: Int! }
type Money { amount: Int!, currency: String! }      # store paise/cents, never floats
type CartItem { product: Product!, quantity: Int!, lineTotal: Money! }
type Cart { id: ID!, items: [CartItem!]!, subtotal: Money! }

type Query { cart: Cart!, products(first: Int = 20, after: String, category: ID): ProductConnection! }

type Mutation {
  addToCart(productId: ID!, quantity: Int! = 1): Cart!
  updateCartItem(productId: ID!, quantity: Int!): Cart!
  checkout(input: CheckoutInput!): CheckoutResult!
}

union CheckoutResult = Order | OutOfStockError | PaymentFailedError
```

Talking points:
- Mutations return the **whole `Cart`**, so the client cache updates in one go.
- Money is stored as an **integer**.
- **Result unions** handle expected failures.
- Products use **cursor pagination**.
- `checkout` takes an **idempotency key** inside `CheckoutInput`.
- `stock` is checked in a **MongoDB transaction**.

### 51. A deeply nested query is taking down your server. What do you do right now, and what do you do long term?

**Right now:** find the operation in the logs (by operation name or hash), block it, or add a depth or cost limit and a timeout, then deploy.

**Long term:**
- cost analysis with a budget per client
- pagination caps on every list
- persisted queries or a safelist for first-party apps
- introspection off
- rate limiting by cost
- alerts on resolver latency

### 52. How would you move a REST MERN app to GraphQL gradually?

1. Add Apollo Server at `/graphql` **next to** the REST routes.
2. Move the logic out of route handlers into **services** that both REST and resolvers call.
3. Start with **read-heavy screens** (queries), and add DataLoaders from day one.
4. Move mutations over next. Keep REST for uploads, webhooks and third parties.
5. Add codegen, then move the React client screen by screen with Apollo Client.
6. Retire each REST endpoint once nothing uses it any more.

### 53. When would you use subscriptions vs polling vs SSE?

- **Subscriptions:** true two-way real time with many updates (chat, collaborative editing, live bids).
- **Polling** (`pollInterval`): data that can be 10–60 s out of date. It's simplest and works with normal HTTP infrastructure.
- **SSE:** one-way server-to-client streams, like notifications or AI token streaming. It's easier to scale through proxies than WebSockets.

### 54. What is Apollo Federation and when do you need it?

Federation splits one big schema into **subgraphs**, each owned by a team or service. A **router** combines them into one **supergraph**. Entities marked with `@key(fields: "id")` can be extended across subgraphs (the posts service adds `User.posts`), and `__resolveReference` loads an entity from its key.

You need it when many teams are fighting over one schema or one deployment. A single MERN app usually doesn't.

### 55. How do you handle file uploads?

Preferred: a mutation returns an **S3 pre-signed URL**. The browser uploads directly to S3, then a second mutation saves the key. Alternatives are the GraphQL multipart request spec (`graphql-upload`, with an `Upload` scalar and CSRF preflight headers), or a separate REST upload endpoint.

### 56. How do you monitor a GraphQL API in production?

- Log and measure by **operation name** (make clients name every operation).
- Track error rates from `errors[].extensions.code`, not HTTP status codes.
- Use per-field tracing (OpenTelemetry / Apollo GraphOS) for latency.
- Track field usage to find deprecated fields that are safe to remove.
- Alert on p95 latency per operation and on cost-limit rejections.

---

## 8️⃣ Live Coding Tasks

### Task 1: Write the schema and resolvers for a to-do API

```js
const typeDefs = `#graphql
  type Todo { id: ID!, title: String!, done: Boolean! }
  type Query { todos(done: Boolean): [Todo!]! }
  type Mutation {
    addTodo(title: String!): Todo!
    toggleTodo(id: ID!): Todo
    deleteTodo(id: ID!): Boolean!
  }
`;

const resolvers = {
  Query: {
    todos: (_p, { done }) => Todo.find(done === undefined ? {} : { done }),
  },
  Mutation: {
    addTodo: (_p, { title }) => Todo.create({ title, done: false }),
    toggleTodo: async (_p, { id }) => {
      const todo = await Todo.findById(id);
      if (!todo) return null;
      todo.done = !todo.done;
      return todo.save();
    },
    deleteTodo: async (_p, { id }) => (await Todo.deleteOne({ _id: id })).deletedCount === 1,
  },
  Todo: { id: (t) => t._id.toString() },
};
```

### Task 2: Fix this N+1

```js
// Before: one query per post
Post: { author: (post) => User.findById(post.authorId) }
```

```js
// After
import DataLoader from "dataloader";

const createLoaders = () => ({
  userById: new DataLoader(async (ids) => {
    const users = await User.find({ _id: { $in: ids } }).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return ids.map((id) => byId.get(id) ?? null);       // same order as ids
  }),
});

// context: () => ({ loaders: createLoaders() })   ← per request
Post: { author: (post, _a, { loaders }) => loaders.userById.load(String(post.authorId)) }
```

### Task 3: Build a tiny DataLoader yourself

Interviewers ask this to check that you understand batching in the event loop:

```js
class MiniLoader {
  constructor(batchFn) {
    this.batchFn = batchFn;
    this.queue = [];          // { key, resolve, reject }
    this.cache = new Map();   // key → promise
  }

  load(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const promise = new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      // Schedule ONE dispatch after all synchronous .load() calls in this tick
      if (this.queue.length === 1) queueMicrotask(() => this.dispatch());
    });
    this.cache.set(key, promise);
    return promise;
  }

  async dispatch() {
    const batch = this.queue;
    this.queue = [];
    try {
      const results = await this.batchFn(batch.map((b) => b.key));
      batch.forEach((b, i) => (results[i] instanceof Error ? b.reject(results[i]) : b.resolve(results[i])));
    } catch (err) {
      batch.forEach((b) => b.reject(err));
    }
  }
}

// Usage
const loader = new MiniLoader(async (ids) => {
  console.log("batch:", ids);           // logs once: batch: [1, 2, 3]
  return ids.map((id) => ({ id }));
});
Promise.all([loader.load(1), loader.load(2), loader.load(3), loader.load(1)]).then(console.log);
```

> The real DataLoader schedules its dispatch a little later than one microtask, so loads made inside nested promise callbacks in the same tick are batched too. The idea is the same.

### Task 4: Call a GraphQL API with only `fetch` (no library)

```js
async function gqlRequest(query, variables = {}, token) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map((e) => e.message).join("; "));
  return data;
}

const data = await gqlRequest(
  `query ($id: ID!) { post(id: $id) { title author { name } } }`,
  { id: "1" },
);
```

### Task 5: React component with query + mutation + cache update

```jsx
const TODOS = gql`query Todos { todos { id title done } }`;
const ADD = gql`mutation Add($title: String!) { addTodo(title: $title) { id title done } }`;
const TOGGLE = gql`mutation Toggle($id: ID!) { toggleTodo(id: $id) { id done } }`;

function Todos() {
  const { data, loading, error } = useQuery(TODOS);
  const [addTodo] = useMutation(ADD, {
    update(cache, { data: { addTodo } }) {
      cache.updateQuery({ query: TODOS }, (old) => ({ todos: [...(old?.todos ?? []), addTodo] }));
    },
  });
  // No update function needed: it returns { id, done }, so the cache merges it into Todo:<id>
  const [toggleTodo] = useMutation(TOGGLE);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <>
      <form onSubmit={(e) => {
        e.preventDefault();
        const title = new FormData(e.currentTarget).get("task").trim();
        if (title) addTodo({ variables: { title } });
        e.currentTarget.reset();
      }}>
        <input name="task" placeholder="New task" />
      </form>
      <ul>
        {data.todos.map((t) => (
          <li key={t.id}>
            <label>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTodo({
                  variables: { id: t.id },
                  optimisticResponse: { toggleTodo: { __typename: "Todo", id: t.id, done: !t.done } },
                })}
              />
              {t.title}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
```

---

## ⚡ Rapid-Fire Round

| Question | One-line answer |
|---|---|
| Default HTTP method? | POST with JSON `{ query, variables, operationName }` |
| What does `__typename` return? | The name of the object's concrete type; used by caches and unions |
| Can a query change data? | It shouldn't; by convention only mutations do |
| Do mutation fields run in parallel? | No, one after another |
| Do query fields run in parallel? | They may; sibling resolvers' promises run at the same time |
| Can `input` types have arguments? | No |
| Can an `input` contain a `type`? | No, only scalars, enums and other inputs |
| What library batches DB calls? | DataLoader |
| Deprecated subscription protocol? | `subscriptions-transport-ws`; use `graphql-ws` |
| Apollo cache key? | `__typename:id` (customise with `keyFields`) |
| How to rename a field in the response? | An alias |
| How to make a field conditional? | `@include(if: $x)` / `@skip(if: $x)` |
| Why opaque cursors? | So the server can change how pagination works without breaking clients |
| GraphQL "file" type? | None in the spec; use pre-signed URLs or the multipart spec |
| Is GraphQL only for React? | No; any client (mobile, CLI, server-to-server) can send it |

---

[← GraphQL in React with Apollo Client](04-graphql-react-client.md) | [Index](../README.md) | [Next: Python Fundamentals for JavaScript Developers →](../28-python/01-python-fundamentals.md)
