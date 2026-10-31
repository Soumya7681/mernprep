# Chapter 149 — MERN Interview: MongoDB & Mongoose Questions

## 📖 How to Use This Chapter

The MongoDB questions most asked in **MERN** interviews, focused on how you use it in real projects with Mongoose. For a full MongoDB question bank (70+ questions and 25 query problems), see the **MongoDB** section.

---

### 1. Why MongoDB in a MERN app?

JSON-like documents map directly to JavaScript objects and API responses, flexible schema for evolving features, rich queries and aggregation, and built-in replication and sharding. For heavily relational, transaction-heavy data (accounting), PostgreSQL can be a better fit.

### 2. How did you design the schema in your project?

Explain one real example with **embed vs reference**:

> "Orders embed their line items — product name, price and quantity at purchase time — because items are always read with the order and must not change if the product price changes later. Orders **reference** the user by `userId`, because users are read independently and have many orders. Reviews are a separate collection referencing `productId`, because a product can have thousands."

### 3. Embed vs reference — rules?

Embed: small, bounded, read together, owned by the parent (address, line items). Reference: large or unbounded, shared, or accessed independently (users, reviews, logs). Max document size is 16 MB.

### 4. What is Mongoose and why use it?

An ODM for Node: schemas, validation, defaults, middleware (hooks), `populate`, model methods. It gives structure to a flexible database.

### 5. Show a schema with validation, hooks and methods.

```js
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user" },
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};
```

### 6. `populate` vs `$lookup`?

`populate` runs an extra query from Mongoose and replaces ids with documents — simple. `$lookup` is a database-side join in an aggregation — needed when you filter/sort/group on joined fields or want one round trip.

### 7. How do indexes help? How did you use them?

Indexes avoid scanning the whole collection. Example: the order list filters by `userId` and `status` and sorts by `createdAt` → compound index `{ userId: 1, status: 1, createdAt: -1 }` (Equality, Sort, Range rule). Verify with `.explain("executionStats")` — look for `IXSCAN` instead of `COLLSCAN`.

### 8. How do you find and fix a slow query?

Enable the profiler / check slow logs or Atlas Performance Advisor → run `explain` → add or fix the index → reduce fields with projection → use `.lean()` for read-only data → paginate → re-measure.

### 9. What does `.lean()` do?

Returns plain JavaScript objects instead of Mongoose documents — faster and lighter, but no `save()`, virtuals or methods. Use for read-only API responses.

### 10. Why don't validators run on `findByIdAndUpdate`?

Mongoose runs schema validators on `save()` by default, not on update queries. Pass `{ runValidators: true, new: true }`. Also note `pre("save")` hooks don't run on `updateOne`.

### 11. How do you prevent two users buying the last item?

Atomic conditional update:

```js
const updated = await Product.findOneAndUpdate(
  { _id: productId, stock: { $gte: qty } },
  { $inc: { stock: -qty } },
  { new: true },
);
if (!updated) throw new AppError(409, "Out of stock");
```

### 12. Have you used transactions? When?

When several documents must change together — e.g. create an order **and** decrement stock for several products **and** record a payment. Requires a replica set (Atlas is one).

```js
await mongoose.connection.transaction(async (session) => {
  await Order.create([{ userId, items, total }], { session });
  for (const i of items) {
    const ok = await Product.updateOne({ _id: i.productId, stock: { $gte: i.qty } }, { $inc: { stock: -i.qty } }, { session });
    if (!ok.modifiedCount) throw new Error("Out of stock");
  }
});
```

### 13. Write an aggregation for monthly revenue.

```js
Order.aggregate([
  { $match: { status: "paid", createdAt: { $gte: new Date("2026-01-01") } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]);
```

### 14. Top 5 customers by spend with names?

```js
Order.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$userId", spent: { $sum: "$total" } } },
  { $sort: { spent: -1 } },
  { $limit: 5 },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
  { $project: { _id: 0, name: { $first: "$user.name" }, spent: 1 } },
]);
```

### 15. How do you implement search?

Simple: regex anchored at the start or a text index (`$text`). Better: MongoDB Atlas Search for fuzzy, autocomplete and relevance. Always escape user input used in regex.

### 16. How do you implement soft delete?

Add `deletedAt: Date | null`; set it instead of deleting; filter `deletedAt: null` in queries (Mongoose query middleware can add it automatically); a partial index keeps it fast.

### 17. How do you handle a duplicate key error?

Error code `11000` from a unique index (e.g. email). Catch it in the error handler and return **409 Conflict** with a clear message.

### 18. How do you prevent NoSQL injection?

Validate types (email must be a string — not `{ "$ne": null }`), don't pass `req.body` directly into filters, use `mongoose.set("sanitizeFilter", true)`, and keep `strictQuery` on.

### 19. What is a replica set and why does it matter to you as a developer?

A primary plus secondaries with automatic failover. It's needed for transactions and change streams; use `w: "majority"` (default) so writes survive failover; reading from secondaries can return slightly old data.

### 20. How do you connect Mongoose correctly in production?

One connection per process at start-up (not per request), with pool size, timeouts, and retry handling; close it on shutdown. In serverless, cache the connection in a module-level variable.

### 21. How do you migrate schema changes?

Make the code handle old and new shapes, run a batched migration script (`updateMany` in chunks), then remove old-code paths. Add a `schemaVersion` field for big changes.

### 22. What are TTL indexes used for?

Auto-deleting documents after a time: OTPs, sessions, password reset tokens, temporary logs.

```js
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });
```

---

[← Node.js & Express Questions](04-node-express-questions.md) | [Index](../README.md) | [Next: Scenario & Debugging Questions →](06-scenario-debugging-questions.md)
