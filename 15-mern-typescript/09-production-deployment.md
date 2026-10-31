# Chapter 120 — Production, Security & Deployment

## 📖 Definition

Shipping a MERN + TypeScript app means turning TS into optimised JS, configuring security middleware, structured logging, health checks and graceful shutdown, and deploying the API, the React build and MongoDB so they scale and recover from failures.

## 🔍 Typical Production Architecture

```text
                 ┌──────────────┐
  Browser ──────►│  CDN         │  React build (static files: Vercel / Netlify / S3+CloudFront)
     │           └──────────────┘
     │  /api/*
     ▼
 ┌────────────────┐      ┌─────────────────────────┐      ┌───────────────────┐
 │ Load balancer / │────►│ Node API containers ×N  │────►│ MongoDB Atlas      │
 │ reverse proxy   │     │ (stateless, Docker)     │      │ (replica set)      │
 │ TLS, gzip       │     └──────────┬──────────────┘      └───────────────────┘
 └────────────────┘                 │
                                    ├────► Redis (cache, rate limits, sessions)
                                    └────► S3 (uploads)
```

The API must be **stateless** (no in-memory sessions or uploads on local disk) so you can run many containers behind a load balancer.

## 💻 Code Example — Build Scripts

```jsonc
// apps/server/package.json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.build.json",
    "start": "node --enable-source-maps dist/index.js"
  }
}
```

```jsonc
// apps/web/package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",      // Vite doesn't type-check — tsc does
    "preview": "vite preview"
  }
}
```

Client env vars in Vite must start with `VITE_` and are **public** (baked into the bundle). Never put secrets there. Type them:

```ts
// apps/web/src/vite-env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SENTRY_DSN?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

## 💻 Code Example — Security Middleware

```ts
// app.ts (production additions)
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import hpp from "hpp";

app.set("trust proxy", 1);                         // behind a load balancer: real client IP + secure cookies

app.use(helmet());                                 // CSP, HSTS, X-Frame-Options, noSniff …
app.use(cors({
  origin: env.CLIENT_ORIGIN,                       // exact origin, never "*" with credentials
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: "100kb" }));         // stop huge-payload DoS
app.use(hpp());                                    // HTTP parameter pollution (?role=a&role=b)
app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.disable("x-powered-by");                        // helmet does this too
```

**NoSQL injection:** `{ "email": { "$ne": null } }` in a login body can match any user. Defences: validate types with express-validator (`isEmail()` rejects objects), keep `mongoose.set("strictQuery", true)`, and use Mongoose's `sanitizeFilter` option (`mongoose.set("sanitizeFilter", true)`) which wraps query operators from user input in `$eq`.

## 📊 Security Checklist

| Risk | Mitigation |
|------|-----------|
| Leaked secrets | Env vars / secret manager; `.env` in `.gitignore`; rotate on leak |
| XSS stealing tokens | Access token in memory, refresh in httpOnly cookie; React escapes output; avoid `dangerouslySetInnerHTML` |
| CSRF | `SameSite` cookies + strict CORS origin |
| NoSQL injection | Validate types, `sanitizeFilter`, never pass `req.body` straight into a query |
| IDOR | Scope every query by owner (Full-Stack Walkthrough chapter) |
| Mass assignment | `matchedData()` / explicit DTO mapping |
| Brute force | Rate limit login, account lockout, CAPTCHA |
| Vulnerable deps | `npm audit`, Dependabot/Renovate |
| Verbose errors | No stack traces in production responses |

## 💻 Code Example — Structured Logging with pino

```ts
// utils/logger.ts
import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password"],   // never log secrets
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
```

```ts
import { pinoHttp } from "pino-http";
app.use(pinoHttp({ logger, genReqId: (req) => req.headers["x-request-id"]?.toString() ?? crypto.randomUUID() }));
// in handlers: req.log.info({ taskId }, "task created")
```

JSON logs can be searched and aggregated (CloudWatch, Datadog, Loki); `console.log` strings can't.

## 💻 Code Example — Health Checks & Graceful Shutdown

```ts
import mongoose from "mongoose";

app.get("/health/live", (_req, res) => { res.json({ status: "ok" }); });   // process is up

app.get("/health/ready", (_req, res) => {                                   // can serve traffic?
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ db: dbUp ? "up" : "down" });
});
```

```ts
// index.ts
const server = app.listen(env.PORT);

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "shutting down");
  server.close(async () => {                    // stop accepting, finish in-flight requests
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();   // force exit if requests hang
}
process.on("SIGTERM", shutdown);   // Docker / Kubernetes stop
process.on("SIGINT", shutdown);    // Ctrl+C

process.on("unhandledRejection", (reason) => { logger.fatal({ reason }, "unhandledRejection"); process.exit(1); });
process.on("uncaughtException", (err) => { logger.fatal(err, "uncaughtException"); process.exit(1); });
```

After an `uncaughtException` the process state is unknown — log and **exit**; let the orchestrator restart it.

## 💻 Code Example — Multi-stage Dockerfile (API)

```dockerfile
# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
RUN npm run build -w @app/shared && npm run build -w server

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
USER node                                   # don't run as root
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://localhost:4000/health/live || exit 1
CMD ["node", "--enable-source-maps", "apps/server/dist/index.js"]
```

Multi-stage keeps TypeScript, dev dependencies and source out of the final image (smaller, fewer CVEs).

## 💻 Code Example — docker-compose for Local Full Stack

```yaml
services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0"]                 # needed for transactions
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]
    healthcheck:
      test: mongosh --quiet --eval "try { rs.status().ok } catch { rs.initiate().ok }"
      interval: 5s
  api:
    build: { context: ., dockerfile: apps/server/Dockerfile }
    env_file: apps/server/.env
    environment:
      MONGO_URI: mongodb://mongo:27017/app?replicaSet=rs0&directConnection=true
    ports: ["4000:4000"]
    depends_on:
      mongo: { condition: service_healthy }
volumes:
  mongo-data:
```

## 📊 Where to Deploy

| Part | Common choices |
|------|----------------|
| React build | Vercel, Netlify, Cloudflare Pages, S3 + CloudFront |
| Node API | Render, Railway, Fly.io, AWS ECS/Fargate, App Runner, a VM with PM2 + Nginx |
| MongoDB | MongoDB Atlas (managed replica set, backups, monitoring) |
| Secrets | Platform env vars, AWS Secrets Manager / SSM |
| Monitoring | Sentry (errors), Datadog / Grafana (metrics & logs), UptimeRobot |

**Same origin vs cross origin:** serving the API under the same domain (`app.com/api` via a reverse proxy) avoids CORS and lets you use `SameSite=strict` cookies. With separate domains (`app.com` + `api.app.com`), use `SameSite=lax` and an exact CORS origin; fully different sites (`vercel.app` + `onrender.com`) need `SameSite=none; Secure`, which weakens CSRF protection.

## 💻 Code Example — PM2 (if deploying to a VM)

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "api",
    script: "apps/server/dist/index.js",
    instances: "max",          // one per CPU core (cluster mode)
    exec_mode: "cluster",
    env_production: { NODE_ENV: "production" },
    max_memory_restart: "500M",
  }],
};
// pm2 start ecosystem.config.cjs --env production && pm2 save
```

## 🌍 Real-World Impact

- Readiness checks stop the load balancer from sending traffic to an instance whose DB connection dropped.
- Graceful shutdown means deploys don't cut off users mid-request.
- Redacted, structured logs let you debug production without exposing passwords or tokens.

## 🎯 Likely Interview Questions

1. **How do you deploy a MERN app?** — React build on a CDN; API in containers behind a load balancer; MongoDB Atlas; secrets in env.
2. **How do you run TypeScript in production?** — Compile with `tsc` and run JS with `node`; don't use `ts-node`/`tsx` in prod.
3. **What security middleware do you add to Express?** — helmet, strict CORS, rate limiting, body size limit, validation, hpp.
4. **How do you prevent NoSQL injection?** — Validate input types, `sanitizeFilter`, `strictQuery`, never trust `req.body` in queries.
5. **Liveness vs readiness checks?** — "Process alive" vs "able to serve (DB connected)".
6. **What is graceful shutdown?** — On SIGTERM stop accepting connections, finish in-flight requests, close DB, exit.
7. **Why multi-stage Docker builds?** — Smaller, safer images without compilers/dev deps.
8. **How do you scale the Node API?** — Stateless instances + load balancer, cluster mode/PM2 or more containers, Redis for shared state, caching, DB indexes.
9. **What happens to `VITE_` env vars?** — Inlined into the client bundle at build time — public, never secret.

---

[← Testing MERN + TypeScript](08-testing-mern-typescript.md) | [Index](../README.md) | [Next: MERN + TS Rapid-Fire Q&A →](10-mern-interview-questions.md)
