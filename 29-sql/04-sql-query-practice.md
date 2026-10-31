# Chapter 103 — SQL Query Practice Problems

## 📖 How to Use This Chapter

These are the SQL problems asked most often in interviews and online tests. They all use the **sample database from [SQL Fundamentals & Joins](01-sql-fundamentals-joins.md)** (employees, departments, customers, orders), plus one extra `logins` table for the streak problem.

The solutions are written for **PostgreSQL**. **Each query's output was checked by running it against the same data** (on SQLite 3.46, with Postgres-only functions swapped for SQLite ones). Try each problem yourself before you read the answer.

```sql
CREATE TABLE logins (user_id INT, login_date DATE);
INSERT INTO logins VALUES
  (1,'2026-03-01'),(1,'2026-03-02'),(1,'2026-03-03'),(1,'2026-03-05'),
  (2,'2026-03-01'),(2,'2026-03-03'),
  (3,'2026-03-10'),(3,'2026-03-11'),(3,'2026-03-12'),(3,'2026-03-13');
```

---

## 🟢 Easy

### 1. Second-highest salary

```sql
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

**Result:** `150000`

This returns `NULL` (not an empty result) when there's no second value, which is what LeetCode expects.

### 2. Nth-highest distinct salary (N = 3)

```sql
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 2;          -- OFFSET N-1
```

**Result:** `130000` (distinct salaries: 200000, 150000, **130000**, …)

The window-function version, which also works per department:

```sql
SELECT DISTINCT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees
) t WHERE rnk = 3;
```

### 3. Customers who never placed an order

```sql
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
```

**Result:** `Divya`, `Esha`

### 4. Departments with no employees

```sql
SELECT d.name
FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);
```

**Result:** `Legal`. (Using `NOT IN (SELECT dept_id FROM employees)` returns **nothing**, because Neha's `dept_id` is NULL. See [Aggregation, Subqueries, CTEs & Window Functions](02-aggregation-subqueries-window-functions.md).)

### 5. Duplicate emails (case-insensitive)

```sql
SELECT LOWER(email) AS email, COUNT(*) AS n
FROM customers
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;
```

**Result:** `anil@x.com | 2`

### 6. Delete duplicates, keeping the lowest id

```sql
DELETE FROM customers c
USING customers d
WHERE LOWER(c.email) = LOWER(d.email)
  AND c.id > d.id;                -- removes Esha (id 5), keeps Anil (id 1)
```

The portable version:

```sql
DELETE FROM customers
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY id) AS rn
    FROM customers
  ) t WHERE rn > 1
);
```

Afterwards, stop it from happening again: `CREATE UNIQUE INDEX ON customers (LOWER(email));`

### 7. Hires per year

```sql
SELECT EXTRACT(YEAR FROM hired_on) AS year, COUNT(*) AS hires
FROM employees
GROUP BY year
ORDER BY year;
```

**Result:** 2019 → 1, 2020 → 2, 2021 → 2, 2022 → 1, 2023 → 2, 2024 → 1

### 8. Team size per manager

```sql
SELECT m.name AS manager, COUNT(e.id) AS reports
FROM employees m
JOIN employees e ON e.manager_id = m.id
GROUP BY m.id, m.name
ORDER BY reports DESC, manager;
```

**Result:** Asha 5, Priya 2, Ravi 1

---

## 🟡 Medium

### 9. Employees who earn more than their manager

```sql
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;
```

**Result:** `John | 130000 | Priya | 120000`

### 10. Departments with an average salary above 1,00,000

```sql
SELECT d.name, COUNT(*) AS headcount, ROUND(AVG(e.salary), 2) AS avg_salary
FROM employees e
JOIN departments d ON d.id = e.dept_id
GROUP BY d.name
HAVING AVG(e.salary) > 100000
ORDER BY avg_salary DESC;
```

**Result:** `Engineering | 4 | 147500.00`, `Sales | 3 | 106666.67`

### 11. Employees who earn above their department's average

```sql
SELECT e.name, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(x.salary) FROM employees x WHERE x.dept_id = e.dept_id)
ORDER BY e.salary DESC;
```

**Result:** Asha 200000, Ravi 150000, Meera 150000, John 130000, Priya 120000

The window-function version, which reads the table once:

```sql
SELECT name, salary FROM (
  SELECT name, salary, AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg FROM employees
) t
WHERE salary > dept_avg;
```

### 12. Top 2 salaries in each department (ties included)

```sql
SELECT dept, name, salary FROM (
  SELECT d.name AS dept, e.name, e.salary,
         DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rnk
  FROM employees e
  JOIN departments d ON d.id = e.dept_id
) t
WHERE rnk <= 2
ORDER BY dept, salary DESC;
```

| dept | name | salary |
|---|---|---|
| Engineering | Asha | 200000 |
| Engineering | Ravi | 150000 |
| Engineering | Meera | 150000 |
| HR | Vikram | 80000 |
| Sales | John | 130000 |
| Sales | Priya | 120000 |

Ask the interviewer: "Should ties both be included?" If not, use `ROW_NUMBER`.

### 13. Latest order for each customer

```sql
SELECT customer_id, order_id, created_at FROM (
  SELECT customer_id, id AS order_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
  FROM orders
) t
WHERE rn = 1;
```

**Result:** customer 1 → order 9 (2026-03-18), customer 2 → order 7 (2026-03-01), customer 3 → order 8 (2026-03-03)

Postgres shortcut: `SELECT DISTINCT ON (customer_id) customer_id, id, created_at FROM orders ORDER BY customer_id, created_at DESC;`

### 14. Order counts by status per customer (pivot)

```sql
SELECT c.name,
       COUNT(*) FILTER (WHERE o.status = 'PAID')      AS paid,
       COUNT(*) FILTER (WHERE o.status = 'CANCELLED') AS cancelled,
       SUM(CASE WHEN o.status = 'PAID' THEN o.amount ELSE 0 END) AS paid_amount
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.name
ORDER BY c.name;
```

**Result:** Anil 4 / 0 / 3700 · Bina 2 / 1 / 1900 · Chetan 1 / 0 / 2500

### 15. Running total of paid revenue

```sql
SELECT id, created_at, amount,
       SUM(amount) OVER (ORDER BY created_at, id) AS running_total
FROM orders
WHERE status = 'PAID'
ORDER BY created_at, id;
```

**Result:** 500, 2000, 2700, 5200, 6000, 7200, **8100**

### 16. Each department's share of total payroll

```sql
SELECT d.name, SUM(e.salary) AS payroll,
       ROUND(100.0 * SUM(e.salary) / SUM(SUM(e.salary)) OVER (), 1) AS pct
FROM employees e
JOIN departments d ON d.id = e.dept_id
GROUP BY d.name
ORDER BY payroll DESC;
```

**Result:** Engineering 590000 (59.6%), Sales 320000 (32.3%), HR 80000 (8.1%)

### 17. Highest-spending customer in each city

```sql
WITH spend AS (
  SELECT c.id, c.city, c.name, SUM(o.amount) AS total
  FROM customers c
  JOIN orders o ON o.customer_id = c.id AND o.status = 'PAID'
  GROUP BY c.id, c.city, c.name
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY city ORDER BY total DESC) AS rn FROM spend
)
SELECT city, name, total FROM ranked WHERE rn = 1 ORDER BY city;
```

**Result:** `Delhi | Bina | 1900`, `Pune | Anil | 3700`

---

## 🔴 Hard

### 18. Month-over-month revenue growth

```sql
WITH monthly AS (
  SELECT to_char(created_at, 'YYYY-MM') AS month, SUM(amount) AS revenue
  FROM orders
  WHERE status = 'PAID'
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

### 19. Login streaks of 3 or more days in a row (gaps and islands)

```sql
WITH d AS (
  SELECT DISTINCT user_id, login_date FROM logins
),
g AS (
  SELECT user_id, login_date,
         login_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date))::int AS grp
  FROM d
)
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM g
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;
```

| user_id | streak_start | streak_end | days |
|---|---|---|---|
| 1 | 2026-03-01 | 2026-03-03 | 3 |
| 3 | 2026-03-10 | 2026-03-13 | 4 |

**The trick:** for days in a row, the date and the row number both go up by 1, so `date − row_number` stays **the same**. Each streak (an "island") gets its own constant `grp`.

```
user 1: 03-01 − 1 = 02-28 │ 03-02 − 2 = 02-28 │ 03-03 − 3 = 02-28 │ 03-05 − 4 = 03-01
                 └──────────── same group (3 days) ────────────┘      new group
```

### 20. Org chart with levels (recursive CTE)

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS level FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.level + 1
  FROM employees e JOIN chain c ON e.manager_id = c.id
)
SELECT level, name FROM chain ORDER BY level, name;
```

**Result:** level 0 Asha · level 1 Meera, Neha, Priya, Ravi, Vikram · level 2 John, Karan, Sara

### 21. Median salary

```sql
-- Postgres
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median FROM employees;

-- Portable
SELECT AVG(salary) AS median FROM (
  SELECT salary,
         ROW_NUMBER() OVER (ORDER BY salary) AS rn,
         COUNT(*) OVER () AS cnt
  FROM employees
) t
WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2);
```

**Result:** `120000` (the 5th of 9 sorted salaries). With an even count, the two middle rows are averaged.

### 22. New and total customers by month of first purchase (cohorts)

```sql
WITH firsts AS (
  SELECT customer_id, MIN(to_char(created_at, 'YYYY-MM')) AS first_month
  FROM orders
  WHERE status = 'PAID'
  GROUP BY customer_id
)
SELECT first_month,
       COUNT(*) AS new_customers,
       SUM(COUNT(*)) OVER (ORDER BY first_month) AS total_customers
FROM firsts
GROUP BY first_month;
```

**Result:** `2026-01 | 2 | 2`, `2026-02 | 1 | 3`

### 23. Row counts for each join type (a check that you understand joins)

```sql
SELECT
  (SELECT COUNT(*) FROM employees e JOIN       departments d ON d.id = e.dept_id) AS inner_rows,
  (SELECT COUNT(*) FROM employees e LEFT JOIN  departments d ON d.id = e.dept_id) AS left_rows,
  (SELECT COUNT(*) FROM employees e RIGHT JOIN departments d ON d.id = e.dept_id) AS right_rows,
  (SELECT COUNT(*) FROM employees e FULL JOIN  departments d ON d.id = e.dept_id) AS full_rows,
  (SELECT COUNT(*) FROM employees CROSS JOIN departments)                         AS cross_rows;
```

**Result:** `8 | 9 | 9 | 10 | 36`

---

## 🧠 How to Approach a SQL Problem Out Loud

1. **Clarify:** What about ties? NULLs? Should cancelled orders count? Distinct or not?
2. **Pick the grain:** what is one row of the output? (One per customer? Per month?)
3. **Build it in steps with CTEs:** filter → aggregate → rank or window → final filter.
4. **Check edge cases:** an empty group, NULL foreign keys, duplicate timestamps (add a tie-breaker to `ORDER BY`).
5. **Talk about performance:** "I'd add an index on `orders (customer_id, created_at)` for this."

---

[← Indexes, Transactions & Normalisation](03-indexes-transactions-normalization.md) | [Index](../README.md) | [Next: SQL Interview Questions →](05-sql-interview-questions.md)
