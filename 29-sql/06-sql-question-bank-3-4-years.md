# Chapter 105 — SQL Question Bank for 3–4 Years Experience

## 📖 How to Use This Chapter

This chapter answers the **topic-wise question list** that interviewers use for developers with 3–4 years of experience. It follows the order of that list: fundamentals, joins, aggregation, subqueries and CTEs, query problems, window functions, indexing, transactions, advanced concepts and practical queries.

**How each answer is written:** first a **simple definition**, then a **plain-words explanation**, then a short example only where it helps. Say the definition out loud first in the interview. The code is there to back up the words, not to replace them.

**Recommended study order:** fundamentals → joins → GROUP BY and HAVING → subqueries and CTEs → query problems → window functions → indexing → transactions → advanced concepts.

### The table used in the query questions

```
employees
| id | name  | department | salary |
|----|-------|------------|--------|
| 1  | Rahul | IT         | 50000  |
| 2  | Amit  | HR         | 40000  |
| 3  | Priya | IT         | 70000  |
| 4  | John  | HR         | 60000  |
| 5  | Sam   | IT         | 50000  |
```

Every query result shown below was checked by running it on this data (on SQLite, with the same standard SQL). Where a database differs, a short note says so. For the larger sample database (customers, orders), see [SQL Fundamentals & Joins](01-sql-fundamentals-joins.md).

---

## 1️⃣ SQL Fundamentals

### 1. What is SQL? Difference between SQL and MySQL?

**SQL (Structured Query Language)** is the standard language used to store, read, change and delete data in a relational database. **MySQL** is a database *product* that understands SQL. So SQL is the language, and MySQL is one engine that runs it. PostgreSQL, SQL Server and Oracle are other engines. Each adds its own small extensions, for example `LIMIT` in MySQL and Postgres but `TOP` in SQL Server.

### 2. What are DDL, DML, DQL, DCL and TCL?

SQL commands are grouped by what they do:

| Group | Full name | What it does | Commands |
|---|---|---|---|
| **DDL** | Data Definition Language | Creates or changes the **structure** | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` |
| **DML** | Data Manipulation Language | Changes the **data** in tables | `INSERT`, `UPDATE`, `DELETE` |
| **DQL** | Data Query Language | **Reads** data | `SELECT` |
| **DCL** | Data Control Language | Controls **who can do what** | `GRANT`, `REVOKE` |
| **TCL** | Transaction Control Language | Controls **transactions** | `COMMIT`, `ROLLBACK`, `SAVEPOINT` |

### 3. What are Primary Key and Foreign Key?

A **primary key** is the column (or columns) that uniquely identifies each row in a table. It cannot be empty (NULL) and cannot repeat. Think of it as a roll number.

A **foreign key** is a column that points to the primary key of another table. It makes sure you cannot refer to something that does not exist. For example, `orders.customer_id` must match an existing `customers.id`. This rule is called **referential integrity**.

### 4. Difference between Primary Key and Unique Key?

Both stop duplicate values. The differences:

| | Primary key | Unique key |
|---|---|---|
| How many per table | **One** | Many |
| NULL allowed | **No** | Yes (usually) |
| Purpose | Main identity of a row | Other columns that must not repeat (email, phone) |

### 5. Difference between DELETE, TRUNCATE and DROP?

- **DELETE** removes the rows you choose (with `WHERE`). The table stays. It can be rolled back and fires triggers.
- **TRUNCATE** removes **all** rows very quickly and resets the table to empty. The table stays. It has no `WHERE`. (In MySQL it cannot be rolled back; in PostgreSQL it can.)
- **DROP** removes the **whole table**: data, structure and indexes.

Easy way to remember: DELETE = remove some rows, TRUNCATE = empty the table, DROP = remove the table.

### 6. Difference between WHERE and HAVING?

Both filter, but at different times. **WHERE** filters individual **rows before** grouping, so it cannot use aggregates like `SUM`. **HAVING** filters **groups after** `GROUP BY`, so it can use aggregates. Use `WHERE` for anything you can, because it shrinks the data before the work of grouping starts.

```sql
SELECT department, AVG(salary)
FROM employees
WHERE salary > 30000          -- row filter, before grouping
GROUP BY department
HAVING AVG(salary) > 50000;   -- group filter, after grouping   → IT | 56666.67
```

### 7. Difference between GROUP BY and ORDER BY?

**GROUP BY** squeezes many rows into one row per group, so you can calculate totals, counts and averages. **ORDER BY** only sorts the rows you already have; it never changes how many there are. `GROUP BY` does not promise any order, so add `ORDER BY` when order matters.

### 8. Difference between NULL, 0 and an empty string?

- **NULL** means "no value / unknown". It is not equal to anything, not even another NULL. You test it with `IS NULL`.
- **0** is a real number.
- **''** is a real text value that has zero characters.

The difference shows in functions: `COUNT(column)` and `AVG(column)` **skip** NULLs but count 0 and `''`. (Oracle is the odd one out: it treats `''` as NULL.)

### 9. What are constraints in SQL?

**Constraints** are rules on a table that the database enforces for you, so bad data cannot get in. The common ones:

| Constraint | Rule |
|---|---|
| `NOT NULL` | The column must have a value |
| `UNIQUE` | No two rows can have the same value |
| `PRIMARY KEY` | `NOT NULL` + `UNIQUE`; identifies the row |
| `FOREIGN KEY` | The value must exist in another table |
| `CHECK` | The value must pass a condition (`salary > 0`) |
| `DEFAULT` | Value used when none is given |

### 10. Difference between CHAR and VARCHAR?

**CHAR(n)** is **fixed** length: it always uses `n` characters, padding short values with spaces. **VARCHAR(n)** is **variable** length: it stores only what you give it, up to `n`. Use `CHAR` for values that are always the same size (country code `IN`, a fixed-length ID), and `VARCHAR` for names, emails and anything that varies.

---

## 2️⃣ SQL Joins

### 1. What are joins in SQL?

A **join** combines rows from two or more tables into one result, using a column that links them (usually a foreign key matching a primary key). We split data into separate tables to avoid repeating it (normalisation), and joins bring it back together when we read.

### 2. Explain INNER JOIN with an example.

**INNER JOIN** returns only the rows that have a **match in both** tables. Rows with no partner are dropped.

```sql
SELECT c.name, o.amount
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
```

A customer with no orders will **not** appear, and neither will an order whose customer is missing.

### 3. Difference between LEFT JOIN and RIGHT JOIN?

**LEFT JOIN** keeps **all rows from the left table**, and fills the right side with NULL when there is no match. **RIGHT JOIN** is the mirror image: it keeps all rows from the right table. They are the same thing with the tables swapped, so most people use only `LEFT JOIN` and reorder the tables.

### 4. What is FULL OUTER JOIN?

**FULL OUTER JOIN** keeps **all rows from both tables**. Matching rows are joined; rows with no match on either side appear with NULLs on the other side. MySQL has no `FULL JOIN`; you combine `LEFT JOIN ... UNION ... RIGHT JOIN` instead.

### 5. What is CROSS JOIN?

**CROSS JOIN** pairs **every row of the first table with every row of the second** (no condition). If one table has 3 rows and the other 4, you get 12. It is used for combinations, such as every size with every colour, or a calendar of dates with every product.

### 6. What is SELF JOIN?

A **self join** joins a table **to itself**. You give the table two different aliases and treat them as two tables. It is used when a row refers to another row in the same table, such as an employee and their manager.

```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;
```

### 7. Difference between JOIN and UNION?

**JOIN** adds **columns** from another table, side by side, using a matching condition. **UNION** adds **rows**, stacking the results of two queries one under the other. For `UNION` both queries need the same number of columns with compatible types. `UNION` removes duplicates; `UNION ALL` keeps them and is faster.

### 8. How do you find records present in one table but missing in another?

This is called an **anti-join**. There are three common ways:

```sql
-- 1) LEFT JOIN and keep the rows with no match
SELECT c.name FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;

-- 2) NOT EXISTS (safest)
SELECT c.name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

-- 3) NOT IN (dangerous if the subquery can return NULL)
```

Prefer `NOT EXISTS` or `LEFT JOIN ... IS NULL`. `NOT IN` returns **no rows at all** if the list contains a single NULL.

### 9. How do you join three or more tables?

Chain the joins one after another. Each new `JOIN` works with the result so far, and each needs its own `ON` condition.

```sql
SELECT c.name, o.id, p.title
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items i  ON i.order_id    = o.id
JOIN products p     ON p.id          = i.product_id;
```

Use short aliases, prefix every column with its alias, and use `LEFT JOIN` for the tables that may have no match.

### 10. What happens when joining tables without a matching condition?

You get a **Cartesian product**: every row paired with every row. Joining 1,000 rows with 1,000 rows gives 1,000,000 rows. If a query suddenly returns far too many rows, a missing `ON` condition is the first thing to check.

---

## 3️⃣ Aggregate Functions and Grouping

### 1. What are aggregate functions?

**Aggregate functions** take many rows and return **one value**: a count, a total, an average, and so on. They are normally used with `GROUP BY` to get one value per group.

### 2. Explain COUNT(), SUM(), AVG(), MIN() and MAX().

| Function | What it gives you | On our table |
|---|---|---|
| `COUNT()` | Number of rows | 5 |
| `SUM(col)` | Total of the values | 270000 |
| `AVG(col)` | Average of the values | 54000 |
| `MIN(col)` | Smallest value | 40000 |
| `MAX(col)` | Largest value | 70000 |

All of them **ignore NULLs** (except `COUNT(*)`).

### 3. Difference between COUNT(*) and COUNT(column)?

`COUNT(*)` counts **all rows**, whatever is in them. `COUNT(column)` counts only the rows where that column is **not NULL**. `COUNT(DISTINCT column)` counts the different non-NULL values. So if 3 of 10 employees have no phone number, `COUNT(*)` is 10 and `COUNT(phone)` is 7.

### 4. How does GROUP BY work?

`GROUP BY` sorts the rows into **buckets** that share the same value in the chosen column(s), then runs the aggregate once per bucket. The result has one row per bucket. Every column in `SELECT` must be either in the `GROUP BY` or inside an aggregate.

```sql
SELECT department, COUNT(*) AS people, SUM(salary) AS payroll
FROM employees GROUP BY department;
-- HR | 2 | 100000
-- IT | 3 | 170000
```

### 5. Can we use WHERE with aggregate functions?

**No.** `WHERE` runs before the groups exist, so it can't see an aggregate. Use `HAVING` for conditions on aggregates. (You can use an aggregate inside a **subquery** in the `WHERE`, such as `salary > (SELECT AVG(salary) ...)`.)

### 6. How does HAVING work?

After `GROUP BY` has made the groups and calculated the aggregates, `HAVING` keeps only the groups that pass its condition. It is "WHERE, but for groups".

### 7. How do you find duplicate records?

Group by the column(s) that should be unique, and keep groups that appear more than once.

```sql
SELECT salary, COUNT(*) AS times
FROM employees
GROUP BY salary
HAVING COUNT(*) > 1;        -- 50000 | 2
```

### 8. How do you find the department with the highest salary?

Two readings, so ask which is meant: the department of the single **top earner**, or the department with the highest **average** (or total).

```sql
-- Department of the highest-paid person
SELECT department FROM employees ORDER BY salary DESC LIMIT 1;     -- IT

-- Department with the highest average salary
SELECT department, AVG(salary) AS avg_salary
FROM employees GROUP BY department
ORDER BY avg_salary DESC LIMIT 1;                                  -- IT | 56666.67
```

---

## 4️⃣ Subqueries and CTE

### 1. What is a subquery?

A **subquery** is a query written **inside another query**, usually in brackets. The inner query runs first (logically) and gives its result to the outer query. It can sit in `WHERE`, `FROM` or `SELECT`.

### 2. Difference between correlated and non-correlated subqueries?

A **non-correlated** subquery is independent: it can run on its own and runs **once**. A **correlated** subquery uses a column from the **outer** query, so it must be re-evaluated **for each outer row**. Correlated ones can be slow on big tables, so check the plan.

```sql
-- Correlated: the inner query uses e.department from the outer row
SELECT name, department, salary FROM employees e
WHERE salary > (SELECT AVG(salary) FROM employees x WHERE x.department = e.department);
-- Priya | IT | 70000
-- John  | HR | 60000
```

### 3. What is a nested query?

Another name for a subquery, usually used when subqueries are placed inside other subqueries (several levels deep). If it gets deeper than two levels, rewrite it with CTEs for readability.

### 4. Difference between IN and EXISTS?

- **IN** compares a value against a **list** of values.
- **EXISTS** only asks "does **at least one row** exist?" and stops at the first match.

`EXISTS` is usually better when the inner table is big, and it is **safe with NULLs**. `NOT IN` breaks when the list contains a NULL; `NOT EXISTS` does not. Modern planners often make both equally fast.

### 5. Difference between EXISTS and JOIN?

`JOIN` **combines columns** from both tables and can **repeat** left rows if there are several matches. `EXISTS` only **checks** for a match and never repeats the left row, and you can't read columns from the inner table. Use `EXISTS` when you only need "has a match?", and `JOIN` when you need data from both.

### 6. What is a CTE (Common Table Expression)?

A **CTE** is a **named temporary result** defined at the top of a query with `WITH`. It exists only for that one statement. Think of it as giving a name to a step, so a long query reads top to bottom.

```sql
WITH dept_avg AS (
  SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department
)
SELECT e.name, e.salary, d.avg_salary
FROM employees e JOIN dept_avg d ON d.department = e.department
WHERE e.salary > d.avg_salary;
```

### 7. Difference between CTE and subquery?

They give the same result; the difference is **readability and reuse**. A CTE has a name, is written once at the top, can be **used several times** in the same query and can be **recursive**. A subquery is written in place and can't be reused. Performance is usually the same.

### 8. What is a recursive CTE?

A CTE that **refers to itself**, to walk through hierarchical data such as an org chart or a category tree. It has two parts joined by `UNION ALL`: the **anchor** (where to start) and the **recursive part** (how to go one level further). It stops when the recursive part returns no more rows.

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 1 AS level FROM employees WHERE manager_id IS NULL   -- start: the top boss
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.level + 1
  FROM employees e JOIN chain c ON e.manager_id = c.id                              -- go one level down
)
SELECT * FROM chain;
```

### 9. Can we use multiple CTEs in one query?

**Yes.** Write `WITH` once and separate the CTEs with commas. A later CTE can use an earlier one.

```sql
WITH it_staff AS (SELECT * FROM employees WHERE department = 'IT'),
     it_avg   AS (SELECT AVG(salary) AS a FROM it_staff)
SELECT name FROM it_staff, it_avg WHERE salary > a;      -- Priya
```

### 10. What is a derived table?

A **derived table** is a subquery written in the `FROM` clause and treated like a table. It **must have an alias**. A CTE does the same job with a nicer layout.

```sql
SELECT t.department, t.total
FROM (SELECT department, SUM(salary) AS total FROM employees GROUP BY department) AS t
WHERE t.total > 100000;                                   -- IT | 170000
```

---

## 5️⃣ SQL Query-Based Questions

All answers use the `employees` table shown at the top.

### 1. Find the second-highest salary.

Use `DISTINCT` so ties don't count twice, then skip the top one. Result: **60000**.

```sql
SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;
-- Or without OFFSET:
SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);
```

If there might be no second salary, wrap the first query as a subquery so you get NULL instead of an empty result.

### 2. Find the third-highest salary.

Same idea, skip two. Result: **50000** (Rahul and Sam tie, and they count once because of `DISTINCT`).

```sql
SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 2;
```

### 3. Find the highest salary in each department.

```sql
SELECT department, MAX(salary) FROM employees GROUP BY department;
-- HR | 60000
-- IT | 70000
```

To also show *who* earns it, use a window function (see section 6) or join back to this result.

### 4. Find employees earning more than the average salary.

The average is 54000. Compare each row with it using a subquery.

```sql
SELECT name, salary FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
-- Priya | 70000
-- John  | 60000
```

### 5. Find duplicate salaries.

Group by salary and keep groups with more than one row: **50000** appears twice.

```sql
SELECT salary, COUNT(*) FROM employees GROUP BY salary HAVING COUNT(*) > 1;
```

### 6. Find duplicate employee names.

Same pattern, on `name`. On this data it returns **no rows**, because all names are different.

```sql
SELECT name, COUNT(*) FROM employees GROUP BY name HAVING COUNT(*) > 1;
```

### 7. Find employees who have the same salary.

Question 5 gives the duplicated *value*; this one asks for the *people*. Use `EXISTS` to find another row with the same salary but a different id.

```sql
SELECT * FROM employees e
WHERE EXISTS (SELECT 1 FROM employees x WHERE x.salary = e.salary AND x.id <> e.id);
-- Rahul | IT | 50000
-- Sam   | IT | 50000
```

### 8. Find the top 3 highest-paid employees.

```sql
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;
-- Priya 70000, John 60000, Rahul 50000
```

Ties are the catch: Sam also earns 50000 but is cut off by `LIMIT`. If ties should be included, use `DENSE_RANK() <= 3` instead.

### 9. Find the department with the highest average salary.

```sql
SELECT department, AVG(salary) AS avg_salary
FROM employees GROUP BY department
ORDER BY avg_salary DESC LIMIT 1;          -- IT | 56666.67
```

### 10. Find employees earning more than their department's average salary.

This is the correlated subquery from section 4, question 2. The average is worked out **per department** (IT 56,667; HR 50,000). Result: **Priya (IT)** and **John (HR)**. A faster alternative for big tables is to compute the department averages once in a CTE and join to it.

### 11. Find the Nth highest salary.

Rank the distinct salaries with `DENSE_RANK` and pick rank N. This handles ties correctly and works for any N.

```sql
SELECT DISTINCT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees
) t
WHERE rnk = 3;                              -- 50000   (change 3 to any N)
```

Without window functions: `ORDER BY salary DESC LIMIT 1 OFFSET N-1` on the distinct salaries.

### 12. Find employees whose names start with 'A'.

`LIKE` matches a pattern: `%` means "any characters" and `_` means "exactly one character".

```sql
SELECT * FROM employees WHERE name LIKE 'A%';       -- Amit
```

`LIKE` is case-insensitive in MySQL and case-sensitive in PostgreSQL (use `ILIKE` there). A pattern that starts with a letter (`'A%'`) can use an index; one that starts with `%` can't.

### 13. Find employees whose salary is between 30,000 and 60,000.

`BETWEEN` includes both ends.

```sql
SELECT name, salary FROM employees WHERE salary BETWEEN 30000 AND 60000;
-- Rahul 50000, Amit 40000, John 60000, Sam 50000
```

### 14. Find employees who joined in the last 30 days.

This needs a date column, so imagine the table also has `joined_on`. Compare the column directly with "today minus 30 days".

```sql
-- PostgreSQL
SELECT * FROM employees WHERE joined_on >= CURRENT_DATE - INTERVAL '30 days';
-- MySQL
SELECT * FROM employees WHERE joined_on >= CURDATE() - INTERVAL 30 DAY;
```

Keep the column on its own on the left side, so an index on `joined_on` can be used.

### 15. Delete duplicate records while keeping one record.

Idea: for each group of duplicates, keep the row with the smallest `id` and delete the rest.

```sql
-- Works in every database (MySQL needs the subquery wrapped in another derived table)
DELETE FROM employees
WHERE id NOT IN (
  SELECT MIN(id) FROM employees GROUP BY name, salary    -- the columns that define "duplicate"
);

-- PostgreSQL / SQL Server: ROW_NUMBER version
DELETE FROM employees WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name, salary ORDER BY id) AS rn FROM employees
  ) t WHERE rn > 1
);
```

Always run the `SELECT` version first to see what will be deleted, and do it inside a transaction.

---

## 6️⃣ Window Functions

### 1. What are window functions?

A **window function** does a calculation across a set of rows related to the current row (its "window"), **without collapsing the rows**. Every row stays in the result, and the function adds an extra value to it, such as a rank, a running total, or the department average next to each person.

### 2. Difference between GROUP BY and window functions?

`GROUP BY` **collapses** rows: you get one row per group and lose the individual rows. A window function **keeps** every row and attaches the calculated value to each. Use `GROUP BY` for "total per department"; use a window function for "each employee **and** the department total".

### 3. Difference between ROW_NUMBER(), RANK() and DENSE_RANK()?

All three number rows in order. They differ only when there are **ties**:

| name | salary | ROW_NUMBER | RANK | DENSE_RANK |
|---|---|---|---|---|
| Priya | 70000 | 1 | 1 | 1 |
| John | 60000 | 2 | 2 | 2 |
| Rahul | 50000 | 3 | 3 | 3 |
| Sam | 50000 | 4 | **3** | **3** |
| Amit | 40000 | 5 | **5** | **4** |

- `ROW_NUMBER` never repeats: ties get different numbers (the order between them is arbitrary unless you add a tie-breaker).
- `RANK` gives ties the same number and then **skips** (3, 3, 5).
- `DENSE_RANK` gives ties the same number and **does not skip** (3, 3, 4).

### 4. What is PARTITION BY?

`PARTITION BY` splits the rows into **separate groups** (partitions) and the window function restarts for each one. It's like `GROUP BY` but without collapsing the rows. `RANK() OVER (PARTITION BY department ...)` ranks people within their own department.

### 5. What is ORDER BY inside OVER()?

It sets the **order of rows inside each partition**, which matters for ranking and running totals. `ORDER BY salary DESC` inside `OVER` means "rank by highest salary first". It is separate from the `ORDER BY` at the end of the query, which sorts the final output.

### 6. What are LEAD() and LAG()?

`LAG` gives you the value from a **previous** row; `LEAD` gives the value from a **following** row. They are used to compare a row with its neighbour, such as this month vs last month.

```sql
SELECT name, salary,
       LAG(salary)  OVER (ORDER BY id) AS previous,
       LEAD(salary) OVER (ORDER BY id) AS next
FROM employees;
-- Rahul 50000 NULL  40000
-- Amit  40000 50000 70000
-- Priya 70000 40000 60000
-- John  60000 70000 50000
-- Sam   50000 60000 NULL      (first row has no previous, last has no next)
```

### 7. What are FIRST_VALUE() and LAST_VALUE()?

They return the **first** or **last** value in the window. Example: the highest-paid person in each department, shown next to everyone.

```sql
SELECT name, department, salary,
       FIRST_VALUE(name) OVER (PARTITION BY department ORDER BY salary DESC) AS top_earner
FROM employees;
-- John & Amit → John;  Priya, Rahul, Sam → Priya
```

**Gotcha:** `LAST_VALUE` with the default frame only looks up to the *current row*, so it often just returns the current row. Add `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` to see the real last row.

### 8. How do you find the second-highest salary using DENSE_RANK()?

Rank salaries from high to low and pick rank 2. Result: **60000**.

```sql
SELECT DISTINCT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees
) t WHERE rnk = 2;
```

### 9. How do you find the top 2 employees in each department?

Rank within each department, then keep ranks 1 and 2. You can't filter on a window function in the same query's `WHERE`, so wrap it in a subquery or CTE.

```sql
SELECT * FROM (
  SELECT name, department, salary,
         DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rnk
  FROM employees
) t WHERE rnk <= 2;
-- John HR 60000 | Amit HR 40000 | Priya IT 70000 | Rahul IT 50000 | Sam IT 50000
```

Use `ROW_NUMBER` instead if you need **exactly** two rows per department even with ties.

### 10. How do you calculate a running total?

Use `SUM()` as a window function with an `ORDER BY`. Each row shows the sum of all rows up to and including itself.

```sql
SELECT name, salary, SUM(salary) OVER (ORDER BY id) AS running_total FROM employees;
-- 50000, 90000, 160000, 220000, 270000
```

---

## 7️⃣ Indexing and Query Optimization

### 1. What is an index in SQL?

An **index** is a separate, sorted structure that lets the database **find rows quickly** without reading the whole table. It works like the index at the back of a book: instead of reading every page to find a topic, you look it up and jump to the page.

### 2. Why do we use indexes?

To make **reads faster**: filtering with `WHERE`, joining on a column, sorting with `ORDER BY` and finding `MIN`/`MAX`. They also enforce uniqueness (a unique index). The cost is paid on writes (see question 6).

### 3. What are clustered and non-clustered indexes?

A **clustered index** decides the **physical order of the rows** in the table, so the table *is* the index. There can only be one per table (usually the primary key; MySQL InnoDB always does this). A **non-clustered** index is a **separate structure** with a pointer back to the row; a table can have many. PostgreSQL tables are plain heaps, so all its indexes are non-clustered.

### 4. What is a composite index?

An index on **two or more columns**, such as `(department, salary)`. It follows the **leftmost-prefix rule**: it helps queries that filter on `department`, or on `department` and `salary`, but not on `salary` alone. Put the column used with `=` first and the range column last.

### 5. What is a unique index?

An index that **also forbids duplicate values**. A `UNIQUE` constraint and a primary key are both backed by one. It speeds up lookups and protects data integrity at the same time.

### 6. What are the disadvantages of indexes?

- **Slower writes:** every `INSERT`, `UPDATE` and `DELETE` must also update each index.
- **Extra disk space and memory.**
- **Maintenance:** bloat builds up over time.
- Too many indexes can confuse the planner and slow things down overall.

So index the columns you really filter, join and sort on, not everything.

### 7. How do indexes improve query performance?

The index is sorted (stored as a **B-tree**), so the database can do a **binary-search-style lookup** in a handful of steps (roughly `log n`) instead of scanning all `n` rows. On a table with a million rows that's about 20 steps instead of a million.

### 8. What is EXPLAIN in SQL?

`EXPLAIN` shows the **execution plan**: how the database intends to run your query (which indexes it uses, the join method, the row estimates). `EXPLAIN ANALYZE` (PostgreSQL) actually **runs** the query and adds the real timings. It's the first tool to reach for with a slow query.

### 9. What is a full table scan?

When the database **reads every row** of the table to find matches, because no index can help. It is fine for small tables (or when you need most of the rows anyway) and a warning sign on big ones. It appears as `Seq Scan` in PostgreSQL and `type: ALL` in MySQL.

### 10. How do you optimize a slow SQL query?

A simple routine to say in an interview:

1. **Measure:** run `EXPLAIN ANALYZE` and find the slowest step.
2. **Add or fix an index** on the filter, join and sort columns (and foreign keys).
3. **Select only the columns you need** (no `SELECT *`) and filter early.
4. **Make conditions index-friendly:** don't wrap the column in a function (`WHERE YEAR(date) = 2026`); compare the bare column against a range.
5. **Rewrite:** replace slow correlated subqueries with joins, use `EXISTS`, avoid `OFFSET` for deep pages (use keyset pagination).
6. **Update statistics** (`ANALYZE`) if the row estimates are far from reality.
7. If still slow: cache, add a read replica, pre-compute with a materialised view, or partition the table.

### 11. Why should we avoid SELECT *?

Because it fetches **every column**, including ones you don't need. That means more data over the network and in memory, it blocks **covering-index** (index-only) plans, and it **breaks silently** when someone adds or reorders columns. Name the columns you need.

### 12. What is query execution order?

The database runs a query in this logical order, which is **different from the order you write it**:

`FROM / JOIN` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`

This explains why you can't use a `SELECT` alias in `WHERE` (it doesn't exist yet) but can in `ORDER BY`.

### 13. What is a covering index?

An index that **contains every column the query needs**, so the database answers from the index alone and never reads the table. Example: an index on `(department, salary)` covers `SELECT salary FROM employees WHERE department = 'IT'`. In PostgreSQL this shows as `Index Only Scan`. You can add extra columns with `INCLUDE`.

### 14. What is index selectivity?

How **well an index narrows down the rows**: distinct values divided by total rows. High selectivity (email, id: nearly all different) means the index finds few rows and is very useful. Low selectivity (gender, a true/false flag) means each value matches many rows, so the planner often ignores the index and scans the table.

### 15. What is the difference between index scan and index seek?

An **index seek** jumps **directly** to the matching entries in the index using the search condition (very fast, for selective filters). An **index scan** reads a **large part or all** of the index in order (slower than a seek, but still cheaper than scanning the table when the index is smaller). These names come from SQL Server; PostgreSQL labels both `Index Scan`.

---

## 8️⃣ Transactions and ACID Properties

### 1. What is a transaction?

A **transaction** is a group of SQL statements that the database treats as **one unit of work**: either **all of them succeed or none of them do**. The standard example is a bank transfer: take money from account A *and* add it to account B. If the second step fails, the first must be undone.

### 2. Explain ACID properties.

| Letter | Name | Plain meaning |
|---|---|---|
| **A** | Atomicity | All or nothing. A failed step undoes the whole transaction. |
| **C** | Consistency | The data moves from one **valid** state to another; constraints are never broken. |
| **I** | Isolation | Transactions running together don't see each other's half-finished work. |
| **D** | Durability | Once committed, the data survives a crash or power failure (written to disk / the write-ahead log). |

### 3. What is COMMIT?

`COMMIT` **saves** all the changes of the current transaction permanently and makes them visible to others.

### 4. What is ROLLBACK?

`ROLLBACK` **cancels** the current transaction and undoes every change made since it began, returning the data to how it was.

### 5. What is SAVEPOINT?

A **checkpoint inside a transaction**. You can roll back to the savepoint and undo only the work after it, while keeping the earlier work.

```sql
BEGIN;
INSERT INTO orders ...;            -- keep this
SAVEPOINT after_order;
INSERT INTO order_items ...;       -- this part fails or is wrong
ROLLBACK TO after_order;           -- undo only the items
COMMIT;                            -- the order is still saved
```

### 6. What is a database isolation level?

The setting that controls **how much one transaction can see of another's uncommitted or newly committed changes**. Stronger isolation = fewer surprises but more waiting or retries. From weakest to strongest: **Read Uncommitted → Read Committed → Repeatable Read → Serializable**. PostgreSQL's default is Read Committed; MySQL InnoDB's is Repeatable Read.

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| Read Uncommitted | Possible | Possible | Possible |
| Read Committed | **Prevented** | Possible | Possible |
| Repeatable Read | Prevented | **Prevented** | Possible (not in PostgreSQL) |
| Serializable | Prevented | Prevented | **Prevented** |

### 7. What is a dirty read?

Reading data that another transaction has **changed but not yet committed**. If that transaction then rolls back, you acted on data that never really existed.

### 8. What is a non-repeatable read?

Reading the **same row twice** in one transaction and getting **different values**, because another transaction updated and committed it in between.

### 9. What is a phantom read?

Running the **same query twice** in one transaction and getting **different sets of rows**, because another transaction inserted or deleted rows that match your condition. The existing rows are the same; **new "phantom" rows** appear.

### 10. What is a deadlock?

When **two transactions wait for each other forever**: A holds a lock that B needs, and B holds a lock that A needs. Neither can continue. The database notices, **kills one of them** (the victim) with an error, and lets the other finish.

### 11. How do you handle deadlocks?

- **Prevent:** always lock rows and tables in the **same order** in every code path; keep transactions **short**; don't wait for user input while holding locks; use proper indexes so fewer rows get locked.
- **Handle:** catch the deadlock error and **retry** the transaction.
- Use `SELECT ... FOR UPDATE SKIP LOCKED` for job queues, to avoid waiting on locked rows.

### 12. What is optimistic vs pessimistic locking?

- **Pessimistic locking** assumes conflicts are likely, so it **locks the row first** (`SELECT ... FOR UPDATE`). Others wait. It is safe, but it reduces concurrency.
- **Optimistic locking** assumes conflicts are rare, so it **doesn't lock**; it checks at save time that nobody else changed the row, usually with a `version` column. If the version changed, the update affects 0 rows and the app retries or reports a conflict.

```sql
UPDATE products SET stock = stock - 1, version = version + 1
WHERE id = 7 AND version = 3;       -- 0 rows updated = someone else got there first
```

Use pessimistic for hot rows with frequent conflicts (inventory, wallets); optimistic for mostly-read data and long user edits.

---

## 9️⃣ Advanced SQL Concepts

### 1. What is normalization?

**Normalisation** is organising tables so that **each fact is stored in only one place**. It removes duplicate data and prevents update, insert and delete anomalies (for example, changing a customer's address in one row but forgetting another). It is done by splitting big tables into smaller related ones.

### 2. Explain 1NF, 2NF and 3NF.

| Form | Rule in simple words | Example fix |
|---|---|---|
| **1NF** | Every cell holds **one value** (no lists), and rows are unique | Don't store `"phone1, phone2"` in one column; make a `phones` table |
| **2NF** | In 1NF, and every non-key column depends on the **whole** primary key (matters for composite keys) | In `(order_id, product_id, product_name)`, `product_name` depends only on `product_id`, so move it to `products` |
| **3NF** | In 2NF, and non-key columns depend **only on the key**, not on other non-key columns | `zip_code → city`: move `city` to a `zip_codes` table |

A handy line: "every non-key column depends on **the key, the whole key, and nothing but the key**."

### 3. What is denormalization?

The opposite: **deliberately adding duplicate data** (or merging tables) to make reads faster and avoid joins. It is a trade-off: reads get simpler and quicker, but writes get harder and the copies can drift apart. Used in reporting tables, caches and read-heavy systems, usually after measuring a real problem.

### 4. What is a View?

A **view** is a **saved query with a name**. It looks like a table but stores no data; the query runs every time you read it. Use it to hide complex joins, give a simpler shape to the data, or expose only certain columns to certain users.

### 5. Difference between View and Materialized View?

A normal view is **always up to date** but recomputes every time. A **materialised view stores the result** on disk, so reads are fast, but the data is **stale** until you refresh it (`REFRESH MATERIALIZED VIEW`). Use it for expensive reports that can be a few minutes old.

### 6. What is a Stored Procedure?

A **stored procedure** is a block of SQL (and logic such as `IF` and loops) that is **saved in the database** and run by name with `CALL`. It can take parameters, run many statements and control transactions. It is useful for batch jobs and for keeping a multi-step process close to the data.

### 7. What is a Trigger?

A **trigger** is code that the database runs **automatically** when something happens on a table (`INSERT`, `UPDATE` or `DELETE`), before or after the change. Common uses are audit logs and setting `updated_at`. The downside is hidden behaviour that's hard to debug, so use them sparingly.

### 8. Difference between Stored Procedure and Function?

| | Function | Stored procedure |
|---|---|---|
| Returns | Must return a value | May return nothing or output parameters |
| Called with | Inside a query (`SELECT fn(x)`) | `CALL proc()` on its own |
| Transaction control | No | Yes (`COMMIT` / `ROLLBACK`) |
| Typical use | A calculation you reuse | A multi-step job |

### 9. What is a temporary table?

A table that **exists only for your session** (or transaction) and is **dropped automatically** afterwards. Other users can't see it. You can index it and reuse it in many statements, which makes it good for holding intermediate results in a long multi-step process.

### 10. Difference between a temporary table and a CTE?

A **CTE** is just a named step that lives for **one statement** and isn't stored. A **temporary table** is a real (short-lived) table that lasts for the **session**, can be **indexed**, and can be used in **many statements**. Use a CTE for readability; use a temp table for big intermediate data you need again and again.

### 11. What is SQL injection?

An attack where a user types **SQL code into an input field** and the application glues it into a query, so the attacker's code runs. Example: entering `' OR '1'='1` as a password makes the login condition always true. It can leak, change or delete data.

### 12. How do you prevent SQL injection?

- Use **parameterised queries / prepared statements** so values are sent separately from the SQL text (the database never treats them as code).
- Use an ORM or query builder correctly; never build SQL with string concatenation.
- Whitelist anything that can't be a parameter (column names in `ORDER BY`).
- Give the app's database user the **least privileges**.
- Validate input and don't show raw database errors to users.

### 13. What is partitioning?

**Splitting one large table into smaller pieces (partitions)** inside the same database, usually by a date range or a key, so queries touch only the relevant piece (**partition pruning**), and old data can be dropped quickly. To the application, it still looks like one table.

### 14. What is sharding?

**Splitting data across several separate database servers**, where each server (shard) holds a part of the data, chosen by a **shard key** such as `user_id`. It lets you scale beyond one machine for both storage and writes, but adds complexity (cross-shard joins and transactions are hard). Partitioning = pieces on **one** server; sharding = pieces on **many** servers.

### 15. What is connection pooling?

Opening a database connection is slow (network, authentication, memory). A **connection pool** keeps a set of **already-open connections** that the application borrows and returns, instead of opening a new one per request. This makes requests faster and stops the database from being overwhelmed by too many connections. Examples: `pg.Pool` in Node, SQLAlchemy's pool, PgBouncer in front of PostgreSQL.

---

## 🔟 Most Important Practical Queries

The table below is the "coding round" list. The first few are answered above; the rest are here, with the idea first and a short query.

| No. | Problem | Difficulty | Where to look |
|---|---|---|---|
| 1 | Second-highest salary | Easy | Section 5, Q1 |
| 2 | Nth highest salary | Medium | Section 5, Q11 |
| 3 | Find duplicate records | Easy | Section 5, Q5–Q6 |
| 4 | Delete duplicate records | Medium | Section 5, Q15 |
| 5 | Highest salary per department | Medium | Section 5, Q3 |
| 6 | Employees above average salary | Medium | Section 5, Q4 and Q10 |
| 7 | Top 3 employees per department | Medium | Section 6, Q9 (change `<= 2` to `<= 3`) |
| 8 | Find missing records using JOIN | Medium | Section 2, Q8 |
| 9 | Running total | Medium | Section 6, Q10 |
| 10 | Find consecutive dates | Hard | below |
| 11 | Employees without a manager | Easy | below |
| 12 | Department-wise employee count | Easy | below |
| 13 | Salary difference between employees | Medium | below |
| 14 | Monthly sales totals | Medium | below |
| 15 | Customers with repeated orders | Medium | below |

### 10. Find consecutive dates (login streaks)

**Idea (gaps and islands):** number each user's dates in order. Subtract that number (as days) from the date. Dates in an unbroken run all give the **same result**, so grouping by that result groups each streak.

```sql
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM (
  SELECT user_id, login_date,
         login_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date))::int AS grp
  FROM (SELECT DISTINCT user_id, login_date FROM logins) d
) t
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;
```

A full worked version with its output is problem 19 in [SQL Query Practice](04-sql-query-practice.md).

### 11. Employees without a manager

A missing manager is stored as `NULL`, so test it with `IS NULL` (never `= NULL`).

```sql
SELECT name FROM employees WHERE manager_id IS NULL;
```

### 12. Department-wise employee count

Group by the department and count. To include departments that have **no** employees, `LEFT JOIN` from the departments table and count the employee id (not `*`).

```sql
SELECT d.name, COUNT(e.id) AS headcount
FROM departments d LEFT JOIN employees e ON e.dept_id = d.id
GROUP BY d.name;
```

### 13. Salary difference between employees

Use `LAG` to bring the previous row's salary next to the current one, then subtract. For the gap to the **department's top earner**, subtract from `MAX(salary) OVER (PARTITION BY department)`.

```sql
SELECT name, salary,
       salary - LAG(salary) OVER (ORDER BY salary) AS diff_from_previous
FROM employees;
```

### 14. Monthly sales totals

Cut each date down to its month, group by that, and sum. Group by the cut-down value (not the raw date), or every day becomes its own group.

```sql
SELECT date_trunc('month', created_at)::date AS month, SUM(amount) AS revenue    -- MySQL: DATE_FORMAT(created_at,'%Y-%m-01')
FROM orders WHERE status = 'PAID'
GROUP BY 1 ORDER BY 1;
```

### 15. Customers with repeated orders

Group the orders by customer and keep the customers with more than one.

```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 1;
```

To find a customer who ordered the **same product** twice, group by `(customer_id, product_id)` instead.

---

## ⚡ Last-Minute Revision

| If they ask… | Say… |
|---|---|
| SQL vs MySQL | Language vs one database that speaks it |
| DELETE vs TRUNCATE vs DROP | Some rows / all rows / the whole table |
| WHERE vs HAVING | Filters rows before grouping / groups after |
| LEFT JOIN | All left rows, NULLs where no match |
| IN vs EXISTS | List comparison / "does a row exist" (NULL-safe) |
| CTE vs subquery | Same result; CTE is named, reusable, can recurse |
| RANK vs DENSE_RANK | Skips numbers after a tie / does not skip |
| Why an index | Find rows without scanning the table; costs slower writes |
| Covering index | Index holds every column the query needs |
| ACID | All-or-nothing, valid state, isolated, saved after commit |
| Dirty / non-repeatable / phantom | Uncommitted data / same row changes / new rows appear |
| Deadlock fix | Same lock order, short transactions, retry |
| Normalisation | One fact in one place (1NF, 2NF, 3NF) |
| SQL injection fix | Parameterised queries |
| Partitioning vs sharding | One server, many pieces / many servers |

---

[← SQL Interview Questions](05-sql-interview-questions.md) | [Index](../README.md) | [Next: FastAPI Fundamentals →](../30-fastapi/01-fastapi-fundamentals.md)
