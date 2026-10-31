# Chapter 100 — SQL Fundamentals & Joins

## 📖 Definition

**SQL (Structured Query Language)** is the standard language for working with **relational databases**. In a relational database, data is stored in **tables** (rows and columns), and tables are linked with **keys**. The popular ones are **PostgreSQL**, **MySQL / MariaDB**, **SQL Server**, **Oracle** and **SQLite**.

SQL is **declarative**: you describe *what* you want, and the database's **query planner** decides *how* to get it.

The examples in this section use **PostgreSQL**, the usual choice with FastAPI and Node (Prisma, TypeORM, Sequelize). Where MySQL is different, there's a note.

### SQL sub-languages

| Group | Commands | Purpose |
|---|---|---|
| **DDL**: Data Definition | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` | Define structure |
| **DML**: Data Manipulation | `INSERT`, `UPDATE`, `DELETE`, `MERGE` | Change rows |
| **DQL**: Data Query | `SELECT` | Read rows |
| **DCL**: Data Control | `GRANT`, `REVOKE` | Permissions |
| **TCL**: Transaction Control | `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` | Transactions |

## 🔍 MongoDB → SQL Vocabulary

| MongoDB | SQL |
|---|---|
| Database | Database / schema |
| Collection | Table |
| Document | Row |
| Field | Column |
| `_id` | Primary key |
| Embedded document / array | Separate table + foreign key (or `JSONB` column) |
| `$lookup` / `populate` | `JOIN` |
| Aggregation pipeline | `GROUP BY`, window functions, CTEs |
| `find({ age: { $gt: 18 } })` | `SELECT * FROM users WHERE age > 18` |
| Schema in Mongoose | Schema enforced by the database itself |

## 💻 The Sample Database (Used in Every SQL Chapter)

```sql
CREATE TABLE departments (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  dept_id     INT REFERENCES departments(id),       -- nullable: Neha has no department
  manager_id  INT REFERENCES employees(id),         -- self-reference
  salary      INT NOT NULL CHECK (salary > 0),
  hired_on    DATE NOT NULL
);

CREATE TABLE customers (
  id     SERIAL PRIMARY KEY,
  name   TEXT NOT NULL,
  email  TEXT UNIQUE,
  city   TEXT
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  customer_id  INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount       INT NOT NULL,                         -- store money as integer paise/cents
  status       TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  created_at   DATE NOT NULL DEFAULT CURRENT_DATE
);

INSERT INTO departments (id, name) VALUES
  (1, 'Engineering'), (2, 'Sales'), (3, 'HR'), (4, 'Legal');

INSERT INTO employees (id, name, dept_id, manager_id, salary, hired_on) VALUES
  (1, 'Asha',   1,    NULL, 200000, '2019-01-10'),
  (2, 'Ravi',   1,    1,    150000, '2020-03-15'),
  (3, 'Meera',  1,    1,    150000, '2021-06-01'),
  (4, 'Karan',  1,    2,     90000, '2022-08-20'),
  (5, 'Priya',  2,    1,    120000, '2020-11-05'),
  (6, 'John',   2,    5,    130000, '2023-01-09'),
  (7, 'Sara',   2,    5,     70000, '2023-04-17'),
  (8, 'Vikram', 3,    1,     80000, '2021-02-28'),
  (9, 'Neha',   NULL, 1,     60000, '2024-05-02');

INSERT INTO customers (id, name, email, city) VALUES
  (1, 'Anil', 'anil@x.com', 'Pune'),   (2, 'Bina', 'bina@x.com', 'Delhi'),
  (3, 'Chetan', 'chetan@x.com', 'Pune'), (4, 'Divya', 'divya@x.com', 'Mumbai'),
  (5, 'Esha', 'ANIL@x.com', 'Delhi');   -- a "duplicate" email with different case

INSERT INTO orders (id, customer_id, amount, status, created_at) VALUES
  (1, 1,  500, 'PAID',      '2026-01-05'), (2, 1, 1500, 'PAID',    '2026-01-20'),
  (3, 2,  700, 'PAID',      '2026-01-25'), (4, 2,  300, 'CANCELLED','2026-02-02'),
  (5, 3, 2500, 'PAID',      '2026-02-10'), (6, 1,  800, 'PAID',    '2026-02-14'),
  (7, 2, 1200, 'PAID',      '2026-03-01'), (8, 3,  400, 'PENDING', '2026-03-03'),
  (9, 1,  900, 'PAID',      '2026-03-18');
```

> In real Postgres projects, prefer `id INT GENERATED ALWAYS AS IDENTITY` (standard SQL) over `SERIAL`. MySQL uses `AUTO_INCREMENT`.

## 💻 Keys and Constraints

| Constraint | Meaning |
|---|---|
| `PRIMARY KEY` | Unique + not null; identifies each row; gets an index automatically |
| `FOREIGN KEY ... REFERENCES` | The value must exist in the other table (referential integrity) |
| `UNIQUE` | No duplicates (but multiple `NULL`s are allowed in Postgres) |
| `NOT NULL` | A value is required |
| `CHECK (expr)` | A custom rule |
| `DEFAULT` | The value used when none is given |

Foreign key actions: `ON DELETE CASCADE` (delete the children too), `SET NULL`, `RESTRICT` / `NO ACTION` (block the delete), `SET DEFAULT`.

**Key words to know:** a **candidate key** is any minimal set of columns that is unique; the **primary key** is the one you choose; an **alternate key** is any other candidate key; a **composite key** has more than one column; a **surrogate key** is a made-up ID (`SERIAL`, UUID); a **natural key** is real data (an email, a PAN number).

## 💻 Common Data Types (PostgreSQL)

| Type | Use |
|---|---|
| `INT`, `BIGINT`, `SMALLINT` | Whole numbers (`BIGINT` for IDs that grow large) |
| `NUMERIC(12, 2)` | Exact decimals for money (or store integer paise) |
| `REAL`, `DOUBLE PRECISION` | Approximate floats; never for money |
| `TEXT`, `VARCHAR(n)` | Strings (in Postgres, `TEXT` is just as fast) |
| `BOOLEAN` | true / false |
| `DATE`, `TIMESTAMPTZ` | Dates; **always use `TIMESTAMPTZ`** for moments in time |
| `UUID` | Globally unique IDs (`gen_random_uuid()`) |
| `JSONB` | Indexed binary JSON, for flexible data like Mongo documents |
| `TEXT[]` | Arrays |
| `ENUM` | `CREATE TYPE status AS ENUM (...)` |

## 💻 CRUD

```sql
-- Create
INSERT INTO customers (name, email, city)
VALUES ('Farah', 'farah@x.com', 'Goa')
RETURNING id;                                   -- Postgres: get the generated id back

-- Upsert: insert, or update if the unique key already exists
INSERT INTO customers (name, email, city) VALUES ('Farah', 'farah@x.com', 'Pune')
ON CONFLICT (email) DO UPDATE SET city = EXCLUDED.city;
-- MySQL: INSERT ... ON DUPLICATE KEY UPDATE city = VALUES(city)

-- Read
SELECT name, city FROM customers WHERE city = 'Pune' ORDER BY name LIMIT 10;

-- Update: ALWAYS check the WHERE clause first
UPDATE employees SET salary = salary * 1.10 WHERE dept_id = 2;

-- Delete
DELETE FROM orders WHERE status = 'CANCELLED' AND created_at < CURRENT_DATE - INTERVAL '1 year';
```

### DELETE vs TRUNCATE vs DROP

| | `DELETE` | `TRUNCATE` | `DROP` |
|---|---|---|---|
| Removes | Chosen rows (`WHERE`) | All rows | The whole table (structure too) |
| Speed | Slower (row by row, logged) | Very fast | Fast |
| Triggers fire | Yes | No (no row triggers) | No |
| Rollback | Yes | Yes in Postgres; **no in MySQL** (it auto-commits) | Yes in Postgres; no in MySQL |
| Resets identity | No | With `RESTART IDENTITY` | n/a |

## 💻 Filtering

```sql
SELECT * FROM employees
WHERE salary BETWEEN 80000 AND 150000          -- inclusive on both ends
  AND name ILIKE 'a%'                          -- Postgres case-insensitive LIKE; % = any characters, _ = one character
  AND dept_id IN (1, 2)
  AND manager_id IS NOT NULL;                  -- never use "= NULL"

SELECT DISTINCT city FROM customers;
SELECT name, COALESCE(dept_id::text, 'No department') AS dept FROM employees;   -- first non-null value
SELECT NULLIF(amount, 0) FROM orders;          -- NULL if amount = 0 (avoids division by zero)
```

### NULL logic (three-valued logic)

`NULL` means "unknown". Any comparison with `NULL` gives **UNKNOWN**, not TRUE or FALSE, and `WHERE` keeps only TRUE rows.

```sql
SELECT NULL = NULL;      -- NULL (not true!)
SELECT NULL IS NULL;     -- true
SELECT 1 + NULL;         -- NULL
-- COUNT(*) counts rows; COUNT(col) skips NULLs; SUM/AVG ignore NULLs
SELECT COUNT(*), COUNT(dept_id), COUNT(DISTINCT dept_id) FROM employees;   -- 9 | 8 | 3
```

Postgres also has `IS DISTINCT FROM`, a comparison that treats NULLs as equal to each other.

### CASE

```sql
SELECT name, salary,
  CASE
    WHEN salary >= 150000 THEN 'Senior'
    WHEN salary >= 100000 THEN 'Mid'
    ELSE 'Junior'
  END AS band
FROM employees;
```

## 🔍 Logical Order of Execution (Very Common Question)

You **write** a query in this order: `SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT`.

The database **evaluates** it in this order:

```
1. FROM / JOIN      → build the combined rows
2. WHERE            → filter rows            (no aggregates; SELECT aliases don't exist yet)
3. GROUP BY         → make groups
4. HAVING           → filter groups          (aggregates allowed)
5. SELECT           → compute columns, aliases, window functions
6. DISTINCT
7. ORDER BY         → can use SELECT aliases
8. LIMIT / OFFSET
```

That's why `WHERE total > 100` fails when `total` is a `SELECT` alias, while `ORDER BY total` works. It's also why you can't put `COUNT(*)` in `WHERE`.

## 💻 Joins

```
employees (9 rows; Neha has dept_id NULL)      departments (4 rows; Legal has no employees)
```

| Join | Returns | Rows here |
|---|---|---|
| `INNER JOIN` | Only matching pairs | **8** (Neha dropped) |
| `LEFT JOIN` | All left rows + matches (NULLs where none) | **9** (Neha with NULL dept) |
| `RIGHT JOIN` | All right rows + matches | **9** (Legal with NULL employee) |
| `FULL OUTER JOIN` | Everything from both sides | **10** (Neha + Legal) |
| `CROSS JOIN` | Every combination (Cartesian product) | **36** (9 × 4) |

These counts were checked against the sample data.

```sql
-- INNER: employees with their department name
SELECT e.name, d.name AS dept
FROM employees e
JOIN departments d ON d.id = e.dept_id;

-- LEFT: keep employees without a department
SELECT e.name, COALESCE(d.name, '—') AS dept
FROM employees e
LEFT JOIN departments d ON d.id = e.dept_id;

-- Anti-join: customers who never ordered (Divya, Esha)
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;

-- FULL: unmatched rows from both sides
SELECT e.name, d.name
FROM employees e
FULL JOIN departments d ON d.id = e.dept_id
WHERE e.id IS NULL OR d.id IS NULL;            -- Neha | NULL, NULL | Legal
-- MySQL has no FULL JOIN: use LEFT JOIN UNION RIGHT JOIN
```

### Self join: a table joined to itself

```sql
-- Each employee with their manager's name
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;  -- LEFT so Asha (no manager) still appears
```

### Filtering in `ON` vs `WHERE` with a LEFT JOIN (classic trap)

```sql
-- Keeps ALL customers; only PAID orders are attached
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'PAID';

-- Silently becomes an INNER JOIN: customers without PAID orders disappear,
-- because o.status is NULL for them and NULL = 'PAID' is not true
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'PAID';
```

### Joins can multiply rows

Joining `customers` → `orders` → `order_items` gives one row per **item**. If you then `SUM(orders.amount)`, each order is counted once per item. Aggregate in a subquery or CTE **before** joining, or use `COUNT(DISTINCT ...)`.

### Other join types

- **Natural join / `USING (col)`**: joins on columns with the same name. Avoid `NATURAL` (it breaks silently when a column is added).
- **Semi-join**: `WHERE EXISTS (SELECT 1 FROM ...)` returns left rows that have a match, without duplicating them.
- **`LATERAL` join** (Postgres): a subquery that can refer to the outer row, e.g. "the latest 3 orders per customer".

```sql
SELECT c.name, recent.id, recent.amount
FROM customers c
CROSS JOIN LATERAL (
  SELECT o.id, o.amount FROM orders o
  WHERE o.customer_id = c.id
  ORDER BY o.created_at DESC
  LIMIT 2
) AS recent;
```

## 💻 Set Operations

```sql
SELECT city FROM customers
UNION                    -- combines and REMOVES duplicates (sorts or hashes: slower)
SELECT 'Bengaluru';

SELECT email FROM customers
UNION ALL                -- keeps duplicates: faster; use it when duplicates are impossible or fine
SELECT email FROM newsletter_subscribers;

SELECT customer_id FROM orders WHERE status = 'PAID'
INTERSECT                -- in both
SELECT customer_id FROM orders WHERE status = 'CANCELLED';   -- 2 (Bina)

SELECT id FROM customers
EXCEPT                   -- in the first but not the second (Oracle: MINUS)
SELECT customer_id FROM orders;                               -- 4, 5
```

Both queries must have the **same number of columns** with **compatible types**.

## 🌍 Real-World Use

- Postgres is the default relational database for most new FastAPI, Django, Rails and Node projects. MySQL is common in PHP and older stacks.
- Financial systems, inventory, bookings, and anything that needs **joins, constraints and transactions** fits SQL better than a document store.
- Many MERN teams use both: MongoDB for flexible product catalogues, Postgres for orders and payments.

## 🎯 Likely Interview Questions

1. **What is SQL? DDL vs DML vs DCL vs TCL?**
2. **Primary key vs unique key vs foreign key?**
3. **What is a composite key? Surrogate vs natural key?**
4. **`DELETE` vs `TRUNCATE` vs `DROP`?**
5. **`WHERE` vs `HAVING`?**
6. **What is the logical order in which a SELECT is evaluated?** Why can't you use an alias in `WHERE`?
7. **Explain INNER, LEFT, RIGHT, FULL and CROSS joins.** How many rows does each return here?
8. **What is a self join? Give an example.**
9. **How do you find rows in A with no match in B?** — `LEFT JOIN ... IS NULL`, or `NOT EXISTS`.
10. **Why does a `WHERE` on the right table turn a LEFT JOIN into an INNER JOIN?**
11. **`UNION` vs `UNION ALL`?**
12. **How does `NULL` behave in comparisons and aggregates?**
13. **`COUNT(*)` vs `COUNT(col)` vs `COUNT(DISTINCT col)`?**
14. **`CHAR` vs `VARCHAR` vs `TEXT`?**
15. **How do you do an upsert in Postgres and in MySQL?**

---

[← Python Interview Questions](../31-python-advanced/05-python-interview-questions.md) | [Index](../README.md) | [Next: Aggregation, Subqueries, CTEs & Window Functions →](02-aggregation-subqueries-window-functions.md)
