# Chapter 102 — MERN System Design Scenarios

## 📖 Definition

A **system design question** asks you to design a feature or a whole application: its components, data model, APIs, and how it behaves under load and failure. For MERN roles, interviewers expect designs built from the tools you know — React, Node/Express, MongoDB, Redis, queues, S3, a CDN — with clear trade-offs, not an abstract big-tech architecture.

## 🧠 The Framework (45 Minutes)

```text
1. Requirements (5 min)   — functional: what must it do? non-functional: users, RPS, latency, consistency
2. Estimates (3 min)      — rough numbers: users, writes/day, storage/year
3. API (5 min)            — main endpoints and payloads
4. Data model (7 min)     — collections, embed vs reference, indexes
5. Architecture (10 min)  — draw the boxes: client, CDN, LB, API, DB, cache, queue, workers, storage
6. Deep dive (10 min)     — the hardest part: concurrency, real-time, search, scaling
7. Wrap up (5 min)        — bottlenecks, failure modes, what you'd do with more time
```

---

## Design 1 — URL Shortener (like bit.ly)

**Requirements:** create short links, redirect fast, optional expiry, click analytics. Read-heavy (≈100 reads per write).

**API**
```text
POST /api/links        { url, customAlias?, expiresAt? } → { code, shortUrl }
GET  /:code            → 301/302 redirect
GET  /api/links/:code/stats
```

**Data model**
```js
// links
{ _id, code /* unique index */, url, userId, expiresAt, createdAt, clicks }
// clicks (or a time-series collection)
{ code, at, country, referrer, device }
```

**Generating codes:** base62 of a counter (Redis `INCR`) → short and unique, but guessable; or random 7-char base62 (62^7 ≈ 3.5 trillion) with a unique index and retry on collision.

**Architecture**
```text
Browser → CDN/edge → LB → Node API ─┬→ Redis (code → url cache, TTL)
                                    ├→ MongoDB (links)
                                    └→ queue → worker → clicks collection / analytics
```

**Deep dive:** the redirect path must be fast — check Redis first, fall back to MongoDB, cache the result. Record clicks **asynchronously** (push to a queue or Redis stream) so analytics never slow the redirect. Use **302** if you need every click to reach your server (301 is cached by browsers). TTL index for expired links.

---

## Design 2 — Real-Time Chat (like WhatsApp Web / Slack lite)

**Requirements:** 1:1 and group chats, online status, typing indicator, message history, read receipts, file sharing.

**Data model**
```js
// conversations
{ _id, type: "direct" | "group", members: [userId], name, lastMessage: { text, at, senderId } }
// index: { members: 1, "lastMessage.at": -1 }  → "my chats, newest first"

// messages
{ _id, conversationId, senderId, text, attachments: [{ key, type }], createdAt, readBy: [userId] }
// index: { conversationId: 1, _id: -1 }  → paginate history by _id cursor
```

**Architecture**
```text
React ──WebSocket──▶ Socket.IO servers (N) ──▶ Redis adapter (pub/sub between servers)
      ──HTTPS────▶ REST API (history, upload URLs) ──▶ MongoDB
                                                   └─▶ S3 (attachments via pre-signed URLs)
Presence: Redis keys with TTL refreshed by heartbeat
Offline users: queue → push notifications (FCM)
```

**Deep dive**
- **Send flow:** client emits with a client-generated `tempId` → server validates membership → saves to MongoDB → emits to the conversation room → acks the sender with the real `_id` (client replaces the temp message).
- **Ordering & duplicates:** order by server `_id`/timestamp; de-duplicate by `tempId`.
- **Reconnects:** client asks `GET /messages?after=<lastId>` to fill gaps.
- **Scale:** Redis adapter so rooms work across servers; sticky sessions if long-polling is enabled; shard messages by `conversationId` at very large scale.

---

## Design 3 — E-Commerce Checkout and Inventory

**Requirements:** cart, checkout, payment, stock that never oversells, order history, admin updates. Flash sales spike traffic 50×.

**Flow**
```text
1. POST /api/checkout (Idempotency-Key)
2. Reserve stock: atomic findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
3. Create order { status: "pending_payment", reservedUntil: now + 15 min }
4. Create payment order with the gateway → return to client
5. Client pays → gateway webhook → verify signature → mark order "paid" (idempotent)
6. Worker: release reservations of unpaid orders after 15 min ($inc stock back)
7. Queue: confirmation email, invoice PDF, analytics
```

**Data model:** orders snapshot item name/price; separate `payments` collection keyed by gateway `paymentId` (unique).

**Flash-sale deep dive**
- Put a **Redis counter** in front (`DECR stock:sku`) as a fast gate; only winners proceed to MongoDB.
- **Queue** checkout requests and process at a controlled rate; show "you're in line".
- Rate limit per user; CDN-cache product pages; keep the checkout service separately scalable.
- Reconcile the Redis counter with MongoDB after the sale.

---

## Design 4 — Notification System (Email, SMS, Push, In-App)

**Requirements:** many services trigger notifications; user preferences; retries; no duplicates; templates; scheduling.

```text
Services ──▶ POST /notify { userId, type, data, idempotencyKey }
            └▶ Notification API: check preferences, quiet hours, de-dupe → enqueue per channel
                 ├─ email queue  → worker → SES/SendGrid
                 ├─ sms queue    → worker → SMS provider
                 ├─ push queue   → worker → FCM/APNs
                 └─ in-app       → MongoDB notifications + Socket.IO emit to user room
Delivery status webhooks ──▶ update notification records
```

**Key points:** idempotency key unique index; per-channel queues so a slow SMS provider does not delay emails; rate limits per provider; retries with backoff and a dead-letter queue; template rendering in workers; `notifications` collection `{ userId, read, createdAt }` indexed `{ userId: 1, createdAt: -1 }` with a TTL for old items.

---

## Design 5 — File Sharing / Document Upload Service

**Requirements:** users upload files up to 2 GB, share links with permissions, preview images/PDFs.

**Design**
- **Upload:** API issues a pre-signed **multipart** S3 upload URL; browser uploads directly (resumable); API records metadata `{ ownerId, key, size, mime, status: "uploading" }`.
- **Processing:** S3 event → queue → worker generates thumbnails/previews, scans for malware, sets `status: "ready"`.
- **Download/share:** permission check in the API → short-lived pre-signed GET URL; CDN (CloudFront signed URLs) for popular files.
- **Data:** `files` and `shares { fileId, granteeId | linkToken, role, expiresAt }`.

---

## Design 6 — Social Feed (Posts, Follows, Likes)

**Requirements:** users follow others; home feed shows recent posts from followed users; likes and comments; 1M daily users.

**Two strategies**
| | Fan-out on read (pull) | Fan-out on write (push) |
|---|---|---|
| How | Query posts where `authorId ∈ following`, sort by time | On post, write the post ID into each follower's feed list |
| Read cost | High (many authors) | Low (precomputed) |
| Write cost | Low | High for celebrities with millions of followers |

**Hybrid answer:** push for normal users (store feed IDs in Redis sorted sets per user, capped at ~500), pull for celebrity accounts at read time, merge.

**Likes at scale:** unique index `{ postId, userId }` on `likes`; keep a `likeCount` on the post updated with `$inc` (computed pattern), or count in Redis and flush periodically.

---

## Design 7 — Multi-Tenant SaaS (e.g. a CRM for many companies)

**Key decision — tenant isolation**
| Model | Isolation | Cost / ops | When |
|---|---|---|---|
| Shared collections with `tenantId` on every document | Logical | Cheapest | Most SaaS apps |
| Database per tenant | Stronger | More connections/ops | Enterprise customers, data residency |
| Cluster per tenant | Strongest | Highest | Regulated / very large tenants |

**With shared collections:** every index starts with `tenantId`; a middleware sets `req.tenantId` from the token; a repository layer **always** adds `{ tenantId }` to queries (never rely on each developer remembering); tests that try cross-tenant access; per-tenant rate limits.

---

## Design 8 — Scaling a MERN App From 1K to 1M Users

```text
Stage 1  (1K users)   Single VM: Node + MongoDB Atlas (M10) + React on Vercel/Netlify/S3+CDN
Stage 2  (10K)        Add: CDN for assets, indexes + explain review, Redis cache, PM2 cluster
Stage 3  (100K)       Stateless API on 3+ instances behind a load balancer, autoscaling,
                      queue + workers for slow jobs, S3 for files, read replicas for analytics,
                      observability (logs/metrics/traces), rate limiting
Stage 4  (1M+)        Split hot domains into services (payments, notifications, search),
                      Atlas Search/Elasticsearch, MongoDB sharding for the biggest collections,
                      event bus (Kafka) between services, multi-region for latency/DR
```

**Say it explicitly:** "I would not start with microservices. I would scale the monolith first — caching, indexes, horizontal scaling — and split services only where load or team ownership requires it."

---

## 🎯 What Interviewers Are Scoring

- You **clarify requirements and scale** before drawing.
- Your **data model and indexes** match the access patterns.
- You handle the **hard part** (concurrency, real-time, idempotency, hot keys) explicitly.
- You discuss **trade-offs** and **failure modes**, and you scale incrementally rather than over-engineering.

---

[← Production Incident Scenarios](05-production-incident-scenarios.md) | [Index](../README.md) | [Next: MERN Self-Intro & Project Questions →](../18-mern-interview/01-project-experience.md)
