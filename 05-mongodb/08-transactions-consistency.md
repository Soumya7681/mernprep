# Chapter 76 — Transactions, Consistency & Concurrency

## 📖 Definitions

- **Atomicity in MongoDB** — every write to a **single document** is atomic, including its embedded arrays and sub-documents.
- **Multi-document transaction** — groups writes across documents/collections so they all commit or all roll back (replica sets since 4.0, sharded clusters since 4.2).
- **Write concern** — how many replica-set members must acknowledge a write before it counts as successful.
- **Read concern** — which data a read is allowed to see (e.g. only majority-committed data).
- **Read preference** — which member (primary or secondaries) a read is sent to.

## 🔍 Do You Even Need a Transaction?

Good document design avoids most transactions because related data lives in one document.

| Situation | Solution |
|-----------|----------|
| Increment a counter, add to an array, update order status | Single-document atomic update (`$inc`, `$push`, `$set`) |
| Decrement stock only if enough is left | Conditional update: `updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })` |
| Move money between two accounts | **Transaction** (two documents must change together) |
| Create order + decrement stock for many products | **Transaction** (or saga with compensation) |

## 💻 Code Example — Transaction with the Node.js Driver

```ts
import { MongoClient } from "mongodb";

const client = new MongoClient(uri);
const accounts = client.db("bank").collection<{ _id: string; balance: number }>("accounts");
const ledger = client.db("bank").collection("ledger");

export async function transfer(from: string, to: string, amount: number) {
  const session = client.startSession();
  try {
    await session.withTransaction(
      async () => {
        const debit = await accounts.updateOne(
          { _id: from, balance: { $gte: amount } },      // guard: no negative balance
          { $inc: { balance: -amount } },
          { session },
        );
        if (debit.modifiedCount !== 1) throw new Error("Insufficient funds");

        await accounts.updateOne({ _id: to }, { $inc: { balance: amount } }, { session });
        await ledger.insertOne({ from, to, amount, at: new Date() }, { session });
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
      },
    );
  } finally {
    await session.endSession();
  }
}
```

Key points:
- **Every** operation inside must pass `{ session }` — forgetting it runs the op **outside** the transaction.
- `withTransaction` automatically **retries** on `TransientTransactionError` (e.g. write conflict) and retries the commit on `UnknownTransactionCommitResult` — so the callback must be safe to run more than once (no external side effects like sending emails inside).
- Throwing inside the callback aborts the transaction.

## 💻 Code Example — Mongoose

```ts
await mongoose.connection.transaction(async (session) => {
  const order = await Order.create([{ userId, items, total }], { session });   // create() needs an array with session
  for (const i of items) {
    const res = await Product.updateOne(
      { _id: i.productId, stock: { $gte: i.qty } },
      { $inc: { stock: -i.qty } },
      { session },
    );
    if (res.modifiedCount === 0) throw new AppError(409, `Out of stock: ${i.productId}`);
  }
  return order[0];
});
```

## ⚠️ Transaction Limits & Costs

- Requires a **replica set** or sharded cluster (a standalone `mongod` can't run them — use a single-node replica set locally).
- Default max runtime **60 seconds** (`transactionLifetimeLimitSeconds`); keep them short.
- Keep them small: modifying many thousands of documents in one transaction puts pressure on the WiredTiger cache.
- **Write conflicts**: two transactions touching the same document → one gets `WriteConflict` and is retried.
- Performance cost is real; "if you need transactions everywhere, reconsider your schema".
- Collections and indexes can be created inside transactions since 4.4 (with restrictions).

## 🔍 Write Concern

```js
db.orders.insertOne(doc, { writeConcern: { w: "majority", j: true, wtimeout: 5000 } });
```

| Setting | Meaning | Trade-off |
|---------|---------|-----------|
| `w: 0` | Fire and forget, no ack | Fastest, can lose data silently |
| `w: 1` | Primary acknowledged | Can be rolled back if primary fails before replicating |
| `w: "majority"` | Majority of voting members have it | Survives failover — **default since MongoDB 5.0** |
| `j: true` | Written to the on-disk journal | Durable across crash of that node |
| `wtimeout` | Give up waiting after N ms | Write may still succeed later |

## 🔍 Read Concern

| Level | Returns | Use for |
|-------|---------|---------|
| `local` (default) | Latest data on the node, may be rolled back | Most reads |
| `available` | Like local; on sharded clusters may return orphan docs | Lowest latency |
| `majority` | Data acknowledged by a majority — never rolled back | Financial reads, after failover safety |
| `linearizable` | Reflects all majority writes completed before the read (primary only) | Strongest single-doc reads; slow |
| `snapshot` | Consistent point-in-time view | Transactions, multi-query consistent reads |

## 🔍 Read Preference

| Mode | Reads from |
|------|-----------|
| `primary` (default) | Primary only — always up to date |
| `primaryPreferred` | Primary, secondary if primary unavailable |
| `secondary` | Secondaries only — may be **stale** (replication lag) |
| `secondaryPreferred` | Secondaries, primary if none available |
| `nearest` | Lowest network latency member |

Reading from secondaries scales reads but gives **eventual consistency**: a user might not see their own write. Use it for analytics/reporting, not "show me what I just saved".

## 💻 Causal Consistency ("Read Your Own Writes")

```ts
const session = client.startSession({ causalConsistency: true });
await users.updateOne({ _id }, { $set: { name: "New" } }, { session, writeConcern: { w: "majority" } });
// Even on a secondary, this read waits until it has seen the write above
const u = await users.findOne({ _id }, { session, readPreference: "secondary", readConcern: { level: "majority" } });
```

## 💻 Optimistic Concurrency Control (Lost-Update Prevention)

Problem: two admins open the same product, both edit, last save silently overwrites the first.

```ts
// Each document carries a version number
const product = await products.findOne({ _id });                       // { …, version: 7 }

const res = await products.updateOne(
  { _id, version: product.version },                                  // only if nobody changed it
  { $set: { price: newPrice }, $inc: { version: 1 } },
);
if (res.matchedCount === 0) throw new AppError(409, "Product was modified by someone else — reload");
```

Mongoose has this built in: `new Schema({...}, { optimisticConcurrency: true })` uses `__v` and throws `VersionError` on `save()` conflicts.

**Pessimistic locking** (lock first) is rarely used in MongoDB; you can emulate it with a `lockedBy`/`lockedUntil` field set via `findOneAndUpdate`.

## 💻 Idempotency for Retries

```ts
// Client sends an Idempotency-Key header; a unique index makes duplicates impossible
db.payments.createIndex({ idempotencyKey: 1 }, { unique: true });

try {
  await payments.insertOne({ idempotencyKey: key, amount, userId, status: "pending" });
} catch (e) {
  if ((e as { code?: number }).code === 11000) return payments.findOne({ idempotencyKey: key }); // retry → same result
  throw e;
}
```

MongoDB drivers also enable **retryable writes** by default (`retryWrites=true`) — a single write is retried once after a network error or failover without being applied twice.

## 🔍 Isolation & Locking (Under the Hood)

- WiredTiger uses **document-level concurrency control** (MVCC) — writers to different documents don't block each other.
- Outside transactions, a multi-document `updateMany` is **not** atomic as a whole; other readers can see it half-applied.
- Inside a transaction, reads see a **snapshot**; writes are invisible to others until commit.

## 📊 Is MongoDB ACID?

| Property | MongoDB |
|----------|---------|
| Atomicity | Single doc always; multi-doc via transactions |
| Consistency | Schema validation, unique indexes, transactions |
| Isolation | Snapshot isolation in transactions |
| Durability | Journaling + `w: "majority"` |

So yes — MongoDB is ACID compliant for multi-document transactions since 4.0.

## 🌍 Real-World Impact

- Conditional `$inc` on stock prevents overselling without any transaction.
- `w: "majority"` prevents "order disappeared after failover" incidents.
- Optimistic concurrency eliminates silent overwrites in admin panels.

## 🎯 Likely Interview Questions

1. **Are single-document writes atomic?** — Yes, always.
2. **When do you need a multi-document transaction?** — Several documents must change together (transfers, order + stock across docs).
3. **What are the requirements and limits of transactions?** — Replica set/sharded cluster; 60s default limit; pass the session to every op; keep them small.
4. **Why does `withTransaction` require idempotent callbacks?** — It retries on transient errors and unknown commit results.
5. **Explain write concern `w: 1` vs `majority`.** — Primary-only ack (can be rolled back on failover) vs majority ack (durable across failover).
6. **What is read concern `majority`?** — Read only data that can't be rolled back.
7. **What are the risks of reading from secondaries?** — Stale data due to replication lag; no read-your-own-writes unless causal sessions.
8. **How do you prevent lost updates?** — Optimistic concurrency with a version field in the filter.
9. **How do you prevent overselling?** — Conditional atomic update `{ stock: { $gte: qty } }` + `$inc`.
10. **What are retryable writes?** — Drivers automatically retry a write once on transient network errors without double-applying.
11. **Is MongoDB ACID?** — Yes for single docs always, for multi-document transactions since 4.0/4.2.
12. **What happens on a write conflict in a transaction?** — One transaction aborts with a transient error and is retried.

---

[← populate vs $lookup](04-populate-vs-lookup.md) | [Index](../README.md) | [Next: Performance Tuning →](10-performance-tuning.md)
