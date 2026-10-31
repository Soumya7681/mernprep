# Chapter 140 — GraphQL Scenarios

## 📖 Definition

GraphQL scenario questions describe a production problem with a GraphQL API (a slow query, a crashing server, a stale UI, a security hole, a schema change that broke mobile apps) and ask how you'd handle it. Answer with **clarify → hypothesise → verify → fix → prevent**, and name the tools: per-field tracing, DataLoader, cost limits, the Apollo cache, schema checks.

---

### Scenario 1 — "The feed query takes 3 seconds, but each resolver looks fast."

**Clarify:** is it every request or only big pages? Did it start after a schema or client change?

**Hypothesis:** **N+1**. Each `Post.author` and `Post.commentCount` resolver makes its own database call: 50 posts × 2 fields = 100+ queries, each one fast on its own.

**Verify**
- Per-field tracing (Apollo GraphOS / OpenTelemetry `graphql` instrumentation) shows hundreds of short resolver spans.
- MongoDB profiler or Postgres logs show the same `findById` pattern repeated with different IDs.

**Fix**
- **DataLoader** for each relation (`userById`, `commentCountByPostId` using one `$group` / `GROUP BY`), created **per request** in the context.
- Cap list sizes (`first ≤ 50`); make `totalCount` lazy.
- Add indexes on the foreign keys the loaders query (`comments.postId`).

**Prevent:** a test that counts DB calls for the feed query; an alert on resolver count per operation.

---

### Scenario 2 — "A single request pegged the CPU and took the GraphQL server down."

**Cause:** an expensive query: deep nesting (`user { posts { author { posts { … } } } }`), huge lists (`posts(first: 10000)`), or **alias abuse** (the same expensive field 1,000 times under different aliases).

**Verify:** find the operation in the logs (by operation name or hash) at the time of the spike; reproduce it in staging.

**Fix (now):** block that operation or client; deploy a **depth limit** and a **max `first`** on every list; add a request timeout.

**Fix (lasting):**
- **Query cost analysis** with a per-request budget, and a per-client budget over time (like Shopify's leaky bucket).
- Limit aliases and batched operations per request.
- **Trusted documents / safelisting** for first-party apps, so unknown queries are rejected.
- Turn off introspection and field suggestions in production for private APIs.

---

### Scenario 3 — "After a user creates a post, it doesn't show in the list until refresh."

**Cause:** Apollo's normalised cache **updates existing objects automatically, but not lists**. It doesn't know the new `Post:123` belongs in the `Feed` query's list.

**Verify:** Apollo DevTools → the cache contains `Post:123`, but `ROOT_QUERY.posts(...)` doesn't reference it.

**Fix (pick one):**
- `refetchQueries: ["Feed"]` (simplest, costs one more request).
- An `update` function with `cache.modify` to add the reference to the list.
- For deletes: `cache.evict({ id: cache.identify(post) })` + `cache.gc()`.
- For multi-user screens: a subscription that pushes new posts.

**Prevent:** a component test with `MockedProvider` that checks the list after the mutation.

---

### Scenario 4 — "Pagination shows duplicates and the 'Load more' button replaces the list instead of appending."

**Causes**
1. **Offset pagination** on a feed where new posts keep arriving: page 2 shifts, so items repeat.
2. No **merge function** for the `posts` field in `typePolicies`, so each `fetchMore` page **replaces** the previous one.
3. Wrong `keyArgs`, so lists with different filters share one cache entry.

**Fix:** switch to **cursor pagination** (Relay connection, cursor = `createdAt + id`), and use `relayStylePagination(["status"])` (or a custom `merge` with the right `keyArgs`). Sort by a **unique** key (`createdAt DESC, id DESC`) so ties don't reorder.

---

### Scenario 5 — "The mobile app crashed for thousands of users after a backend deploy."

**Cause:** a **breaking schema change**: a field was removed or renamed, a nullable field became non-null (or the reverse in an input), or an enum value was removed. Old app versions can't be force-updated.

**Fix (now):** restore the old field (as an alias that resolves the new data), and redeploy.

**Prevent**
- **Never remove fields directly:** add the new field, mark the old one `@deprecated(reason: "...")`, watch **field usage** by client version, and only remove it when usage is ~0.
- **Schema checks in CI** (`graphql-inspector`, `rover graph check`) that fail the build on breaking changes compared with the deployed schema and real traffic.
- Add new enum values carefully. Old clients may crash on values they don't know, so ask the client teams to handle unknown values.

---

### Scenario 6 — "One user can read another user's private orders through GraphQL."

**Cause:** authorisation was only checked on the **REST route** or the **top-level** query. GraphQL lets users reach the same data through **another path**: `user(id: 2) { orders { … } }`, `order(id: …)`, `search { ... on Order }`, or a nested `post.author.orders`.

**Fix**
- Put authorisation in the **business layer** (`orderService.listForUser(viewer, userId)`) that every resolver uses, or in the field resolver (`User.orders` checks `viewer.id === user.id || admin`).
- A schema directive (`@auth(requires: OWNER)`) or `graphql-shield` for rules in one place.
- Make sensitive fields nullable, so hiding them doesn't break the response.

**Prevent:** tests that query every path to the sensitive type as another user; introspection off; tracking field usage.

---

### Scenario 7 — "GraphQL error rates look fine in monitoring, but users report broken pages."

**Cause:** GraphQL usually returns **HTTP 200** with an `errors` array. HTTP-level monitoring (load balancer 5xx rates) sees no errors at all.

**Fix**
- Log and measure **by operation name** and by `errors[].extensions.code` (a plugin's `didEncounterErrors` hook), not by HTTP status.
- Dashboards per operation: error rate, p95 latency, partial-data rate.
- Require clients to **name every operation**, so `query { ... }` without a name doesn't show up as "anonymous".

---

### Scenario 8 — "Subscriptions work locally but users miss real-time updates in production."

**Causes**
1. **Several server instances** with the in-memory `PubSub`: an event published on server A never reaches clients on server B.
2. The **load balancer or proxy** drops idle WebSockets (idle timeout shorter than the keep-alive interval), or isn't configured for `Upgrade`.
3. Clients that reconnect **miss events** sent while they were disconnected.

**Fix:** a shared broker (`graphql-redis-subscriptions`, Kafka); a load balancer idle timeout above the `graphql-ws` keep-alive; after reconnecting, the client **refetches** the current state (subscriptions aren't a durable queue). Make sure you're using `graphql-ws`, not the deprecated `subscriptions-transport-ws`.

---

### Scenario 9 — "We want to move our REST MERN app to GraphQL. How would you do it without a big-bang rewrite?"

**Plan**
1. Add Apollo Server at `/graphql` **next to** the REST routes in the same Express app.
2. Move logic from route handlers into **services**, so REST and resolvers share validation and authorisation.
3. Start with **read-heavy screens** that need data from several endpoints. Add DataLoaders from day one.
4. Add **codegen** for typed React hooks, and move screens over one by one with Apollo Client.
5. Move mutations over next. Keep REST for **uploads, webhooks, health checks and third parties**.
6. Turn off each REST endpoint once nothing calls it (watch the access logs).

**Watch out for:** N+1, auth checks that lived only in Express middleware, HTTP caching you relied on (CDN caches GETs), and error-handling differences (200 + `errors`).

---

### Scenario 10 — "Our GraphQL gateway in front of 6 microservices is slow and every team blocks each other."

**Diagnosis:** one big monolithic schema in the gateway, with resolvers making many **sequential** HTTP calls to services, and every schema change needing the gateway team.

**Fix**
- Move to **Apollo Federation** (or another composition tool): each team owns a **subgraph** with `@key` entities, and a **router** (Apollo Router, Cosmo, Hive Gateway) plans queries and runs subgraph calls **in parallel** where it can.
- DataLoaders inside each subgraph's `__resolveReference`.
- Schema composition checks in each team's CI, so teams can ship on their own.

**Don't** suggest federation for a single small MERN app; it's an organisational tool as much as a technical one.

---

## 🎯 What Interviewers Are Scoring

- You know GraphQL's specific failure modes: **N+1, expensive queries, 200-with-errors, breaking schema changes, list cache updates, authorisation on every path**.
- You **measure** by operation and by field (tracing, operation names, field usage), not by HTTP status.
- Your fixes include **prevention**: DataLoader tests, cost limits, safelists, schema checks in CI.

---

[← MongoDB Scenarios](04-mongodb-scenarios.md) | [Index](../README.md) | [Next: SQL Scenarios →](08-sql-scenarios.md)
