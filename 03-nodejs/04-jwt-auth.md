# Chapter 54 — JWT Authentication & Refresh Tokens

## 📖 Definition

**JWT (JSON Web Token)** is a self-contained, signed token format used for stateless authentication.

## 🔍 Structure

```
header.payload.signature
```
Each segment is **Base64URL-encoded** JSON (or in the case of the signature, the binary signature).

- **Header** — `{ "alg": "HS256", "typ": "JWT" }`
- **Payload** — claims: `sub`, `exp`, `iat`, plus your custom data.
- **Signature** — `HMACSHA256(base64(header) + "." + base64(payload), secret)` (HS256), or asymmetric (RS256, ES256).

## 🔑 Access + Refresh Token Flow

```
[1] POST /login (email, password)
       └─→ server validates → returns:
           access  (15 min, in memory or Authorization header)
           refresh (7 days, in httpOnly cookie)

[2] GET /api/whatever
       Authorization: Bearer <access>
       └─→ server verifies access JWT → handles request

[3] Access expires → 401
       └─→ client calls POST /auth/refresh
           (browser sends refresh cookie automatically)
           └─→ server verifies refresh against DB allowlist
               returns new access (and rotates refresh)

[4] POST /logout
       └─→ server deletes refresh from DB
           clears cookie
```

## 💻 Code Example — Issuing Tokens at Login

```js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const access  = jwt.sign({ sub: user.id, role: user.role },
                           process.env.JWT_SECRET, { expiresIn: "15m" });
  const refresh = jwt.sign({ sub: user.id },
                           process.env.REFRESH_SECRET, { expiresIn: "7d" });

  // Persist refresh token (so we can revoke it)
  await RefreshToken.create({ userId: user.id, token: refresh });

  res
    .cookie("refresh", refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({ access });
}
```

## 💻 Code Example — Verifying on Protected Routes

```js
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.use("/api", authMiddleware);
```

## 💻 Code Example — Refresh Endpoint with Rotation

```js
async function refresh(req, res) {
  const token = req.cookies.refresh;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid refresh" });
  }

  // Allowlist check (so we can revoke)
  const stored = await RefreshToken.findOne({ token });
  if (!stored) return res.status(401).json({ error: "Revoked token" });

  // Rotate — delete old, issue new
  await RefreshToken.deleteOne({ _id: stored._id });

  const newRefresh = jwt.sign({ sub: payload.sub },
                              process.env.REFRESH_SECRET, { expiresIn: "7d" });
  await RefreshToken.create({ userId: payload.sub, token: newRefresh });

  const newAccess  = jwt.sign({ sub: payload.sub },
                              process.env.JWT_SECRET, { expiresIn: "15m" });

  res.cookie("refresh", newRefresh, { httpOnly: true, sameSite: "strict" })
     .json({ access: newAccess });
}
```

## 💻 Code Example — Logout

```js
async function logout(req, res) {
  const token = req.cookies.refresh;
  if (token) await RefreshToken.deleteOne({ token });
  res.clearCookie("refresh").json({ ok: true });
}
```

## 💻 Code Example — Frontend Usage

```js
// On login
const res = await fetch("/api/auth/login", {
  method: "POST",
  credentials: "include",                   // ← allow httpOnly cookie
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const { access } = await res.json();
sessionStorage.setItem("access", access);   // or in memory

// Authorized request
const data = await fetch("/api/me", {
  headers: { Authorization: `Bearer ${access}` },
  credentials: "include",
});

// Auto-refresh on 401 (axios interceptor or fetch wrapper)
async function apiFetch(url, opts = {}) {
  let res = await fetch(url, { ...opts, headers: authHeaders() });
  if (res.status === 401) {
    const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (!r.ok) throw new Error("Session expired");
    const { access } = await r.json();
    sessionStorage.setItem("access", access);
    res = await fetch(url, { ...opts, headers: authHeaders() });
  }
  return res;
}
```

## 💻 Code Example — Decoding a JWT (Debug)

```js
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

const [headerB64, payloadB64] = token.split(".");
const header  = JSON.parse(Buffer.from(headerB64,  "base64").toString());
const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString());

console.log(header);   // { alg: "HS256", typ: "JWT" }
console.log(payload);  // { sub: "abc123", role: "user", iat: ..., exp: ... }
```

> ⚠️ The payload is **not encrypted** — only signed. Never put secrets in it.

## 🔒 Security Best Practices

| Topic | Best practice |
|-------|---------------|
| Storage | **httpOnly cookie** for refresh; access in memory (not localStorage if you can avoid it) |
| Cookie flags | `httpOnly`, `secure`, `sameSite=strict` |
| Rotation | Issue a new refresh token on every refresh |
| Revocation | Maintain a DB list of valid refresh tokens |
| Expiry | Short access (15m), longer refresh (7-30d) |
| Algorithm | Use HS256 with strong secret, or RS256 for distributed verification |
| Claims | Include `sub`, `iat`, `exp`; minimal payload |
| Logout | Delete refresh token server-side |

## 🎯 Likely Interview Questions

1. **Explain JWT authentication.**
2. **Why do we need refresh tokens?** — Short-lived access tokens limit damage if leaked; refresh allows re-authentication without re-login.
3. **Where do you store JWTs in the browser?**
4. **How do you revoke a JWT?** — JWTs themselves are stateless. Maintain a server-side blocklist/allowlist of refresh tokens; for access, you either tolerate up to expiry or maintain a denylist.
5. **HS256 vs RS256?** — HS256 (symmetric, single secret); RS256 (asymmetric, public/private — gateway can verify without sharing secret).

---

[← Middleware](03-middleware.md) | [Index](../README.md) | [Next: REST Best Practices →](05-rest-best-practices.md)
