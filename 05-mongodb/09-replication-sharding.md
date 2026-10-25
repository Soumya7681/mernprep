# Chapter 79 — Replication & Sharding

## 📖 Definitions

- **Replication** — keeping identical copies of data on multiple servers (a **replica set**) for **high availability** and data safety.
- **Sharding** — splitting one collection's data across multiple replica sets (**shards**) for **horizontal scaling** of storage and write throughput.

> Replication = copies of the same data (availability). Sharding = different pieces of data on different machines (scale). Production clusters use both: every shard is a replica set.

## 🔍 Replica Set Architecture

```text
            writes + default reads
   App ───────────────────────────► PRIMARY
                                      │  oplog (operations log)
                       ┌──────────────┴──────────────┐
                       ▼                             ▼
                  SECONDARY                     SECONDARY
             (copies the oplog,            (can serve reads if
              applies operations)           readPreference allows)

  heartbeat every 2s between all members; if primary unreachable for
  electionTimeoutMillis (10s default) → election → a secondary becomes primary
```

| Concept | Detail |
|---------|--------|
| **Primary** | Only member that accepts writes |
| **Secondary** | Replicates the primary's **oplog** asynchronously; can serve reads |
| **Oplog** | Capped collection `local.oplog.rs` of idempotent operations; secondaries tail it |
| **Arbiter** | Votes in elections, holds no data (avoid in production when possible — weakens `majority` writes) |
| **Hidden / delayed member** | Not visible to apps; delayed member keeps an older copy (e.g. 1h) to recover from accidental deletes |
| **Size** | Up to 50 members, max 7 voting; use an **odd** number of voters (3 or 5) |

## 💻 Setting Up a Replica Set

```js
// Start 3 mongod processes with --replSet rs0, then in mongosh:
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2 },   // preferred primary
    { _id: 1, host: "mongo2:27017", priority: 1 },
    { _id: 2, host: "mongo3:27017", priority: 1 },
  ],
});

rs.status();                 // health, state, optime of each member
rs.printSecondaryReplicationInfo();   // replication lag
rs.stepDown();               // force primary to step down (maintenance)
```

Connection string lists several hosts; the driver discovers the topology and **follows the primary** after failover:

```text
mongodb://mongo1:27017,mongo2:27017,mongo3:27017/app?replicaSet=rs0&retryWrites=true&w=majority
```

## 🔍 Elections & Failover

1. Secondaries stop receiving heartbeats from the primary for `electionTimeoutMillis` (10s).
2. An eligible secondary calls an election; members vote (majority of **voting** members required).
3. The most up-to-date, highest-priority eligible member typically wins.
4. Drivers detect the new primary; retryable writes retry the failed write.
5. Typical failover: **~10–12 seconds** of no writes.

**Why majority?** It prevents **split brain**: during a network partition only the side with a majority can elect a primary. With 3 nodes, 1 can fail. With 5, 2 can fail. With 4 — still only 1 (that's why odd numbers).

**Rollback:** writes acknowledged with `w: 1` on an old primary that hadn't replicated them are rolled back after failover. `w: "majority"` writes are never rolled back.

## 🔍 Sharded Cluster Architecture

```text
             App
              │
              ▼
          mongos  (query router — stateless, run several)
              │   reads chunk → shard map from config servers
     ┌────────┼────────┬───────────┐
     ▼        ▼        ▼           ▼
  Shard A  Shard B  Shard C    Config servers (replica set):
  (replica (replica (replica   metadata — which ranges live where
   set)     set)     set)
```

| Component | Role |
|-----------|------|
| **mongos** | Router: sends each query to the right shard(s), merges results |
| **Config servers** | Replica set storing cluster metadata and chunk ranges |
| **Shard** | A replica set holding a subset of the data |
| **Chunk** | A contiguous range of shard-key values (default max 128 MB since 6.0) |
| **Balancer** | Background process that moves chunks to even out shards |

## 💻 Sharding a Collection

```js
sh.enableSharding("shop");                                  // optional on 6.0+; implicit
db.orders.createIndex({ customerId: 1, orderDate: 1 });
sh.shardCollection("shop.orders", { customerId: 1, orderDate: 1 });   // ranged sharding

sh.shardCollection("shop.events", { deviceId: "hashed" });            // hashed sharding

sh.status();                                                 // distribution of chunks
db.orders.getShardDistribution();
```

## 📊 Choosing a Shard Key (The Most Important Decision)

A good shard key has:

| Property | Why | Bad example |
|----------|-----|-------------|
| **High cardinality** | Many distinct values → can split into many chunks | `status` (5 values) |
| **Low frequency** | No single value dominates | `country` where 80% are "IN" |
| **Non-monotonic** | Inserts spread across shards | `createdAt`, `ObjectId` → all inserts hit the last chunk ("hot shard") |
| **Matches queries** | Queries including the key are **targeted** to one shard | Key never used in filters → every query is **scatter-gather** |

| Strategy | Pros | Cons |
|----------|------|------|
| **Ranged** `{ customerId: 1 }` | Range queries hit few shards | Monotonic keys create hot spots |
| **Hashed** `{ _id: "hashed" }` | Even write distribution | Range queries go to all shards |
| **Compound** `{ tenantId: 1, _id: 1 }` | Targeted per tenant + good spread | Must design with query patterns |
| **Zoned** | Pin ranges to regions (e.g. EU data in EU shards) | Extra configuration |

Since 5.0 you can **reshard** (`reshardCollection`) and since 4.4 **refine** a key by adding suffix fields — but changing the key is still expensive, so choose carefully.

## 🔍 Targeted vs Scatter-Gather Queries

```js
// Shard key: { customerId: 1, orderDate: 1 }
db.orders.find({ customerId: 42 });                       // ✅ targeted — one shard
db.orders.find({ customerId: 42, orderDate: { $gte: d } }); // ✅ targeted
db.orders.find({ status: "paid" });                       // ❌ scatter-gather — every shard
```

Scatter-gather isn't wrong, but its latency is the **slowest shard's** latency and it doesn't scale with more shards.

## ⚠️ Sharding Gotchas

- **Jumbo chunks**: too many docs with the same shard-key value can't be split.
- **Unique indexes** must include the shard key as a prefix (only `_id` uniqueness is per-shard otherwise).
- **Don't shard too early**: vertical scaling + indexes + replica set reads often suffice; shard when data or write volume exceeds one replica set (often > 1–2 TB or very high write rates).
- **Transactions across shards** work (4.2+) but are slower.

## 🔍 Replication vs Sharding

| | Replication | Sharding |
|---|-------------|----------|
| Goal | Availability, durability, read scaling | Write + storage scaling |
| Data on each node | Full copy | Subset |
| Minimum setup | 3 members | Config RS + ≥2 shard RS + mongos |
| Complexity | Low | High |

## 🌍 Real-World Impact

- A 3-node replica set across availability zones survives a data-centre outage with ~10s of write unavailability and no data loss (with `w: majority`).
- A team sharded on `createdAt` and found one shard took 100% of inserts; resharding to `{ tenantId: 1, createdAt: 1 }` spread the load.
- A delayed secondary recovered a collection someone dropped by mistake.

## 🎯 Likely Interview Questions

1. **What is a replica set?** — A group of `mongod` nodes with the same data: one primary, multiple secondaries, automatic failover.
2. **How does replication work?** — Secondaries tail and apply the primary's oplog asynchronously.
3. **What happens when the primary goes down?** — Heartbeats fail → election → a secondary becomes primary (~10s); drivers reconnect; retryable writes retry.
4. **Why should a replica set have an odd number of voting members?** — A majority is needed to elect; odd numbers maximise fault tolerance and avoid ties.
5. **What is an arbiter?** — A voting member without data; cheap tie-breaker but weakens majority write durability.
6. **What is sharding and when do you need it?** — Horizontal partitioning across shards when one replica set can't hold the data or handle the writes.
7. **What are the components of a sharded cluster?** — `mongos` routers, config server replica set, shard replica sets.
8. **How do you choose a shard key?** — High cardinality, low frequency, non-monotonic, used in most queries.
9. **Hashed vs ranged sharding?** — Even distribution vs efficient range queries.
10. **Why is `createdAt` or `ObjectId` a bad shard key?** — Monotonic → all inserts hit one shard.
11. **What is a scatter-gather query?** — A query without the shard key, sent to all shards.
12. **Replication vs sharding?** — Copies for availability vs partitions for scale.
13. **What is a rollback in a replica set?** — Undoing writes on a former primary that weren't replicated to a majority before failover.

---

[← Performance Tuning](10-performance-tuning.md) | [Index](../README.md) | [Next: Advanced Features →](11-advanced-features.md)
