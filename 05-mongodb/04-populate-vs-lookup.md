# Chapter 80 — `populate()` vs `$lookup`

## 📖 Definitions

- **`populate()`** — a Mongoose convenience that runs a **second query** to load referenced documents and attach them.
- **`$lookup`** — a MongoDB **aggregation stage** that joins two collections inside a single query.

## 🔍 At a Glance

| | `populate()` | `$lookup` |
|---|---|---|
| Layer | Mongoose (app-side) | MongoDB (DB-side) |
| Queries | 2+ (round-trip per population) | 1 |
| Syntax | Concise | Verbose |
| Filter / sort joined fields | Limited | Full power |
| Multi-level joins | Easy with chained populate | Nested pipelines |
| Read-only? | Yes | Yes (unless combined with `$out`/`$merge`) |

## 💻 Code Example — Setup

```js
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const orderSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number,
    price:    Number,
  }],
  status: String,
});

export const User    = mongoose.model("User",    userSchema);
export const Order   = mongoose.model("Order",   orderSchema);
export const Product = mongoose.model("Product", productSchema);
```

## 💻 Code Example — `populate()`

```js
const order = await Order.findById(id)
  .populate("user", "name email")                 // pick fields
  .populate("items.product", "name price");

// order.user.name, order.items[0].product.name etc.
```

### Behind the scenes
```
1. Order.findById(id)                  → 1 query
2. User.find({ _id: order.user })      → 2nd query
3. Product.find({ _id: { $in: ids } }) → 3rd query
4. Mongoose stitches them together in JS
```

## 💻 Code Example — `populate` with Filtering

```js
// Only populate active products
const order = await Order.findById(id).populate({
  path: "items.product",
  match: { active: true },           // products that don't match → null
  select: "name price",
});
```

## 💻 Code Example — `populate` with Conditions on the Parent

```js
// Can't easily say "give me orders where the user is in country IN"
// → that's where $lookup wins
```

## 💻 Code Example — `$lookup`

```js
const orders = await Order.aggregate([
  { $match: { status: "paid" } },
  {
    $lookup: {
      from: "users",
      localField: "user",
      foreignField: "_id",
      as: "user",
    },
  },
  { $unwind: "$user" },              // flatten the user array
  { $match: { "user.country": "IN" } },   // filter by joined field
  { $project: { _id: 0, total: 1, "user.name": 1, "user.email": 1 } },
]);
```

This is impossible with `populate` alone — you can't filter on the populated field at the DB level.

## 💻 Code Example — `$lookup` with Sub-Pipeline (MongoDB 3.6+)

```js
db.orders.aggregate([
  {
    $lookup: {
      from: "products",
      let: { itemIds: "$items.product" },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$itemIds"] }, active: true } },
        { $project: { name: 1, price: 1 } },
      ],
      as: "products",
    },
  },
]);
```

This is the modern, flexible form of `$lookup`.

## 💻 Code Example — Multi-Level Populate

```js
// User → Orders → Items → Product
const user = await User.findById(id)
  .populate({
    path: "orders",
    populate: { path: "items.product", select: "name price" },
  });
```

## 💻 Code Example — Multi-Level `$lookup`

```js
db.users.aggregate([
  {
    $lookup: {
      from: "orders",
      let: { uid: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$user", "$$uid"] } } },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "products",
          },
        },
      ],
      as: "orders",
    },
  },
]);
```

## ⚖️ When to Use Which

### Prefer `populate` when…
- Simple parent-child fetching.
- You don't need to filter/sort by joined fields.
- The number of distinct foreign IDs is small (one extra round-trip is cheap).
- You like the cleaner syntax for everyday CRUD.

### Prefer `$lookup` when…
- You need to **filter** or **sort** by the joined collection.
- You need to do **complex aggregations** (group, count, etc.).
- You want **one DB round-trip** instead of two.
- The data is large and reducing round-trips matters.

## ⚠️ Performance Notes

- `$lookup` is **not free** — index the `foreignField` (usually `_id` is already indexed, but custom ones aren't).
- `populate` with `match` filters in JS — so it fetches all matches first, then filters. Be careful with huge sets.
- Multi-level `populate` can create N+1 patterns; consider `$lookup` if it hits performance.

## 💻 Code Example — Denormalization (Sometimes the Best Choice)

Instead of joining each time, store frequently-needed fields together:

```js
// orderSchema
{
  user: { type: ObjectId, ref: "User" },
  userName: String,          // ← denormalized
  userEmail: String,
}
```

Trade off: faster reads, harder updates (you must sync changes). Common in dashboards and reporting.

## 🎯 Likely Interview Questions

1. **`populate()` vs `$lookup`?** — `populate` is Mongoose-only and runs a second query (`$in` on ids) then stitches results in Node; `$lookup` is a server-side join in one aggregation round trip and can filter/sort on joined fields.
2. **When would you choose `$lookup`?** — When you filter, sort, group or paginate by fields of the joined collection, need computed results, or want one round trip for reporting/analytics.
3. **How do you filter on a populated field?** — Either `populate({ match: ... })` (post-filter) or `$lookup` + `$match`.
4. **What's denormalization, and when is it worth it?** — Copying fields from one document into another (e.g. customer name into orders) to avoid joins; worth it when those fields are read often and change rarely, or when a historical snapshot is desired.
5. **Does `populate` cause N+1 queries?** — No — it batches ids into one `$in` query per populated path; but nested/deep populates add one query per level.
6. **How do you populate across multiple levels?** — `populate({ path: "author", populate: { path: "company" } })`, or nested `$lookup` stages.
7. **Why does `$lookup` need an index?** — It searches the joined collection's `foreignField` for every input document; without an index each lookup is a collection scan.
8. **What is virtual populate?** — Defining a virtual on the parent (`ref`, `localField`, `foreignField`) so you can populate children that store the parent id, without keeping an array of child ids in the parent.

---

[← Aggregation Pipeline](03-aggregation.md) | [Index](../README.md) | [Next: Transactions & Consistency →](08-transactions-consistency.md)
