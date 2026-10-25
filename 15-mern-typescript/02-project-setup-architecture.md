# Chapter 88 — MERN + TypeScript Project Setup & Architecture

## 📖 Definition

A production MERN + TypeScript project is usually organised as a **monorepo** with three parts:

- `apps/server` — Node.js + Express (or NestJS) + Mongoose, compiled TypeScript.
- `apps/web` — React + TypeScript, built with Vite (or Next.js).
- `packages/shared` — TypeScript types and constants used by **both** sides, so the API contract is written once.

## 🔍 Why This Structure?

- **Single source of truth** for request/response shapes — no copy-pasted interfaces drifting apart.
- **Atomic changes** — a PR that changes an endpoint updates server, client and shared types together.
- **Layered server** (routes → controllers → services → models) keeps HTTP concerns out of business logic, which makes it testable.

## 💻 Folder Structure

```text
mern-app/
├── package.json                # npm/pnpm workspaces
├── tsconfig.base.json          # shared compiler options
├── packages/
│   └── shared/
│       ├── package.json        # "name": "@app/shared"
│       └── src/
│           ├── index.ts
│           ├── types/user.ts             # User, PublicUser, CreateUserDto
│           ├── types/api.ts              # ApiResponse<T>, Paginated<T>
│           └── constants.ts              # ROLES, ORDER_STATUS (as const)
└── apps/
    ├── server/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                  # bootstrap: connect DB, listen
    │       ├── app.ts                    # build Express app (no listen → testable)
    │       ├── config/env.ts             # validated env vars
    │       ├── db/connect.ts
    │       ├── modules/
    │       │   └── users/
    │       │       ├── user.model.ts
    │       │       ├── user.service.ts
    │       │       ├── user.controller.ts
    │       │       └── user.routes.ts
    │       ├── middleware/               # auth, validate, errorHandler
    │       ├── utils/                    # AppError, asyncHandler, logger
    │       └── types/express.d.ts        # Request augmentation
    └── web/
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── main.tsx
            ├── api/                      # typed API client
            ├── features/users/           # components + hooks per feature
            ├── hooks/
            ├── store/                    # Redux Toolkit (optional)
            └── routes/
```

**Feature-based** (`modules/users/*`) scales better than **type-based** (`controllers/`, `models/`, `routes/`) once you have more than a handful of entities — everything about "users" lives in one folder.

## 💻 Code Example — Workspaces

```jsonc
// package.json (root)
{
  "name": "mern-app",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build -w @app/shared && npm run build -w server && npm run build -w web",
    "typecheck": "tsc -b"
  }
}
```

```jsonc
// apps/server/package.json
{
  "name": "server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@app/shared": "*",
    "express": "^5.1.0",
    "express-validator": "^7.2.0",
    "mongoose": "^8.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

- **`tsx`** runs TS directly in dev (fast, esbuild-based, no type-check). Run `tsc --noEmit` in CI for type safety.
- Alternatives: `ts-node-dev`, `nodemon + ts-node`, or Node 22.6+'s `--experimental-strip-types` (type stripping only — no enums/namespaces).

## 💻 Code Example — Validated Environment Config

Never read `process.env.X` all over the code — it's `string | undefined` and unchecked. Parse it once at startup and **crash early** if it's wrong.

```ts
// apps/server/src/config/env.ts
const NODE_ENVS = ["development", "test", "production"] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  MONGO_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CLIENT_ORIGIN: string;
}

const errors: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value) errors.push(`${name} is required`);
  return value ?? "";
}

function secret(name: string): string {
  const value = required(name);
  if (value && value.length < 32) errors.push(`${name} must be at least 32 characters`);
  return value;
}

function isNodeEnv(v: string): v is NodeEnv {
  return (NODE_ENVS as readonly string[]).includes(v);
}

const rawNodeEnv = process.env.NODE_ENV ?? "development";
if (!isNodeEnv(rawNodeEnv)) errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(", ")}`);

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port <= 0) errors.push("PORT must be a positive integer");

export const env: Env = {
  NODE_ENV: rawNodeEnv as NodeEnv,
  PORT: port,
  MONGO_URI: required("MONGO_URI"),
  JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
  CLIENT_ORIGIN: required("CLIENT_ORIGIN"),
};

if (errors.length) {
  console.error("❌ Invalid environment variables:\n - " + errors.join("\n - "));
  process.exit(1);
}
```

The `Env` interface is the contract; the helpers collect **all** problems before exiting, so you fix them in one go instead of one crash at a time.

## 💻 Code Example — Separate `app.ts` from `index.ts`

```ts
// apps/server/src/app.ts
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { userRouter } from "./modules/users/user.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { notFound, errorHandler } from "./middleware/error.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);

  app.use(notFound);
  app.use(errorHandler);   // must be last
  return app;
}
```

```ts
// apps/server/src/index.ts
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const server = createApp().listen(env.PORT, () =>
    console.log(`API on http://localhost:${env.PORT}`),
  );

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Why split? Tests import `createApp()` and hit it with Supertest **without** opening a port or a real DB connection (see the Testing chapter in this section).

> **Note on `.js` extensions:** With `"module": "NodeNext"` and `"type": "module"`, relative imports must include `.js` even in `.ts` files — TypeScript maps them to the compiled output.

## 💻 Code Example — React App with Vite + Proxy

```ts
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
```

The proxy lets the browser call `/api/...` on the same origin in dev — no CORS headaches, and cookies just work.

## 💻 Code Example — The Layered Request Flow

```text
HTTP request
   │
   ▼
Router  ──► middleware (auth, validate(schema))
   │
   ▼
Controller   — reads req, calls service, shapes response. No DB code.
   │
   ▼
Service      — business rules, transactions. No req/res.
   │
   ▼
Model (Mongoose) — persistence only.
```

## 🌍 Real-World Impact

- New engineers find code by feature, not by guessing which of 5 folders it's in.
- Env validation turns "works on my machine" production outages into an immediate, readable crash at boot.
- `createApp()` makes integration tests fast and deterministic.

## 🎯 Likely Interview Questions

1. **How would you structure a MERN app in TypeScript?** — Monorepo, shared package for types/schemas, feature-based modules, layered server.
2. **How do you share types between client and server?** — Workspace package (`@app/shared`) exporting interfaces, DTO types and `as const` constants; or generate types from an OpenAPI spec; or use tRPC.
3. **Why separate `app.ts` and `server.ts`/`index.ts`?** — Testability and clean bootstrap/shutdown.
4. **How do you handle environment variables safely?** — Read and check them once at boot, export a typed `env` object, fail fast with every error listed.
5. **What's the difference between `tsx`/`ts-node` and `tsc`?** — Dev runners transpile on the fly (often skip type-check); `tsc` type-checks and emits JS for production.
6. **Controller vs service — what goes where?** — Controller = HTTP; service = business logic, reusable from jobs/CLI/tests.
7. **How do you shut down a Node server gracefully?** — Handle SIGTERM, stop accepting connections, finish in-flight requests, close DB, exit.

---

[← TypeScript Essentials](01-typescript-essentials.md) | [Index](../README.md) | [Next: Typed Express Server →](03-typed-express-server.md)
