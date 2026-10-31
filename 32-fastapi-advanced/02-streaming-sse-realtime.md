# Chapter 109 — Streaming, SSE & Real-Time

## 📖 Definition

Not every response is "compute, then send one JSON". FastAPI supports three ways to send data **over time**:

| Technique | Direction | Transport | Use for |
|---|---|---|---|
| **`StreamingResponse`** | Server → client, one response sent in chunks | Plain HTTP | Big CSV / file exports, LLM tokens as plain text, proxying a stream |
| **Server-Sent Events (SSE)** | Server → client, named events | HTTP (`text/event-stream`) | Live order status, notifications, progress bars, **LLM token streaming** |
| **WebSockets** | **Both ways** | WebSocket protocol | Chat, collaborative editing, multiplayer, live dashboards with user input |

Recent FastAPI versions (0.162 here) have **built-in SSE**: `fastapi.sse.EventSourceResponse` and `ServerSentEvent`. The order-events SSE, the token `StreamingResponse` and the WebSocket + Redis examples below were run with `TestClient` (using `fakeredis`) and **pass**, and the outputs shown are the real wire format. The CSV export and LLM proxy examples need a real database and LLM provider, so they weren't run.

## 💻 `StreamingResponse`

```python
import asyncio
from fastapi.responses import StreamingResponse

async def fake_llm_tokens(prompt: str):
    for word in f"Echo: {prompt}".split():
        yield word + " "
        await asyncio.sleep(0.01)                 # pretend each token takes time

@app.get("/chat")
async def chat(prompt: str):
    return StreamingResponse(fake_llm_tokens(prompt), media_type="text/plain")
# GET /chat?prompt=hello world  →  "Echo: hello world " arrives word by word
```

### Streaming a large CSV from the database

```python
import csv, io

@app.get("/reports/orders.csv")
async def export_orders(db: DB):
    async def rows():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "amount", "status"])
        yield buf.getvalue()
        result = await db.stream(select(Order.id, Order.amount, Order.status))   # server-side cursor
        async for row in result:
            buf.seek(0); buf.truncate()
            writer.writerow(row)
            yield buf.getvalue()

    return StreamingResponse(
        rows(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="orders.csv"'},
    )
```

Memory stays flat whether there are 1,000 or 10 million rows, the same as piping streams in Node.

## 💻 Server-Sent Events (Built In)

```python
from collections.abc import AsyncIterator
from fastapi.sse import EventSourceResponse, ServerSentEvent

@app.get("/orders/{order_id}/events", response_class=EventSourceResponse)
async def order_events(order_id: int) -> AsyncIterator[ServerSentEvent]:
    for i, step in enumerate(["PLACED", "PACKED", "SHIPPED"]):
        yield ServerSentEvent(data={"order_id": order_id, "status": step}, event="status", id=str(i))
        await asyncio.sleep(1)
```

The real response (`content-type: text/event-stream; charset=utf-8`):

```text
event: status
data: {"order_id": 42, "status": "PLACED"}
id: 0

event: status
data: {"order_id": 42, "status": "PACKED"}
id: 1

event: status
data: {"order_id": 42, "status": "SHIPPED"}
id: 2
```

- If you `yield` a plain dict or Pydantic model, it's JSON-encoded into `data:`. Use `raw_data=` to send text that isn't JSON.
- `id` lets the browser **resume**: on reconnect, it sends a `Last-Event-ID` header, so your endpoint can continue from there.
- `retry=` (milliseconds) tells the browser how long to wait before reconnecting.
- On older FastAPI versions, use the `sse-starlette` package (`EventSourceResponse`), which works the same way.

### React client

```jsx
useEffect(() => {
  const es = new EventSource(`/api/orders/${orderId}/events`);   // auto-reconnects
  es.addEventListener("status", (e) => setStatus(JSON.parse(e.data).status));
  es.onerror = () => console.warn("SSE connection lost; browser will retry");
  return () => es.close();                                       // clean up on unmount
}, [orderId]);
```

`EventSource` only does **GET** and can't set an `Authorization` header. Use a cookie session, a short-lived token in the query string, or `fetch()` with a stream reader (needed for POST-based LLM chat).

```js
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ prompt }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
}
```

## 💻 Streaming an LLM Response Through FastAPI

The common AI-feature setup: React → FastAPI → LLM provider. FastAPI keeps the API key secret, checks auth, logs usage, and **passes the tokens through as they arrive**.

```python
import httpx
from pydantic import BaseModel

class ChatIn(BaseModel):
    prompt: str

@app.post("/chat", response_class=EventSourceResponse)
async def chat_stream(body: ChatIn, request: Request, user: CurrentUser):
    client: httpx.AsyncClient = request.app.state.http            # created once in lifespan
    async with client.stream("POST", LLM_URL, json={"prompt": body.prompt, "stream": True},
                             headers={"Authorization": f"Bearer {LLM_KEY}"}, timeout=60) as upstream:
        async for line in upstream.aiter_lines():
            if await request.is_disconnected():                    # user closed the tab → stop paying for tokens
                break
            if line:
                yield ServerSentEvent(raw_data=line)
```

Things to mention: timeouts, cancelling on disconnect, rate limits per user, counting tokens for billing, and **never sending the provider key to the browser**.

## 💻 WebSockets With Auth and Redis Pub/Sub

A WebSocket endpoint can use dependencies too. Here, a `Query` token is checked before `accept()`, and messages go through **Redis Pub/Sub**, so users connected to **different workers or servers** still see each other's messages.

```python
import json
import jwt
import redis.asyncio as redis
from fastapi import Query, WebSocket, WebSocketDisconnect, WebSocketException, status

async def ws_user(token: Annotated[str | None, Query()] = None) -> int:
    try:
        return int(jwt.decode(token or "", SECRET, algorithms=["HS256"])["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)   # closes with code 1008

@app.websocket("/ws/rooms/{room}")
async def room_socket(
    ws: WebSocket,
    room: str,
    user_id: Annotated[int, Depends(ws_user)],
    r: Annotated[redis.Redis, Depends(get_redis)],
):
    await ws.accept()
    pubsub = r.pubsub()
    await pubsub.subscribe(f"room:{room}")

    async def forward_from_redis():                       # Redis → this client
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                await ws.send_text(msg["data"])

    forward = asyncio.create_task(forward_from_redis())
    try:
        while True:                                       # this client → Redis → every subscriber
            text = await ws.receive_text()
            await r.publish(f"room:{room}", json.dumps({"from": user_id, "text": text}))
    except WebSocketDisconnect:
        pass
    finally:
        forward.cancel()
        await pubsub.unsubscribe(f"room:{room}")
        await pubsub.aclose()
```

Test result: a client with a valid token sends `"hello"` and receives `{"from": 7, "text": "hello"}` back through Redis. A client with a bad token is closed with code **1008** (policy violation).

### WebSocket production checklist

- **Authenticate at connect time** (token in the query string or the first message; cookies work for the same site), and check room permissions.
- **Heartbeats:** Uvicorn sends pings (`--ws-ping-interval`). Set the proxy and load balancer idle timeouts higher than that. Nginx needs the `Upgrade` and `Connection` headers.
- **Back-pressure:** a slow client can fill memory; drop or disconnect clients that fall too far behind.
- **Reconnects:** the client reconnects with backoff, then fetches missed messages over REST (`?after=<last_id>`). Sockets aren't a durable queue.
- **Persist first, then publish**, so a crash never shows a message that wasn't saved.
- **Sticky sessions** are only needed for protocols with HTTP fallbacks (like Socket.IO's polling). Plain WebSockets stay on one connection.

## 🔍 Choosing the Technique

```
Does the client need to SEND messages over the same channel often?
├── Yes → WebSocket
└── No (server pushes only)
    ├── Discrete events (status, notifications, LLM tokens) → SSE
    ├── One big payload sent in pieces (CSV, file, proxy)   → StreamingResponse
    └── Updates every 30 s+ are fine                        → plain polling
```

## 🌍 Real-World Use

- An AI chat feature in a MERN app: React → FastAPI (auth, rate limit, prompt building) → LLM provider, with tokens streamed back as SSE.
- Order tracking: SSE from FastAPI, fed by Redis Pub/Sub messages published by the order service.
- Admin exports: a `StreamingResponse` CSV straight from a server-side DB cursor.
- Live support chat: WebSockets + Redis Pub/Sub across several Uvicorn workers.

## 🎯 Likely Interview Questions

1. **`StreamingResponse` vs SSE vs WebSocket: when do you use each?**
2. **What is the SSE wire format? What are `id` and `retry` for?**
3. **How do you stream LLM tokens from FastAPI to React?**
4. **Why can't `EventSource` send an Authorization header, and what do you do instead?**
5. **How do you stop work when the client disconnects?** — `await request.is_disconnected()` / catch the cancellation.
6. **How do you stream a 10-million-row export without running out of memory?**
7. **How do you authenticate a WebSocket in FastAPI?**
8. **How do you broadcast WebSocket messages across several workers or servers?** — Redis Pub/Sub (or a broker).
9. **What WebSocket close code means "policy violation"?** — 1008.
10. **What must a proxy or load balancer support for WebSockets and SSE?** — Upgrade headers, long idle timeouts, no response buffering (`X-Accel-Buffering: no` for Nginx with SSE).

---

[← Caching, Rate Limiting, Idempotency & Background Jobs](01-caching-rate-limiting-background-jobs.md) | [Index](../README.md) | [Next: FastAPI in a MERN Architecture →](03-fastapi-in-mern-architecture.md)
