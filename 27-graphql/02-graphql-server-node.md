# Chapter 88 — Building a GraphQL Server in Node.js

## 📖 Definition

A GraphQL server is two things joined together:

- **Type definitions** (`typeDefs`): the schema, in SDL.
- **Resolvers**: plain functions that return the data for each field.

**Apollo Server** is the most common Node.js GraphQL server. Other popular options are **GraphQL Yoga** (from The Guild), **Mercurius** (for Fastify) and **NestJS `@nestjs/graphql`** (which uses Apollo or Mercurius underneath).

This chapter builds the blog API from the previous chapter with **Express + Apollo Server + Mongoose + JWT**.

## 🔍 Explanation: Resolvers

Every field in the schema can have a resolver. A resolver gets **four arguments**:

```js
fieldName: (parent, args, context, info) => result
```

| Argument | What it holds | Example use |
|---|---|---|
| `parent` (also called `root` or `obj`) | The result of the parent field's resolver | In `Post.author`, `parent` is the post document |
| `args` | Arguments passed to this field | `{ id: "42" }` for `user(id: "42")` |
| `context` | An object shared by **every** resolver in **one** request | Logged-in user, DataLoaders, models |
| `info` | The AST, field name, path, and return type | Advanced: field selection, cache hints |

A resolver can return a **value**, a **Promise**, or an **array** of either. GraphQL waits for promises for you.

### Default resolvers

If a field has no resolver, GraphQL uses the **default resolver**: it returns `parent[fieldName]` (and calls it if it's a function). That's why you don't write resolvers for `Post.title`. The Mongoose document already has a `title` property.

**You only write resolvers for:**
- root fields (`Query`, `Mutation`, `Subscription`)
- fields that need another lookup (`Post.author`)
- computed or renamed fields (`User.id` from `_id`, `Post.commentCount`)

### The resolver chain

```
query { post(id: "1") { title author { name } } }

Query.post(null, { id: "1" })      → returns post document  { _id, title, authorId }
  Post.title(post)                 → default: post.title
  Post.author(post)                → User.findById(post.authorId)
    User.name(user)                → default: user.name
```

Each level only knows its own parent. This keeps resolvers small. It's also the cause of the **N+1 problem** (covered in the next chapter).

## 💻 Code Example: Project Setup

```bash
npm i @apollo/server @as-integrations/express5 graphql express cors mongoose jsonwebtoken
npm i graphql-scalars dataloader          # used later
```

> **Version note:** In Apollo Server 4, `expressMiddleware` was imported from `@apollo/server/express4`. In **Apollo Server 5** it moved to a separate package: `@as-integrations/express5` (or `@as-integrations/express4` for Express 4). The API is the same.

```
src/
  index.js            # Express + Apollo wiring
  schema/
    typeDefs.js
    resolvers/
      index.js
      user.js
      post.js
  models/User.js, Post.js, Comment.js
  auth.js
  loaders.js
```

## 💻 Code Example: Mongoose Models

```js
// models/Post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    tags: [String],
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

export const Post = mongoose.model("Post", postSchema);
```

## 💻 Code Example: Type Definitions

```js
// schema/typeDefs.js
export const typeDefs = `#graphql
  scalar DateTime

  enum Role { USER ADMIN }
  enum PostStatus { DRAFT PUBLISHED }

  type User {
    id: ID!
    name: String!
    email: String
    role: Role!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    tags: [String!]!
    status: PostStatus!
    author: User!
    commentCount: Int!
    createdAt: DateTime!
  }

  union SearchResult = User | Post

  input CreatePostInput {
    title: String!
    body: String!
    tags: [String!] = []
  }

  input UpdatePostInput {
    title: String
    body: String
    tags: [String!]
    status: PostStatus
  }

  type AuthPayload { token: String!, user: User! }

  type Query {
    me: User
    post(id: ID!): Post
    posts(status: PostStatus, limit: Int = 10, offset: Int = 0): [Post!]!
    search(term: String!): [SearchResult!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, input: UpdatePostInput!): Post!
    deletePost(id: ID!): Boolean!
  }
`;
```

The `#graphql` comment at the start only tells editors to highlight the string as GraphQL.

## 💻 Code Example: Resolvers

```js
// schema/resolvers/post.js
import { GraphQLError } from "graphql";
import { Post } from "../../models/Post.js";
import { Comment } from "../../models/Comment.js";
import { requireUser } from "../../auth.js";

export const postResolvers = {
  Query: {
    post: (_parent, { id }) => Post.findById(id),

    posts: (_parent, { status, limit, offset }) => {
      const filter = status ? { status } : {};
      return Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 50)); // cap page size: never trust the client
    },
  },

  Mutation: {
    createPost: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      return Post.create({ ...input, authorId: user.id });
    },

    updatePost: async (_parent, { id, input }, ctx) => {
      const user = requireUser(ctx);
      const post = await Post.findById(id);
      if (!post) {
        throw new GraphQLError("Post not found", { extensions: { code: "NOT_FOUND" } });
      }
      if (String(post.authorId) !== user.id && user.role !== "ADMIN") {
        throw new GraphQLError("Not your post", { extensions: { code: "FORBIDDEN" } });
      }
      Object.assign(post, input);
      return post.save();
    },

    deletePost: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const res = await Post.deleteOne({ _id: id, authorId: user.id });
      return res.deletedCount === 1;
    },
  },

  // Field resolvers: run once per Post object in the result
  Post: {
    id: (post) => post._id.toString(),
    author: (post, _args, ctx) => ctx.loaders.userById.load(String(post.authorId)), // batched (next chapter)
    commentCount: (post) => Comment.countDocuments({ postId: post._id }),
  },
};
```

```js
// schema/resolvers/user.js
export const userResolvers = {
  Query: {
    me: (_p, _a, ctx) => (ctx.user ? User.findById(ctx.user.id) : null),
  },
  User: {
    id: (u) => u._id.toString(),
    // field-level authorisation: only the owner or an admin sees email
    email: (u, _a, ctx) =>
      ctx.user && (ctx.user.id === String(u._id) || ctx.user.role === "ADMIN") ? u.email : null,
    posts: (u) => Post.find({ authorId: u._id }),
  },
};
```

```js
// schema/resolvers/index.js
import { DateTimeResolver } from "graphql-scalars";
import { postResolvers } from "./post.js";
import { userResolvers } from "./user.js";
import { searchResolvers } from "./search.js";

// Merge resolver maps by type name
export const resolvers = {
  DateTime: DateTimeResolver,
  Query: { ...userResolvers.Query, ...postResolvers.Query, ...searchResolvers.Query },
  Mutation: { ...postResolvers.Mutation, ...userResolvers.Mutation },
  User: userResolvers.User,
  Post: postResolvers.Post,
  SearchResult: searchResolvers.SearchResult,
};
```

For larger projects, `@graphql-tools/merge` (`mergeTypeDefs`, `mergeResolvers`) does this merging for you.

### Resolving a union

```js
// schema/resolvers/search.js
export const searchResolvers = {
  Query: {
    search: async (_p, { term }) => {
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); // escape user input
      const [users, posts] = await Promise.all([
        User.find({ name: rx }).limit(5),
        Post.find({ title: rx }).limit(5),
      ]);
      return [...users, ...posts];
    },
  },
  SearchResult: {
    // Tell GraphQL which concrete type each item is
    __resolveType: (obj) => (obj.title !== undefined ? "Post" : "User"),
  },
};
```

## 💻 Code Example: Custom Scalar (Hand-Written)

`graphql-scalars` gives you `DateTime`, `EmailAddress`, `URL`, `JSON` and more. Knowing how to write one yourself is a common interview question:

```js
import { GraphQLScalarType, Kind, GraphQLError } from "graphql";

export const DateTime = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 date-time string",
  serialize(value) {             // server → client (outgoing)
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  },
  parseValue(value) {            // client variables → server (incoming JSON)
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new GraphQLError("Invalid DateTime");
    return d;
  },
  parseLiteral(ast) {            // value written inline in the query text
    if (ast.kind !== Kind.STRING) throw new GraphQLError("DateTime must be a string");
    return new Date(ast.value);
  },
});
```

## 💻 Code Example: Authentication via Context

The **context function runs once per request**. It's the right place to read the JWT and create per-request DataLoaders.

```js
// auth.js
import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";

export function getUserFromToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const { sub, role } = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return { id: sub, role };
  } catch {
    return null; // invalid or expired token → treat as anonymous
  }
}

export function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError("You must be logged in", {
      extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
    });
  }
  return ctx.user;
}

export function requireRole(ctx, role) {
  const user = requireUser(ctx);
  if (user.role !== role) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN", http: { status: 403 } } });
  }
  return user;
}
```

**Authenticate in context, authorise in resolvers** (or in a business-logic layer the resolvers call). Don't reject anonymous requests in the context function, because some queries, like a public feed or `login`, must work without a token.

## 💻 Code Example: Wiring Express + Apollo Server

```js
// index.js
import express from "express";
import cors from "cors";
import http from "node:http";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers/index.js";
import { getUserFromToken } from "./auth.js";
import { createLoaders } from "./loaders.js";

const app = express();
const httpServer = http.createServer(app);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== "production",
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })], // graceful shutdown
  formatError: (formatted, original) => {
    // Never leak stack traces or DB errors to clients in production
    if (process.env.NODE_ENV === "production" && formatted.extensions?.code === "INTERNAL_SERVER_ERROR") {
      console.error(original);
      return { message: "Internal server error", extensions: { code: "INTERNAL_SERVER_ERROR" } };
    }
    return formatted;
  },
});

await mongoose.connect(process.env.MONGO_URL);
await server.start(); // must be awaited before adding the middleware

// REST routes can live next to GraphQL
app.get("/health", (_req, res) => res.send("ok"));

app.use(
  "/graphql",
  cors({ origin: ["https://app.example.com"], credentials: true }),
  express.json({ limit: "100kb" }),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: getUserFromToken(req.headers.authorization),
      loaders: createLoaders(),      // new loaders for every request
    }),
  }),
);

await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
console.log("GraphQL ready at http://localhost:4000/graphql");
```

For a quick prototype, `startStandaloneServer(server, { context })` from `@apollo/server/standalone` skips Express completely.

### Calling it without any client library

```js
const res = await fetch("http://localhost:4000/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    query: `query ($id: ID!) { post(id: $id) { title author { name } } }`,
    variables: { id: "65f1c..." },
  }),
});
const { data, errors } = await res.json();
```

```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ posts(limit: 2) { id title } }"}'
```

> Apollo Server has **CSRF prevention** turned on by default. A request must have `Content-Type: application/json` or an `apollo-require-preflight` header, so a plain HTML form on another site can't trigger a mutation.

## 💻 Code Example: Error Handling

Throw `GraphQLError` with an `extensions.code` so clients can react in a consistent way:

| Code | When |
|---|---|
| `GRAPHQL_PARSE_FAILED` | Query has a syntax error (Apollo sets this) |
| `GRAPHQL_VALIDATION_FAILED` | Unknown field, wrong type (Apollo sets this) |
| `BAD_USER_INPUT` | Arguments are syntactically valid but wrong (e.g. bad email) |
| `UNAUTHENTICATED` | No valid token |
| `FORBIDDEN` | Logged in, but not allowed |
| `NOT_FOUND` | Custom: the entity doesn't exist |
| `INTERNAL_SERVER_ERROR` | Any other thrown error (default) |

Validate input in the resolver, or better, in a service layer with Zod or Joi:

```js
import { z } from "zod";

const CreatePost = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(1),
  tags: z.array(z.string().max(20)).max(5),
});

createPost: async (_p, { input }, ctx) => {
  const user = requireUser(ctx);
  const parsed = CreatePost.safeParse(input);
  if (!parsed.success) {
    throw new GraphQLError("Invalid input", {
      extensions: { code: "BAD_USER_INPUT", issues: parsed.error.flatten().fieldErrors },
    });
  }
  return Post.create({ ...parsed.data, authorId: user.id });
},
```

## 💻 Code Example: The Same API in NestJS (Code-First)

NestJS generates the SDL from decorated TypeScript classes:

```ts
// post.model.ts
import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum PostStatus { DRAFT = "DRAFT", PUBLISHED = "PUBLISHED" }
registerEnumType(PostStatus, { name: "PostStatus" });

@ObjectType()
export class Post {
  @Field(() => ID) id: string;
  @Field() title: string;
  @Field(() => [String]) tags: string[];
  @Field(() => PostStatus) status: PostStatus;
  authorId: string; // no @Field: not exposed in the schema
}
```

```ts
// post.resolver.ts
@Resolver(() => Post)
export class PostResolver {
  constructor(private posts: PostService, private users: UserService) {}

  @Query(() => Post, { nullable: true })
  post(@Args("id", { type: () => ID }) id: string) {
    return this.posts.findById(id);
  }

  @Mutation(() => Post)
  @UseGuards(GqlAuthGuard)
  createPost(@Args("input") input: CreatePostInput, @CurrentUser() user: User) {
    return this.posts.create(input, user.id);
  }

  @ResolveField(() => User)
  author(@Parent() post: Post) {
    return this.users.findById(post.authorId);
  }
}
```

```ts
// app.module.ts
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,      // code-first: generate the schema in memory
  context: ({ req }) => ({ req }),
}),
```

Guards in GraphQL read the request with `GqlExecutionContext.create(context).getContext().req`, not `context.switchToHttp()`.

## 🔍 Testing Resolvers

You don't need HTTP to test a GraphQL server. Use `server.executeOperation`:

```js
import { ApolloServer } from "@apollo/server";

test("posts returns titles", async () => {
  const server = new ApolloServer({ typeDefs, resolvers });
  const res = await server.executeOperation(
    { query: "query { posts(limit: 1) { title } }" },
    { contextValue: { user: null, loaders: createLoaders() } },
  );
  expect(res.body.kind).toBe("single");
  expect(res.body.singleResult.errors).toBeUndefined();
  expect(res.body.singleResult.data.posts).toHaveLength(1);
});
```

Resolvers are plain functions, so you can also unit-test them directly with a fake context.

## 🌍 Real-World Use

- A MERN app keeps **REST for uploads, webhooks and health checks**, and uses **GraphQL for screens** that need nested data.
- Resolvers stay thin: they handle **auth checks and data shaping**, then call **services** that hold the business logic and are shared with REST routes and background jobs.

## 🎯 Likely Interview Questions

1. **What are the four arguments of a resolver?** What goes in `context`?
2. **What is a default resolver?** Why don't you write a resolver for every field?
3. **How do resolvers for nested fields get their data?** — From `parent`, the result of the field above.
4. **Where do you authenticate and where do you authorise in GraphQL?**
5. **How do you do field-level authorisation**, e.g. hide `email` from other users?
6. **How do you return errors with a specific code?** What is `extensions`?
7. **How do you write a custom scalar?** Explain `serialize`, `parseValue` and `parseLiteral`.
8. **How does GraphQL know which type a union member is?** — `__resolveType` (or `isTypeOf`).
9. **Why must the context function create new DataLoaders per request?**
10. **How would you add GraphQL to an existing Express REST app?** — Mount Apollo's middleware at `/graphql`, reuse the existing services and auth.
11. **In NestJS, how do guards work for GraphQL resolvers?**
12. **How do you test a GraphQL server?**

---

[← GraphQL Fundamentals & Schema Design](01-graphql-fundamentals.md) | [Index](../README.md) | [Next: Advanced GraphQL Server Topics →](03-graphql-advanced-server.md)
