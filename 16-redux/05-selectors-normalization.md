# Chapter 49 — Selectors, Normalised State & Performance

## 📖 Definitions

- **Selector** — a function `(state: RootState) => value` that reads or derives data from the store.
- **Memoized selector** — created with `createSelector` (Reselect); it only recomputes when its inputs change and otherwise returns the **same reference**.
- **Normalised state** — storing collections as `{ ids: string[], entities: Record<id, item> }` instead of nested arrays, like tables in a database.
- **`createEntityAdapter`** — RTK helper that generates normalised state, CRUD reducers and selectors.

## 🔍 Why Selectors Matter for Performance

`useSelector` re-runs your selector after **every** dispatched action and re-renders the component if the result is not `===` the previous one.

```ts
// ❌ New array every time → component re-renders on EVERY action in the app
const done = useAppSelector((s) => s.todos.items.filter((t) => t.done));

// ❌ New object every time → same problem
const { name, email } = useAppSelector((s) => ({ name: s.auth.user?.name, email: s.auth.user?.email }));

// ✅ Select primitives / existing references separately
const name  = useAppSelector((s) => s.auth.user?.name);
const email = useAppSelector((s) => s.auth.user?.email);

// ✅ Or memoize derived data
const done = useAppSelector(selectDoneTodos);
```

## 💻 Code Example — `createSelector`

```ts
// features/cart/cartSelectors.ts
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";

// Input selectors: cheap, return existing references
const selectItems  = (s: RootState) => s.cart.items;
const selectCoupon = (s: RootState) => s.cart.couponCode;

export const selectSubtotal = createSelector([selectItems], (items) =>
  items.reduce((sum, i) => sum + i.price * i.qty, 0),
);

const DISCOUNTS: Record<string, number> = { SAVE10: 0.1, WELCOME20: 0.2 };

// Selectors compose: the output of one is the input of another
export const selectCartTotal = createSelector([selectSubtotal, selectCoupon], (subtotal, coupon) => {
  const rate = coupon ? DISCOUNTS[coupon] ?? 0 : 0;
  return Math.round(subtotal * (1 - rate));
});

export const selectExpensiveItems = createSelector([selectItems], (items) =>
  items.filter((i) => i.price > 1000),           // same array ref until items change
);
```

## 💻 Code Example — Selectors with Arguments

```ts
// Pass extra arguments through as another input selector
export const selectTodosByStatus = createSelector(
  [(s: RootState) => s.todos.items, (_s: RootState, status: "all" | "done" | "open") => status],
  (items, status) => (status === "all" ? items : items.filter((t) => (status === "done" ? t.done : !t.done))),
);

// Component
const visible = useAppSelector((s) => selectTodosByStatus(s, filter));
```

> A `createSelector` instance caches only the **last** argument set (Reselect 5 uses `weakMapMemoize`, which caches more, but don't rely on it for per-item selectors). If many list rows each need their own memoized selector, create one per component with `useMemo(() => makeSelectItemById(), [])`.

## 🔍 Why Normalise?

Nested / duplicated (❌):
```json
{
  "posts": [
    { "id": "p1", "author": { "id": "u1", "name": "Asha" }, "comments": [ { "id": "c1", "author": { "id": "u1", "name": "Asha" } } ] }
  ]
}
```
Renaming user `u1` means finding and updating every copy. Lookups by id are `O(n)`.

Normalised (✅):
```json
{
  "users":    { "ids": ["u1"], "entities": { "u1": { "id": "u1", "name": "Asha" } } },
  "posts":    { "ids": ["p1"], "entities": { "p1": { "id": "p1", "authorId": "u1", "commentIds": ["c1"] } } },
  "comments": { "ids": ["c1"], "entities": { "c1": { "id": "c1", "authorId": "u1" } } }
}
```
Each item exists once; lookups are `O(1)`; updating one entity doesn't create new references for unrelated ones → fewer re-renders.

## 💻 Code Example — `createEntityAdapter`

```ts
// features/todos/todosSlice.ts
import { createEntityAdapter, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import { fetchTodos } from "./todosThunks";

export interface Todo { id: string; title: string; done: boolean; createdAt: string }

const todosAdapter = createEntityAdapter<Todo>({
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),   // keep ids sorted (newest first)
});

// { ids: [], entities: {}, status: "idle" }
const initialState = todosAdapter.getInitialState({ status: "idle" as "idle" | "loading" | "failed" });

const todosSlice = createSlice({
  name: "todos",
  initialState,
  reducers: {
    todoAdded: todosAdapter.addOne,
    todoRemoved: todosAdapter.removeOne,
    todoUpdated: todosAdapter.updateOne,            // payload: { id, changes: Partial<Todo> }
    todoToggled(state, action: PayloadAction<string>) {
      const todo = state.entities[action.payload];
      if (todo) todo.done = !todo.done;
    },
    allCompletedCleared(state) {
      const doneIds = Object.values(state.entities).filter((t) => t?.done).map((t) => t!.id);
      todosAdapter.removeMany(state, doneIds);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (s) => { s.status = "loading"; })
      .addCase(fetchTodos.fulfilled, (s, a) => {
        s.status = "idle";
        todosAdapter.setAll(s, a.payload);          // replace all
      });
  },
});

export const { todoAdded, todoRemoved, todoUpdated, todoToggled, allCompletedCleared } = todosSlice.actions;
export default todosSlice.reducer;

// Generated, memoized selectors bound to this slice's location in RootState
export const {
  selectAll: selectAllTodos,          // Todo[] in sorted order
  selectById: selectTodoById,         // (state, id) => Todo | undefined
  selectIds: selectTodoIds,
  selectTotal: selectTodoCount,
} = todosAdapter.getSelectors<RootState>((s) => s.todos);
```

Adapter CRUD methods: `addOne/addMany`, `setOne/setMany/setAll`, `updateOne/updateMany`, `upsertOne/upsertMany`, `removeOne/removeMany/removeAll`.

## 💻 Code Example — List Rendering Pattern (Ids Down, Select by Id)

```tsx
import { memo } from "react";

export function TodoList() {
  const ids = useAppSelector(selectTodoIds);          // only changes when items are added/removed/reordered
  return <ul>{ids.map((id) => <TodoRow key={id} id={id} />)}</ul>;
}

const TodoRow = memo(function TodoRow({ id }: { id: string }) {
  const todo = useAppSelector((s) => selectTodoById(s, id));   // re-renders only when THIS todo changes
  const dispatch = useAppDispatch();
  if (!todo) return null;
  return (
    <li>
      <label>
        <input type="checkbox" checked={todo.done} onChange={() => dispatch(todoToggled(id))} />
        {todo.title}
      </label>
    </li>
  );
});
```

Toggling one todo now re-renders **one row**, not the whole list of 1,000.

## 💻 Code Example — `shallowEqual` for Small Objects

```ts
import { shallowEqual } from "react-redux";

// Re-render only if any of these top-level values change
const { status, error } = useAppSelector((s) => ({ status: s.users.status, error: s.users.error }), shallowEqual);
```

## 📊 Performance Checklist

| Problem | Fix |
|---------|-----|
| Component re-renders on every action | Selector returns new array/object → memoize or select primitives |
| Whole list re-renders on one item change | Normalise + pass ids + select by id in `memo` rows |
| Expensive derived data recomputed | `createSelector` |
| Huge state copied on each update | Normalise; keep big immutable blobs out of hot paths |
| Store holds data nobody uses | Use RTK Query (auto cache removal) for server data |
| Dev-mode slowness | Immutability/serialisability checks are dev-only; tune `warnAfter` or exclude huge slices |

## 🌍 Real-World Impact

- A dashboard with 2,000 rows went from re-rendering every row on each WebSocket tick to re-rendering only changed rows after switching to ids + `selectById`.
- Memoized totals mean a cart badge doesn't recalculate on unrelated actions like opening a modal.

## 🎯 Likely Interview Questions

1. **What is a selector and why use one?** — Encapsulates state shape, reusable, enables memoization.
2. **How does `createSelector` memoize?** — Compares input-selector results by reference; if unchanged returns cached output.
3. **Why does `useSelector(s => s.items.filter(...))` hurt performance?** — Returns a new array each run → `===` fails → re-render every dispatch.
4. **What is normalised state?** — `ids` + `entities` map; single copy of each entity; O(1) lookup.
5. **What does `createEntityAdapter` give you?** — Normalised initial state, CRUD reducers, sorted ids, memoized selectors.
6. **How do you avoid re-rendering a whole list when one item changes?** — Pass ids to `memo` rows that select their own entity.
7. **When would you use `shallowEqual`?** — Selecting a small object of several fields without memoizing.

---

[← RTK Query](04-rtk-query.md) | [Index](../README.md) | [Next: Middleware, Testing & Alternatives →](06-middleware-testing-alternatives.md)
