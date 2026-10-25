# Chapter 117 — Monolith vs Microservices

## 📖 Definitions

- **Monolith** — a single deployable application containing all features.
- **Microservices** — multiple small, independently deployable services that communicate over the network.
- **Modular monolith** — single deployable, but internally organized into clear module boundaries (the often-recommended middle ground).

## 📊 Comparison

| Aspect | Monolith | Microservices |
|--------|----------|---------------|
| Codebase | Single | Many |
| Deployment | All-at-once | Independent |
| Communication | In-process | Network (HTTP, gRPC, queues) |
| Database | Usually one | Each service owns its DB (ideally) |
| Transactions | ACID native | Distributed sagas, complex |
| Team org | One team / multiple feature teams | One team per service |
| Operability | Easy logs, debugging | Needs distributed tracing, central logs |
| Failure isolation | One bug can take down the whole thing | One service can be down while others run |
| Best for | Small/medium teams, early product | Large orgs, independent domains |
| Pitfalls | Slow CI, deploy coupling | Network failures, operational overhead |

## 🏗️ When to Start with Monolith

> **The honest answer most interviewers want:**
> "I'd start with a well-modularized monolith. Microservices add operational cost — networking, observability, deployment, data consistency. Only split when team size or scale forces it."

## 🏗️ Modular Monolith Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   ├── auth.repo.js
│   │   └── auth.routes.js
│   ├── orders/
│   │   ├── orders.controller.js
│   │   ├── orders.service.js
│   │   ├── orders.repo.js
│   │   └── orders.routes.js
│   ├── billing/
│   │   ├── ...
│   └── notifications/
│       └── ...
├── shared/
│   └── db/
└── app.js
```

Each module exposes a clear interface (a service, not its DB). When you eventually split it out, you replace in-process calls with network calls.

## 💻 Code Example — Module Boundary

```js
// modules/orders/orders.service.js
import { BillingService } from "../billing/billing.service.js";

export const OrderService = {
  async create(dto) {
    const order = await OrderRepo.create(dto);
    await BillingService.charge(order);             // in-process today
    // Future: an HTTP/gRPC call or a queue message
    return order;
  },
};
```

If/when you split billing into its own service, only **this one line** changes:
```js
await fetch("http://billing/api/charge", { method: "POST", body: JSON.stringify(order) });
```

## 🔁 Inter-Service Communication

| Style | Use |
|-------|-----|
| Sync HTTP/REST | Simple request-response |
| Sync gRPC | Strongly-typed, lower latency |
| Async events (Kafka, RabbitMQ, SNS) | Decoupling, eventual consistency |
| Message queues (BullMQ, SQS) | Background work, retry, fan-out |

## 💻 Code Example — Event-Driven (Decoupling)

```js
// Order service emits an event
await eventBus.publish("OrderPaid", { orderId: order.id, userId: user.id, amount });

// Notification service consumes (separate process, separate deploy)
eventBus.subscribe("OrderPaid", async (event) => {
  await sendEmail(event.userId, `Order ${event.orderId} paid`);
});

// Analytics service also subscribes — no change to Order service needed
eventBus.subscribe("OrderPaid", async (event) => {
  await analytics.track("order_paid", event);
});
```

This is the strongest argument for microservices: **adding consumers doesn't touch the producer**.

## 🔥 Microservices Pitfalls

### 1. Distributed Transactions
You can't `BEGIN…COMMIT` across services. You need:
- **Sagas** (compensating transactions): if step 3 fails, undo steps 1 and 2.
- **Outbox pattern**: write to DB and to an "outbox" table in the same transaction; a background process publishes outbox events.

### 2. Network Failures
Every call can fail or be slow. Use:
- Timeouts
- Retries with exponential backoff
- Circuit breakers (e.g., `opossum`)
- Fallbacks / degraded responses

### 3. Observability
With 20 services, you can't `tail -f` 20 logs. Required:
- **Centralized logs** (ELK, Loki, Datadog).
- **Distributed tracing** (OpenTelemetry) — trace IDs across services.
- **Metrics dashboards** (Prometheus + Grafana).

### 4. Data Consistency
Each service owns its DB → you can't `JOIN`. Approaches:
- Materialized views built from events.
- API composition (the gateway calls multiple services and merges).
- Accept eventual consistency.

### 5. Versioning
Service A v2 may need to coexist with v1 callers. Strategies:
- Backwards-compatible changes only.
- Versioned endpoints (`/v1`, `/v2`).
- Proto evolution rules for gRPC.

## 📐 When to Actually Split

Honest triggers:
- **Team size > ~30 engineers** — deployment coordination becomes painful.
- **One module needs a different scaling profile** (e.g., image processing).
- **Different release cadences** — one team ships hourly, another monthly.
- **Different tech needs** — one part really wants Rust/Python.

If none of those apply, stay monolithic.

## 🎯 Likely Interview Questions

1. **Would you build this as a monolith or microservices?**
2. **What's the modular monolith?**
3. **How do you handle distributed transactions?**
4. **What's the outbox pattern?**
5. **How do you trace a request across services?** — Propagate a trace/correlation ID via HTTP header (`traceparent`) and log it everywhere; aggregate with OpenTelemetry.

---

[← Caching](03-caching.md) | [Index](../README.md) | [Next: API Security →](05-api-security.md)
