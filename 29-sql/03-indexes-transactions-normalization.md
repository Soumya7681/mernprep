# Chapter 102 — Indexes, Transactions & Normalisation

## 📖 Definition

These topics decide whether a SQL database is **fast**, **correct under concurrency**, and **easy to maintain**:

- **Indexes:** extra data structures (usually B-trees) that let the database find rows without scanning the whole table.
- **Transactions:** groups of statements that succeed or fail together, with the **ACID** guarantees.
- **Isolation levels and locking:** how transactions running at the same time see each other's changes.
- **Normalisation:** designing tables so each fact is stored **once**, which avoids update anomalies.

---

## 1️⃣ Indexes

### How a B-tree index works

A B-tree index keeps the column values **sorted** in a balanced tree, with a pointer to each row. A lookup is **O(log n)** instead of O(n). Because the values are sorted, the same index also speeds up range queries (`>`, `BETWEEN`), `ORDER BY` and prefix `LIKE 'abc%'`.

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE UNIQUE INDEX idx_customers_email ON customers (LOWER(email));     -- expression index: case-insensitive unique
CREATE INDEX idx_orders_cust_date ON orders (customer_id, created_at DESC);   -- composite
CREATE INDEX idx_orders_pending ON orders (created_at) WHERE status = 'PENDING';   -- partial index
CREATE INDEX idx_orders_cover ON orders (customer_id) INCLUDE (amount, status);     -- covering (Postgres 11+)
CREATE INDEX CONCURRENTLY idx_big ON events (user_id);   -- build without blocking writes (Postgres)
```

### Index types (PostgreSQL)

| Type | Good for |
|---|---|
| **B-tree** (default) | `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, `LIKE 'x%'` |
| **Hash** | Only `=` |
| **GIN** | `JSONB` (`@>`), arrays, full-text search (`tsvector`), trigram `LIKE '%x%'` (`pg_trgm`) |
| **GiST** | Geometric data, ranges, nearest-neighbour search (PostGIS) |
| **BRIN** | Huge tables where values follow the physical order (time-series `created_at`) |

### Composite indexes: the leftmost-prefix rule

An index on `(customer_id, created_at)` works like a phone book sorted by **last name, then first name**:

| Query | Uses the index? |
|---|---|
| `WHERE customer_id = 1` | ✅ |
| `WHERE customer_id = 1 AND created_at > '2026-01-01'` | ✅ (best case) |
| `WHERE customer_id = 1 ORDER BY created_at DESC` | ✅ no sort needed |
| `WHERE created_at > '2026-01-01'` | ❌ usually not (no leading column) |

Order columns as **equality first, then sort, then range**. This is the same ESR rule as in MongoDB.

### When an index is NOT used

- A function wrapped around the column: `WHERE LOWER(email) = 'x'` needs an index on `LOWER(email)`. Likewise `WHERE DATE(created_at) = ...` → use a range on the raw column instead.
- A leading wildcard: `LIKE '%son'` (use `pg_trgm` or full-text search).
- Implicit type casts (comparing a `TEXT` column with a number).
- **Low selectivity:** when the query would return most of the table (e.g. `status = 'PAID'` for 95% of rows), a sequential scan is cheaper.
- `OR` across different columns (sometimes rewritten as `UNION`, or the planner uses a bitmap OR).
- Stale statistics: run `ANALYZE`.

### Costs of indexes

Every index makes **writes slower** (each `INSERT`, `UPDATE` or `DELETE` must update it), uses disk and memory, and needs maintenance. Index the columns you **filter, join and sort on**, especially **foreign keys**. Don't index every column.

### Clustered vs non-clustered

- **Clustered:** the table's rows are physically stored in index order. There's only one per table. MySQL InnoDB always clusters by the primary key. SQL Server lets you choose.
- **Non-clustered / secondary:** a separate structure that points to the rows. Postgres tables are **heaps**, so all Postgres indexes are secondary (`CLUSTER` reorders the table once, but the order isn't kept).

### Reading `EXPLAIN`

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 10;
```

```
Limit  (cost=0.43..8.95 rows=10) (actual time=0.031..0.045 rows=10 loops=1)
  ->  Index Scan using idx_orders_cust_date on orders  (actual rows=10 loops=1)
        Index Cond: (customer_id = 42)
Planning Time: 0.10 ms
Execution Time: 0.07 ms
```

| Plan node | Meaning |
|---|---|
| `Seq Scan` | Reads the whole table (fine for small tables; a red flag for big ones) |
| `Index Scan` | Walks the index, then fetches each row from the table |
| `Index Only Scan` | Gets everything from the index (a covering index); fastest |
| `Bitmap Heap Scan` | Collects matching row locations first, then reads them in order; for medium selectivity |
| `Nested Loop` | For each outer row, look up the inner one; good when the outer side is small and the inner side is indexed |
| `Hash Join` | Builds a hash table of one side; good for large unsorted joins |
| `Merge Join` | Both sides sorted; walk through them together |
| `Sort` / `HashAggregate` | In-memory or on-disk sort or grouping (check `work_mem`) |

Compare **estimated rows vs actual rows**. A big mismatch means the planner had bad statistics.

---

## 2️⃣ Transactions & ACID

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 500 WHERE id = 1;
  UPDATE accounts SET balance = balance + 500 WHERE id = 2;
  INSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 500);
COMMIT;      -- or ROLLBACK; to undo everything since BEGIN
```

| Property | Meaning | How the DB provides it |
|---|---|---|
| **Atomicity** | All or nothing | Undo/rollback, WAL |
| **Consistency** | Constraints always hold (FK, CHECK, UNIQUE) | Constraint checks at statement or commit time |
| **Isolation** | Concurrent transactions don't see each other's half-done work | Locks + MVCC |
| **Durability** | Once committed, data survives a crash | Write-Ahead Log (WAL) flushed to disk |

### Savepoints

```sql
BEGIN;
  INSERT INTO orders (...) VALUES (...);
  SAVEPOINT before_coupon;
  UPDATE coupons SET used = used + 1 WHERE code = 'NEW10';   -- if this fails...
  ROLLBACK TO SAVEPOINT before_coupon;                       -- ...undo only this part
COMMIT;
```

### MVCC (Multi-Version Concurrency Control)

Postgres (and InnoDB) keep **several versions of a row**. An `UPDATE` writes a new version. Readers see the version that matches their **snapshot**. So **readers don't block writers, and writers don't block readers**. Old versions are cleaned up later by `VACUUM` (autovacuum in Postgres).

### Read anomalies

| Anomaly | What happens |
|---|---|
| **Dirty read** | You read another transaction's **uncommitted** change, which may then roll back |
| **Non-repeatable read** | You read a row twice and get different values, because someone committed an update in between |
| **Phantom read** | You run the same `WHERE` twice and get **new rows**, because someone inserted matching rows |
| **Lost update** | Two transactions read, change and write the same value; one overwrites the other |
| **Write skew** | Two transactions each check a condition, then write different rows, together breaking a rule (two doctors both go off call) |

### Isolation levels

| Level | Dirty read | Non-repeatable read | Phantom | Notes |
|---|---|---|---|---|
| Read Uncommitted | Possible | Possible | Possible | Postgres treats it as Read Committed |
| **Read Committed** | Prevented | Possible | Possible | **Postgres default**; each *statement* sees fresh committed data |
| **Repeatable Read** | Prevented | Prevented | Possible by the standard (prevented in Postgres) | **MySQL InnoDB default**; one snapshot for the whole transaction |
| **Serializable** | Prevented | Prevented | Prevented | Acts as if transactions ran one at a time; you must **retry** serialization failures |

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
...
COMMIT;   -- may fail with SQLSTATE 40001 → the application retries the whole transaction
```

### Preventing lost updates

**1. Atomic update (best when possible):**

```sql
UPDATE products SET stock = stock - 1 WHERE id = 7 AND stock > 0;   -- check the row count: 0 means sold out
```

**2. Pessimistic locking: `SELECT ... FOR UPDATE`**

```sql
BEGIN;
SELECT stock FROM products WHERE id = 7 FOR UPDATE;   -- other transactions trying to lock this row wait
-- application checks stock > 0
UPDATE products SET stock = stock - 1 WHERE id = 7;
COMMIT;
```

`FOR UPDATE SKIP LOCKED` lets several workers take **different** jobs from a queue table without waiting on each other.

**3. Optimistic locking: a version column**

```sql
UPDATE products SET stock = 9, version = version + 1
WHERE id = 7 AND version = 3;          -- 0 rows updated → someone else changed it; reload and retry
```

Use optimistic locking when conflicts are rare (most web apps). Use pessimistic locking when they're common, like flash sales or seat booking.

### Deadlocks

Transaction A locks row 1, then wants row 2. Transaction B locks row 2, then wants row 1. Both wait forever. The database **detects** this and aborts one of them (error `40P01` in Postgres).

Prevention:
- Always lock rows in a **consistent order** (e.g. by id).
- Keep transactions **short** (no HTTP calls inside a transaction).
- Retry when a deadlock error happens.

---

## 3️⃣ Normalisation

The goal is to remove **redundancy** and **anomalies**:
- **Update anomaly:** changing a customer's city in 50 order rows, and missing some.
- **Insert anomaly:** you can't add a product until someone orders it.
- **Delete anomaly:** deleting the last order also loses the customer's details.

### Starting point: one wide table

| order_id | customer | customer_city | products | product_prices |
|---|---|---|---|---|
| 1 | Anil | Pune | Pen, Book | 10, 200 |

| Normal form | Rule | Fix applied |
|---|---|---|
| **1NF** | Atomic values; no repeating groups or lists in a cell; each row unique | One row per order **item**: `(order_id, product, price)` |
| **2NF** | 1NF + every non-key column depends on the **whole** composite key (no partial dependency) | `price` depends only on `product`, not on `(order_id, product)` → move it to a `products` table |
| **3NF** | 2NF + no **transitive** dependency (non-key → non-key) | `customer_city` depends on `customer`, not on the order → move it to `customers` |
| **BCNF** | Every determinant is a candidate key | A stricter 3NF; matters for overlapping composite keys |
| 4NF / 5NF | No multi-valued or join dependencies | Rarely asked |

Result:

```
customers(id, name, city)
products(id, name, price)
orders(id, customer_id → customers, created_at)
order_items(order_id → orders, product_id → products, quantity, unit_price_at_purchase)
```

> Notice `unit_price_at_purchase`. It **looks** like duplication, but it's a different fact: the price **when the order was placed**. Interviewers like this point.

**Short version for the interview:** "Each column depends on the key (1NF), the whole key (2NF), and nothing but the key (3NF)."

### Denormalisation

Adding redundancy on purpose to make reads faster: a stored `order_total`, a `comment_count` column, a reporting table, or a **materialised view**. You accept extra work on writes (keeping copies in sync with triggers or application code) in exchange for fewer joins. Do it when reads are much more frequent than writes and you've **measured** that the joins are slow.

### Relationship patterns

| Relationship | Design |
|---|---|
| One-to-one | FK with `UNIQUE` on one side (`user_profiles.user_id UNIQUE`) |
| One-to-many | FK on the "many" side (`orders.customer_id`) |
| Many-to-many | **Junction table** with a composite PK: `student_courses(student_id, course_id)` |

---

## 4️⃣ Other Database Objects

```sql
-- View: a saved query (no data stored)
CREATE VIEW paid_orders AS SELECT * FROM orders WHERE status = 'PAID';

-- Materialised view: stores the result; refresh it when needed
CREATE MATERIALIZED VIEW monthly_revenue AS
  SELECT date_trunc('month', created_at) AS month, SUM(amount) AS revenue
  FROM orders WHERE status = 'PAID' GROUP BY 1;
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;   -- needs a unique index

-- Trigger: keep updated_at current automatically
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

| Object | Use |
|---|---|
| View | Hide complex joins; limit which columns a role can see |
| Materialised view | Expensive reports refreshed every few minutes |
| Stored procedure / function | Logic close to the data (bulk jobs); harder to version and test |
| Trigger | Audit logs, `updated_at`, enforcing rules; hidden side effects, so use sparingly |

---

## 5️⃣ Security & Operations

### SQL injection

```python
# ❌ Never build SQL by joining strings with user input
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")   # email = "' OR '1'='1"

# ✅ Parameterised query: the driver sends the value separately from the SQL
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
```

```js
// Node (pg)
await pool.query("SELECT * FROM users WHERE email = $1", [email]);
```

Also: give the app a DB user with the least privilege it needs, and whitelist dynamic `ORDER BY` columns (they can't be parameterised).

### Connection pooling

Opening a connection costs a TCP + TLS + auth handshake, and each Postgres connection is a separate **process** (several MB of memory). Apps keep a **pool** of connections (SQLAlchemy pool, `pg.Pool`). With many app instances or serverless functions, put **PgBouncer** in front of Postgres.

### Scaling SQL

- **Vertical scaling** (a bigger machine) goes a long way.
- **Read replicas** with streaming replication: send reads to replicas, but watch for **replication lag** (read-your-own-writes problems).
- **Partitioning** (`PARTITION BY RANGE (created_at)`): split one big table into child tables inside the same database; old partitions can be dropped quickly.
- **Sharding:** split data across **separate** servers by a key (Citus, Vitess, application-level). It's complex, so do it last.
- **Caching:** Redis in front of hot queries.

## 🌍 Real-World Use

- Payment and wallet systems use transactions with `FOR UPDATE` or serializable isolation plus retries.
- E-commerce stock uses atomic `UPDATE ... WHERE stock > 0`.
- Job queues in Postgres use `FOR UPDATE SKIP LOCKED` (e.g. Graphile Worker, `pg-boss`).
- Slow-query fixes are almost always: `EXPLAIN ANALYZE` → add or adjust an index → rewrite the query.

## 🎯 Likely Interview Questions

1. **What is an index and how does a B-tree index work?**
2. **Clustered vs non-clustered index?**
3. **What is a composite index? Explain the leftmost-prefix rule.**
4. **When does the database NOT use an index?**
5. **What is a covering index / index-only scan?**
6. **What are the downsides of indexes?**
7. **How do you find out why a query is slow?** — `EXPLAIN ANALYZE`, look for seq scans and row estimate mismatches.
8. **What is ACID? Explain each letter.**
9. **What are the isolation levels and which anomalies does each prevent?** What are the Postgres and MySQL defaults?
10. **Dirty read vs non-repeatable read vs phantom read?**
11. **What is MVCC?**
12. **Optimistic vs pessimistic locking? When would you use `SELECT FOR UPDATE`?**
13. **What is a deadlock and how do you prevent it?**
14. **Explain 1NF, 2NF, 3NF with an example. What is BCNF?**
15. **What is denormalisation and when is it OK?**
16. **How do you model a many-to-many relationship?**
17. **View vs materialised view?**
18. **How do you prevent SQL injection?**
19. **Why use connection pooling? What is PgBouncer?**
20. **Partitioning vs sharding vs replication?**

---

[← Aggregation, Subqueries, CTEs & Window Functions](02-aggregation-subqueries-window-functions.md) | [Index](../README.md) | [Next: SQL Query Practice Problems →](04-sql-query-practice.md)
