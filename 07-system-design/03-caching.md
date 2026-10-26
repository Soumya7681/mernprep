# Chapter 127 — Caching

## 📖 Definition

Caching is the practice of storing the results of expensive computations or remote lookups in a fast, nearby location so subsequent requests are served instantly.

## 📊 Layers of Cache

```
[Browser]  →  [CDN]  →  [App-process (LRU)]  →  [Distributed Cache (Redis)]  →  [DB]
   ms             ms              μs                  ms                          ms-s
```

Each layer adds capacity but also complexity (invalidation, consistency).

## 🔁 Strategies

### 1. Cache-Aside (Lazy)
App reads from cache; on miss, reads DB then writes back to cache.
```
read:  cache.get(k) ?? (db.get(k) >> cache.set(k))
write: db.set(k, v); cache.del(k)
```
Pros: simple; only caches what's used.
Cons: cold reads pay full DB cost.

### 2. Write-Through
App writes to cache and DB together; reads always hit cache.
```
write: cache.set(k, v); db.set(k, v)
read:  cache.get(k)
```
Pros: cache always fresh.
Cons: every write pays cache + DB cost.

### 3. Write-Behind (Write-Back)
App writes to cache only; background process flushes to DB.
```
write: cache.set(k, v); queue.add({k, v})
```
Pros: super-fast writes.
Cons: data loss risk if cache crashes before flush.

### 4. Refresh-Ahead
Background job pre-populates cache before TTL expires.
Pros: avoids stampede.
Cons: extra infrastructure.

## 💻 Code Example — Redis Cache-Aside

```js
import { createClient } from "redis";
const redis = createClient();
await redis.connect();

export async function cached(key, ttl, fetcher) {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const fresh = await fetcher();
  await redis.set(key, JSON.stringify(fresh), { EX: ttl });
  return fresh;
}

// Usage
const user = await cached(`user:${id}`, 300, () => User.findById(id).lean());
```

## 💻 Code Example — Invalidation on Write

```js
async function updateUser(id, patch) {
  const updated = await User.findByIdAndUpdate(id, patch, { new: true });
  await redis.del(`user:${id}`);                   // invalidate
  return updated;
}
```

## 💻 Code Example — Tag-Based Invalidation

```js
// Store a set of all keys tied to a tag
async function setWithTag(key, tag, value, ttl) {
  await redis.set(key, JSON.stringify(value), { EX: ttl });
  await redis.sAdd(`tag:${tag}`, key);
}

async function invalidateTag(tag) {
  const keys = await redis.sMembers(`tag:${tag}`);
  if (keys.length) await redis.del(keys);
  await redis.del(`tag:${tag}`);
}

// Usage
await setWithTag(`product:${id}`, `category:${product.cat}`, product, 600);
// On category change:
await invalidateTag(`category:${product.cat}`);
```

## 💻 Code Example — In-Process LRU Cache

```js
import { LRUCache } from "lru-cache";

const cache = new LRUCache({ max: 1000, ttl: 60_000 });

function get(id) {
  if (cache.has(id)) return cache.get(id);
  const v = compute(id);
  cache.set(id, v);
  return v;
}
```
Fastest possible — but not shared across instances.

## 💻 Code Example — HTTP Caching Headers

```js
app.get("/api/products", (req, res) => {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(products);
});

// ETag for conditional GETs
app.get("/api/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  const etag = `"${product.updatedAt.getTime()}"`;
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.set("ETag", etag).json(product);
});
```

The CDN will cache the response; clients use `If-None-Match` for revalidation.

## 💻 Code Example — Cache Stampede Prevention

Problem: when a hot key expires, hundreds of concurrent requests all miss → all hit DB.

### Solution: distributed lock
```js
async function cached(key, ttl, fetcher) {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const lock = `lock:${key}`;
  const ok = await redis.set(lock, "1", { NX: true, EX: 10 });

  if (!ok) {
    // Another instance is computing — wait briefly and retry
    await new Promise(r => setTimeout(r, 100));
    return cached(key, ttl, fetcher);
  }

  try {
    const fresh = await fetcher();
    await redis.set(key, JSON.stringify(fresh), { EX: ttl });
    return fresh;
  } finally {
    await redis.del(lock);
  }
}
```

## 💻 Code Example — Stale-While-Revalidate (App-Level)

```js
async function swr(key, ttl, fetcher) {
  const cached = await redis.get(key);
  if (cached) {
    // Refresh in the background
    fetcher().then(fresh =>
      redis.set(key, JSON.stringify(fresh), { EX: ttl })
    );
    return JSON.parse(cached);
  }
  const fresh = await fetcher();
  await redis.set(key, JSON.stringify(fresh), { EX: ttl });
  return fresh;
}
```

## 💻 Code Example — When NOT to Cache

- Per-user private data with low reuse.
- Data that changes faster than the TTL.
- Tiny lookups that are already < 1ms (just hit the DB).
- Anything requiring strong consistency without invalidation.

## 📐 Key Considerations

| Decision | Question to ask |
|----------|----------------|
| TTL | How stale can data be? (seconds → days) |
| Eviction | LRU, LFU, FIFO, TTL-only |
| Storage | App-memory (fast, not shared) vs Redis (shared) vs CDN (global) |
| Granularity | Object cache (`user:1`), query cache (`top-10-products`), page cache |
| Invalidation | Time-based, event-based, or both |
| Stampede | Lock + retry, SWR, request coalescing |

## 🎯 Likely Interview Questions

1. **What caching strategies do you know?**
2. **How do you invalidate a cache?**
3. **What is a cache stampede and how do you prevent it?**
4. **What's the difference between in-process and distributed cache?**
5. **What's `stale-while-revalidate`?**

---

[← Scalable APIs](02-scalable-apis.md) | [Index](../README.md) | [Next: Monolith vs Microservices →](04-monolith-vs-microservices.md)
