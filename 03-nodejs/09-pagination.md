# Chapter 59 — Pagination

## 📖 Definition

Pagination is the technique of returning a subset of a large result set, page by page, to keep responses fast and predictable.

## 🔍 Two Common Approaches

| Approach | URL | DB Query | Pros | Cons |
|----------|-----|----------|------|------|
| **Offset** | `?page=2&limit=20` | `SKIP 20 LIMIT 20` | Easy, supports jump-to-page | Slow on deep pages, unstable under inserts |
| **Cursor** | `?after=<id>&limit=20` | `WHERE id > X LIMIT 20` | Fast, stable under inserts | No jump-to-page, requires a sortable cursor field |

## 💻 Code Example — Offset Pagination (Express + Mongoose)

```js
// GET /users?page=2&limit=20
router.get("/users", async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  ?? "1"));
  const limit = Math.min(100, parseInt(req.query.limit ?? "20"));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    User.find().sort("-createdAt").skip(skip).limit(limit),
    User.countDocuments(),
  ]);

  res.json({
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext:    skip + items.length < total,
      hasPrev:    page > 1,
    },
  });
});
```

## 💻 Code Example — Cursor Pagination

```js
// GET /messages?after=<id>&limit=20
router.get("/messages", async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit ?? "20"));
  const after = req.query.after;

  const query = {};
  if (after) query._id = { $gt: after };

  // fetch limit + 1 to detect if there's a next page
  const items = await Message.find(query).sort("_id").limit(limit + 1);

  const hasNext = items.length > limit;
  const data    = hasNext ? items.slice(0, -1) : items;

  res.json({
    data,
    meta: {
      nextCursor: hasNext ? data[data.length - 1]._id : null,
    },
  });
});
```

## 💻 Code Example — Cursor on `(createdAt, _id)` for Stability

When the cursor field isn't unique (timestamps can collide), combine with `_id`:

```js
// Cursor format: "createdAt|_id"
function decodeCursor(s) {
  if (!s) return null;
  const [ts, id] = Buffer.from(s, "base64").toString().split("|");
  return { createdAt: new Date(ts), _id: id };
}

router.get("/posts", async (req, res) => {
  const limit = 20;
  const cursor = decodeCursor(req.query.cursor);

  const query = {};
  if (cursor) {
    query.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const items = await Post.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasNext = items.length > limit;
  const data = hasNext ? items.slice(0, -1) : items;
  const last = data[data.length - 1];
  const next = hasNext
    ? Buffer.from(`${last.createdAt.toISOString()}|${last._id}`).toString("base64")
    : null;

  res.json({ data, meta: { nextCursor: next } });
});
```

## 💻 Code Example — SQL Equivalent

```sql
-- Offset
SELECT * FROM users
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;          -- page 3

-- Cursor (keyset pagination)
SELECT * FROM users
WHERE (created_at, id) < (?, ?)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Cursor / keyset pagination is the standard for high-scale feeds (Facebook, Twitter, etc.).

## 💻 Code Example — Frontend "Load More" Pattern

```jsx
function Feed() {
  const [items,  setItems]  = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done,   setDone]   = useState(false);

  const load = async () => {
    const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
    const { data, meta } = await fetch(url).then(r => r.json());
    setItems(prev => [...prev, ...data]);
    setCursor(meta.nextCursor);
    if (!meta.nextCursor) setDone(true);
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      {items.map(p => <Post key={p.id} {...p} />)}
      {!done && <button onClick={load}>Load more</button>}
    </>
  );
}
```

## 💻 Code Example — Infinite Scroll with IntersectionObserver

```jsx
function InfiniteFeed() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const sentinel = useRef();

  const load = useCallback(async () => {
    const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
    const { data, meta } = await fetch(url).then(r => r.json());
    setItems(prev => [...prev, ...data]);
    setCursor(meta.nextCursor);
  }, [cursor]);

  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) load();
    });
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [load]);

  return (
    <>
      {items.map(p => <Post key={p.id} {...p} />)}
      <div ref={sentinel} />
    </>
  );
}
```

## ⚠️ Common Mistakes

- **Trusting client `limit`** without clamping → can be abused for DoS.
- **Forgetting to sort** before `skip/limit` → results are non-deterministic.
- **Counting on every page** — `countDocuments` is expensive; cache or skip when not needed.
- **Using `skip` past 10k+** — DB still has to scan everything before that point.

## 🎯 Likely Interview Questions

1. **How do you paginate a large dataset?**
2. **Offset vs cursor pagination?**
3. **Why is `skip` slow on deep pages?**
4. **How would you implement infinite scroll?**
5. **What if data changes while the user is paginating?** — Cursor pagination is stable; offset may skip or duplicate items.

---

[← File Upload (S3)](08-file-upload-s3.md) | [Index](../README.md) | [Next: Rate Limiting →](10-rate-limiting.md)
