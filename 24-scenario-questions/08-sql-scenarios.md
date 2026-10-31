# Chapter 141 — SQL Scenarios

## 📖 Definition

SQL scenario questions describe a production database problem (a slow query, deadlocks, overselling, a migration that locked a table, replica lag, a full disk) and ask how you'd handle it. Answer with **clarify → hypothesise → verify → fix → prevent**, and name the tools: `EXPLAIN ANALYZE`, `pg_stat_statements`, `pg_stat_activity`, `pg_locks`, the slow-query log.

The examples use **PostgreSQL**; MySQL equivalents are noted where they differ.

---

### Scenario 1 — "An orders page that was instant is now taking 8 seconds."

**Clarify:** all users or only big customers? Since a deploy, or gradually as data grew?

**Verify**
- `pg_stat_statements` → the queries with the highest `total_exec_time` and `mean_exec_time`.
- `EXPLAIN (ANALYZE, BUFFERS)` on the slow query → a `Seq Scan` on a big table, a `Sort` spilling to disk, or **estimated rows far from actual rows**.

**Common causes and fixes**
- **Missing composite index** for `WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20` → `CREATE INDEX CONCURRENTLY ON orders (customer_id, created_at DESC);`
- **A function on the column** (`WHERE DATE(created_at) = ...`) → rewrite as a range: `created_at >= $1 AND created_at < $2`.
- **Large `OFFSET`** → keyset pagination.
- **Stale statistics** after a bulk import → `ANALYZE orders;`
- **N+1 from the ORM** → eager loading (`selectinload` / `include`).

**Prevent:** slow-query logging (`log_min_duration_statement = 500ms`), p95 latency alerts per endpoint, `EXPLAIN` in code review for new queries.

---

### Scenario 2 — "Two customers bought the last ticket; we oversold."

**Cause:** a **read-then-write race**: both requests ran `SELECT stock` (1), both passed the check in app code, then both ran `UPDATE stock = stock - 1`.

**Fix (pick by situation)**
- **Atomic conditional update** (best for counters): `UPDATE tickets SET stock = stock - 1 WHERE id = $1 AND stock > 0;` → 0 rows changed = sold out.
- **Pessimistic lock** when the logic is more complex: `BEGIN; SELECT ... FOR UPDATE; ...checks...; UPDATE ...; COMMIT;`
- **Seat booking:** a unique constraint on `(event_id, seat_no)` in a `bookings` table, so the database rejects the second insert.
- **Serializable isolation** + retry on `40001`, for rules spread across several rows.

**Prevent:** `CHECK (stock >= 0)`; a concurrency test that fires 50 parallel purchases and asserts exactly N succeed.

---

### Scenario 3 — "We're seeing `deadlock detected` errors in the logs."

**Cause:** two transactions lock the same rows in **opposite order**. A transfer A→B locks A then B, while B→A locks B then A.

**Verify:** the Postgres log shows both statements and the lock graph; `log_lock_waits = on` shows long waits.

**Fix**
- **Lock in a consistent order:** `SELECT ... WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`.
- **Keep transactions short:** no HTTP calls, emails or user input inside them.
- **Retry** the aborted transaction (the error is safe to retry), with a small backoff.
- Bulk updates in a stable `ORDER BY` and in smaller batches.

---

### Scenario 4 — "A migration took down production for 10 minutes."

**Cause:** DDL that takes an **`ACCESS EXCLUSIVE` lock** for a long time, or waits behind a long-running query while every new query queues behind it:
- `ALTER TABLE ... ADD COLUMN ... DEFAULT <volatile>` that rewrites the table (adding a **constant** default is instant in Postgres 11+)
- `CREATE INDEX` without `CONCURRENTLY`
- `ALTER COLUMN TYPE`
- `ADD CONSTRAINT ... FOREIGN KEY` / `NOT NULL` checked against every row at once

**Safe pattern (expand → migrate → contract)**
1. Set `lock_timeout = '3s'`, so a migration fails fast instead of blocking everyone.
2. `CREATE INDEX CONCURRENTLY`.
3. Add constraints as `NOT VALID`, then `VALIDATE CONSTRAINT` separately (it doesn't block writes).
4. For a column rename or type change: add the new column → write to both → backfill **in batches** → switch reads → drop the old one in a later release.

**Prevent:** a migration review checklist; run migrations against a production-sized copy first; tools like `squawk` or `strong_migrations` that lint for unsafe DDL.

---

### Scenario 5 — "Users update their profile, but the page still shows old data."

**Clarify:** does it fix itself after a few seconds? Is there a cache or read replica?

**Causes**
1. **Read replica lag:** the write went to the primary, the next read went to a replica that hasn't caught up.
2. **Stale cache:** Redis or the CDN still holds the old value; invalidation was missed.
3. **The transaction wasn't committed** (an ORM session that was never committed, or autocommit off).

**Fix**
- **Read-your-own-writes:** send the user's reads to the primary for a few seconds after a write (a "recent writer" flag in the session), or use the returned row from `UPDATE ... RETURNING *`.
- Invalidate the cache **after** the commit.
- Monitor replica lag (`pg_stat_replication`, `replay_lag`).

---

### Scenario 6 — "The database ran out of connections (`too many clients already`)."

**Cause:** `app instances × workers × pool size` is bigger than `max_connections`. Or connections **leak** (sessions never closed), or serverless functions each open new connections. Postgres uses one process per connection, so raising `max_connections` a lot isn't the answer.

**Verify:** `SELECT state, count(*) FROM pg_stat_activity GROUP BY state;`. Many `idle in transaction` connections mean leaks or transactions left open.

**Fix**
- Right-size the pools (`pool_size` per worker × workers ≤ what the database can handle).
- **PgBouncer** in transaction-pooling mode in front of Postgres.
- Make sure sessions are always closed (a `yield` dependency / `try/finally`).
- `idle_in_transaction_session_timeout` to kill forgotten transactions.

---

### Scenario 7 — "The disk on the database server is nearly full, but row counts haven't changed much."

**Causes**
- **Table and index bloat:** Postgres MVCC leaves dead row versions behind after `UPDATE` / `DELETE`. Autovacuum can't keep up, or is blocked by a **long-running transaction** that holds an old snapshot.
- Unused or duplicate **indexes**.
- **WAL** piling up because a replication slot is inactive.
- Huge log or audit tables with no retention.

**Fix:** find and end long transactions; tune autovacuum for hot tables; `pg_repack` (online) to reclaim space; drop unused indexes (`pg_stat_user_indexes.idx_scan = 0`); drop dead replication slots; **partition** log tables by month and drop old partitions.

---

### Scenario 8 — "A report query slows down the whole app every morning at 9 am."

**Cause:** heavy analytics (full-table aggregates) running on the **same primary** as the user-facing traffic, competing for CPU, I/O and cache.

**Fix**
- Run reports on a **read replica** or a **warehouse** (BigQuery, Snowflake, ClickHouse).
- **Materialised views** refreshed on a schedule (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).
- Pre-aggregate into summary tables (daily totals) updated by a job.
- Set `statement_timeout` for the reporting role.

---

### Scenario 9 — "We found duplicate users with the same email."

**Cause:** the uniqueness check was done **in application code** (`SELECT` then `INSERT`), which races under concurrency. Or emails differ only by case or spaces.

**Fix**
1. Clean up: merge or delete duplicates, keeping the oldest (`ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY created_at)`), and move their related rows to the kept user.
2. `CREATE UNIQUE INDEX CONCURRENTLY users_email_uq ON users (LOWER(email));`
3. Normalise emails on write, and handle the unique-violation error (`23505`) in the API as **409 Conflict**.

**Lesson:** *constraints in the database are the only reliable uniqueness check.*

---

### Scenario 10 — "Should we move from MongoDB to PostgreSQL?"

**Clarify the real problem first:** Is it complex reporting with joins? Consistency across documents (payments)? Schema drift? Or just a slow query that an index would fix?

**Reasoning**
- Postgres is a good fit for **relational data, multi-row transactions, joins and reporting**. `JSONB` covers flexible attributes.
- MongoDB is a good fit for **document-shaped, evolving data**, very high write volume with simple access patterns, and built-in horizontal sharding.
- A **partial move** is common: orders and payments in Postgres, catalogue and events in MongoDB.

**Migration plan (if justified):** design the relational schema → dual-write or change-data-capture → backfill → verify with comparison checks → switch reads → switch writes → retire. Never a big-bang weekend migration.

---

### Scenario 11 — "A `DELETE` without a `WHERE` was run in production."

**Now:** stop writes to the affected tables if possible. Recover with **point-in-time recovery (PITR)** to just before the statement, into a **separate** instance, then copy the lost rows back. Don't overwrite production with a full restore.

**Prevent**
- Least-privilege roles (app users can't `TRUNCATE`; humans use read-only by default).
- `BEGIN; ... ; SELECT count(*) ...; COMMIT` habits, `--safe-updates` in MySQL.
- Tested backups (a backup you've never restored is a hope, not a backup).
- **Soft deletes** for user data; audit logs; change review for manual production queries.

---

### Scenario 12 — "Search with `LIKE '%term%'` is slow on a 20-million-row products table."

**Cause:** a leading wildcard can't use a B-tree index, so every search is a full scan.

**Fix (by need)**
- Prefix search only: `LIKE 'term%'` with a `text_pattern_ops` B-tree index.
- Substring and typo tolerance: the **`pg_trgm`** extension + a GIN index: `CREATE INDEX ... USING gin (name gin_trgm_ops);`
- Real search (ranking, stemming, synonyms): Postgres **full-text search** (`tsvector` + GIN), or a search engine (OpenSearch, Meilisearch, Typesense) kept in sync by events or CDC.

---

## 🎯 What Interviewers Are Scoring

- You reach for **evidence first**: `EXPLAIN ANALYZE`, `pg_stat_statements`, `pg_stat_activity`, logs.
- You know the classic database bugs: **missing indexes, races (read-then-write), deadlocks, locking migrations, replica lag, connection exhaustion, bloat**.
- Your fixes use the **database's guarantees** (constraints, atomic updates, transactions), not only app code.
- You think about **safety**: `CONCURRENTLY`, `lock_timeout`, batches, PITR, least privilege.

---

[← GraphQL Scenarios](07-graphql-scenarios.md) | [Index](../README.md) | [Next: Python & FastAPI Scenarios →](09-python-fastapi-scenarios.md)
