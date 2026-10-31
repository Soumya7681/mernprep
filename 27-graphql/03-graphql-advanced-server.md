# Chapter 89 — Advanced GraphQL Server Topics

## 📖 Definition

A basic GraphQL server works fine in a demo. In production, the same server can be slow and easy to attack. This chapter covers what interviewers ask about once you say "I've used GraphQL":

- the **N+1 problem** and **DataLoader**
- **cursor pagination** (Relay connections)
- **subscriptions** over WebSockets
- **security**: depth limits, cost limits, persisted queries, batching abuse
- **caching**
- **file uploads**
- **federation** for microservices

---

## 1️⃣ The N+1 Problem

### What it is

```graphql
query { posts(limit: 50) { title author { name } } }
```

```js
Query: { posts: () => Post.find().limit(50) },             // 1 query
Post:  { author: (p) => User.findById(p.authorId) },      // called 50 times → 50 queries
```

That's **1 query for the list + N queries for each item's author = N+1** database calls. Nest it once more (`author { posts { comments } }`) and it grows very fast.

Why it happens: each resolver only sees its own `parent`. It has no idea that 49 other resolvers just asked for very similar data.

### The fix: DataLoader

**DataLoader** (from Facebook) does two jobs:

1. **Batching:** it collects every `.load(key)` call made in the **same tick of the event loop**, then calls your batch function **once** with all the keys.
2. **Caching (per request):** the same key in the same request returns the same promise. Asking for user 7 twenty times hits the database once.

```js
// loaders.js
import DataLoader from "dataloader";
import { User } from "./models/User.js";
import { Comment } from "./models/Comment.js";

export function createLoaders() {
  return {
    userById: new DataLoader(async (ids) => {
      const users = await User.find({ _id: { $in: ids } }).lean();
      const map = new Map(users.map((u) => [String(u._id), u]));
      // RULE: return results in the SAME ORDER and SAME LENGTH as `ids`
      return ids.map((id) => map.get(id) ?? null);
    }),

    // one-to-many: comments for many posts at once
    commentsByPostId: new DataLoader(async (postIds) => {
      const comments = await Comment.find({ postId: { $in: postIds } }).lean();
      const groups = new Map(postIds.map((id) => [id, []]));
      for (const c of comments) groups.get(String(c.postId))?.push(c);
      return postIds.map((id) => groups.get(id));
    }),

    // counts with one aggregation
    commentCountByPostId: new DataLoader(async (postIds) => {
      const rows = await Comment.aggregate([
        { $match: { postId: { $in: postIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: "$postId", n: { $sum: 1 } } },
      ]);
      const map = new Map(rows.map((r) => [String(r._id), r.n]));
      return postIds.map((id) => map.get(id) ?? 0);
    }),
  };
}
```

```js
Post: {
  author: (p, _a, { loaders }) => loaders.userById.load(String(p.authorId)),
  comments: (p, _a, { loaders }) => loaders.commentsByPostId.load(String(p._id)),
  commentCount: (p, _a, { loaders }) => loaders.commentCountByPostId.load(String(p._id)),
},
```

Result: 50 posts + authors + comment counts = **3 queries**, not 101.

### DataLoader rules interviewers check

| Rule | Why |
|---|---|
| Create loaders **per request** (in `context`) | The cache would otherwise leak data between users and grow forever |
| Batch function returns an array of the **same length and order** as the keys | DataLoader matches results to keys by position |
| Return `null` or an `Error` for missing keys, don't skip them | Skipping shifts the order and gives users the wrong data |
| Normalise keys (`String(id)`) | `ObjectId` instances are different objects, so cache lookups miss |
| After a mutation, `loader.clear(id)` or `prime(id, value)` | So later reads in the same request see fresh data |

### Other fixes

- **Lookahead / join:** read `info` to see which child fields were requested, then `populate` or `$lookup` in the parent resolver. Fast, but the parent and child resolvers become tied together.
- **Denormalise** often-read fields (for example, store `authorName` on the post).
- Libraries like `graphql-parse-resolve-info` help read `info`.

---

## 2️⃣ Pagination

### Offset vs cursor

| | Offset (`limit`, `offset`) | Cursor (`first`, `after`) |
|---|---|---|
| Jump to page 7 | Easy | Not possible directly |
| Large offsets | Slow (`skip` still reads the skipped docs) | Fast (uses an index range) |
| Items inserted while scrolling | Duplicates or missed items | Stable |
| Best for | Admin tables | Infinite scroll, feeds |

### The Relay connection spec (the standard shape)

```graphql
type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PostEdge {
  cursor: String!
  node: Post!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type Query {
  posts(first: Int = 10, after: String): PostConnection!
}
```

```js
const encode = (doc) => Buffer.from(`${doc.createdAt.toISOString()}|${doc._id}`).toString("base64url");
const decode = (c) => {
  const [date, id] = Buffer.from(c, "base64url").toString().split("|");
  return { date: new Date(date), id: new mongoose.Types.ObjectId(id) };
};

posts: async (_p, { first, after }) => {
  const limit = Math.min(first, 50);
  const filter = {};
  if (after) {
    const { date, id } = decode(after);
    // "older than the cursor", using _id to break ties between equal timestamps
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }];
  }
  const docs = await Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })     // needs index { createdAt: -1, _id: -1 }
    .limit(limit + 1);                    // fetch one extra to know if there's a next page

  const hasNextPage = docs.length > limit;
  const nodes = hasNextPage ? docs.slice(0, limit) : docs;
  const edges = nodes.map((n) => ({ cursor: encode(n), node: n }));

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: Boolean(after),
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
    totalCount: () => Post.countDocuments(), // resolved only if the client asks for it
  };
},
```

Cursors should be **opaque** (base64). Clients must not parse them. That lets you change how they work later.

---

## 3️⃣ Subscriptions (Real-Time)

Subscriptions keep a connection open, usually a **WebSocket** using the **`graphql-ws`** protocol, and the server pushes an event each time something happens.

> The old `subscriptions-transport-ws` package is **deprecated**. Use `graphql-ws`.

```js
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";   // graphql-ws v6; v5 used "graphql-ws/lib/use/ws"
import { makeExecutableSchema } from "@graphql-tools/schema";
import { PubSub, withFilter } from "graphql-subscriptions";

const pubsub = new PubSub(); // in-memory: only works with ONE server process
const schema = makeExecutableSchema({ typeDefs, resolvers });

const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
const serverCleanup = useServer(
  {
    schema,
    // Runs for each subscription; auth comes from connectionParams, not HTTP headers
    context: async (ctx) => ({
      user: getUserFromToken(ctx.connectionParams?.authorization),
      loaders: createLoaders(),
    }),
    onConnect: (ctx) => Boolean(getUserFromToken(ctx.connectionParams?.authorization)), // reject anonymous
  },
  wsServer,
);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    { async serverWillStart() { return { async drainServer() { await serverCleanup.dispose(); } }; } },
  ],
});
```

```js
// resolvers
Mutation: {
  addComment: async (_p, { postId, text }, ctx) => {
    const user = requireUser(ctx);
    const comment = await Comment.create({ postId, text, authorId: user.id });
    await pubsub.publish("COMMENT_ADDED", { commentAdded: comment }); // save first, then publish
    return comment;
  },
},
Subscription: {
  commentAdded: {
    subscribe: withFilter(
      () => pubsub.asyncIterableIterator("COMMENT_ADDED"),          // asyncIterator() in older versions
      (payload, vars) => String(payload.commentAdded.postId) === vars.postId, // only this post
    ),
  },
},
```

### Scaling subscriptions

`PubSub` from `graphql-subscriptions` lives **in memory**. With 3 server instances behind a load balancer, a comment saved on server A never reaches clients connected to server B.

Fix: use a shared broker, like `graphql-redis-subscriptions` (Redis Pub/Sub), Kafka, or a managed service. Also set the load balancer's idle timeout higher than the `graphql-ws` keep-alive interval.

### Subscriptions vs alternatives

| Need | Use |
|---|---|
| Chat, live collaboration, live cursors | Subscriptions (WebSocket) |
| Notification badge, order status | Subscriptions, SSE, or polling |
| "Refresh every 30 s is fine" | `pollInterval` on the query, much simpler |
| AI token streaming / large lists | `@defer` / `@stream` (incremental delivery) or SSE |

---

## 4️⃣ Security

One GraphQL endpoint accepts **any** query the schema allows. So a client can write a very expensive one on purpose.

### Attacks and defences

| Attack | Example | Defence |
|---|---|---|
| **Deep nesting** | `user { posts { author { posts { author { ... } } } } }` 20 levels | **Depth limit** (e.g. `graphql-depth-limit`, max 7–10) |
| **Wide / costly queries** | `posts(first: 1000) { comments(first: 1000) { ... } }` | **Cost/complexity analysis**: give each field a cost, multiply by list size, reject above a budget |
| **Alias abuse** | `a1: login(...) a2: login(...) ... a1000: login(...)` in one request (brute force past rate limiting) | Limit aliases per operation; rate-limit **per operation or field**, not per HTTP request |
| **Batching abuse** | An array of 500 operations in one POST | Turn off array batching or cap it |
| **Schema discovery** | Introspection to map every field | Turn off introspection in production; also turn off "Did you mean…?" field suggestions |
| **Injection** | Raw values glued into Mongo or SQL queries | Variables + validation + no `$where`; sanitise (e.g. `express-mongo-sanitize`) |
| **Data exposure** | A resolver returns `passwordHash` because the doc has it | Only fields in the schema are returned, but **never put sensitive fields in the schema**; field-level auth |
| **IDOR** | `post(id: "someone-else's")` | Check ownership in each resolver or service |
| **CSRF** | A form posts a mutation with cookies | Apollo's CSRF prevention, `SameSite` cookies, `Content-Type: application/json` |
| **Large payloads** | A 50 MB query string | Body size limit (`express.json({ limit })`), max tokens per query |

```js
import depthLimit from "graphql-depth-limit";
import { createComplexityLimitRule } from "graphql-validation-complexity";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: false,
  validationRules: [depthLimit(8), createComplexityLimitRule(1000)],
});
```

### Persisted queries: the strongest defence

- **Automatic Persisted Queries (APQ):** the client sends a **SHA-256 hash** first. If the server knows it, the full query text isn't sent. This is a **bandwidth and caching** feature. It does **not** block unknown queries, because any client can register a new one.
- **Trusted documents / safelisting:** at build time, you collect every query your apps use and register them with the server. The server **rejects any query not on the list**. For a private API (your own React and mobile apps), this removes most of the risk of arbitrary queries.

---

## 5️⃣ Caching

HTTP caching is harder with GraphQL: there's one URL, most requests are POST, and every query has a different shape. Caching happens at several layers instead:

| Layer | How |
|---|---|
| **Client** | Apollo Client / urql normalised cache (by `__typename` + `id`), see the next chapter |
| **Per request** | DataLoader de-duplicates within one request |
| **CDN / HTTP** | Send queries as **GET** with APQ hashes (`/graphql?extensions={persistedQuery...}`) so CDNs can cache them; set `Cache-Control` |
| **Response cache** | `@apollo/server-plugin-response-cache` + `@cacheControl(maxAge: 60)` hints; the whole response is cached in Redis |
| **Resolver / data** | Cache expensive lookups in Redis inside services (same as REST) |

```graphql
type Post @cacheControl(maxAge: 60) {
  id: ID!
  title: String!
  viewerHasLiked: Boolean! @cacheControl(scope: PRIVATE)  # per user, never shared
}
```

The response's `maxAge` is the **lowest** of all the fields it contains. One uncached field makes the whole response uncacheable. So keep personalised fields separate from public ones.

---

## 6️⃣ File Uploads

The GraphQL spec has no file type. Choose one of these:

1. **Recommended: pre-signed URLs.** A mutation `createUploadUrl(filename, contentType)` returns an S3 pre-signed URL. The browser uploads **directly to S3**. A second mutation saves the key. Your server never streams the file.
2. **Multipart request spec** (`graphql-upload`) with an `Upload` scalar. It works, but it ties up your server with file streams and has had CSRF issues. Apollo needs the `apollo-require-preflight` header for it.
3. **A plain REST endpoint** for uploads, next to GraphQL.

```graphql
type Mutation {
  createUploadUrl(filename: String!, contentType: String!): UploadTicket!
  attachAvatar(key: String!): User!
}
type UploadTicket { url: String!, key: String! }
```

---

## 7️⃣ Federation & Microservices

When many teams own different parts of the data, one big schema becomes a bottleneck. **Apollo Federation** lets each service own a **subgraph**. A **router** (Apollo Router, written in Rust; or Cosmo, Hive Gateway) combines them into one **supergraph**.

```graphql
# users-subgraph
type User @key(fields: "id") {
  id: ID!
  name: String!
}
```

```graphql
# posts-subgraph: adds a "posts" field to a type it doesn't own
type User @key(fields: "id") {
  id: ID!
  posts: [Post!]!
}

type Post @key(fields: "id") {
  id: ID!
  title: String!
  author: User!
}
```

```js
// posts subgraph: resolve a User reference sent by the router
User: {
  __resolveReference: ({ id }) => ({ id }),        // only the key is needed here
  posts: ({ id }) => Post.find({ authorId: id }),
},
```

| Approach | Description |
|---|---|
| **Monolithic schema** | One server, one schema. Fine for most MERN apps. |
| **Schema stitching** | A gateway merges remote schemas by hand (older, `@graphql-tools/stitch`) |
| **Federation** | Each subgraph declares entities with `@key`; the router plans queries across services |
| **GraphQL BFF over REST** | One GraphQL server whose resolvers call existing REST microservices |

---

## 8️⃣ Monitoring & Performance

- **Trace per field:** Apollo Studio / GraphOS, or OpenTelemetry (`@opentelemetry/instrumentation-graphql`). A slow request is usually **one slow resolver** or an N+1.
- Log the **operation name**, never only "POST /graphql". Make clients name every operation.
- **Track field usage** before removing deprecated fields.
- Return `totalCount` lazily (as a function) so it only runs when someone asks for it.
- `@defer` lets the server send the fast part of the response first and the slow fragment later.

## 🌍 Real-World Use

- **Shopify** gives every query a cost and enforces a per-app cost budget that slowly refills ("leaky bucket").
- **GitHub** uses node limits and point-based rate limits for its GraphQL API.
- **Netflix** and **Expedia** run federated supergraphs over many subgraphs.
- A typical MERN product: DataLoader for every relation, Relay-style cursors for feeds, Redis PubSub for chat, persisted queries from the React app, and REST for uploads and webhooks.

## 🎯 Likely Interview Questions

1. **What is the N+1 problem in GraphQL and how do you solve it?**
2. **How does DataLoader batch requests?** — Collects `.load()` calls in one tick, calls the batch function once, then resolves each promise.
3. **Why must DataLoaders be created per request?** What breaks if you share one globally?
4. **Why must the batch function keep the order of the keys?**
5. **Offset vs cursor pagination: which would you use for an infinite feed?** Explain the Relay connection spec.
6. **How do subscriptions work? Which transport and library?**
7. **How do you authenticate a WebSocket subscription?** — `connectionParams` in `graphql-ws`, checked in `onConnect`/`context`.
8. **How do you scale subscriptions across multiple Node servers?**
9. **How do you protect a GraphQL API from expensive or malicious queries?** — Depth limit, cost analysis, timeouts, alias/batch limits, persisted queries, rate limiting.
10. **APQ vs trusted documents: what's the difference?**
11. **How is caching different in GraphQL vs REST?**
12. **How do you upload files with GraphQL?**
13. **What is Apollo Federation, and what is an entity / `@key`?**
14. **A GraphQL query takes 4 seconds. How do you debug it?** — Per-field tracing, find the slow resolver, check for N+1, check indexes, add DataLoader or caching.

---

[← Building a GraphQL Server in Node.js](02-graphql-server-node.md) | [Index](../README.md) | [Next: GraphQL in React with Apollo Client →](04-graphql-react-client.md)
