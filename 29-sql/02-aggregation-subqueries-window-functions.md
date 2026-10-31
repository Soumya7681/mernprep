# Chapter 101 — Aggregation, Subqueries, CTEs & Window Functions

## 📖 Definition

These four tools turn SQL from "fetch rows" into an analytics language:

- **Aggregation** (`GROUP BY` + `COUNT/SUM/AVG/MIN/MAX`) **collapses** many rows into one row per group.
- **Subqueries** are queries inside queries: in `WHERE`, `FROM` or `SELECT`.
- **CTEs** (`WITH ...`) name a subquery so a long query reads from top to bottom. **Recursive CTEs** walk trees and graphs.
- **Window functions** (`... OVER (...)`) calculate across related rows **without collapsing them**: rankings, running totals, the previous row's value.

All results below use the sample data from the previous chapter, and were checked by running the queries.

## 💻 Aggregation with GROUP BY and HAVING

```sql
SELECT d.name,
       COUNT(*)      AS headcount,
       AVG(e.salary) AS avg_salary,
       MAX(e.salary) AS top_salary
FROM employees e
JOIN departments d ON d.id = e.dept_id
GROUP BY d.name
HAVING AVG(e.salary) > 100000         -- filter GROUPS (WHERE filters ROWS)
ORDER BY avg_salary DESC;
```

| name | headcount | avg_salary | top_salary |
|---|---|---|---|
| Engineering | 4 | 147500 | 200000 |
| Sales | 3 | 106666.67 | 130000 |

**The GROUP BY rule:** every column in `SELECT` must either be in `GROUP BY` or be inside an aggregate. (Postgres also allows other columns of a table when you group by that table's primary key. MySQL with `ONLY_FULL_GROUP_BY` turned off allows anything, and returns random values.)

### Conditional aggregation (pivoting)

```sql
SELECT c.name,
       COUNT(*) FILTER (WHERE o.status = 'PAID')       AS paid,        -- Postgres / SQLite
       COUNT(*) FILTER (WHERE o.status = 'CANCELLED')  AS cancelled,
       SUM(CASE WHEN o.status = 'PAID' THEN o.amount ELSE 0 END) AS paid_amount   -- works everywhere
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.name
ORDER BY c.name;
```

| name | paid | cancelled | paid_amount |
|---|---|---|---|
| Anil | 4 | 0 | 3700 |
| Bina | 2 | 1 | 1900 |
| Chetan | 1 | 0 | 2500 |

### Other useful aggregates

```sql
SELECT dept_id, STRING_AGG(name, ', ' ORDER BY name) AS team   -- MySQL: GROUP_CONCAT
FROM employees GROUP BY dept_id;

SELECT ARRAY_AGG(id), JSON_AGG(name) FROM employees;            -- Postgres

SELECT dept_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median
FROM employees GROUP BY dept_id;                                -- Postgres median

-- Subtotals and a grand total in one query
SELECT dept_id, COUNT(*) FROM employees GROUP BY ROLLUP (dept_id);
```

## 💻 Subqueries

### Scalar subquery (returns one value)

```sql
-- Second-highest salary → 150000
SELECT MAX(salary) FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

### `IN` / `EXISTS` subquery

```sql
-- Customers with at least one PAID order
SELECT name FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE status = 'PAID');

-- Same with EXISTS: it stops at the first match, and handles NULLs safely
SELECT name FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'PAID');
```

### The `NOT IN` + NULL trap

```sql
-- Departments with no employees. Expected: Legal
SELECT COUNT(*) FROM departments
WHERE id NOT IN (SELECT dept_id FROM employees);                          -- 0  ← wrong!

SELECT COUNT(*) FROM departments
WHERE id NOT IN (SELECT dept_id FROM employees WHERE dept_id IS NOT NULL);   -- 1

SELECT name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);      -- Legal  ✓ preferred
```

Neha's `dept_id` is `NULL`. So `4 NOT IN (1, 2, 3, NULL)` becomes `4 <> 1 AND ... AND 4 <> NULL`, which is UNKNOWN, so **no row passes**. **Use `NOT EXISTS`.**

### Correlated subquery (runs once per outer row, in logic)

```sql
-- Employees who earn more than their department's average
SELECT e.name, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(x.salary) FROM employees x WHERE x.dept_id = e.dept_id);
-- Asha 200000, Ravi 150000, Meera 150000, John 130000, Priya 120000
```

Modern planners often rewrite correlated subqueries as joins. If one is slow, rewrite it with a window function (below) or a join to a grouped subquery.

### Derived table (a subquery in FROM)

```sql
SELECT dept_id, avg_salary
FROM (SELECT dept_id, AVG(salary) AS avg_salary FROM employees GROUP BY dept_id) AS t
WHERE avg_salary > 100000;
```

## 💻 CTEs (Common Table Expressions)

```sql
WITH paid AS (
  SELECT customer_id, SUM(amount) AS total
  FROM orders
  WHERE status = 'PAID'
  GROUP BY customer_id
),
ranked AS (
  SELECT c.city, c.name, p.total,
         ROW_NUMBER() OVER (PARTITION BY c.city ORDER BY p.total DESC) AS rn
  FROM paid p
  JOIN customers c ON c.id = p.customer_id
)
SELECT city, name, total FROM ranked WHERE rn = 1 ORDER BY city;
-- Delhi | Bina | 1900
-- Pune  | Anil | 3700
```

CTEs make long queries **readable** (each step has a name) and let you **reuse** a step more than once. In Postgres 12+, simple CTEs are inlined, so they're as fast as subqueries. Write `AS MATERIALIZED` to force the result to be computed once.

### Recursive CTE: hierarchies

```sql
-- Org chart: every employee with their level below the CEO
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS level       -- anchor: the root
  FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.level + 1 -- recursive step: children of the last level
  FROM employees e
  JOIN chain c ON e.manager_id = c.id
)
SELECT level, name FROM chain ORDER BY level, name;
```

| level | names |
|---|---|
| 0 | Asha |
| 1 | Meera, Neha, Priya, Ravi, Vikram |
| 2 | John, Karan, Sara |

It's also used for category trees, comment threads, bill-of-materials, and generating date series. To protect against cycles, track a path array, or use `CYCLE` (Postgres 14+).

## 💻 Window Functions

```
function(...) OVER (
  PARTITION BY col      -- restart for each group (optional)
  ORDER BY col          -- order inside the window
  ROWS BETWEEN ...      -- frame (optional)
)
```

Unlike `GROUP BY`, **every row stays in the result**. The window value is just added as a new column.

### Ranking: ROW_NUMBER vs RANK vs DENSE_RANK

```sql
SELECT name, salary,
       ROW_NUMBER() OVER w AS row_num,
       RANK()       OVER w AS rnk,
       DENSE_RANK() OVER w AS dense
FROM employees
WHERE dept_id = 1
WINDOW w AS (ORDER BY salary DESC);
```

| name | salary | row_num | rnk | dense |
|---|---|---|---|---|
| Asha | 200000 | 1 | 1 | 1 |
| Ravi | 150000 | 2 | 2 | 2 |
| Meera | 150000 | 3 | 2 | 2 |
| Karan | 90000 | 4 | **4** | **3** |

- `ROW_NUMBER`: always unique (ties broken randomly unless you add more ORDER BY columns).
- `RANK`: ties share a rank, and the next rank **skips** (1, 2, 2, 4).
- `DENSE_RANK`: ties share a rank, **no gaps** (1, 2, 2, 3). Use it for "Nth highest salary".
- Also: `NTILE(4)` (quartiles), `PERCENT_RANK()`, `CUME_DIST()`.

### Top-N per group

```sql
SELECT dept, name, salary FROM (
  SELECT d.name AS dept, e.name, e.salary,
         DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rnk
  FROM employees e JOIN departments d ON d.id = e.dept_id
) t
WHERE rnk <= 2
ORDER BY dept, salary DESC;
```

You can't filter on a window function in `WHERE` (it's computed in the SELECT step), so you wrap it in a subquery or CTE. Some databases (Snowflake, BigQuery, DuckDB) have `QUALIFY rnk <= 2` for this.

### Running totals and moving averages

```sql
SELECT id, created_at, amount,
       SUM(amount) OVER (ORDER BY created_at, id) AS running_total,
       AVG(amount) OVER (ORDER BY created_at, id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3
FROM orders
WHERE status = 'PAID';
```

| id | created_at | amount | running_total |
|---|---|---|---|
| 1 | 2026-01-05 | 500 | 500 |
| 2 | 2026-01-20 | 1500 | 2000 |
| 3 | 2026-01-25 | 700 | 2700 |
| 5 | 2026-02-10 | 2500 | 5200 |
| 6 | 2026-02-14 | 800 | 6000 |
| 7 | 2026-03-01 | 1200 | 7200 |
| 9 | 2026-03-18 | 900 | 8100 |

**The frame trap:** with `ORDER BY` and no frame, the default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Rows with the **same** ORDER BY value are counted together. Add a tie-breaker (`id`) or write `ROWS` explicitly.

### LAG / LEAD: compare with the previous or next row

```sql
WITH monthly AS (
  SELECT date_trunc('month', created_at)::date AS month, SUM(amount) AS revenue
  FROM orders WHERE status = 'PAID'
  GROUP BY 1
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM monthly;
```

| month | revenue | prev | growth_pct |
|---|---|---|---|
| 2026-01 | 2700 | NULL | NULL |
| 2026-02 | 3300 | 2700 | 22.2 |
| 2026-03 | 2100 | 3300 | -36.4 |

Also: `FIRST_VALUE`, `LAST_VALUE` (watch the frame), `NTH_VALUE`.

### Percentage of total

```sql
SELECT d.name, SUM(e.salary) AS payroll,
       ROUND(100.0 * SUM(e.salary) / SUM(SUM(e.salary)) OVER (), 1) AS pct
FROM employees e JOIN departments d ON d.id = e.dept_id
GROUP BY d.name ORDER BY payroll DESC;
-- Engineering 590000 59.6 | Sales 320000 32.3 | HR 80000 8.1
```

`SUM(SUM(...)) OVER ()` is a window over the **grouped** result: the aggregate runs first, then the window.

## 🔍 GROUP BY vs Window Function

| | `GROUP BY` | Window function |
|---|---|---|
| Rows out | One per group | Same as rows in |
| Can show row details next to the aggregate | No | Yes |
| Filter with | `HAVING` | Outer query / CTE |
| Example | "Total per department" | "Each employee and their department total" |

## 🌍 Real-World Use

- **Dashboards:** monthly revenue, growth (`LAG`), cohort retention, running balances.
- **Leaderboards:** `DENSE_RANK` per region or season.
- **De-duplication:** `ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at)`, then keep `rn = 1`.
- **Hierarchies:** recursive CTEs for categories and org charts (instead of many round trips from the app).

## 🎯 Likely Interview Questions

1. **`WHERE` vs `HAVING`?**
2. **Can you use a column in `SELECT` that isn't in `GROUP BY`?**
3. **Subquery vs JOIN: which is faster?** — It depends on the planner; check with `EXPLAIN`. Correlated subqueries can be slow.
4. **`IN` vs `EXISTS`? Why is `NOT IN` dangerous?**
5. **What is a correlated subquery?**
6. **What is a CTE? CTE vs subquery vs temporary table vs view?**
7. **What is a recursive CTE? Write an org-chart query.**
8. **What is a window function? How is it different from GROUP BY?**
9. **ROW_NUMBER vs RANK vs DENSE_RANK?** Show the output with ties.
10. **How do you get the top 3 salaries per department?**
11. **How do you write a running total? What is a window frame?**
12. **What do LAG and LEAD do? Calculate month-over-month growth.**
13. **Why can't you use a window function in WHERE?**
14. **How do you pivot rows into columns?** — Conditional aggregation (`CASE` / `FILTER`).

---

[← SQL Fundamentals & Joins](01-sql-fundamentals-joins.md) | [Index](../README.md) | [Next: Indexes, Transactions & Normalisation →](03-indexes-transactions-normalization.md)
