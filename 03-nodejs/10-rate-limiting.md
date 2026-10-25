# Chapter 56 — Rate Limiting

## 📖 Definition

Rate limiting restricts the number of requests a client can make in a given time window. It protects APIs from abuse, brute-force, and accidental overload.

## 🔍 Common Algorithms

| Algorithm | How it works | Pros | Cons |
|-----------|--------------|------|------|
| **Fixed window** | Counter per window (e.g., per minute) | Simple, low memory | Burst at boundaries |
| **Sliding window** | Weighted average between current/previous window | Smoother | More memory |
| **Token bucket** | Tokens added at a fixed rate, each request consumes one | Allows bursts up to bucket size | Slightly more complex |
| **Leaky bucket** | Requests drain at a fixed rate | Smooth output | Drops bursts |

## 💻 Code Example — `express-rate-limit` (In-Memory)

```js
import rateLimit from "express-rate-limit";

// 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,         // adds RateLimit-* headers
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

app.use("/api", apiLimiter);
```

## 💻 Code Example — Stricter on Auth Endpoints

```js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                        // only 5 attempts / 15min
  skipSuccessfulRequests: true,  // successful logins don't count
  message: "Too many login attempts, please try again later.",
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
```

## 💻 Code Example — Distributed Rate Limiting with Redis

```js
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const limiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.sendCommand(args),
  }),
  windowMs: 60 * 1000,
  max: 30,                       // 30 req/min across ALL instances
});

app.use("/api", limiter);
```

When you run multiple Node instances behind a load balancer, in-memory counters drift. Redis gives one shared counter.

## 💻 Code Example — Custom Per-User Limiter

```js
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,    // per-user, fallback per-IP
});

app.use("/api", authMiddleware, userLimiter);
```

## 💻 Code Example — Manual Token Bucket (Redis-Backed)

```js
import { createClient } from "redis";
const redis = createClient(); await redis.connect();

async function takeToken(userId, cost = 1, capacity = 10, refillPerSec = 1) {
  const key = `rate:${userId}`;
  const now = Date.now() / 1000;

  // Lua script to make it atomic
  const script = `
    local tokens, last = unpack(redis.call('HMGET', KEYS[1], 'tokens', 'last'))
    tokens = tonumber(tokens) or tonumber(ARGV[3])     -- capacity
    last   = tonumber(last)   or tonumber(ARGV[1])     -- now

    local refill = (tonumber(ARGV[1]) - last) * tonumber(ARGV[4])
    tokens = math.min(tonumber(ARGV[3]), tokens + refill)

    if tokens < tonumber(ARGV[2]) then
      redis.call('HMSET', KEYS[1], 'tokens', tokens, 'last', ARGV[1])
      return 0
    else
      tokens = tokens - tonumber(ARGV[2])
      redis.call('HMSET', KEYS[1], 'tokens', tokens, 'last', ARGV[1])
      return 1
    end
  `;

  const allowed = await redis.eval(script, {
    keys: [key],
    arguments: [String(now), String(cost), String(capacity), String(refillPerSec)],
  });

  return allowed === 1;
}

// Middleware
app.use(async (req, res, next) => {
  const ok = await takeToken(req.user?.id || req.ip);
  if (!ok) return res.status(429).json({ error: "RATE_LIMITED" });
  next();
});
```

## 💻 Code Example — NestJS with Throttler

```ts
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

@Controller("auth")
export class AuthController {
  @Throttle({ default: { ttl: 60_000, limit: 5 } })  // override
  @Post("login")
  login(@Body() dto: LoginDto) { /* ... */ }
}
```

## 💻 Code Example — Returning Helpful 429 Headers

Recommended headers (already added by `express-rate-limit` with `standardHeaders: true`):

```
RateLimit-Limit:     100
RateLimit-Remaining: 0
RateLimit-Reset:     1700000000          # epoch seconds
Retry-After:         60                  # seconds
```

This tells well-behaved clients exactly when to retry.

## 🌍 Real-World Impact

- **Login routes:** prevent credential stuffing and brute-force.
- **Password reset:** prevent user enumeration.
- **Public APIs:** prevent scraping/DoS.
- **Webhooks:** absorb upstream bursts gracefully (combine with a queue).

## 🎯 Likely Interview Questions

1. **Why rate-limit?**
2. **How does rate limiting work in a distributed setup?** — Shared store (Redis), atomic counters.
3. **Difference between token bucket and leaky bucket?**
4. **How would you protect login from brute force?**
5. **What headers do you return on rate limit?**

---

[← Pagination](09-pagination.md) | [Index](../README.md) | [Next: Streams, Buffers & Backpressure →](../22-node-advanced/01-streams-buffers.md)
