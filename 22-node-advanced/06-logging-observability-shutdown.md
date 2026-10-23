# Chapter 61 — Logging, Observability & Graceful Shutdown

## 📖 Definition

**Observability** is the ability to understand what a running system is doing from the outside, through three signals: **logs** (discrete events), **metrics** (numbers over time) and **traces** (the path of one request across services). **Graceful shutdown** means that when a process is told to stop, it finishes in-flight work and closes connections cleanly instead of dropping requests.

## 🔍 Explanation

| Signal | Answers | Tools |
|---|---|---|
| **Logs** | *What happened* for this request? | Pino, Winston → CloudWatch, ELK, Loki, Datadog |
| **Metrics** | *How much / how fast* overall? (RPS, p95 latency, error rate) | Prometheus + Grafana, Datadog, CloudWatch |
| **Traces** | *Where* did the time go across services? | OpenTelemetry → Jaeger, Tempo, Datadog APM |
| **Errors** | *Which exception*, with stack and context | Sentry |

### Logging rules

- **Structured JSON**, not `console.log("user " + id)`, so logs are searchable.
- **Log levels**: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. `info` in prod, `debug` locally.
- **Correlation/request ID** on every log line, so one request can be followed end to end.
- **Never log secrets or PII**: passwords, tokens, card numbers, full Aadhaar/PAN.

## 💻 Code Example — Pino With Request IDs

```js
import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
  transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers["x-request-id"] ?? randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
  }),
);

app.get("/api/orders/:id", async (req, res) => {
  req.log.info({ orderId: req.params.id }, "fetching order");   // carries reqId automatically
});
```

Output:

```json
{"level":30,"time":1729500000000,"reqId":"7f3c…","orderId":"652…","msg":"fetching order"}
```

## 💻 Code Example — Propagating the Request ID Without Passing It Everywhere

```js
import { AsyncLocalStorage } from "node:async_hooks";
export const als = new AsyncLocalStorage();

app.use((req, res, next) => als.run({ reqId: req.id, userId: req.user?.id }, next));

export const log = () => logger.child(als.getStore() ?? {});
// Deep inside a service: log().info("charging card");
```

## 💻 Code Example — Health Checks

```js
// Liveness: is the process alive? (do not check dependencies here)
app.get("/health/live", (req, res) => res.json({ status: "ok" }));

// Readiness: can it serve traffic right now?
app.get("/health/ready", async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = await redis.ping().then(() => true).catch(() => false);
  const ready = mongoOk && redisOk && !shuttingDown;
  res.status(ready ? 200 : 503).json({ mongo: mongoOk, redis: redisOk });
});
```

Load balancers and Kubernetes use these to route traffic only to healthy instances.

## 💻 Code Example — Metrics With Prometheus

```js
import client from "prom-client";
client.collectDefaultMetrics();                    // CPU, memory, event loop lag, GC

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => end({ method: req.method, route: req.route?.path ?? "unknown", status: res.statusCode }));
  next();
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});
```

**Golden signals to alert on:** latency (p95/p99), traffic (RPS), errors (5xx rate), saturation (CPU, memory, event-loop lag, DB pool usage).

## 💻 Code Example — Graceful Shutdown

When you deploy, the orchestrator sends **`SIGTERM`**, waits (e.g. 30 s), then sends **`SIGKILL`**. Without handling it, in-flight requests get dropped and jobs are cut in half.

```js
const server = app.listen(PORT, () => logger.info(`listening on ${PORT}`));
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  // 1. Fail readiness so the load balancer stops sending new traffic
  // 2. Stop accepting new connections; wait for in-flight requests
  server.close(async (err) => {
    try {
      await worker?.close();              // BullMQ: let running jobs finish
      await mongoose.connection.close();
      await redis.quit();
      logger.info("clean exit");
      process.exit(err ? 1 : 0);
    } catch (e) {
      logger.error(e, "error during shutdown");
      process.exit(1);
    }
  });

  server.closeIdleConnections?.();        // Node 18.2+: drop idle keep-alive sockets
  setTimeout(() => {                      // 3. Hard deadline, below the orchestrator's grace period
    logger.error("forced exit");
    process.exit(1);
  }, 25_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));     // Ctrl+C locally

// Crashes: log, then exit — let PM2/Kubernetes restart a clean process
process.on("uncaughtException", (err) => { logger.fatal(err, "uncaught exception"); process.exit(1); });
process.on("unhandledRejection", (reason) => { logger.fatal({ reason }, "unhandled rejection"); process.exit(1); });
```

**Why exit on `uncaughtException`?** After an unexpected exception the process may be in an unknown state (half-updated variables, leaked locks). Continuing risks corrupt behaviour; restarting is safer.

## 💻 Code Example — Sentry for Errors

```js
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
// ...routes...
Sentry.setupExpressErrorHandler(app);
```

## 🌍 Real-World Use

- "Users say checkout failed at 3:15 pm" → search logs by `userId` and time, follow the `reqId` to the failing downstream call.
- p95 latency alert fires → trace shows a slow MongoDB query → add an index.
- Deploys no longer cause a spike of 502 errors after adding graceful shutdown.

## 🎯 Likely Interview Questions

1. **What are logs, metrics and traces? How are they different?**
2. **Why structured logging? What should never be logged?**
3. **How do you trace one request through your logs?** — Correlation ID (+ AsyncLocalStorage).
4. **Liveness vs readiness checks?**
5. **What is graceful shutdown? Implement it for an Express app with MongoDB.**
6. **What signals does Docker/Kubernetes send when stopping a container?**
7. **Should a Node process keep running after an uncaught exception?**
8. **Which metrics would you alert on for an API?**

---

[← Node Security (OWASP)](05-security-owasp.md) | [Index](../README.md) | [Next: Performance & Memory Leaks →](07-performance-memory-leaks.md)
