# Chapter 41 — Server State & Data Fetching

## 📖 Definition

**Client state** is owned by the browser: form inputs, open modals, selected theme. **Server state** is owned by the backend and only *cached* in the browser: users, products, orders. Server state can become stale, needs refetching, deduplication, pagination and invalidation — so it deserves a dedicated tool such as **TanStack Query** (React Query) or **RTK Query**, rather than `useEffect` + `useState` or a hand-written Redux slice.

## 🔍 Explanation

### Problems with `useEffect` fetching

```jsx
useEffect(() => {
  fetch(`/api/products?page=${page}`).then((r) => r.json()).then(setProducts);
}, [page]);
```

This misses: loading and error state, race conditions (old page arriving after new), caching between screens, deduplication when two components need the same data, refetch on window focus, retries, and invalidation after a mutation.

### Choosing a tool

| Need | Tool |
|---|---|
| Server state, any stack | **TanStack Query** |
| Already on Redux Toolkit | **RTK Query** |
| Small global client state | **Zustand**, Jotai, or Context |
| Complex client state with many actions, devtools, middleware | **Redux Toolkit** |
| Truly local state | `useState` / `useReducer` |

## 💻 Code Example — TanStack Query Setup

```jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
```

## 💻 Code Example — Queries

```jsx
import { useQuery, keepPreviousData } from "@tanstack/react-query";

const fetchProducts = async ({ page, q }) => {
  const res = await fetch(`/api/products?page=${page}&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
};

function ProductList({ q }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["products", { page, q }],   // cache key — changes trigger refetch
    queryFn: () => fetchProducts({ page, q }),
    placeholderData: keepPreviousData,     // keep page 1 visible while page 2 loads
    enabled: q.length !== 1,               // conditional query
  });

  if (isPending) return <Spinner />;
  if (isError) return <p>{error.message}</p>;

  return (
    <>
      {data.items.map((p) => <ProductCard key={p._id} product={p} />)}
      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <button disabled={isPlaceholderData || !data.hasMore} onClick={() => setPage((p) => p + 1)}>Next</button>
      {isFetching && <small>Refreshing…</small>}
    </>
  );
}
```

**`staleTime` vs `gcTime`:** `staleTime` is how long data counts as fresh (no refetch). `gcTime` (formerly `cacheTime`, default 5 minutes) is how long *unused* data stays in memory.

## 💻 Code Example — Mutations With Invalidation

```jsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

function AddProduct() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body) => fetch("/api/products", { method: "POST", body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }), // refetch all product lists
  });

  return (
    <button disabled={mutation.isPending} onClick={() => mutation.mutate({ name: "Pen", price: 20 })}>
      Add
    </button>
  );
}
```

## 💻 Code Example — Optimistic Update With Rollback

```jsx
const toggleTodo = useMutation({
  mutationFn: (todo) => api.updateTodo(todo.id, { done: !todo.done }),
  onMutate: async (todo) => {
    await queryClient.cancelQueries({ queryKey: ["todos"] });
    const previous = queryClient.getQueryData(["todos"]);
    queryClient.setQueryData(["todos"], (old) =>
      old.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
    );
    return { previous };                         // context for rollback
  },
  onError: (_err, _todo, context) => queryClient.setQueryData(["todos"], context.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
});
```

## 💻 Code Example — Infinite Scroll

```jsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ["feed"],
  queryFn: ({ pageParam }) => fetch(`/api/feed?cursor=${pageParam ?? ""}`).then((r) => r.json()),
  initialPageParam: null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

const posts = data?.pages.flatMap((p) => p.items) ?? [];
// Trigger fetchNextPage() from an IntersectionObserver on the last item.
```

## 💻 Code Example — Prefetching on Hover

```jsx
<Link
  to={`/products/${p._id}`}
  onMouseEnter={() =>
    queryClient.prefetchQuery({ queryKey: ["product", p._id], queryFn: () => fetchProduct(p._id) })
  }
>
  {p.name}
</Link>
```

## 💻 Code Example — Zustand for Client State

```js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useCart = create(
  persist(
    (set, get) => ({
      items: [],
      add: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);
          return existing
            ? { items: state.items.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i)) }
            : { items: [...state.items, { ...product, qty: 1 }] };
        }),
      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    { name: "cart" },                       // saved to localStorage
  ),
);

// Component subscribes only to what it selects → minimal re-renders
const count = useCart((s) => s.items.length);
```

## 💻 Code Example — Fixing the Race Condition Without a Library

```jsx
useEffect(() => {
  let ignore = false;
  fetchUser(id).then((u) => { if (!ignore) setUser(u); });
  return () => { ignore = true; };          // or AbortController
}, [id]);
```

## 🌍 Real-World Use

- Product listing with filters and pagination → `useQuery` with filters in the `queryKey`.
- Admin panel edits → `useMutation` + `invalidateQueries`.
- Social feed → `useInfiniteQuery` + IntersectionObserver.
- Cart, theme, sidebar state → Zustand or Redux Toolkit.

## 🎯 Likely Interview Questions

1. **What is the difference between server state and client state?**
2. **Why not store API data in Redux with `useEffect` fetching?**
3. **Explain `staleTime` vs `gcTime` in TanStack Query.**
4. **How do you refresh a list after creating an item?** — Invalidate its query key.
5. **How do you implement an optimistic update with rollback?**
6. **How do you avoid a race condition when fetching in `useEffect`?**
7. **TanStack Query vs RTK Query — when would you pick each?**
8. **Redux vs Zustand vs Context for global state?**

---

[← Advanced Component Patterns](03-advanced-patterns.md) | [Index](../README.md) | [Next: Forms & Routing →](05-forms-routing.md)
