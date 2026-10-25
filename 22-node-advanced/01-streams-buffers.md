# Chapter 57 — Streams, Buffers & Backpressure

## 📖 Definition

A **Buffer** is a fixed-size chunk of raw binary memory outside the V8 heap, used for bytes (files, network packets, images). A **stream** processes data **piece by piece** (in chunks) instead of loading it all into memory. **Backpressure** is the mechanism that slows a fast producer down when the consumer cannot keep up.

## 🔍 Explanation

### Four stream types

| Type | Direction | Examples |
|---|---|---|
| **Readable** | Source | `fs.createReadStream`, `req` (incoming HTTP body), MongoDB cursor stream |
| **Writable** | Destination | `fs.createWriteStream`, `res` (HTTP response), S3 upload |
| **Duplex** | Both, independent | TCP socket, WebSocket |
| **Transform** | Both, output derived from input | `zlib.createGzip()`, CSV parser, encryption |

### Why streams?

```js
// ❌ Loads a 2 GB file into memory → crashes or slows the whole server
app.get("/video", async (req, res) => {
  const data = await fs.promises.readFile("movie.mp4");
  res.end(data);
});

// ✅ Constant ~64 KB memory regardless of file size
app.get("/video", (req, res) => {
  fs.createReadStream("movie.mp4").pipe(res);
});
```

### Backpressure

`writable.write(chunk)` returns `false` when the writable's internal buffer exceeds its `highWaterMark`. A correct producer then **pauses** until the `drain` event. `pipe()` and `pipeline()` do this automatically — manual `on("data")` + `write()` loops often do not, and memory explodes.

## 💻 Code Example — Buffers

```js
const buf = Buffer.from("Hello", "utf8");
buf;                         // <Buffer 48 65 6c 6c 6f>
buf.toString("base64");      // "SGVsbG8="
buf.length;                  // 5 (bytes, not characters)
Buffer.byteLength("₹");      // 3 — multi-byte UTF-8
Buffer.alloc(10);            // zero-filled
Buffer.concat([b1, b2]);
```

## 💻 Code Example — `pipeline` With Error Handling

```js
import { pipeline } from "node:stream/promises";
import fs from "node:fs";
import zlib from "node:zlib";

await pipeline(
  fs.createReadStream("access.log"),
  zlib.createGzip(),
  fs.createWriteStream("access.log.gz"),
);
// pipeline handles backpressure AND destroys every stream if one fails.
// .pipe() does not propagate errors — prefer pipeline in production.
```

## 💻 Code Example — Custom Transform Stream

```js
import { Transform } from "node:stream";

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});

await pipeline(process.stdin, upperCase, process.stdout);
```

## 💻 Code Example — Export 1 Million Orders as CSV (No Memory Spike)

```js
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

app.get("/api/reports/orders.csv", async (req, res, next) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="orders.csv"');

  const toCsv = new Transform({
    objectMode: true,                       // receives objects, emits strings
    transform(order, _enc, cb) {
      cb(null, `${order._id},${order.customer},${order.total},${order.createdAt.toISOString()}\n`);
    },
  });

  res.write("id,customer,total,createdAt\n");
  try {
    await pipeline(
      Order.find({ status: "paid" }).select("customer total createdAt").lean().cursor(),
      toCsv,
      res,
    );
  } catch (err) {
    next(err);
  }
});
```

## 💻 Code Example — Import a Large CSV Into MongoDB in Batches

```js
import { parse } from "csv-parse";

async function importProducts(path) {
  const parser = fs.createReadStream(path).pipe(parse({ columns: true }));
  let batch = [];
  for await (const row of parser) {           // async iteration respects backpressure
    batch.push({ name: row.name, price: Number(row.price) });
    if (batch.length === 1000) {
      await Product.insertMany(batch, { ordered: false });
      batch = [];
    }
  }
  if (batch.length) await Product.insertMany(batch, { ordered: false });
}
```

## 💻 Code Example — Manual Backpressure

```js
function writeMany(writable, lines) {
  let i = 0;
  function write() {
    let ok = true;
    while (i < lines.length && ok) {
      ok = writable.write(lines[i++] + "\n");  // false → buffer is full
    }
    if (i < lines.length) writable.once("drain", write); // resume when drained
    else writable.end();
  }
  write();
}
```

## 💻 Code Example — Streaming Upload to S3

```js
import { Upload } from "@aws-sdk/lib-storage";
import busboy from "busboy";

app.post("/upload", (req, res, next) => {
  const bb = busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024 } });
  bb.on("file", async (_name, file, info) => {
    try {
      const upload = new Upload({
        client: s3,
        params: { Bucket: process.env.BUCKET, Key: `uploads/${Date.now()}-${info.filename}`, Body: file },
      });
      const result = await upload.done();      // multipart upload, streamed
      res.json({ url: result.Location });
    } catch (err) { next(err); }
  });
  req.pipe(bb);
});
```

The file never touches the server's disk or sits in memory in full.

## 🔍 Object Mode and `highWaterMark`

- Default streams carry Buffers/strings; `highWaterMark` is in **bytes** (64 KB for fs read streams, 16 KB otherwise).
- `objectMode: true` streams carry JS objects; `highWaterMark` counts **objects** (default 16).

## 🌍 Real-World Use

- Video/audio streaming with HTTP `Range` requests.
- CSV/Excel exports and imports of large datasets.
- Proxying uploads straight to S3.
- Log processing, compression, encryption on the fly.
- Server-Sent Events and streaming AI responses (`res.write` chunks).

## 🎯 Likely Interview Questions

1. **What is a stream? Name the four types with examples.**
2. **Why use streams instead of `fs.readFile` for large files?**
3. **What is backpressure and how does Node handle it?**
4. **`pipe()` vs `pipeline()`?** — `pipeline` propagates errors and cleans up.
5. **What is a Buffer? Why is `Buffer.length` different from `string.length`?**
6. **How would you export 1 million MongoDB documents as CSV without running out of memory?**
7. **What is `objectMode`?**
8. **How would you upload a 2 GB file through your API?**

---

[← Rate Limiting](../03-nodejs/10-rate-limiting.md) | [Index](../README.md) | [Next: Cluster, Worker Threads & Scaling →](02-scaling-cluster-workers.md)
