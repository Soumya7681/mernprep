# Chapter 63 — WebSockets & Real-Time

## 📖 Definition

**WebSocket** is a protocol that upgrades an HTTP connection into a **persistent, full-duplex** channel, so the server can push data to the client at any time. **Socket.IO** is a library on top of WebSocket that adds automatic reconnection, fallbacks, rooms, namespaces, acknowledgements and multi-server scaling.

## 🔍 Choosing a Real-Time Technique

| Technique | Direction | Use when |
|---|---|---|
| **Polling** (`setInterval` + fetch) | Client pulls | Updates every 30 s+ are fine; simplest |
| **Long polling** | Client pulls, server holds | Legacy fallback |
| **Server-Sent Events (SSE)** | Server → client only, over HTTP | Notifications, live scores, streaming AI tokens |
| **WebSocket / Socket.IO** | Both ways | Chat, collaborative editing, multiplayer, live tracking |

## 💻 Code Example — Socket.IO Server With Express

```js
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "https://app.example.com", credentials: true },
});

// Authenticate the socket once, during the handshake
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);           // personal room for notifications

  socket.on("chat:join", (roomId) => socket.join(`chat:${roomId}`));

  socket.on("chat:message", async ({ roomId, text }, ack) => {
    if (!text?.trim()) return ack({ ok: false, error: "Empty message" });
    const msg = await Message.create({ roomId, text, from: socket.user.id });
    socket.to(`chat:${roomId}`).emit("chat:message", msg);  // everyone in room except sender
    ack({ ok: true, id: msg._id });                         // acknowledgement to sender
  });

  socket.on("typing", (roomId) => socket.to(`chat:${roomId}`).volatile.emit("typing", socket.user.id));

  socket.on("disconnect", (reason) => console.log("left", socket.user.id, reason));
});

httpServer.listen(4000);
```

## 💻 Code Example — Emitting From a REST Route

```js
app.patch("/api/orders/:id/status", auth, async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  io.to(`user:${order.userId}`).emit("order:status", { id: order._id, status: order.status });
  res.json(order);
});
```

## 💻 Code Example — React Client

```jsx
import { io } from "socket.io-client";

export function useSocket(token) {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { auth: { token } });
    setSocket(s);
    return () => s.disconnect();                 // avoid duplicate connections
  }, [token]);
  return socket;
}

function ChatRoom({ roomId, socket }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("chat:join", roomId);
    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on("chat:message", onMessage);
    return () => socket.off("chat:message", onMessage);   // remove THIS listener only
  }, [socket, roomId]);

  const send = (text) =>
    socket.emit("chat:message", { roomId, text }, (res) => {
      if (!res.ok) alert(res.error);
    });
  // …
}
```

**Classic bug:** forgetting `socket.off` in cleanup → every re-render or StrictMode double-mount adds another listener, and messages appear 2×, 3×…

## 💻 Code Example — Scaling Across Servers With Redis

```js
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
// io.to("chat:42").emit(...) now reaches clients connected to ANY instance.
```

Also enable **sticky sessions** on the load balancer if clients may fall back to HTTP long-polling, or force `transports: ["websocket"]`.

## 💻 Code Example — Server-Sent Events (No Library)

```js
app.get("/api/notifications/stream", auth, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
  const unsubscribe = notifications.subscribe(req.user.id, send);

  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});
```

```js
// Browser
const es = new EventSource("/api/notifications/stream", { withCredentials: true });
es.onmessage = (e) => showToast(JSON.parse(e.data));   // auto-reconnects
```

## 🔍 Production Concerns

- **Authentication:** verify on handshake; re-check permissions when joining rooms (can this user join `chat:42`?).
- **Missed messages:** clients that reconnect must fetch history (`GET /messages?after=<lastId>`); sockets are not a durable queue.
- **Message ordering and duplicates:** include IDs and timestamps; de-duplicate on the client.
- **Heartbeats:** Socket.IO pings automatically; proxies (Nginx, ALB) need idle timeouts above the ping interval and `Upgrade` headers configured.
- **Rate limiting** per socket to stop spam.
- **Persist first, then emit**, so a crash never shows a message that was not saved.

## 🌍 Real-World Use

- Chat and support widgets, live order tracking, delivery-partner location, stock tickers, collaborative docs, live dashboards, multiplayer games.

## 🎯 Likely Interview Questions

1. **WebSocket vs HTTP — how does the upgrade work?**
2. **WebSocket vs SSE vs polling — when would you use each?**
3. **What does Socket.IO add on top of WebSocket?**
4. **What are rooms and namespaces?**
5. **How do you authenticate socket connections?**
6. **How do you scale Socket.IO across multiple servers?** — Redis adapter + sticky sessions.
7. **Messages appear twice in the React chat — why?**
8. **How do you make sure a user does not miss messages while offline?**

---

[← Cluster, Worker Threads & Scaling](02-scaling-cluster-workers.md) | [Index](../README.md) | [Next: Redis Caching & Job Queues →](04-redis-caching-queues.md)
