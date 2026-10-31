# Chapter 104 — SQL Interview Questions (Detailed Answers)

## 📖 How to Use This Chapter

These are the SQL questions asked in full-stack and backend interviews, with answers short enough to say out loud. For the hands-on query problems, see [SQL Query Practice Problems](04-sql-query-practice.md).

---

## 1️⃣ Basics

### 1. What is a relational database? What is an RDBMS?

A relational database stores data in **tables** of rows and columns. Tables are linked by **keys**, and the data is queried with SQL. An **RDBMS** is the software that manages it (PostgreSQL, MySQL, SQL Server, Oracle). It enforces the schema and constraints, runs transactions with ACID guarantees, and plans queries.

### 2. SQL vs NoSQL (e.g. PostgreSQL vs MongoDB)?

| | SQL (Postgres) | NoSQL document (MongoDB) |
|---|---|---|
| Schema | Fixed, enforced by the database | Flexible, per document (enforce it in the app or with JSON schema) |
| Relationships | Joins + foreign keys | Embed or reference; `$lookup` |
| Transactions | Strong, multi-row, the default | Multi-document since 4.0, but costlier |
| Scaling | Vertical + read replicas; sharding is harder | Built-in horizontal sharding |
| Best for | Financial data, complex queries, strong integrity | Fast-changing schemas, nested aggregates, high write volume |

**A good answer:** "Choose based on the data's relationships and consistency needs, not hype. Postgres with `JSONB` covers many flexible-schema cases too."

### 3. What are DDL, DML, DCL and TCL?

- **DDL:** `CREATE`, `ALTER`, `DROP`, `TRUNCATE` (structure).
- **DML:** `INSERT`, `UPDATE`, `DELETE` (data).
- **DQL:** `SELECT`.
- **DCL:** `GRANT`, `REVOKE` (permissions).
- **TCL:** `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` (transactions).

### 4. Primary key vs unique key vs foreign key?

- A **primary key** uniquely identifies each row. It can't be NULL, there's one per table, and it's indexed automatically.
- A **unique key** blocks duplicates. A table can have many, and they usually allow NULLs.
- A **foreign key** says the value must exist in the referenced table's key. It enforces referential integrity, with actions like `ON DELETE CASCADE`.

### 5. What is a composite key? Surrogate vs natural key?

A **composite key** has more than one column (`(student_id, course_id)` in a junction table). A **surrogate key** is a meaningless generated ID (`IDENTITY`, UUID). It's stable and compact. A **natural key** is real data (email, ISBN). It's meaningful, but it can change. Most apps use surrogate PKs with `UNIQUE` constraints on the natural keys.

### 6. `DELETE` vs `TRUNCATE` vs `DROP`?

`DELETE` removes chosen rows, is logged row by row, fires triggers, and can be rolled back. `TRUNCATE` quickly removes **all** rows (in Postgres it's transactional; in MySQL it's DDL that commits automatically). `DROP` removes the table itself.

### 7. `CHAR` vs `VARCHAR` vs `TEXT`?

`CHAR(n)` is fixed length and padded with spaces. `VARCHAR(n)` is variable length with a maximum. In Postgres, `TEXT` has no limit and is just as fast as `VARCHAR`. Use `VARCHAR(n)` or a `CHECK` only when the limit is a real business rule.

### 8. What does NULL mean? How does it behave?

`NULL` means unknown or missing. Comparisons with NULL give UNKNOWN, so `WHERE col = NULL` never matches; use `IS NULL`. Arithmetic with NULL gives NULL. Aggregates skip NULLs (except `COUNT(*)`). `NOT IN` against a list that contains a NULL returns no rows. Tools: `COALESCE`, `NULLIF`, `IS DISTINCT FROM`.

### 9. `WHERE` vs `HAVING`?

`WHERE` filters **rows before** grouping and can't use aggregates. `HAVING` filters **groups after** `GROUP BY` and can use aggregates. Put as much as possible in `WHERE`, so fewer rows get grouped.

### 10. What is the logical order of a SELECT query?

`FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT (window functions) → DISTINCT → ORDER BY → LIMIT`. That's why a SELECT alias works in `ORDER BY` but not in `WHERE`.

### 11. `COUNT(*)` vs `COUNT(1)` vs `COUNT(col)`?

`COUNT(*)` and `COUNT(1)` both count rows, and perform the same in modern databases. `COUNT(col)` counts rows where `col` is **not NULL**. `COUNT(DISTINCT col)` counts unique non-null values.

### 12. `UNION` vs `UNION ALL`?

`UNION` removes duplicates, which needs a sort or hash, so it's slower. `UNION ALL` keeps every row and is faster. Use `UNION ALL` unless you really need to remove duplicates.

---

## 2️⃣ Joins & Subqueries

### 13. Explain the join types.

- **INNER:** only matching rows.
- **LEFT:** all left rows, NULLs where there's no match.
- **RIGHT:** the mirror of LEFT.
- **FULL OUTER:** all rows from both sides.
- **CROSS:** every combination.
- **SELF:** a table joined to itself (employee → manager).

On the sample data (9 employees, 4 departments, one employee without a department, one department without employees): inner 8, left 9, right 9, full 10, cross 36.

### 14. How do you find records in one table that have no match in another?

`LEFT JOIN b ON ... WHERE b.id IS NULL` (an anti-join), or `WHERE NOT EXISTS (SELECT 1 FROM b WHERE ...)`. **Avoid `NOT IN`** if the subquery's column can be NULL.

### 15. Why can a WHERE clause turn a LEFT JOIN into an INNER JOIN?

For unmatched rows, the right table's columns are NULL. A condition like `WHERE right.status = 'PAID'` is UNKNOWN for those rows, so they're removed. Put conditions on the right table in the **`ON`** clause to keep the unmatched left rows.

### 16. Subquery vs JOIN: which is better?

They often give the same plan, because the optimiser rewrites one into the other. Use JOINs when you need columns from both tables. Use `EXISTS` subqueries when you're only checking that something exists (no duplicate rows). Correlated subqueries can run once per row, so if one is slow, rewrite it as a join or window function. Always check with `EXPLAIN`.

### 17. What is a correlated subquery?

A subquery that refers to a column of the outer query, so in logic it's evaluated **for each outer row**. Example: `WHERE salary > (SELECT AVG(salary) FROM employees x WHERE x.dept_id = e.dept_id)`.

### 18. `IN` vs `EXISTS`?

`IN` compares against a list of values. `EXISTS` checks whether the subquery returns any row, and stops at the first one. For large subqueries, `EXISTS` is often faster. `NOT EXISTS` is safe with NULLs; `NOT IN` is not.

### 19. What is a CTE? CTE vs subquery vs temporary table vs view?

- A **CTE** (`WITH name AS (...)`) is a named subquery for **one statement**. It makes queries readable and can be **recursive**.
- A **subquery** is the same thing, just unnamed and inline.
- A **temporary table** stores the data for the whole session. You can index it and use it across several queries.
- A **view** is a saved query stored in the database and reusable by everyone.
- A **materialised view** stores the result itself.

### 20. What is a recursive CTE used for?

Hierarchies and graphs: org charts, category trees, threaded comments, bill-of-materials, and generating series. It has an **anchor** query and a **recursive** query joined with `UNION ALL`. It stops when the recursive step returns no new rows.

---

## 3️⃣ Aggregation & Window Functions

### 21. What are window functions?

Functions that calculate over a set of rows related to the current row (`OVER (PARTITION BY ... ORDER BY ...)`) **without collapsing rows**, unlike GROUP BY. They're used for rankings (`ROW_NUMBER`, `RANK`, `DENSE_RANK`), running totals (`SUM() OVER`), moving averages, `LAG`/`LEAD`, and percentage of total.

### 22. ROW_NUMBER vs RANK vs DENSE_RANK?

For salaries 200, 150, 150, 90:
- `ROW_NUMBER`: 1, 2, 3, 4 (always unique).
- `RANK`: 1, 2, 2, **4** (ties share a rank, then a gap).
- `DENSE_RANK`: 1, 2, 2, **3** (no gaps).

Use `DENSE_RANK` for "Nth highest salary", and `ROW_NUMBER` for de-duplication or "latest row per group".

### 23. How do you get the Nth highest salary?

`SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET N-1`, or `DENSE_RANK() OVER (ORDER BY salary DESC) = N` in a subquery (which also works per department with `PARTITION BY`). For the second highest, there's also `MAX(salary) WHERE salary < (SELECT MAX(salary) ...)`.

### 24. How do you get the top N rows per group?

`ROW_NUMBER()` or `DENSE_RANK() OVER (PARTITION BY group ORDER BY metric DESC)` in a CTE or subquery, then filter `WHERE rn <= N` outside it. In Postgres, `DISTINCT ON` works for N = 1, and `LATERAL` with `LIMIT N` for small N.

### 25. What is a window frame?

The set of rows inside the partition that the function looks at, e.g. `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` for a 3-row moving average. With `ORDER BY` and no frame, the default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which groups rows with the same sort value together (watch for ties).

### 26. How do you find consecutive days or values (gaps and islands)?

Subtract `ROW_NUMBER()` from the date (or the sequence value). For consecutive rows, the difference stays constant, so `GROUP BY` that difference to get each streak, and use `MIN`, `MAX` and `COUNT` for its start, end and length. `LAG()` also lets you find gaps directly.

---

## 4️⃣ Indexes & Performance

### 27. What is an index? How does it work?

A separate, sorted data structure (usually a **B-tree**) that maps column values to row locations. Lookups are O(log n) instead of a full scan. It speeds up `WHERE`, `JOIN`, `ORDER BY` and `GROUP BY`, but slows writes and uses storage.

### 28. Clustered vs non-clustered index?

A **clustered** index decides the physical order of rows, so there's only one per table (InnoDB clusters on the PK). A **non-clustered** index is separate and points to the rows; there can be many. Postgres stores tables as heaps, so all its indexes are non-clustered.

### 29. What is a composite index and the leftmost-prefix rule?

An index on several columns, `(a, b, c)`. It helps queries that filter on `a`, on `a, b`, or on `a, b, c`, but usually not on `b` alone or `c` alone. Order the columns as **equality → sort → range**.

### 30. What is a covering index?

An index that contains every column a query needs, so the database can answer from the index alone (an "index-only scan") without reading the table. In Postgres, `CREATE INDEX ... (customer_id) INCLUDE (amount, status)`.

### 31. When will an index not be used?

When there's a function on the column (`LOWER(col)` without an expression index), a leading-wildcard `LIKE '%x'`, a type mismatch or implicit cast, low selectivity (most rows match), stale statistics, very small tables, or some `OR` conditions.

### 32. How do you optimise a slow query?

1. Run `EXPLAIN ANALYZE` and find seq scans on big tables, expensive sorts, and estimates far from actual rows.
2. Add the right index (composite or covering) and select only the columns you need.
3. Rewrite: avoid functions on indexed columns, replace correlated subqueries, use `EXISTS`, paginate with **keyset** (`WHERE id > last_id`) instead of a large `OFFSET`.
4. Fix N+1 queries in the ORM.
5. Run `ANALYZE` / `VACUUM`, cache hot results, use materialised views or partitioning for very large tables.

### 33. Why is `OFFSET` pagination slow on big tables?

`OFFSET 100000` still reads and throws away 100,000 rows. **Keyset (cursor) pagination**, `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20`, jumps straight there through the index.

---

## 5️⃣ Transactions & Concurrency

### 34. What is ACID?

- **Atomicity:** all or nothing.
- **Consistency:** constraints always hold.
- **Isolation:** concurrent transactions don't interfere.
- **Durability:** committed data survives crashes, thanks to the write-ahead log.

### 35. Explain the isolation levels.

- **Read Uncommitted:** allows dirty reads.
- **Read Committed** (the Postgres default): each statement sees committed data, but repeated reads can change.
- **Repeatable Read** (the MySQL InnoDB default): one snapshot for the whole transaction.
- **Serializable:** the result is as if transactions ran one after another; you must retry on failure.

Higher isolation means fewer anomalies, but more blocking or retries.

### 36. Dirty read vs non-repeatable read vs phantom read?

- **Dirty read:** reading another transaction's uncommitted change.
- **Non-repeatable read:** the same row read twice gives different values.
- **Phantom read:** the same query returns new rows the second time because of inserts.

### 37. What is MVCC?

Multi-Version Concurrency Control. The database keeps multiple versions of each row, and every transaction reads from a consistent snapshot. Readers don't block writers, and writers don't block readers. Old versions are cleaned up by VACUUM (Postgres) or the purge thread (InnoDB).

### 38. Optimistic vs pessimistic locking?

- **Pessimistic:** lock the row before changing it (`SELECT ... FOR UPDATE`); others wait. Good when conflicts are frequent (seat booking, stock in a flash sale).
- **Optimistic:** don't lock. Check a `version` column in the `UPDATE ... WHERE version = n`, and retry if 0 rows changed. Good when conflicts are rare. It's the usual choice in web apps and ORMs.

### 39. How do you stop two users from buying the last item?

Use an atomic conditional update: `UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0` and check that 1 row was affected. Or, in a transaction, `SELECT ... FOR UPDATE`, check, then update. Add `CHECK (stock >= 0)` as a safety net.

### 40. What is a deadlock? How do you handle it?

Two transactions each hold a lock the other one needs. The database detects it and aborts one of them. Prevent it by locking rows in a consistent order and keeping transactions short. Handle it by retrying the aborted transaction.

---

## 6️⃣ Design

### 41. What is normalisation? Explain 1NF, 2NF and 3NF.

Organising tables to remove redundancy and update anomalies:
- **1NF:** atomic values, no repeating groups.
- **2NF:** no partial dependency on part of a composite key.
- **3NF:** no transitive dependency (non-key columns depend only on the key).

"The key, the whole key, and nothing but the key." **BCNF:** every determinant is a candidate key.

### 42. What is denormalisation and when should you use it?

Adding redundant data on purpose (stored totals, cached counts, reporting tables, materialised views) to avoid expensive joins on read-heavy paths. Use it after measuring a real performance problem, and keep the copies in sync with transactions, triggers or events.

### 43. How do you model many-to-many?

With a junction table holding two foreign keys and a composite primary key: `enrollments(student_id, course_id, enrolled_at, PRIMARY KEY (student_id, course_id))`. Extra columns about the relationship (grade, role) go in the junction table.

### 44. How would you design tables for an e-commerce order system?

`users`, `addresses`, `products`, `orders(id, user_id, status, total, created_at)`, `order_items(order_id, product_id, quantity, unit_price)`, `payments(order_id, provider, status, amount)`.

Talking points:
- Store the price at purchase time in `order_items`.
- Store money as integers or `NUMERIC`.
- Put indexes on the foreign keys and on `(user_id, created_at)`.
- Use transactions for checkout, and an idempotency key on payments.

### 45. What are views, stored procedures and triggers? Pros and cons?

- A **view** is a saved query, used for simpler reads and restricting columns.
- A **stored procedure or function** keeps logic inside the database: it's fast for bulk work, but harder to test and version.
- A **trigger** runs automatically on INSERT, UPDATE or DELETE (audit logs, `updated_at`); its side effects are hidden.

Most modern apps keep business logic in the application and use these sparingly.

---

## 7️⃣ Security, Scaling & ORMs

### 46. How do you prevent SQL injection?

Always use **parameterised queries or prepared statements** (`$1` / `%s` placeholders, or an ORM). Never put user input into SQL strings. Validate input, whitelist dynamic identifiers like `ORDER BY` columns, and use a database user with only the privileges it needs.

### 47. What is connection pooling and why is it needed?

Opening a database connection is expensive, and Postgres uses a process per connection. A pool keeps a fixed set of connections open and reuses them across requests. Size the pool based on database capacity, not traffic. Use PgBouncer when there are many app instances or serverless functions.

### 48. Replication vs partitioning vs sharding?

- **Replication:** copies of the whole database (a primary plus read replicas) for read scaling and failover; watch for replication lag.
- **Partitioning:** splits a big table into child tables **inside one database** (by date or range).
- **Sharding:** splits data **across several databases or servers** by a key, for write scaling. It's complex: cross-shard joins and transactions are hard.

### 49. What is the N+1 query problem with ORMs?

Loading a list (1 query), then lazily loading a relation for each item (N queries). Fix it with eager loading: a JOIN or a second `IN` query (`selectinload` / `joinedload` in SQLAlchemy, `include` in Prisma, `populate` in Mongoose).

### 50. ORM vs raw SQL?

An ORM (SQLAlchemy, Prisma, TypeORM) gives productivity, type safety, migrations and protection from injection. Raw SQL gives full control over complex reporting queries and performance tuning. Most teams use the ORM by default, and raw SQL (still parameterised) for the hard queries, checking ORM-generated SQL with logging or `EXPLAIN`.

---

## ⚡ Rapid-Fire Round

| Question | Answer |
|---|---|
| Default isolation in Postgres / MySQL? | Read Committed / Repeatable Read |
| Can a table have two primary keys? | No, but one PK can span several columns |
| Can a UNIQUE column have NULLs? | Yes; several NULLs are allowed in Postgres (unless `NULLS NOT DISTINCT`) |
| Fastest way to empty a table? | `TRUNCATE` |
| Get the inserted id in Postgres? | `INSERT ... RETURNING id` |
| Upsert in Postgres? | `INSERT ... ON CONFLICT (col) DO UPDATE` |
| Case-insensitive match in Postgres? | `ILIKE`, or `LOWER(col) =` with an expression index |
| Top row per group in Postgres? | `DISTINCT ON (group) ... ORDER BY group, metric DESC` |
| Store money? | `NUMERIC(12,2)` or an integer in the smallest unit; never `FLOAT` |
| Store timestamps? | `TIMESTAMPTZ` (in UTC) |
| JSON in Postgres? | `JSONB` with a GIN index |
| Remove duplicates from a result? | `DISTINCT` or `GROUP BY` |
| Check a query plan? | `EXPLAIN ANALYZE` |
| Clean up dead rows in Postgres? | `VACUUM` (autovacuum) |
| What is a schema migration? | A versioned DDL change script (Alembic, Prisma Migrate, Flyway) |

---

[← SQL Query Practice Problems](04-sql-query-practice.md) | [Index](../README.md) | [Next: FastAPI Fundamentals →](../30-fastapi/01-fastapi-fundamentals.md)
