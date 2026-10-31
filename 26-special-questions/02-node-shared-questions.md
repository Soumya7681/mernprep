# Chapter 154 — Node.js: Shared Interview Questions

## 📖 How to Use This Chapter

These questions were asked in real interviews on **12 and 13 October 2026** and shared in the **MERN STACK TI** WhatsApp group. Questions that came up in more than one interview appear here only once. Some of them were asked in almost every interview: require vs import, middleware, JWT, and error handling.

Each answer is kept short and simple, so you can read it once and say it in your own words.

---

## ⚙️ Node.js Basics

### 1. What is the JavaScript runtime environment?

The runtime is **everything JavaScript needs to run**:
- an **engine** to run the code (V8)
- **APIs** like timers, files and network
- an **event loop** to run callbacks when async work finishes.

In the browser, the runtime gives you the DOM and `window`. In Node.js, it gives you `fs`, `http` and `process`.

### 2. What is the V8 engine and how does it work?

V8 is Google's JavaScript engine. It is used in Chrome and Node.js.

How it works, in simple steps:
1. It **reads (parses)** your code.
2. It converts it to **bytecode** and starts running it.
3. Code that runs often is compiled into **fast machine code** (JIT compilation).
4. It cleans up unused memory automatically (**garbage collection**).

### 3. What is libuv and why do we need it?

libuv is a C library that gives Node.js its **event loop** and **async I/O**.

V8 can only run JavaScript; it can't read files or handle network calls. libuv does that work in the background (using the operating system and a small **thread pool**, 4 threads by default) and tells Node when it's done.

That's why Node can handle many requests at the same time with one main thread.

### 4. What is the Event Loop? Explain its phases.

Node runs your JavaScript on **one thread**. The event loop keeps checking: *"Is any async work finished? Then run its callback."*

**Phases, in order:**
1. **Timers:** `setTimeout` and `setInterval` callbacks
2. **Pending callbacks:** some system callbacks
3. **Idle / prepare:** internal use
4. **Poll:** I/O callbacks (files, network); waits here if there is nothing else to do
5. **Check:** `setImmediate` callbacks
6. **Close callbacks:** for example `socket.on("close")`

Between every callback, Node first runs `process.nextTick`, then **Promise** callbacks.

```js
console.log("1");
setTimeout(() => console.log("4"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("2");
// Output: 1 2 3 4
```

**Remember:** never block the loop with heavy synchronous work, or all other requests have to wait.

### 5. Do you know ES Modules?

Yes. ES Modules are the standard way to share code between files, using `import` and `export`.

```js
// math.js
export const add = (a, b) => a + b;

// app.js
import { add } from "./math.js";
```

To use them in Node, add `"type": "module"` to `package.json` (or name the file `.mjs`).

### 6. What is the difference between `require` and `import`?

| `require` (CommonJS) | `import` (ES Modules) |
|---|---|
| Old Node style | Modern JavaScript standard |
| `module.exports` / `require()` | `export` / `import` |
| Loads **synchronously** | Loads **asynchronously** |
| Can be used anywhere, even inside an `if` | Must be at the top (use `import()` for dynamic loading) |
| No tree-shaking | Supports tree-shaking (removes unused code) |

```js
const express = require("express");   // CommonJS
import express from "express";        // ES Modules
```

---

## 🚏 Express.js

### 7. What is middleware in Express?

Middleware is a function that runs **between the request and the response**. It gets `req`, `res` and `next`.

It can:
- read or change the request
- send a response
- call `next()` to pass control to the next function.

```js
function logger(req, res, next) {
  console.log(req.method, req.url);
  next();   // go to the next middleware or route
}
app.use(logger);
```

If you forget `next()` and don't send a response, the request hangs.

### 8. What are the types of middleware?

1. **Application-level:** `app.use(...)`, runs for the whole app.
2. **Router-level:** `router.use(...)`, runs only for a group of routes.
3. **Error-handling:** has 4 arguments, `(err, req, res, next)`.
4. **Built-in:** `express.json()`, `express.static()`.
5. **Third-party:** from npm, like `cors`, `helmet` and `morgan`.

### 9. How do you handle errors in Express?

**1. Create one error-handling middleware** and put it **after all routes**:

```js
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});
```

**2. Send errors to it with `next(err)`:**

```js
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    next(err);   // goes to the error handler
  }
});
```

In **Express 5**, errors from `async` routes go to the error handler automatically.

**3. Also:** add a 404 handler for unknown routes, and handle `unhandledRejection` at the process level.

### 10. Name some HTTP status codes.

| Code | Meaning |
|---|---|
| **200** OK | Success |
| **201** Created | New item created (POST) |
| **204** No Content | Success, nothing to return (DELETE) |
| **400** Bad Request | Wrong input |
| **401** Unauthorized | Not logged in / bad token |
| **403** Forbidden | Logged in but not allowed |
| **404** Not Found | Resource doesn't exist |
| **409** Conflict | Duplicate, for example the email already exists |
| **429** Too Many Requests | Rate limit hit |
| **500** Internal Server Error | Bug on the server |
| **503** Service Unavailable | Server down or overloaded |

The groups: **2xx** success, **3xx** redirect, **4xx** client mistake, **5xx** server problem.

---

## 🔐 Auth, JWT & Security

### 11. What are authentication and authorization?

- **Authentication:** *Who are you?* Checking the user's identity (login with a password, OTP or Google). If it fails, return **401**.
- **Authorization:** *What are you allowed to do?* Checking permissions (for example, only an admin can delete). If it fails, return **403**.

Authentication always comes first.

### 12. What is JWT?

JWT (JSON Web Token) is a **signed token** that the server gives the user after login. The user sends it with every request, and the server checks it to know who the user is.

```js
// Login: create the token
const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

// Protected route: check the token
const data = jwt.verify(token, process.env.JWT_SECRET);
```

The token is sent in the header: `Authorization: Bearer <token>`.

### 13. How many parts does a JWT have?

**Three parts**, separated by dots: `header.payload.signature`

1. **Header:** the algorithm, for example `{ "alg": "HS256", "typ": "JWT" }`
2. **Payload:** the data (user ID, role, expiry)
3. **Signature:** proves the token was not changed

### 14. In which part of the JWT do we keep the expiry time?

In the **payload**, in the **`exp`** field. It is a timestamp in **seconds**.

```json
{ "id": "42", "iat": 1791990000, "exp": 1791993600 }
```

`expiresIn: "1h"` in `jwt.sign` sets `exp` for you.

### 15. Can you decode a JWT?

**Yes. Anyone can decode it.** The header and payload are only Base64URL-encoded, not encrypted.

```js
jwt.decode(token);   // reads the data, but does NOT check if it's real
jwt.verify(token, secret);   // checks the signature and expiry ✅
```

So:
- **Never put passwords or secret data in a JWT.**
- On the server, always use `verify`, not just `decode`.

### 16. How do you secure an API in Node.js?

- Use **JWT or sessions** for login, and check roles for permissions.
- **Validate all input** (Joi or zod).
- Use **HTTPS**.
- Add **helmet** for safe headers.
- Set up **CORS** correctly (allow only your frontend).
- Add **rate limiting**, especially on login.
- **Hash passwords** with bcrypt.
- Keep secrets in **`.env`**, never in code.
- Don't show error details or stack traces to users.
- Keep packages updated (`npm audit`).

### 17. What is CORS?

CORS (Cross-Origin Resource Sharing) is a **browser rule**. By default, a website can't call an API on a different domain or port. The server must allow it.

For example, a frontend on `localhost:3000` calling an API on `localhost:5000` is blocked until the server allows it:

```js
const cors = require("cors");
app.use(cors({ origin: "http://localhost:3000" }));
```

CORS only applies in browsers. Postman ignores it.

---

## 🏗️ Performance & Architecture

### 18. How do you handle CPU-heavy tasks in Node.js?

Heavy work (image or video processing, big calculations) **blocks the event loop**, so other requests have to wait. Solutions:

1. **Worker threads:** run the heavy work in a separate thread.
2. **Job queue:** put the task in a queue (BullMQ with Redis) and let a background worker do it.
3. **Child process:** run an external tool like `ffmpeg`.
4. **Cluster / PM2:** run one Node process per CPU core.

```js
const { Worker } = require("worker_threads");
new Worker("./heavy-task.js");
```

### 19. One request needs data from 7 APIs, and all must finish before you respond. How?

Call all 7 **at the same time** with `Promise.all`, not one by one. The total time then equals the slowest call, not the sum of all of them.

```js
const results = await Promise.all([
  fetch(api1), fetch(api2), fetch(api3), fetch(api4),
  fetch(api5), fetch(api6), fetch(api7),
]);
```

Also mention:
- **Timeouts**, so one slow API doesn't hang everything.
- `Promise.allSettled` if some failures are OK.
- **Cache** data that doesn't change often (Redis).

### 20. An API is slow in production. How do you debug and fix it?

**Find the problem:**
1. Check logs and monitoring tools to see which API is slow, and since when.
2. Measure time for each step: the database, external APIs, your code.

**Common causes and fixes:**
- **Slow database query** → add an **index**, fetch only the fields you need, use pagination.
- **Many queries in a loop** → combine them into one query.
- **API calls one after another** → use `Promise.all`.
- **Response too big** → paginate and compress it.
- **Heavy code blocking the event loop** → move it to a worker or queue.
- **Same data fetched again and again** → cache it with Redis.

Then measure again to confirm it's faster.

### 21. How does Pub/Sub work?

**Pub/Sub = Publish / Subscribe.**
- A **publisher** sends a message to a **topic**.
- Every **subscriber** listening to that topic gets the message.
- The publisher doesn't know or care who the subscribers are.

```
Order Service ──"order created"──► Topic ──► Email Service
                                         ──► Inventory Service
```

Tools: Redis Pub/Sub, Kafka, RabbitMQ, Google Pub/Sub.

**Benefit:** services are loosely connected, and you can add new subscribers without changing the publisher.

### 22. How do you make sure an event is processed exactly once?

Messages can sometimes be **delivered twice** (for example, after a retry). So you make the consumer handle duplicates safely:

1. Give every message a **unique ID**.
2. Before processing, check whether that ID was **already processed**, for example in a DB table with a unique index or in Redis.
3. If it was, **skip it**. If not, process it and save the ID.
4. **Acknowledge (ack)** the message only after processing succeeds.

```js
const alreadyDone = await ProcessedEvent.findOne({ eventId: msg.id });
if (alreadyDone) return msg.ack();
await processOrder(msg);
await ProcessedEvent.create({ eventId: msg.id });
msg.ack();
```

This is called making the consumer **idempotent**: running it twice gives the same result. For full safety, save the event ID and do the work in the **same database transaction**.

### 23. For long AI video processing, which would you use: SSE, WebSockets, long polling or short polling?

**Use SSE (Server-Sent Events)**, with short polling as a backup.

How:
1. The user uploads a video → the server returns a **job ID** right away.
2. A background worker processes the video.
3. The server sends progress updates (10%... 50%... done) to the browser using **SSE**.

**Why SSE?**
- Updates only go **one way** (server → browser), which is exactly what SSE does.
- It's simple, works over normal HTTP and reconnects automatically.

**Why not WebSockets?** They are two-way and harder to scale, and we don't need two-way communication here.

**Short polling** (asking "is it done?" every few seconds) is also fine, because video processing takes minutes.

### 24. What are the benefits of long and short polling compared to SSE and WebSockets?

**Short polling:** the client asks the server every few seconds.
**Long polling:** the client asks, and the server waits to reply until there is new data.

**Benefits of polling:**
- **Very simple:** just normal API calls.
- **Works everywhere:** no problems with firewalls, proxies or old browsers.
- **Easy to scale:** no open connections to manage.

**Downsides:** many wasted requests (short polling) and slower updates.

**Simple rule:** for real-time apps (chat, live scores), use WebSockets or SSE. For slow updates (job status), polling is fine.

### 25. How do you choose the polling interval: 1, 2, 5 seconds or more?

It depends on:
1. **How fast the user needs the update.** Payment status → 1–2 seconds. Video processing → 5–10 seconds.
2. **How long the task takes.** A 10-minute job doesn't need checking every second.
3. **Server load.** 10,000 users polling every 1 second = 10,000 requests per second. Every 5 seconds = 2,000.

**Best practice: backoff.** Start fast, then slow down (1s → 2s → 5s → 10s), and stop when the task is done.

```js
let delay = 1000;
async function check() {
  const job = await fetch(`/api/jobs/${id}`).then(r => r.json());
  if (job.status === "done") return showResult(job);
  delay = Math.min(delay * 2, 10000);   // slow down, max 10 seconds
  setTimeout(check, delay);
}
check();
```

---

## 🗄️ Database

### 26. When should you use SQL and when NoSQL?

**Use SQL** (MySQL, PostgreSQL) when:
- data has many **relationships** (users → orders → payments)
- you need strong **transactions** (banking, payments)
- the structure is fixed.

**Use NoSQL** (MongoDB) when:
- the data structure **changes often** or differs per record
- you need to handle **large amounts of data** and scale easily
- data is naturally document-like (profiles, product catalogues, logs).

Many apps use both: SQL for payments, MongoDB for products, Redis for caching.

---

## 🧑‍💼 Other Things Asked

### 27. Set up an application from scratch.

Explain the steps:

```bash
npm init -y
npm install express mongoose dotenv cors
npm install -D nodemon
```

**Folder structure:**

```
src/
  routes/        → URL paths
  controllers/   → handle request and response
  services/      → business logic
  models/        → database schemas
  middlewares/   → auth, error handler
  config/        → DB connection, env
  app.js
  server.js
```

```js
// app.js
const express = require("express");
const app = express();
app.use(express.json());
app.use("/api/users", require("./routes/user.routes"));
app.use(errorHandler);
module.exports = app;
```

Also mention: a `.env` file for secrets, `.gitignore`, ESLint and Prettier, and the scripts `npm run dev` and `npm start`.

### 28. Are you comfortable with both frontend and backend?

Answer honestly, with an example:

*"Yes. In my last project I built React screens and the Node/Express APIs behind them, including login with JWT and MongoDB. I'm a little stronger in backend, but I can handle a full feature end to end."*

### 29. Scenario and project questions

Be ready to explain **your own project**:
- What the project does and your role in it.
- The tech stack and why you chose it.
- One **difficult problem** you solved and how.
- How you did login, error handling and deployment.

See **MERN Self-Intro & Project Questions** for practice.

---

## ✅ Quick Revision

- Runtime = V8 + libuv + Node APIs.
- Event loop phases: timers → pending → idle → poll → check → close.
- `require` = old and synchronous; `import` = modern and asynchronous.
- Middleware = `(req, res, next)`. The error middleware has 4 arguments.
- JWT = header.payload.signature. Expiry is `exp` in the **payload**. Anyone can decode it, so always `verify`.
- 401 = not logged in, 403 = not allowed.
- CPU-heavy work → worker threads or a queue.
- 7 APIs → `Promise.all`.
- Exactly once → unique message ID + skip duplicates.
- Long jobs → job ID + SSE or polling.

---

[← React: 40 Shared Interview Questions](01-react-shared-questions.md) | [Index](../README.md) | [Next: Frontend Tasks →](../06-machine-coding/01-frontend-tasks.md)
