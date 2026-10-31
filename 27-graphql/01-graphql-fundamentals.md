# Chapter 87 — GraphQL Fundamentals & Schema Design

## 📖 Definition

**GraphQL** is a **query language for APIs** and a **runtime** that answers those queries using a **typed schema**. The client sends one request that describes exactly the data it needs. The server returns JSON in exactly that shape.

Facebook built it in 2012 for its mobile apps and open-sourced it in 2015. It is now run by the GraphQL Foundation.

Three ideas sum it up:

1. **One endpoint**, usually `POST /graphql`, instead of many REST URLs.
2. **The client chooses the fields.** No over-fetching and no under-fetching.
3. **A strongly typed schema** is the contract between frontend and backend. Every query is checked against it before it runs.

## 🔍 Explanation

### The problem GraphQL solves

A profile screen needs a user's name, their last 3 posts, and the comment count for each post. With REST, that is usually:

```
GET /api/users/42            → returns 30 fields, you need 2   (over-fetching)
GET /api/users/42/posts      → returns all posts, you need 3
GET /api/posts/1/comments    → one call per post               (under-fetching, N extra calls)
```

With GraphQL it is **one request**, and the response has exactly these fields:

```graphql
query ProfileScreen {
  user(id: "42") {
    name
    posts(last: 3) {
      title
      commentCount
    }
  }
}
```

```json
{
  "data": {
    "user": {
      "name": "Asha",
      "posts": [
        { "title": "GraphQL in MERN", "commentCount": 4 },
        { "title": "Indexes 101", "commentCount": 11 },
        { "title": "JWT vs sessions", "commentCount": 2 }
      ]
    }
  }
}
```

### GraphQL vs REST

| | REST | GraphQL |
|---|---|---|
| Endpoints | Many (`/users`, `/posts/:id`) | One (`/graphql`) |
| Who decides the response shape | Server | Client |
| Over/under-fetching | Common | Avoided by design |
| Typing / contract | Optional (OpenAPI) | Built in (schema) |
| Versioning | `/v1`, `/v2` | Evolve the schema; deprecate fields |
| HTTP caching | Easy (GET + URL + ETag) | Harder (mostly POST); needs client cache or persisted queries |
| Errors | HTTP status codes | Usually `200` with an `errors` array |
| File upload | Native multipart | Not in the spec; use a signed URL or a multipart extension |
| Real-time | WebSockets/SSE added separately | `Subscription` type in the spec |
| Tooling | Postman, Swagger | Introspection, GraphiQL, Apollo Sandbox, codegen |

**Neither is "better".** GraphQL shines when many clients (web, iOS, Android) need different shapes of related data. REST is simpler for public APIs, file-heavy services, and anything that relies on HTTP caching or CDNs.

### The three operation types

| Operation | Purpose | REST equivalent |
|---|---|---|
| `query` | Read data | `GET` |
| `mutation` | Write data | `POST` / `PUT` / `PATCH` / `DELETE` |
| `subscription` | Server pushes events over a long-lived connection | WebSocket / SSE |

Top-level fields of a **query** may run **in parallel**. Top-level fields of a **mutation** run **one after another**, in order. This is in the spec.

## 💻 Schema Definition Language (SDL)

The schema is written in SDL. This is a small blog schema used through the rest of this section:

```graphql
"""A registered user."""
type User {
  id: ID!
  name: String!
  email: String!          # protected in resolvers; only the owner can read it
  role: Role!
  posts(first: Int = 10, after: String): PostConnection!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
  tags: [String!]!
  comments: [Comment!]!
  commentCount: Int!
  status: PostStatus!
  legacySlug: String @deprecated(reason: "Use id")
}

type Comment {
  id: ID!
  text: String!
  author: User!
}

enum Role { USER ADMIN }
enum PostStatus { DRAFT PUBLISHED }

scalar DateTime            # custom scalar, explained below

input CreatePostInput {
  title: String!
  body: String!
  tags: [String!] = []
}

type Query {
  me: User
  user(id: ID!): User
  posts(status: PostStatus, first: Int = 10, after: String): PostConnection!
  search(term: String!): [SearchResult!]!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  deletePost(id: ID!): Boolean!
}

type Subscription {
  commentAdded(postId: ID!): Comment!
}
```

### The type system

| Kind | Example | Notes |
|---|---|---|
| **Scalar** | `Int`, `Float`, `String`, `Boolean`, `ID` | Leaves of the tree. `ID` is serialised as a string. |
| **Custom scalar** | `scalar DateTime` | You write `serialize`, `parseValue`, `parseLiteral`. |
| **Object type** | `type User { ... }` | Has fields; each field can take arguments. |
| **Enum** | `enum Role { USER ADMIN }` | A fixed set of values, validated for you. |
| **Input type** | `input CreatePostInput` | The only object type allowed as an argument. It cannot have resolvers or arguments on its fields. |
| **Interface** | `interface Node { id: ID! }` | Shared fields; types `implements Node`. |
| **Union** | `union SearchResult = User \| Post` | One of several types with no shared fields required. |
| **List** | `[Post]` | |
| **Non-null** | `String!` | The server promises never to return null here. |

### Nullability, carefully

The `!` placement matters and interviewers love to ask about it:

| Type | List can be null? | Items can be null? |
|---|---|---|
| `[Post]` | Yes | Yes |
| `[Post]!` | No | Yes |
| `[Post!]` | Yes | No |
| `[Post!]!` | No | No |

**Null bubbling:** if a resolver for a non-null field returns `null` or throws, GraphQL sets the **nearest nullable parent** to `null` and adds an error. A single failing `String!` deep in the tree can wipe out a whole branch. So make fields non-null only when you can really guarantee them. Fields that call other services are often left nullable on purpose, so one failure doesn't break the whole page.

### Interfaces and unions

```graphql
interface Node { id: ID! }
type User implements Node { id: ID! name: String! }
type Post implements Node { id: ID! title: String! }

union SearchResult = User | Post
```

The client uses **inline fragments** to pick fields per concrete type:

```graphql
query Search {
  search(term: "graphql") {
    __typename
    ... on User { name }
    ... on Post { title }
  }
}
```

The server needs a `__resolveType` function to tell GraphQL which concrete type each object is (shown in the next chapter).

## 💻 Writing Operations

### Arguments, variables and operation names

Never build query strings by joining strings together. Use **variables**. They are typed, validated, and safe from injection.

```graphql
query GetPost($id: ID!, $withComments: Boolean = false) {
  post(id: $id) {
    title
    comments @include(if: $withComments) {
      text
    }
  }
}
```

```json
{ "id": "65f1c...", "withComments": true }
```

The HTTP request body looks like this:

```json
{
  "operationName": "GetPost",
  "query": "query GetPost($id: ID!, ...) { ... }",
  "variables": { "id": "65f1c...", "withComments": true }
}
```

### Aliases: the same field twice

```graphql
query Compare {
  drafts: posts(status: DRAFT) { totalCount }
  published: posts(status: PUBLISHED) { totalCount }
}
```

### Fragments: reusable field sets

```graphql
fragment PostCard on Post {
  id
  title
  author { name }
}

query Feed {
  posts(first: 10) {
    edges { node { ...PostCard } }
  }
}
```

In React, each component often declares the fragment for the data it needs. This is called **fragment colocation**.

### Directives

| Directive | Where | Meaning |
|---|---|---|
| `@include(if: Boolean)` | Query | Include the field only when true |
| `@skip(if: Boolean)` | Query | Skip the field when true |
| `@deprecated(reason: String)` | Schema | Marks a field as deprecated; shown in tooling |
| `@specifiedBy(url: String)` | Schema | Links a custom scalar to its spec |
| Custom (`@auth`, `@cacheControl`) | Schema | Your own logic, via schema transforms |

### Mutations

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    author { name }
  }
}
```

Good mutation design:
- **One input object** per mutation (`input: CreatePostInput!`). It is easy to add fields later without breaking clients.
- **Return the changed object**, so the client cache can update itself.
- Name mutations as **verb + noun**: `createPost`, `publishPost`, `addComment`.
- For expected failures (like "email already taken"), many teams return a **result union** instead of throwing:

```graphql
union CreateUserResult = User | EmailTakenError | ValidationError

type EmailTakenError { message: String! email: String! }
```

## 🔍 How a Request Is Executed

```
 Request ──► 1. Parse ──► 2. Validate ──► 3. Execute ──► Response
             string→AST    against schema   call resolvers   { data, errors }
```

1. **Parse:** the query string becomes an AST (abstract syntax tree). Syntax errors stop here.
2. **Validate:** fields exist, arguments have the right types, variables match, fragments are used. Invalid queries never reach your code.
3. **Execute:** GraphQL walks the tree. For each field it calls that field's **resolver**, passing the parent's result down. Results are put together in the same shape as the query.

### The response format

```json
{
  "data": { "post": { "title": "Hi", "author": null } },
  "errors": [
    {
      "message": "Author service timed out",
      "path": ["post", "author"],
      "locations": [{ "line": 4, "column": 5 }],
      "extensions": { "code": "SERVICE_UNAVAILABLE" }
    }
  ]
}
```

- **Partial success** is normal: `data` and `errors` can both be there.
- `path` tells the client exactly which field failed.
- `extensions.code` is how clients branch on error type (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`).

## 🔍 Introspection

Every GraphQL server can describe itself through special fields like `__schema` and `__type`:

```graphql
{ __type(name: "Post") { fields { name type { name kind } } } }
```

GraphiQL, Apollo Sandbox, IDE autocomplete and code generators all use introspection. In production, many teams **turn it off** for private APIs, so attackers can't easily map the whole schema.

## 🔍 Schema-First vs Code-First

| | Schema-first | Code-first |
|---|---|---|
| You write | SDL (`.graphql` files), then resolvers | Code (classes or builders); SDL is generated |
| Tools | Apollo Server + `graphql-tools`, GraphQL Yoga | NestJS `@ObjectType`, TypeGraphQL, Pothos, Nexus |
| Pros | Schema is easy to read and review; frontend can start from it | One source of truth with TypeScript types; no drift |
| Cons | Resolvers and SDL can drift apart (fix: codegen) | Schema is hidden in code; harder for non-backend people to review |

## 🌍 Real-World Use

- **GitHub API v4**, **Shopify Storefront API**, **Netflix**, **Airbnb**, **PayPal** and **Meta** all use GraphQL.
- **Backend-for-frontend (BFF):** a GraphQL layer sits in front of many REST microservices and gives each app one tidy schema.
- **Headless CMS** tools (Contentful, Hygraph, Strapi) expose GraphQL so frontends can ask for exactly the content they render.
- **Gatsby** used GraphQL at build time to query Markdown and CMS data.

## 🎯 Likely Interview Questions

1. **What is GraphQL and what problem does it solve compared to REST?** — Over-fetching, under-fetching and many round trips; one typed endpoint where the client picks fields.
2. **What are queries, mutations and subscriptions?** Why do mutation fields run in order?
3. **Explain `[String!]!` vs `[String]!` vs `[String!]`.**
4. **What is null bubbling?** How does it affect your choice of nullable fields?
5. **What is the difference between `type` and `input`?** Why can't you pass a `type` as an argument?
6. **Interface vs union?**
7. **What are fragments and aliases used for?**
8. **Why use variables instead of putting values in the query string?** — Validation, safety, and query caching / persisted queries.
9. **How do you version a GraphQL API?** — You usually don't: add fields, `@deprecated` old ones, watch field usage, then remove.
10. **What does a GraphQL error response look like, and why is it often HTTP 200?**
11. **What is introspection, and should it be on in production?**
12. **Schema-first or code-first: which would you pick and why?**
13. **When would you NOT choose GraphQL?** — Simple CRUD, public cache-heavy APIs, file streaming, small teams with one client.

---

[← MongoDB Rapid-Fire Q&A](../05-mongodb/13-mongodb-interview-questions.md) | [Index](../README.md) | [Next: Building a GraphQL Server in Node.js →](02-graphql-server-node.md)
