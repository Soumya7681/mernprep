# Chapter 113 — Authentication Architecture

## 📖 Definition

Authentication architecture is the set of components and protocols that establish **who** a user is, while authorization determines **what** they can do.

## 🔍 Common Approaches

| Approach | Storage | Pros | Cons |
|----------|---------|------|------|
| **Session (server-side)** | Session ID in cookie, data in Redis | Easy revocation, smaller cookie | Sticky sessions / shared store |
| **Stateless JWT** | Self-contained token in `Authorization` header | Scales horizontally, no DB hop per request | Hard to revoke before expiry |
| **JWT + Refresh** | Short access in memory, long refresh in httpOnly cookie | Best of both worlds | More moving parts |
| **OAuth 2.0 / OIDC** | Tokens issued by an Identity Provider (Google, Auth0, Cognito) | No password handling on your servers | Setup complexity |

## 🏗️ Reference Architecture (JWT + Refresh)

```
[Browser]
   │  POST /auth/login (email, password)
   ▼
[API Gateway / Load Balancer]
   │
   ▼
[Auth Service]
   │  1. validate creds
   │  2. issue Access JWT (15m)
   │  3. issue Refresh JWT (7d), store hash in DB
   │
   ▼
   Set-Cookie: refresh=...; HttpOnly; Secure; SameSite=Strict
   Body: { accessToken }
   ◄─────────────────────────────────────────────
[Browser stores access in memory]

╭───────── subsequent requests ─────────╮
[Browser]
   │  GET /api/orders
   │  Authorization: Bearer <access>
   ▼
[API Gateway] → verify JWT signature (public key, no DB hit)
   │
   ▼
[Backend Service]
   │  handle business logic
   ▼
[Database]

╭─── access expires (401) ───╮
[Browser]
   │  POST /auth/refresh   (cookie sent automatically)
   ▼
[Auth Service]
   │  1. verify refresh signature
   │  2. check DB allowlist (revoke check)
   │  3. ROTATE — delete old, issue new
   │  4. issue new access
   ▼
   Set-Cookie: refresh=new; Body: { accessToken }
```

## 💻 Code Example — Multi-Provider Login

```js
// Strategy pattern: same interface, multiple providers
const providers = {
  password: async ({ email, password }) => {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, "BAD_CREDS");
    }
    return user;
  },

  google: async ({ idToken }) => {
    const profile = await verifyGoogleToken(idToken);
    return User.findOneAndUpdate(
      { email: profile.email },
      { $setOnInsert: { name: profile.name } },
      { upsert: true, new: true }
    );
  },

  github: async ({ code }) => {
    const { access_token } = await exchangeGitHubCode(code);
    const profile = await fetchGitHubProfile(access_token);
    return User.findOneAndUpdate({ email: profile.email }, { ... }, { upsert: true, new: true });
  },
};

app.post("/auth/:provider", async (req, res) => {
  const fn = providers[req.params.provider];
  if (!fn) return res.status(404).end();
  const user = await fn(req.body);
  // Issue tokens as in Chapter 31
});
```

## 🔐 Role-Based Access Control (RBAC)

```js
// User → Role → Permissions
{
  user: { id: "u1", roles: ["editor"] },
  roles: {
    admin:  ["users.*",  "posts.*"],
    editor: ["posts.read", "posts.write"],
    viewer: ["posts.read"],
  },
}
```

```ts
// NestJS guard
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<string>("permission", ctx.getHandler());
    const { user } = ctx.switchToHttp().getRequest();
    return user.permissions.includes(required);
  }
}

@Post()
@RequirePermission("posts.write")
create(@Body() dto: CreatePostDto) {}
```

## 🔑 Attribute-Based Access Control (ABAC)

Decisions can depend on attributes of the user, resource, and environment:

```js
function canEdit(user, post) {
  if (user.role === "admin") return true;
  if (user.id === post.authorId && post.status !== "published") return true;
  return false;
}
```

Use ABAC when permissions depend on relationships (ownership, team membership).

## 🛡️ Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Long-lived access tokens | Keep access tokens short (5–15 min) |
| Refresh tokens forever | Rotate on every use, store hash in DB |
| Storing JWT in `localStorage` | Vulnerable to XSS — prefer httpOnly cookie for refresh |
| No CSRF protection on cookies | Use `SameSite=Strict` or a CSRF token |
| Same secret across environments | Use env-specific secrets, rotate periodically |
| Password reset enumeration | Always respond identically whether the email exists or not |

## 📊 Choosing an Approach (Quick Guide)

| Scenario | Recommendation |
|----------|---------------|
| SaaS for general users | JWT + refresh (httpOnly cookie) |
| Internal tools (single-domain) | Session cookies |
| Mobile apps | JWT + refresh (secure storage) |
| Enterprise SSO | OIDC with Auth0 / Cognito / Okta |
| Microservices | RS256 JWT (gateway verifies with public key) |

## 💻 Code Example — Password Reset Flow

```
1. POST /auth/forgot { email }
   - Generate reset token: random 32 bytes
   - Save HASH of token + expiry (15 min) in DB
   - Email link: /reset?token=<raw>
2. POST /auth/reset { token, newPassword }
   - Hash the incoming raw token
   - Look up by hash; check expiry
   - Update password, delete token
```

```js
import crypto from "crypto";

async function forgotPassword({ email }) {
  const user = await User.findOne({ email });
  if (!user) return;                          // don't leak existence
  const raw  = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  await ResetToken.create({ userId: user.id, hash, expiresAt: Date.now() + 15*60*1000 });
  await sendEmail(email, `Reset: https://app.example/reset?token=${raw}`);
}
```

## 🎯 Likely Interview Questions

1. **Walk me through your authentication flow.**
2. **How do you handle token expiry?**
3. **How do you revoke a JWT?**
4. **Stateful vs stateless auth?**
5. **How does OAuth differ from your own JWT auth?**
6. **What's RBAC vs ABAC?**

---

[← Backend Tasks](../06-machine-coding/02-backend-tasks.md) | [Index](../README.md) | [Next: Scalable APIs →](02-scalable-apis.md)
