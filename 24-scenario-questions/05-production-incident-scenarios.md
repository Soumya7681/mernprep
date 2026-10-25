# Chapter 110 — Production Incident Scenarios

## 📖 Definition

A **production incident** is any event that degrades the live service: an outage, a spike in errors, a data problem, or a security breach. Incident questions test whether you can stay calm, **restore service first**, find the root cause second, and communicate clearly — skills that matter most in client-facing and on-call roles.

## 🧠 The Incident Playbook

```text
1. Detect      — alert, dashboard, or user report. Acknowledge it.
2. Assess      — impact: who is affected, how badly, since when? Set severity.
3. Communicate — tell the team/client: what we know, what we are doing, next update time.
4. Mitigate    — stop the bleeding: roll back, feature-flag off, scale up, failover.
5. Diagnose    — logs, metrics, traces, recent changes (deploys, config, data).
6. Fix         — the real fix, tested, deployed safely.
7. Learn       — blameless post-mortem: timeline, root cause, action items.
```

**Golden rule:** *"What changed?"* — most incidents follow a deploy, a config change, a data change, or a traffic change.

---

### Incident 1 — "Right after a deploy, the error rate jumps from 0.1% to 15%."

**Mitigate first:** roll back to the previous version (or turn off the feature flag) — do not debug on a burning production system.

**Then diagnose**
- Compare errors by route/version in logs or Sentry; read the top stack trace.
- Check what the release changed: code, dependencies, env vars, migrations.
- Was a database migration applied that the old code is now incompatible with? (Then rollback alone may not work — this is why migrations should be **backward compatible**: expand → migrate → contract.)

**Prevent:** canary or blue-green releases, automated smoke tests after deploy, feature flags, backward-compatible migrations, alert on error-rate change.

---

### Incident 2 — "The site is down. The health check fails and the load balancer shows no healthy targets."

**Assess:** all instances or one? Can you reach the instance directly?

**Investigate in order**
1. Did processes crash? (`pm2 logs`, container restarts, OOM-killed in `dmesg`/Kubernetes events)
2. Is a dependency down? (MongoDB Atlas status, Redis, DNS) — a readiness check that includes the DB fails when the DB fails.
3. Disk full? (logs filling the disk is a classic)
4. Certificate expired? Config/secret rotated?
5. Traffic spike or attack? (request rate, WAF logs)

**Mitigate:** restart/scale instances, fail over the DB, rotate the certificate, block abusive traffic; communicate status to users.

---

### Incident 3 — "API latency went from 200 ms to 4 s, but there are no errors."

**Investigate:** which endpoints? Look at the dependency breakdown in traces. Check MongoDB (slow queries, connections, CPU, replication lag), Redis (memory, evictions), external APIs, Node event-loop delay, CPU/memory saturation, connection-pool exhaustion.

**Typical causes:** a missing index exposed by data growth; a cache that expired or was flushed (thundering herd on the DB); a slow third-party API with no timeout; a noisy batch job running at peak; GC pressure from a memory leak.

**Mitigate:** scale out, pause the batch job, warm the cache, enable a circuit breaker; then fix the root cause.

---

### Incident 4 — "A customer reports their payment was taken but the order shows 'pending'."

**Investigate:** find the order and payment IDs; check the payment provider dashboard; check webhook delivery logs (did the webhook arrive? was it rejected due to a signature or timeout? did processing fail?).

**Fix now:** reconcile the order manually or replay the webhook; inform the customer.

**Fix properly:**
- Webhook handler that verifies the signature, stores the event, responds 200 quickly, processes idempotently in a worker.
- A **reconciliation job** that periodically queries the provider for payments in "pending" orders older than N minutes.
- Alert when the pending-payment count rises.

---

### Incident 5 — "A bug in yesterday's release wrote wrong prices to 3,000 orders."

**Mitigate:** stop the damage (rollback/flag off); find the exact time window and affected records (logs, `updatedAt`, audit log).

**Repair:** write a **script** to correct data, tested on a copy/staging first, run in batches, with a dry-run mode and logs of every change; keep a backup (`mongodump` of affected docs) before touching anything; get sign-off from the business on how to treat customers.

**Prevent:** validation at the schema level; automated tests for pricing; audit trails (who changed what, when); point-in-time backups (Atlas continuous backup) tested by actually restoring.

---

### Incident 6 — "Our AWS bill / MongoDB Atlas bill tripled this month."

**Investigate:** cost explorer by service; data transfer (images served without a CDN?); logs at `debug` level in production; an index explosion or an unbounded collection; autoscaling that never scaled down; a bot hammering an expensive endpoint; a runaway cron job or retry loop.

**Fix:** CDN for static assets, log level `info` with retention policies, TTL indexes and archiving, rate limiting and bot protection, budgets and cost alerts.

---

### Incident 7 — "We suspect a security breach: unusual admin logins at 3 am from another country."

**Immediate steps**
1. **Contain:** revoke sessions/tokens (rotate the JWT secret or bump a `tokenVersion`), disable the compromised accounts, rotate API keys and database credentials.
2. **Preserve evidence:** keep logs; do not wipe servers.
3. **Assess scope:** what data was accessed (audit logs)? which accounts?
4. **Escalate:** security team, management, legal — data protection laws (e.g. India's DPDP Act, GDPR) may require notifying regulators and users within strict time limits.

**Prevent:** MFA for admins, IP allow-lists for admin panels, alerting on anomalous logins, least-privilege roles, secrets in a vault, dependency scanning.

---

### Incident 8 — "Users get logged out every few minutes after we scaled to 3 servers."

**Cause:** state kept in a single process — `express-session` MemoryStore, an in-memory token blacklist, or each server using a **different JWT secret** (env not shared).

**Fix:** shared Redis session store, or stateless JWTs with the same secret across instances (from a secrets manager); verify sticky sessions are not masking the problem.

---

### Incident 9 — "Emails were sent twice to all customers."

**Cause:** a non-idempotent job processed twice (a worker crashed after sending but before marking the job complete; or two schedulers ran the same cron on two instances).

**Fix:** idempotency records (`{ campaignId, userId }` unique) checked before sending; a single scheduler (BullMQ repeatable jobs, or a distributed lock); apologise if needed.

---

### Incident 10 — "Production database was accidentally dropped by a script."

**Recover:** restore from the latest backup / point-in-time recovery to a new cluster, verify, then switch the app's connection string; replay what can be replayed (queues, provider data).

**Prevent:** separate credentials per environment (dev scripts physically cannot reach prod), least-privilege DB users (the app user cannot `dropDatabase`), confirmation prompts and dry runs in scripts, regular **restore drills**.

---

## 💬 Communicating During an Incident (Client-Facing Roles)

A good status update is short and factual:

> **[10:42] Checkout errors — investigating.** Since 10:15, about 20% of checkout attempts fail with a payment error. Browsing and cart are unaffected. We have rolled back this morning's release and are monitoring. Next update by 11:00.

- Say what is affected and what is not.
- Give the next update time — and keep it.
- No blame, no guesses presented as facts.

## 📝 Blameless Post-Mortem Template

```text
Summary       — one paragraph: what happened, impact, duration
Timeline      — detection, key actions, mitigation, resolution (with times)
Root cause    — technical cause AND why our process allowed it
What went well / what did not
Action items  — owner + due date (tests, alerts, runbooks, process changes)
```

## 🎯 What Interviewers Are Scoring

- **Mitigate before investigating** — rollback is a valid first move.
- You ask **"what changed?"** and use logs, metrics and traces.
- You protect **data integrity** (backups before fixes, idempotency, reconciliation).
- You **communicate** clearly and run a **blameless** review with concrete action items.

---

[← MongoDB Scenarios](04-mongodb-scenarios.md) | [Index](../README.md) | [Next: MERN System Design Scenarios →](06-mern-system-design-scenarios.md)
