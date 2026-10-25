# Chapter 91 — Authentication End-to-End (Express + Mongo + React/Redux)

## 📖 Definition

Production MERN auth usually means:

- A short-lived **access token** (JWT, ~15 min) sent in the `Authorization: Bearer` header and kept **in memory** (Redux state) on the client.
- A long-lived **refresh token** (~7 days) stored in an **httpOnly, Secure, SameSite cookie**, so JavaScript (and XSS) can't read it.
- A `/auth/refresh` endpoint that issues a new access token, with **refresh-token rotation** to detect theft.

## 🔍 The Full Flow

```text
 React (Redux)                          Express API                         MongoDB
 ─────────────                          ───────────                         ───────
 POST /auth/login {email,pw}  ───────►  verify password (bcrypt)  ────────► users
                                        sign access (15m) + refresh (7d)
                              ◄───────  200 { user, accessToken }
                                        Set-Cookie: rt=…; HttpOnly; Secure
 store accessToken in Redux

 GET /api/tasks
   Authorization: Bearer <access> ───►  requireAuth → verify JWT → req.user

 …15 min later…
 GET /api/tasks  ─────────────────────► 401 TOKEN_EXPIRED
 POST /auth/refresh (cookie sent) ────► verify refresh, check tokenVersion
                              ◄───────  { accessToken } + rotated cookie
 retry original request (RTK Query baseQueryWithReauth)

 POST /auth/logout ───────────────────► bump tokenVersion, clear cookie
```

## 💻 Server — Token Helpers

```ts
// modules/auth/tokens.ts
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { Role } from "@app/shared";

export interface AccessPayload { sub: string; role: Role }
export interface RefreshPayload { sub: string; ver: number }   // ver = user.tokenVersion

export const signAccess = (p: AccessPayload) =>
  jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });

export const signRefresh = (p: RefreshPayload) =>
  jwt.sign(p, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

function isAccess(p: string | JwtPayload): p is JwtPayload & AccessPayload {
  return typeof p === "object" && typeof p.sub === "string" && typeof p.role === "string";
}
function isRefresh(p: string | JwtPayload): p is JwtPayload & RefreshPayload {
  return typeof p === "object" && typeof p.sub === "string" && typeof p.ver === "number";
}

export function verifyAccess(token: string): AccessPayload {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (!isAccess(p)) throw new Error("Malformed token");
  return p;
}

export function verifyRefresh(token: string): RefreshPayload {
  const p = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (!isRefresh(p)) throw new Error("Malformed token");
  return p;
}
```

`jwt.verify` returns `string | JwtPayload`. The type guards make the payload type **true** rather than just cast.

## 💻 Server — User Model Addition

```ts
// user.model.ts (add to IUser and the schema from the Mongoose chapter)
tokenVersion: { type: Number, default: 0 },   // bump to invalidate every refresh token for this user
```

## 💻 Server — Auth Service & Controller

```ts
// modules/auth/auth.service.ts
import { User, type UserDocument } from "../users/user.model.js";
import { AppError } from "../../utils/AppError.js";
import { signAccess, signRefresh, verifyRefresh } from "./tokens.js";

export const authService = {
  async register(dto: { email: string; name: string; password: string }) {
    if (await User.exists({ email: dto.email })) throw AppError.conflict("Email already registered");
    const user = await User.create(dto);              // pre("save") hashes the password
    return issueTokens(user);
  },

  async login(email: string, password: string) {
    const user = await User.findByEmail(email);       // selects +password
    // Same message for "no user" and "wrong password" → no user enumeration
    if (!user || !(await user.comparePassword(password))) throw AppError.unauthorized("Invalid credentials");
    if (!user.isActive) throw AppError.forbidden("Account disabled");
    return issueTokens(user);
  },

  async refresh(token: string | undefined) {
    if (!token) throw AppError.unauthorized("No refresh token");
    const payload = verifyRefresh(token);
    const user = await User.findById(payload.sub);
    // tokenVersion mismatch = logged out everywhere OR a stolen, already-rotated token
    if (!user || user.tokenVersion !== payload.ver) throw AppError.unauthorized("Session expired");
    user.tokenVersion += 1;                            // rotation: the old refresh token is now dead
    await user.save();
    return issueTokens(user);
  },

  async logout(userId: string) {
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  },
};

function issueTokens(user: UserDocument) {
  return {
    user: user.toJSON(),
    accessToken: signAccess({ sub: user.id, role: user.role }),
    refreshToken: signRefresh({ sub: user.id, ver: user.tokenVersion }),
  };
}
```

> Simple rotation with a single `tokenVersion` logs the user out on **all devices** when any refresh happens on another device. For multi-device support, store one hashed refresh-token record per session (collection `sessions` with `userId`, `tokenHash`, `expiresAt` + TTL index) and rotate per session.

```ts
// modules/auth/auth.controller.ts
import type { Request, Response, CookieOptions } from "express";
import { env } from "../../config/env.js";
import { authService } from "./auth.service.js";

const REFRESH_COOKIE = "rt";
const cookieOpts: CookieOptions = {
  httpOnly: true,                              // JS can't read it → safe from XSS theft
  secure: env.NODE_ENV === "production",       // HTTPS only
  sameSite: "strict",                          // not sent on cross-site requests → CSRF protection
  path: "/api/auth",                           // only sent to auth endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function sendAuth(res: Response, r: Awaited<ReturnType<typeof authService.login>>, status = 200) {
  res.cookie(REFRESH_COOKIE, r.refreshToken, cookieOpts);
  res.status(status).json({ success: true, data: { user: r.user, accessToken: r.accessToken } });
}

export async function register(req: Request, res: Response) {
  sendAuth(res, await authService.register(req.body), 201);
}

export async function login(req: Request<{}, unknown, { email: string; password: string }>, res: Response) {
  sendAuth(res, await authService.login(req.body.email, req.body.password));
}

export async function refresh(req: Request, res: Response) {
  sendAuth(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE]));
}

export async function logout(req: Request, res: Response) {
  if (req.user) await authService.logout(req.user.id);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ success: true, data: req.user });
}
```

## 💻 Server — `requireAuth` and `requireRole` Middleware

```ts
// middleware/auth.ts
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@app/shared";
import { verifyAccess } from "../modules/auth/tokens.js";
import { AppError } from "../utils/AppError.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(AppError.unauthorized("Missing token"));

  try {
    const payload = verifyAccess(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };   // typed via express.d.ts augmentation
    next();
  } catch (err) {
    next(
      err instanceof jwt.TokenExpiredError
        ? new AppError(401, "Token expired", "TOKEN_EXPIRED")    // client knows to refresh
        : AppError.unauthorized("Invalid token"),
    );
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden("Insufficient role"));
    next();
  };

// Ownership check: users can only touch their own resources unless admin
export const requireSelfOrAdmin: RequestHandler<{ id: string }> = (req, _res, next) => {
  if (req.user?.role === "admin" || req.user?.id === req.params.id) return next();
  next(AppError.forbidden());
};
```

```ts
// modules/auth/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { body } from "express-validator";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import * as c from "./auth.controller.js";

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true });

export const authRouter = Router();
authRouter.post("/register", validate([
  body("email").isEmail().normalizeEmail(),
  body("name").trim().isLength({ min: 2 }),
  body("password").isLength({ min: 8 }),
]), c.register);
authRouter.post("/login", loginLimiter, validate([body("email").isEmail(), body("password").notEmpty()]), c.login);
authRouter.post("/refresh", c.refresh);
authRouter.post("/logout", requireAuth, c.logout);
authRouter.get("/me", requireAuth, c.me);
```

## 💻 Client — Auth Slice (Redux Toolkit)

```ts
// features/auth/authSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PublicUser } from "@app/shared";
import type { RootState } from "../../app/store";

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;      // memory only — never localStorage
  status: "unknown" | "authenticated" | "anonymous";
}

const initialState: AuthState = { user: null, accessToken: null, status: "unknown" };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loggedIn(state, action: PayloadAction<{ user: PublicUser; accessToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = "authenticated";
    },
    tokenRefreshed(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    loggedOut() {
      return { ...initialState, status: "anonymous" as const };
    },
  },
});

export const { loggedIn, tokenRefreshed, loggedOut } = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentUser = (s: RootState) => s.auth.user;
export const selectAuthStatus  = (s: RootState) => s.auth.status;
export const selectIsAdmin     = (s: RootState) => s.auth.user?.role === "admin";
```

## 💻 Client — Auth Endpoints with RTK Query

```ts
// features/auth/authApi.ts
import { api } from "../../services/api";       // createApi with baseQueryWithReauth (Redux: RTK Query chapter)
import { loggedIn, loggedOut } from "./authSlice";
import type { PublicUser } from "@app/shared";

type AuthResponse = { success: true; data: { user: PublicUser; accessToken: string } };

export const authApi = api.injectEndpoints({
  endpoints: (b) => ({
    login: b.mutation<AuthResponse["data"], { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (r: AuthResponse) => r.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(loggedIn(data));
      },
    }),
    // Called once on app start: the httpOnly cookie restores the session after a page reload
    restoreSession: b.mutation<AuthResponse["data"], void>({
      query: () => ({ url: "/auth/refresh", method: "POST" }),
      transformResponse: (r: AuthResponse) => r.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try { dispatch(loggedIn((await queryFulfilled).data)); }
        catch { dispatch(loggedOut()); }
      },
    }),
    logout: b.mutation<void, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await queryFulfilled.catch(() => undefined);
        dispatch(loggedOut());
        dispatch(api.util.resetApiState());      // drop every cached response from the old user
      },
    }),
  }),
});

export const { useLoginMutation, useRestoreSessionMutation, useLogoutMutation } = authApi;
```

## 💻 Client — Protected Routes (React Router)

```tsx
// routes/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { selectAuthStatus, selectCurrentUser } from "../features/auth/authSlice";
import type { Role } from "@app/shared";

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const status = useAppSelector(selectAuthStatus);
  const user = useAppSelector(selectCurrentUser);
  const location = useLocation();

  if (status === "unknown") return <p>Checking session…</p>;   // avoid redirect flash on reload
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
```

```tsx
// App.tsx
export default function App() {
  const [restore] = useRestoreSessionMutation();
  useEffect(() => { void restore(); }, [restore]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<TasksPage />} />
      </Route>
      <Route element={<RequireAuth roles={["admin"]} />}>
        <Route path="/admin/users" element={<AdminUsers />} />
      </Route>
    </Routes>
  );
}
```

> Client-side guards are **UX only**. The real protection is `requireAuth` / `requireRole` on the server — anyone can call the API directly.

## 💻 Client — Login Page

```tsx
export function LoginPage() {
  const [login, { isLoading, error }] = useLoginMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await login({ email: String(f.get("email")), password: String(f.get("password")) }).unwrap();
      navigate(from, { replace: true });
    } catch { /* shown below */ }
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="email" type="email" autoComplete="email" required />
      <input name="password" type="password" autoComplete="current-password" required />
      <button disabled={isLoading}>Sign in</button>
      {error && <p role="alert">{errorMessage(error)}</p>}
    </form>
  );
}
```

## 📊 Where to Store Tokens

| Storage | XSS can steal it? | CSRF risk? | Verdict |
|---------|-------------------|-----------|---------|
| `localStorage` | ✅ Yes | No | Avoid for tokens |
| Memory (Redux) | Only while the page is open | No | ✅ Access token |
| httpOnly cookie | ❌ No | Yes → mitigate with `SameSite=strict/lax` + CORS | ✅ Refresh token |

## 🌍 Real-World Impact

- Short access tokens limit the damage of a leaked token to minutes.
- Rotation + `tokenVersion` lets you "log out of all devices" and detect replayed refresh tokens.
- Rate-limited login and identical error messages block brute-force and user-enumeration attacks.

## 🎯 Likely Interview Questions

1. **Walk me through JWT auth in a MERN app.** — Use the flow diagram above.
2. **Why two tokens?** — Short-lived access token limits exposure; refresh token gives long sessions without re-login.
3. **Where do you store JWTs on the client?** — Access token in memory (Redux); refresh token in httpOnly Secure SameSite cookie.
4. **How do you log out a JWT user if JWTs are stateless?** — Short expiry + server-side refresh invalidation (`tokenVersion` / session records / denylist).
5. **What is refresh-token rotation?** — Every refresh issues a new refresh token and invalidates the old one; reuse of an old one signals theft.
6. **How do you keep the user logged in after a page reload?** — Call `/auth/refresh` on app start; the cookie is sent automatically.
7. **How do you implement role-based access?** — `requireRole("admin")` middleware on the server; route guards on the client for UX.
8. **How do you type `jwt.verify`'s result?** — It returns `string | JwtPayload`; use a type guard, not a blind cast.
9. **How do you handle many parallel 401s?** — Share a single refresh promise, then retry the queued requests.

---

[← Mongoose with TypeScript](04-mongoose-typescript.md) | [Index](../README.md) | [Next: React with TypeScript →](06-react-with-typescript.md)
