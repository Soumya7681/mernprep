# Chapter 133 — SQL Coding Questions

## 📖 Definition

SQL coding rounds give you a small schema (usually **e-commerce**: customers, orders, products, order items) and ask you to **write DDL and queries live**: best sellers, products never sold, retention, gaps between orders, pivots, upserts, and safe stock updates. Interviewers check correctness first (joins that don't duplicate rows, NULL handling, ties), then readability (CTEs), then performance (indexes).

These problems extend the sample database from [SQL Fundamentals & Joins](../29-sql/01-sql-fundamentals-joins.md) with three new tables. For more classic warm-ups (second-highest salary, gaps and islands, org charts), see [SQL Query Practice Problems](../29-sql/04-sql-query-practice.md).

The solutions are written for **PostgreSQL**. **Every query was run against this exact data** (on SQLite 3.46, with Postgres date functions swapped for SQLite ones), and the results shown are real.

## 🧠 Checklist While Coding

- Ask: should **cancelled or pending** orders count? What about **ties**? What should happen with **NULLs**?
- **Aggregate before you join** when two one-to-many tables meet, or the rows multiply.
- Prefer `NOT EXISTS` over `NOT IN` for "never did X" questions.
- Name every step with a **CTE**; it's easier to explain out loud.
- Finish with: "I'd index `order_items(product_id)` and `orders(customer_id, created_at)` for this."

---

## 1. DDL: Products, Order Items and Inventory With Constraints

```sql
CREATE TABLE products (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  category  TEXT NOT NULL,
  price     INT  NOT NULL CHECK (price >= 0)               -- paise; never FLOAT for money
);

CREATE TABLE order_items (
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id),        -- no cascade: don't delete sales history
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  INT NOT NULL,                                -- the price AT PURCHASE time
  PRIMARY KEY (order_id, product_id)                       -- one line per product per order
);
CREATE INDEX idx_order_items_product ON order_items (product_id);   -- the PK already covers order_id

CREATE TABLE inventory (
  product_id  INT PRIMARY KEY REFERENCES products(id),
  stock       INT NOT NULL CHECK (stock >= 0)              -- the database itself refuses negative stock
);

INSERT INTO products VALUES
  (1, 'Pen', 'Stationery', 50), (2, 'Notebook', 'Stationery', 200), (3, 'Backpack', 'Bags', 1200),
  (4, 'Water Bottle', 'Kitchen', 300), (5, 'Desk Lamp', 'Electronics', 900), (6, 'Stapler', 'Stationery', 250);

INSERT INTO order_items VALUES
  (1,1,4,50), (1,2,1,200), (1,4,1,100),        -- order 1 = 500 (water bottle was on offer)
  (2,3,1,1200), (2,4,1,300),                   -- order 2 = 1500
  (3,1,10,50), (3,2,1,200),                    -- order 3 = 700
  (4,4,1,300),                                 -- order 4 = 300 (CANCELLED)
  (5,3,1,1200), (5,5,1,900), (5,1,8,50),       -- order 5 = 2500
  (6,2,4,200),                                 -- order 6 = 800
  (7,5,1,900), (7,4,1,300),                    -- order 7 = 1200
  (8,2,2,200),                                 -- order 8 = 400 (PENDING)
  (9,1,2,50), (9,3,1,800);                     -- order 9 = 900 (backpack discounted)

INSERT INTO inventory VALUES (1, 100), (2, 40), (3, 5);
```

The constraints at work (checked):

```sql
INSERT INTO order_items VALUES (1, 1, 0, 50);   -- ERROR: CHECK constraint (quantity > 0)
INSERT INTO order_items VALUES (1, 1, 1, 50);   -- ERROR: duplicate key (order_id, product_id)
```

## 2. Top 3 Best-Selling Products (Paid Orders Only)

```sql
SELECT p.name,
       SUM(i.quantity)                AS units,
       SUM(i.quantity * i.unit_price) AS revenue
FROM order_items i
JOIN orders   o ON o.id = i.order_id AND o.status = 'PAID'
JOIN products p ON p.id = i.product_id
GROUP BY p.id, p.name
ORDER BY units DESC, revenue DESC
LIMIT 3;
```

| name | units | revenue |
|---|---|---|
| Pen | 24 | 1200 |
| Notebook | 6 | 1200 |
| Backpack | 3 | 3200 |

Ask: "best-selling by **units** or by **revenue**?" By revenue, Backpack would be first.

## 3. Products That Were Never Ordered

```sql
SELECT p.name
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.product_id = p.id);
```

**Result:** `Stapler`

## 4. Customers Who Bought a Backpack but Never a Desk Lamp

```sql
SELECT c.name
FROM customers c
WHERE EXISTS (
        SELECT 1 FROM orders o
        JOIN order_items i ON i.order_id = o.id
        JOIN products p    ON p.id = i.product_id
        WHERE o.customer_id = c.id AND p.name = 'Backpack')
  AND NOT EXISTS (
        SELECT 1 FROM orders o
        JOIN order_items i ON i.order_id = o.id
        JOIN products p    ON p.id = i.product_id
        WHERE o.customer_id = c.id AND p.name = 'Desk Lamp');
```

**Result:** `Anil`. (Chetan bought both in order 5.)

This "bought A but not B" pattern is also used for cross-sell targeting.

## 5. Customers With a Paid Order in Every Month of Q1 (Relational Division)

```sql
SELECT c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'PAID'
  AND o.created_at >= '2026-01-01' AND o.created_at < '2026-04-01'   -- a half-open range uses the index
GROUP BY c.id, c.name
HAVING COUNT(DISTINCT date_trunc('month', o.created_at)) = 3;
```

**Result:** `Anil` (Jan, Feb, Mar). Bina's February order was cancelled.

The `COUNT(DISTINCT ...) = <total>` trick answers every "did X for **all** of Y" question.

## 6. Customers Whose Average Order Value Is Above the Overall Average

```sql
WITH per_customer AS (
  SELECT customer_id, AVG(amount) AS aov, COUNT(*) AS orders
  FROM orders WHERE status = 'PAID'
  GROUP BY customer_id
)
SELECT c.name, pc.orders, ROUND(pc.aov, 2) AS aov
FROM per_customer pc
JOIN customers c ON c.id = pc.customer_id
WHERE pc.aov > (SELECT AVG(amount) FROM orders WHERE status = 'PAID')
ORDER BY aov DESC;
```

**Result:** `Chetan | 1 | 2500.00`. The overall average is 8100 / 7 ≈ 1157; Anil averages 925 and Bina 950.

## 7. Repeat-Purchase Rate

```sql
WITH counts AS (
  SELECT customer_id, COUNT(*) AS n
  FROM orders WHERE status = 'PAID'
  GROUP BY customer_id
)
SELECT COUNT(*)                                      AS buyers,
       COUNT(*) FILTER (WHERE n > 1)                 AS repeat_buyers,
       ROUND(100.0 * COUNT(*) FILTER (WHERE n > 1) / COUNT(*), 1) AS repeat_rate_pct
FROM counts;
```

**Result:** `3 | 2 | 66.7`

## 8. Average Days Between a Customer's Orders

```sql
WITH gaps AS (
  SELECT customer_id,
         created_at - LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at) AS gap_days
  FROM orders WHERE status = 'PAID'
)
SELECT customer_id, COUNT(gap_days) AS gaps, ROUND(AVG(gap_days), 1) AS avg_gap_days
FROM gaps
GROUP BY customer_id
HAVING COUNT(gap_days) > 0
ORDER BY customer_id;
```

**Result:** customer 1 → 3 gaps, **24.0** days (15 + 25 + 32) · customer 2 → 1 gap, **35.0** days

In Postgres, `date - date` gives an integer number of days. For `TIMESTAMPTZ`, use `EXTRACT(EPOCH FROM ...) / 86400`.

## 9. First and Last Order per Customer (With Amounts)

```sql
SELECT DISTINCT customer_id,
       FIRST_VALUE(created_at) OVER w AS first_order,
       LAST_VALUE(created_at)  OVER w AS last_order,
       FIRST_VALUE(amount)     OVER w AS first_amount,
       LAST_VALUE(amount)      OVER w AS last_amount
FROM orders
WHERE status = 'PAID'
WINDOW w AS (PARTITION BY customer_id ORDER BY created_at
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
ORDER BY customer_id;
```

| customer_id | first_order | last_order | first_amount | last_amount |
|---|---|---|---|---|
| 1 | 2026-01-05 | 2026-03-18 | 500 | 900 |
| 2 | 2026-01-25 | 2026-03-01 | 700 | 1200 |
| 3 | 2026-02-10 | 2026-02-10 | 2500 | 2500 |

**The trap:** without the full `ROWS BETWEEN ... UNBOUNDED FOLLOWING` frame, `LAST_VALUE` just returns the **current** row, because the default frame ends at the current row.

## 10. Month-1 → Month-2 Retention

```sql
SELECT c.name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'PAID'
              AND o.created_at >= '2026-01-01' AND o.created_at < '2026-02-01')
  AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'PAID'
              AND o.created_at >= '2026-02-01' AND o.created_at < '2026-03-01');
```

**Result:** `Anil` (1 of the 2 January buyers came back in February, so 50% retention).

## 11. Rank Products by Revenue Within Each Category

```sql
SELECT category, name, revenue, rnk FROM (
  SELECT p.category, p.name,
         SUM(i.quantity * i.unit_price) AS revenue,
         RANK() OVER (PARTITION BY p.category ORDER BY SUM(i.quantity * i.unit_price) DESC) AS rnk
  FROM order_items i
  JOIN orders o   ON o.id = i.order_id AND o.status = 'PAID'
  JOIN products p ON p.id = i.product_id
  GROUP BY p.id, p.category, p.name
) t
ORDER BY category, rnk;
```

| category | name | revenue | rnk |
|---|---|---|---|
| Bags | Backpack | 3200 | 1 |
| Electronics | Desk Lamp | 1800 | 1 |
| Kitchen | Water Bottle | 700 | 1 |
| Stationery | Pen | 1200 | **1** |
| Stationery | Notebook | 1200 | **1** |

A window function **over an aggregate** works because `GROUP BY` runs before the window step. Pen and Notebook tie, and `RANK` shows it.

## 12. Running Lifetime Value per Customer

```sql
SELECT customer_id, created_at, amount,
       SUM(amount) OVER (PARTITION BY customer_id ORDER BY created_at, id) AS lifetime_value
FROM orders
WHERE status = 'PAID'
ORDER BY customer_id, created_at;
```

**Result:** customer 1: 500 → 2000 → 2800 → **3700** · customer 2: 700 → **1900** · customer 3: **2500**

## 13. Find Missing IDs (Gaps in a Sequence)

```sql
-- invoice numbers: 1, 2, 3, 6, 7, 10
WITH ids AS (
  SELECT id, LEAD(id) OVER (ORDER BY id) AS next_id FROM invoices
)
SELECT id + 1 AS gap_start, next_id - 1 AS gap_end
FROM ids
WHERE next_id - id > 1;
```

**Result:** `4–5`, `8–9`

## 14. Pivot: Revenue by Category per Month

```sql
SELECT p.category,
       COALESCE(SUM(i.quantity * i.unit_price) FILTER (WHERE date_trunc('month', o.created_at) = '2026-01-01'), 0) AS jan,
       COALESCE(SUM(i.quantity * i.unit_price) FILTER (WHERE date_trunc('month', o.created_at) = '2026-02-01'), 0) AS feb,
       COALESCE(SUM(i.quantity * i.unit_price) FILTER (WHERE date_trunc('month', o.created_at) = '2026-03-01'), 0) AS mar
FROM order_items i
JOIN orders o   ON o.id = i.order_id AND o.status = 'PAID'
JOIN products p ON p.id = i.product_id
GROUP BY p.category
ORDER BY p.category;
```

| category | jan | feb | mar |
|---|---|---|---|
| Bags | 1200 | 1200 | 800 |
| Electronics | 0 | 900 | 900 |
| Kitchen | 400 | 0 | 300 |
| Stationery | 1100 | 1200 | 100 |

With `FILTER`, a month with no rows gives `NULL`, which is why each column is wrapped in `COALESCE(..., 0)`. The checked run used `SUM(CASE WHEN ... THEN ... ELSE 0 END)`, which returns 0 directly and works in every database.

## 15. Upsert: Add Stock, or Create the Row

```sql
INSERT INTO inventory (product_id, stock)
VALUES (2, 10), (4, 25)
ON CONFLICT (product_id) DO UPDATE
SET stock = inventory.stock + EXCLUDED.stock;     -- EXCLUDED = the row you tried to insert
```

**Result:** Notebook 40 → **50** (updated), Water Bottle → **25** (new row), Pen and Backpack unchanged.

MySQL: `INSERT ... ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)` (or `AS new ... new.stock` in MySQL 8.0.19+).

## 16. Reserve Stock Safely Under Concurrency

```sql
UPDATE inventory
SET stock = stock - 3
WHERE product_id = 3 AND stock >= 3;      -- check and change in ONE atomic statement
```

**Result:** the first call updates **1 row** (5 → 2). Running it again updates **0 rows**, so the app knows it's out of stock. The stock never goes negative, and the `CHECK (stock >= 0)` is a second safety net.

In the app, check the affected row count (`cursor.rowcount`, or `RETURNING stock`). Never do `SELECT stock`, then check in code, then `UPDATE`; two requests can both pass the check.

## 17. Show Days With Zero Orders (Fill Date Gaps)

```sql
SELECT d::date AS day,
       COUNT(o.id)                AS orders,
       COALESCE(SUM(o.amount), 0) AS revenue
FROM generate_series('2026-03-01'::date, '2026-03-07'::date, interval '1 day') AS d
LEFT JOIN orders o ON o.created_at = d::date AND o.status = 'PAID'
GROUP BY d
ORDER BY d;
```

**Result:** 2026-03-01 → 1 order, 1200 · 03-02 to 03-07 → **0, 0** (the PENDING order on 03-03 isn't counted)

Without the generated calendar, the days with no orders would simply be **missing** from the chart. (Without `generate_series`, use a recursive CTE.)

## 18. Each Customer's Second Order

```sql
SELECT customer_id, id AS second_order_id, created_at FROM (
  SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at, id) AS rn
  FROM orders o WHERE status = 'PAID'
) t
WHERE rn = 2
ORDER BY customer_id;
```

**Result:** customer 1 → order 2 (2026-01-20) · customer 2 → order 7 (2026-03-01). Chetan has only one order, so he doesn't appear.

## 19. Conditional Update With CASE (Different Raise per Department)

```sql
UPDATE employees
SET salary = CASE dept_id
               WHEN 1 THEN salary * 110 / 100      -- Engineering +10%
               WHEN 2 THEN salary * 105 / 100      -- Sales +5%
               ELSE salary                         -- everyone else (and NULL dept) unchanged
             END;
```

**Result:** Asha 200000 → 220000 · Priya 120000 → 126000 · Vikram 80000 → 80000 · Neha (no dept) 60000 → 60000

Without `ELSE salary`, every unmatched row would be set to **NULL**. That's a classic bug, and the `NOT NULL` constraint would make the whole statement fail.

## 20. Data Check: Orders Whose Total Doesn't Match Their Items

```sql
SELECT o.id, o.amount, SUM(i.quantity * i.unit_price) AS items_total
FROM orders o
LEFT JOIN order_items i ON i.order_id = o.id
GROUP BY o.id, o.amount
HAVING o.amount <> COALESCE(SUM(i.quantity * i.unit_price), 0);
```

**Result:** no rows. Every order's `amount` matches its line items. Run checks like this as a scheduled job after migrations or imports. The `LEFT JOIN` + `COALESCE` also catches orders that have **no** items.

---

## 🎯 Likely Interview Questions

1. **Why does joining orders and order items before summing `orders.amount` give the wrong total?**
2. **`NOT EXISTS` vs `LEFT JOIN ... IS NULL` vs `NOT IN`: which would you use?**
3. **How do you answer "customers who did X in every month"?** — `COUNT(DISTINCT month) = N`.
4. **Why does `LAST_VALUE` return the current row?** — The default window frame.
5. **How do you pivot rows into columns in Postgres?** — `FILTER` or `CASE` inside aggregates (or the `crosstab` extension).
6. **How do you show dates that have no data?** — `generate_series` or a calendar table + `LEFT JOIN`.
7. **How do you stop overselling?** — An atomic conditional `UPDATE` + check the row count + a `CHECK` constraint.
8. **Why store `unit_price` on `order_items` when `products.price` exists?**
9. **What indexes would these queries need?**

---

[← Python Coding Questions](07-python-coding-questions.md) | [Index](../README.md) | [Next: FastAPI Coding Questions →](09-fastapi-coding-questions.md)
