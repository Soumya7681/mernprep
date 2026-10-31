# Chapter 90 — GraphQL in React with Apollo Client

## 📖 Definition

**Apollo Client** is a state-management library for GraphQL in React. It sends queries, keeps the results in a **normalised in-memory cache**, and re-renders every component that uses data that changes.

Other common clients:

| Client | Good for |
|---|---|
| **Apollo Client** | Most popular; strong cache, devtools, subscriptions |
| **urql** | Smaller and simpler; document cache by default, normalised cache as an add-on |
| **Relay** | Meta's client; compiler-driven, strict fragment rules, best at very large scale |
| **TanStack Query + `graphql-request`** | You already use TanStack Query and don't need a normalised cache |

> **Version note:** These examples use **Apollo Client 4**. React hooks are imported from `@apollo/client/react`, and you pass a `link` (no `uri` shortcut). In **Apollo Client 3**, everything came from `@apollo/client` and `new ApolloClient({ uri, cache })` also worked. The hooks behave the same.

## 💻 Code Example: Setup With Auth

```bash
npm i @apollo/client graphql rxjs
```

```jsx
// apollo.js
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

const httpLink = new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_URL });

// Add the JWT to every request
const authLink = new SetContextLink((prevContext) => {
  const token = localStorage.getItem("token");
  return {
    headers: { ...prevContext.headers, ...(token && { authorization: `Bearer ${token}` }) },
  };
});

// Handle errors in one place
const errorLink = new ErrorLink(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    if (error.errors.some((e) => e.extensions?.code === "UNAUTHENTICATED")) {
      localStorage.removeItem("token");
      window.location.assign("/login");
    }
  } else {
    console.error("Network error", error);
  }
});

export const client = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]), // links run left → right
  cache: new InMemoryCache(),
});
```

```jsx
// main.jsx
import { ApolloProvider } from "@apollo/client/react";
import { client } from "./apollo";

createRoot(document.getElementById("root")).render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
);
```

## 💻 Code Example: `useQuery`

```jsx
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const GET_POST = gql`
  query GetPost($id: ID!) {
    post(id: $id) {
      id
      title
      body
      author { id name }
    }
  }
`;

function PostPage({ id }) {
  const { data, loading, error, refetch } = useQuery(GET_POST, {
    variables: { id },
    skip: !id,                          // don't run until we have an id
    fetchPolicy: "cache-and-network",   // show cached data at once, then refresh it
  });

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => refetch()} />;
  if (!data?.post) return <NotFound />;

  return (
    <article>
      <h1>{data.post.title}</h1>
      <p>by {data.post.author.name}</p>
      <div>{data.post.body}</div>
    </article>
  );
}
```

### Fetch policies

| Policy | Behaviour | Use for |
|---|---|---|
| `cache-first` (default) | Use the cache if every field is there; otherwise go to the network | Data that rarely changes |
| `cache-and-network` | Return cached data now **and** fetch, then update | Feeds, dashboards |
| `network-only` | Always fetch; save the result in the cache | Must be fresh (balance, cart) |
| `no-cache` | Always fetch; don't save it | One-off, sensitive data |
| `cache-only` | Never fetch | Offline / data you know is already loaded |
| `standby` | Don't run or update automatically | Advanced, manual control |

### Other query hooks

- **`useLazyQuery`:** runs only when you call the function it returns (search on submit).
- **`useSuspenseQuery`:** suspends instead of returning `loading`; use with `<Suspense>` and an error boundary.
- **`pollInterval: 30000`:** refetch on a timer, a simple alternative to subscriptions.

## 💻 Code Example: `useMutation`

```jsx
import { useMutation } from "@apollo/client/react";

const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      author { id name }
    }
  }
`;

function NewPostForm() {
  const [createPost, { loading, error }] = useMutation(CREATE_POST);

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createPost({
      variables: { input: { title: form.get("title"), body: form.get("body") } },
      refetchQueries: ["Feed"],   // simplest way to update lists: refetch by operation name
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="title" required />
      <textarea name="body" required />
      <button disabled={loading}>{loading ? "Saving…" : "Publish"}</button>
      {error && <p role="alert">{error.message}</p>}
    </form>
  );
}
```

## 🔍 The Normalised Cache

`InMemoryCache` breaks every response into **separate objects**, each stored under a key made of **`__typename` + `id`**:

```
ROOT_QUERY
  post({"id":"1"})  → { __ref: "Post:1" }
  posts(...)        → [{ __ref: "Post:1" }, { __ref: "Post:2" }]
Post:1   → { title: "Hi", author: { __ref: "User:7" } }
User:7   → { name: "Asha" }
```

So:

- **Updating an existing object is automatic.** If any mutation returns `{ __typename: "Post", id: "1", title: "New" }`, every component that shows `Post:1` re-renders. This is why **mutations should return the fields they changed, and always include `id`**.
- **Adding to or removing from a list is NOT automatic.** The cache can't know that a new post belongs in the `Feed` list. You need `refetchQueries`, `update`, or `cache.modify`.
- If a type has no `id`, set `keyFields` in `typePolicies` (e.g. `Product: { keyFields: ["sku"] }`). Otherwise it is stored inside its parent.

### Updating a list after a mutation

```jsx
const [createPost] = useMutation(CREATE_POST, {
  update(cache, { data }) {
    cache.modify({
      fields: {
        posts(existing = [], { toReference }) {
          return [toReference(data.createPost), ...existing];
        },
      },
    });
  },
});
```

```jsx
const [deletePost] = useMutation(DELETE_POST, {
  update(cache, _result, { variables }) {
    cache.evict({ id: cache.identify({ __typename: "Post", id: variables.id }) });
    cache.gc();   // remove anything that is no longer referenced
  },
});
```

### Optimistic UI

Show the result **before** the server answers. Apollo shows the guessed result first, then replaces it with the real one (or rolls it back if there's an error):

```jsx
const [toggleLike] = useMutation(TOGGLE_LIKE);

toggleLike({
  variables: { postId: post.id },
  optimisticResponse: {
    toggleLike: {
      __typename: "Post",
      id: post.id,
      viewerHasLiked: !post.viewerHasLiked,
      likeCount: post.likeCount + (post.viewerHasLiked ? -1 : 1),
    },
  },
});
```

## 💻 Code Example: Cursor Pagination With `fetchMore`

```jsx
const FEED = gql`
  query Feed($after: String) {
    posts(first: 10, after: $after) {
      edges { cursor node { id title } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function Feed() {
  const { data, fetchMore, loading } = useQuery(FEED);
  if (!data) return <Spinner />;
  const { edges, pageInfo } = data.posts;

  return (
    <>
      {edges.map(({ node }) => <PostCard key={node.id} post={node} />)}
      {pageInfo.hasNextPage && (
        <button disabled={loading} onClick={() => fetchMore({ variables: { after: pageInfo.endCursor } })}>
          Load more
        </button>
      )}
    </>
  );
}
```

Tell the cache how to **merge** pages. Otherwise each page replaces the last one:

```js
import { relayStylePagination } from "@apollo/client/utilities";

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        posts: relayStylePagination(["status"]), // keyArgs: a different status = a different list
      },
    },
  },
});
```

For offset lists, use `offsetLimitPagination()`, or write your own `merge(existing, incoming)` function.

## 💻 Code Example: Subscriptions on the Client

```js
import { split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

const wsLink = new GraphQLWsLink(
  createClient({
    url: "wss://api.example.com/graphql",
    connectionParams: () => ({ authorization: `Bearer ${localStorage.getItem("token")}` }),
  }),
);

// Subscriptions go over WebSocket; queries and mutations go over HTTP
const link = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === "OperationDefinition" && def.operation === "subscription";
  },
  wsLink,
  ApolloLink.from([errorLink, authLink, httpLink]),
);
```

```jsx
import { useSubscription } from "@apollo/client/react";

const COMMENT_ADDED = gql`
  subscription OnComment($postId: ID!) {
    commentAdded(postId: $postId) { id text author { id name } }
  }
`;

function LiveComments({ postId }) {
  const { data } = useSubscription(COMMENT_ADDED, { variables: { postId } });
  // ...or use subscribeToMore on the comments query to add each new comment to the cached list
}
```

## 💻 Code Example: Fragment Colocation

Each component declares the fields it needs. The parent query spreads those fragments.

```jsx
export const POST_CARD_FIELDS = gql`
  fragment PostCardFields on Post {
    id
    title
    author { id name }
  }
`;

export function PostCard({ post }) {
  return <li>{post.title}, {post.author.name}</li>;
}
```

```jsx
const FEED = gql`
  ${POST_CARD_FIELDS}
  query Feed {
    posts(first: 10) { edges { node { ...PostCardFields } } }
  }
`;
```

If `PostCard` later needs `createdAt`, you only change **one file**. Every query that uses the fragment gets the new field.

## 💻 Code Example: Type-Safe Queries With GraphQL Code Generator

```bash
npm i -D @graphql-codegen/cli @graphql-codegen/client-preset
```

```ts
// codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:4000/graphql",     // or ./schema.graphql
  documents: ["src/**/*.{ts,tsx}"],
  generates: { "./src/gql/": { preset: "client" } },
};
export default config;
```

```tsx
import { graphql } from "./gql";

const GET_POST = graphql(`
  query GetPost($id: ID!) {
    post(id: $id) { id title author { name } }
  }
`);

// data and variables are now fully typed from the schema
const { data } = useQuery(GET_POST, { variables: { id } });
data?.post?.author.name; // string
```

On the server, `@graphql-codegen/typescript-resolvers` generates types for `parent`, `args` and return values, so the SDL and resolvers can't drift apart.

## 🔍 Testing Components

```jsx
import { MockedProvider } from "@apollo/client/testing/react";   // "@apollo/client/testing" in v3
import { render, screen } from "@testing-library/react";

const mocks = [
  {
    request: { query: GET_POST, variables: { id: "1" } },
    result: { data: { post: { __typename: "Post", id: "1", title: "Hello", body: "…",
      author: { __typename: "User", id: "7", name: "Asha" } } } },
  },
];

test("renders the post title", async () => {
  render(
    <MockedProvider mocks={mocks}>
      <PostPage id="1" />
    </MockedProvider>,
  );
  expect(await screen.findByText("Hello")).toBeInTheDocument();
});
```

Mock Service Worker (`msw`) with `graphql.query("GetPost", ...)` is a good alternative that tests the real client and links too.

## 🔍 With Next.js / Server Components

- In **Server Components**, you can `fetch` the GraphQL endpoint directly, or use `@apollo/client-integration-nextjs` (`registerApolloClient`) for a client created per request.
- In **Client Components**, wrap the tree in the integration's `ApolloNextAppProvider`, so data fetched during SSR fills the client cache with no second request.

## 🌍 Real-World Use

- A dashboard uses `cache-and-network` so it opens instantly, then refreshes.
- Like buttons and to-do toggles use `optimisticResponse`.
- An infinite feed uses `relayStylePagination` + `fetchMore`.
- Teams run codegen in CI, so a breaking schema change fails the frontend build instead of production.

## 🎯 Likely Interview Questions

1. **How does Apollo's normalised cache work?** What is the cache key?
2. **Why should a mutation return `id` and the changed fields?**
3. **After creating an item, the list doesn't update. Why, and what are the fixes?** — `refetchQueries`, `update` + `cache.modify`, or `cache.evict`.
4. **Explain the fetch policies.** When would you use `cache-and-network` vs `network-only`?
5. **How do you implement optimistic UI?**
6. **How does pagination work with `fetchMore`? Why do you need a `merge` function / `keyArgs`?**
7. **How do you send the JWT with every request?** — An auth link that sets headers.
8. **How do you route subscriptions over WebSocket and the rest over HTTP?** — `split` link.
9. **What is fragment colocation and why is it useful?**
10. **How do you get TypeScript types for GraphQL queries?**
11. **Apollo Client vs TanStack Query + `graphql-request`: when would you pick each?**
12. **How do you test a component that uses `useQuery`?**

---

[← Advanced GraphQL Server Topics](03-graphql-advanced-server.md) | [Index](../README.md) | [Next: GraphQL Interview Questions →](05-graphql-interview-questions.md)
