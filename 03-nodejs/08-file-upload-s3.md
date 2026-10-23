# Chapter 53 — File Uploads with AWS S3

## 📖 Definition

File upload handling in Node.js typically uses **Multer** to parse multipart bodies, then streams the file to an object store like **AWS S3** and saves only the key/URL in the database.

> 💡 You already use this stack in production — be ready to talk through it confidently.

## 🔍 Two Patterns

| Pattern | Flow | When |
|---------|------|------|
| **Server-mediated** | Browser → API → S3 | Small files, need server-side validation/transformation |
| **Pre-signed URL** | Browser → S3 directly (API only signs the URL) | Large files, high throughput, lower server cost |

## 💻 Code Example — Multer Setup

```js
import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },          // 5 MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error("Only PNG/JPEG/WebP allowed"));
    }
    cb(null, true);
  },
});
```

## 💻 Code Example — Server-Mediated Upload to S3

```js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";

const s3 = new S3Client({ region: process.env.AWS_REGION });

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const ext = path.extname(req.file.originalname);
  const key = `uploads/${crypto.randomUUID()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
    Metadata: { uploadedBy: String(req.user.id) },
  }));

  const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  res.status(201).json({ url, key });
});
```

## 💻 Code Example — Pre-Signed URL (Direct Browser Upload)

```js
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

app.post("/upload/sign", async (req, res) => {
  const { filename, contentType } = req.body;
  const key = `uploads/${crypto.randomUUID()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 });   // 60s window
  res.json({ uploadUrl: url, key });
});
```

```js
// Browser-side
async function upload(file) {
  // 1. Ask server for a pre-signed URL
  const { uploadUrl, key } = await fetch("/upload/sign", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
    headers: { "Content-Type": "application/json" },
  }).then(r => r.json());

  // 2. Upload directly to S3
  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  // 3. Tell server we're done
  await fetch("/upload/complete", {
    method: "POST",
    body: JSON.stringify({ key }),
    headers: { "Content-Type": "application/json" },
  });
}
```

> Server CPU usage drops to near zero — large file bytes never traverse it.

## 💻 Code Example — Streaming Upload (`@aws-sdk/lib-storage`)

```js
import { Upload } from "@aws-sdk/lib-storage";

app.post("/upload-stream", upload.single("file"), async (req, res) => {
  const key = `uploads/${Date.now()}-${req.file.originalname}`;

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: req.file.stream,        // for true streaming, use multer.diskStorage or busboy
      ContentType: req.file.mimetype,
    },
  });

  uploader.on("httpUploadProgress", (p) => {
    console.log(`Progress: ${p.loaded}/${p.total}`);
  });

  await uploader.done();
  res.json({ key });
});
```

`lib-storage` handles **multipart uploads** for files > 5 MB and retries failed parts automatically.

## 💻 Code Example — Generating Pre-Signed Download URLs

```js
import { GetObjectCommand } from "@aws-sdk/client-s3";

app.get("/files/:key/download", async (req, res) => {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: req.params.key,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  res.redirect(url);
});
```

Useful for protected files — clients don't need long-term S3 credentials.

## 💻 Code Example — NestJS Version

```ts
@Controller("upload")
export class UploadController {
  constructor(private readonly s3: S3Service) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /^image\//.test(file.mimetype);
      cb(ok ? null : new BadRequestException("Bad type"), ok);
    },
  }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.s3.upload(file);
  }
}

@Injectable()
export class S3Service {
  private client = new S3Client({ region: process.env.AWS_REGION });

  async upload(file: Express.Multer.File) {
    const key = `uploads/${randomUUID()}-${file.originalname}`;
    await this.client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return { key, url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}` };
  }
}
```

## 🔒 Security Checklist

- ✅ Validate **MIME type** server-side, not just file extension.
- ✅ Enforce **size limit** in Multer + S3 policy.
- ✅ Use **randomized keys** to prevent guessing.
- ✅ Set S3 bucket to **private** by default; serve via pre-signed URLs.
- ✅ Strip EXIF/metadata from images before storing.
- ✅ Scan for malware on user uploads (e.g., ClamAV, S3 Lambda triggers).
- ✅ Set tight **CORS** rules on the bucket.

## 🎯 Likely Interview Questions

1. **How does file upload work in Node?**
2. **What's a pre-signed URL?**
3. **Why use pre-signed URLs for large files?**
4. **How do you validate file types securely?**
5. **How would you stream a 1 GB upload to S3?** — `@aws-sdk/lib-storage`'s `Upload` does multipart streaming with retries.
6. **Story to tell:** Mention your NestJS + AWS S3 work — "I implemented a scalable file-upload service using NestJS and AWS S3 with pre-signed URLs and MIME validation. Server CPU dropped ~50% on the upload route once we moved to direct uploads."

---

[← Error Handling](07-error-handling.md) | [Index](../README.md) | [Next: Pagination →](09-pagination.md)
