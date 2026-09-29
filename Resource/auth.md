# How Authentication Works in Vigil

This guide explains the complete login system in Vigil: what happens on the
backend (NestJS), what happens in the browser (Next.js), and why each piece
exists. Read it top to bottom the first time. Afterwards, the flow diagrams in
section 5 are the quickest reference.

---

## Table of contents

1. [The big picture](#1-the-big-picture)
2. [Core concepts](#2-core-concepts)
3. [The two tokens](#3-the-two-tokens-access-and-refresh)
4. [Where the code lives](#4-where-the-code-lives)
5. [Every flow, step by step](#5-every-flow-step-by-step)
6. [The frontend files explained](#6-the-frontend-files-explained)
7. [Security decisions and what they protect against](#7-security-decisions-and-what-they-protect-against)
8. [Known limitations](#8-known-limitations)
9. [Debugging tips](#9-debugging-tips)
10. [Explaining it to someone in one minute](#10-explaining-it-to-someone-in-one-minute)

---

## 1. The big picture

There are four players:

```
 ┌───────────┐      ┌──────────────────────┐      ┌──────────────┐      ┌──────────┐
 │  Browser  │ ───▶ │  Next.js (port 3000) │ ───▶ │ NestJS API   │ ───▶ │ Postgres │
 │           │      │  - proxy.ts          │      │ (port 3001)  │      │          │
 │  cookies  │ ◀─── │  - /api/* rewrite    │ ◀─── │ /v1/auth/*   │ ◀─── │ tables   │
 └───────────┘      └──────────────────────┘      └──────────────┘      └──────────┘
```

- **Browser.** It stores two cookies, `vigil_token` and `vigil_refresh_token`,
  and sends them automatically with every request.
- **Next.js.** It serves the pages and does two auth-related jobs:
  - `proxy.ts` runs **before a page loads** and decides whether to redirect
    you to `/login`.
  - `next.config.ts` forwards every `/api/...` request to the backend. For
    example, `/api/auth/login` goes to `http://localhost:3001/v1/auth/login`.
- **NestJS API.** It checks passwords, creates tokens and protects endpoints.
  It is the **real gatekeeper**.
- **Postgres.** It stores users, hashed passwords, refresh tokens and password
  reset tokens.

> **Why the `/api` rewrite matters for auth:** the browser thinks it is only
> talking to `localhost:3000`, so the backend's cookies are saved for
> `localhost:3000`. That is why `proxy.ts` (running on Next.js) can read them.
> It also means we avoid cross-site cookie problems entirely.

---

## 2. Core concepts

### 2.1 Password hashing (bcrypt)

We **never** store passwords. We store a *hash*, a scrambled version that
cannot be turned back into the password.

```
"Str0ng!Pass"  ──bcrypt──▶  "$2b$10$Xk9...q7W"   (this goes in User.passwordHash)
```

At login, we hash what the user typed and ask bcrypt whether the result matches
the stored hash (`bcrypt.compare`). If the database leaks, attackers get hashes,
not passwords. bcrypt is deliberately slow, which makes guessing expensive.

### 2.2 Cookies, and what `httpOnly` means

A cookie is a small value the server asks the browser to store. The browser
then attaches it to every request to the same site, with no code needed.

We set our cookies with these options (`apps/api/src/auth/utils/auth-cookies.ts`):

| Option | Value | What it means |
|---|---|---|
| `httpOnly` | `true` | JavaScript **cannot read** the cookie (`document.cookie` won't show it). If an attacker injects a script into the page (XSS), they still can't steal the token. |
| `secure` | `true` in production | The cookie is only sent over HTTPS. |
| `sameSite` | `lax` | Other websites can't make your browser send the cookie along with their form posts (CSRF protection). |
| `path` | `/` | Sent for every URL on the site. |
| `maxAge` | 1 hour / 14 days | When the browser deletes the cookie. |

> **Why not localStorage?** Any JavaScript on the page can read
> localStorage, including malicious scripts. httpOnly cookies can't be read by
> JavaScript at all. That's the main reason we use cookies.

### 2.3 JWT (JSON Web Token)

A JWT is a string made of three parts: `header.payload.signature`.

```
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiJ1c2VyLTEyMyIsIm9yZ0lkIjoib3JnLTQ1NiIsInJvbGUiOiJPV05FUiJ9 . k2j3h4...
      header                                  payload (base64)                                signature
```

Decoded, our payload looks like this:

```json
{ "sub": "user-123", "orgId": "org-456", "role": "OWNER", "iat": 1790675342, "exp": 1790678942 }
```

- `sub` is the user id, `orgId` the organization and `role` the permission level.
- `iat` is when the token was issued; `exp` is when it expires (1 hour later).
- The **signature** is created with `JWT_SECRET`, which only the server knows.
  If anyone changes even one character of the payload, the signature no longer
  matches and the server rejects the token.

The big advantage is that the server can check a JWT **without a database
lookup**. It only recalculates the signature, which is fast.

The big disadvantage is that **you can't cancel a JWT** before it expires. The
server doesn't keep a list of JWTs, so a stolen JWT keeps working until `exp`.
This is exactly why we keep access tokens short-lived and add a refresh token.

> The payload is only *encoded*, not *encrypted*. Anyone can decode it (paste
> one into jwt.io). Never put secrets in a JWT.

---

## 3. The two tokens: access and refresh

### 3.1 The analogy

Think of a hotel:

- **Access token = your room key card.** You show it constantly (every API
  request). It expires quickly (1 hour). If someone steals it, they only get a
  short window.
- **Refresh token = your ID at the front desk.** You rarely use it. When your
  key card stops working, you go to the desk, show your ID, and get a new key
  card. The desk keeps a record, so it can refuse you (for example after you
  check out, i.e. log out).

### 3.2 Side-by-side comparison

| | Access token | Refresh token |
|---|---|---|
| Cookie name | `vigil_token` | `vigil_refresh_token` |
| What it looks like | JWT (`eyJ...`) | Random 64-character hex string |
| Lifetime | **1 hour** | **14 days** |
| Sent to | Every API request | Only `POST /auth/refresh` and `/auth/logout` in practice (the browser attaches it everywhere, but only these read it) |
| Checked by | Signature check, no DB lookup (`auth.guard.ts`) | Database lookup (`RefreshToken` table) |
| Can be cancelled? | No, it lives until it expires | **Yes**, delete the DB row |
| Stored in DB? | No | Yes, **only its SHA-256 hash** |

### 3.3 Why have two at all?

We want two things that pull against each other:

1. **Fast checks on every request**, which calls for a JWT with no database lookup.
2. **The ability to log someone out or revoke access**, which calls for a
   database record.

Two tokens give us both. The access token handles the fast path. The refresh
token, checked against the database, is the "can this person still be logged
in?" check, and it happens only about once an hour.

### 3.4 Why the refresh token is hashed in the database

The `RefreshToken` table stores `tokenHash`, not the token. If someone steals
a database backup, they get hashes, which are useless because you can't log in
with a hash. When the browser sends its refresh token, we hash it again and
look up the hash.

This is the same idea as password hashing. We use SHA-256 instead of bcrypt
because the token is already 256 bits of pure randomness and impossible to
guess, so a fast hash is enough.

### 3.5 Refresh token rotation

Every refresh token works **exactly once**. When you use it:

1. The old token is deleted from the database.
2. A brand-new refresh token (and access token) is issued.

Why bother? If an attacker steals a refresh token and uses it, the real user's
next refresh fails. Nobody gets to use a stolen token silently forever.

This rotation is also why the frontend must never send two refreshes at the
same time (see [6.1](#61-libapiaxiosts-the-silent-refresh)).

---

## 4. Where the code lives

### Backend: `apps/api/src/auth/`

| File | Job |
|---|---|
| `auth.controller.ts` | The HTTP endpoints. Reads and writes cookies. |
| `auth.service.ts` | The logic: check passwords, create and rotate tokens, reset passwords. |
| `auth.guard.ts` | `@UseGuards(AuthGuard)` protects an endpoint. Verifies the access token and puts `req.user` on the request. |
| `auth.constants.ts` | Cookie names and lifetimes, all in one place. |
| `auth.module.ts` | Wires up `JwtModule` with `JWT_SECRET` and the 1-hour expiry. |
| `utils/auth-cookies.ts` | `setAuthCookies()` / `clearAuthCookies()`. |
| `utils/tokens.ts` | `generateToken()` (random string) and `hashToken()` (SHA-256). |
| `dto/*.ts` | Request validation: email format, password rules, and so on. |
| `../common/guards/role.guard.ts` | `@Roles('OWNER')` restricts an endpoint by role. Runs after `AuthGuard`. |

### Database tables (`apps/api/prisma/schema.prisma`)

| Table | What's in it |
|---|---|
| `User` | `email`, `passwordHash`, `name`, `timezone` |
| `Membership` | Which user belongs to which organization, with which `role` |
| `RefreshToken` | `tokenHash`, `userId`, `expiresAt`. One row per logged-in device. |
| `PasswordResetToken` | `tokenHash`, `userId`, `expiresAt`. One row per pending reset. |

### Endpoints (all under `/v1/auth`)

| Method | Path | Needs login? | What it does |
|---|---|---|---|
| POST | `/signup` | No | Creates user + organization + OWNER membership |
| POST | `/login` | No | Checks password, sets both cookies |
| GET | `/me` | **Yes** (access token) | Returns the current user, org and role |
| POST | `/refresh` | Refresh cookie | Swaps the refresh token for new tokens |
| POST | `/logout` | No* | Deletes the refresh token, clears cookies |
| POST | `/forgot-password` | No | Emails a reset link |
| POST | `/reset-password` | No | Sets a new password using the emailed token |

\* Logout deliberately doesn't require a valid access token. Someone whose
access token already expired must still be able to log out.

### Frontend: `apps/web/`

| File | Job |
|---|---|
| `proxy.ts` | Runs on the server **before a page renders**. Redirects based on which cookies exist. (Next.js 16 renamed `middleware.ts` to `proxy.ts`.) |
| `next.config.ts` | Rewrites `/api/*` to the backend. |
| `lib/api/axios.ts` | The shared HTTP client. Handles the **silent refresh**. |
| `lib/api/auth.ts` | One small function per auth endpoint. |
| `context/auth-context.tsx` | `useAuth()` gives any component the current `session`, plus `logout()`. |
| `app/(auth)/*` | Login, signup, forgot-password and reset-password pages. |
| `lib/validation/password.ts` | Password rules, kept identical to the backend. |

---

## 5. Every flow, step by step

### 5.1 Signup

```
Browser                         NestJS                              Postgres
   │  POST /auth/signup            │                                    │
   │  {name,email,password,org}    │                                    │
   │ ────────────────────────────▶ │ validate DTO (strong password…)    │
   │                               │ email already used? ─────────────▶ │
   │                               │ org slug already used? ──────────▶ │
   │                               │ bcrypt.hash(password)              │
   │                               │ in ONE transaction: ─────────────▶ │ User
   │                               │   create user, org, membership     │ Organization
   │                               │                                    │ Membership(OWNER)
   │ ◀──────────── 201 {user,org}  │                                    │
   │  redirect to /login           │                                    │
```

- A **transaction** means all three rows are created or none are. You never
  end up with a user who has no organization.
- Signup doesn't log you in. The user is sent to `/login`.

### 5.2 Login

```
Browser                         NestJS                              Postgres
   │  POST /auth/login             │                                    │
   │  {email,password}             │                                    │
   │ ────────────────────────────▶ │ find user by email ──────────────▶ │
   │                               │ bcrypt.compare(password, hash)     │
   │                               │ pick first membership (org + role) │
   │                               │ accessToken  = JWT {sub,orgId,role}│
   │                               │ refreshToken = random string       │
   │                               │ save hash(refreshToken) ─────────▶ │ RefreshToken
   │ ◀──────────── 200 {user,…}    │                                    │
   │   Set-Cookie: vigil_token=eyJ…          (1 hour, httpOnly)         │
   │   Set-Cookie: vigil_refresh_token=9f3a… (14 days, httpOnly)        │
```

Details worth knowing:

- Wrong email and wrong password both return the **same message**, "Invalid
  email or password", so attackers can't discover which emails have accounts.
- If the email doesn't exist, we still run `bcrypt.hash` once. That makes the
  response take the same time as a real password check (a *timing attack*
  defence).
- Emails are lowercased and trimmed, so `John@X.com ` and `john@x.com` are the
  same account.
- The tokens go into cookies, **not** the response body. The frontend never
  sees or handles the tokens itself.

### 5.3 Calling a protected endpoint

```
Browser                         NestJS AuthGuard
   │  GET /api/auth/me             │
   │  Cookie: vigil_token=eyJ…     │  (browser attaches it automatically)
   │ ────────────────────────────▶ │ read token from cookie (or "Authorization: Bearer …")
   │                               │ jwt.verify(token, JWT_SECRET)
   │                               │   ✔ valid   → req.user = {userId, organizationId, role}
   │                               │   ✘ invalid/expired → 401
   │ ◀──────────── 200 / 401       │
```

To protect any new endpoint:

```ts
@Get('something')
@UseGuards(AuthGuard)                 // must be logged in
someHandler(@Req() req: Request & { user: CurrentUserPayload }) {
  req.user.userId; req.user.organizationId; req.user.role;
}
```

To also restrict by role:

```ts
@UseGuards(AuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
```

Note: another module that uses `AuthGuard` must import `AuthModule`, because
`AuthModule` exports the `JwtModule` the guard needs.

### 5.4 Opening a page (proxy.ts)

Before Next.js renders any page, `proxy.ts` looks at the cookies:

```
                   ┌─────────────────────────────┐
  request /xyz ──▶ │ Is /xyz public?             │
                   │ (/, /login, /signup,        │
                   │  /forgot-password,          │
                   │  /reset-password, …)        │
                   └──────────────┬──────────────┘
                     no           │            yes
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
 Has vigil_token OR                              Is it /login, /signup or
 vigil_refresh_token?                            /forgot-password AND
   no  → redirect /login                         has vigil_token?
   yes → show page                                 yes → redirect /
                                                   no  → show page
```

Important: **the proxy only checks whether a cookie exists, not whether it's
valid.** It can't verify the JWT (it doesn't have `JWT_SECRET`), and it doesn't
need to. It only avoids flashing a page at someone who is obviously logged out.
The backend checks everything properly on every API call.

Why does a refresh cookie alone let you in? Because after 1 hour the access
cookie disappears, but the user is still logged in (the refresh token is valid
for 14 days). We let the page load; its first API call gets a 401, and axios
refreshes silently (next section).

Why does only the access cookie count for "logged-in users can't see /login"?
A leftover refresh cookie might be expired or revoked. If it counted, a
logged-out person could be bounced away from `/login` and never be able to log
in.

### 5.5 The silent refresh (access token expired)

This is the part that runs in `lib/api/axios.ts`. The user notices nothing.

```
Browser (axios)                               NestJS                         Postgres
   │ GET /api/auth/me  (access cookie expired) │                                │
   │ ────────────────────────────────────────▶ │ AuthGuard: no valid token      │
   │ ◀──────────────────────────────── 401     │                                │
   │                                           │                                │
   │ interceptor: "401? try a refresh once"    │                                │
   │ POST /api/auth/refresh                    │                                │
   │ Cookie: vigil_refresh_token=9f3a…         │                                │
   │ ────────────────────────────────────────▶ │ hash it, find row ───────────▶ │
   │                                           │ expired? missing? → 401        │
   │                                           │ delete old row ──────────────▶ │  (rotation)
   │                                           │ look up membership again ────▶ │  (fresh role)
   │                                           │ issue new access + refresh ──▶ │  new row
   │ ◀────── 200 + Set-Cookie (both new)       │                                │
   │                                           │                                │
   │ replay: GET /api/auth/me (new cookie)     │                                │
   │ ────────────────────────────────────────▶ │ ✔                              │
   │ ◀──────────────────────────────── 200     │                                │
```

You can see this exact sequence in the browser's Network tab:
`me 401 → refresh 200 → me 200`.

Bonus: because refresh looks up the membership again, if an admin changes your
role, the change takes effect within the hour (at your next refresh).

### 5.6 When the refresh also fails

If the refresh token is expired, revoked (after logout or a password reset) or
missing:

1. `/auth/refresh` returns 401 **and clears both cookies** (the controller's
   `catch` block).
2. Axios gives up and looks at the **original** request:
   - If it was `/auth/me` (the "am I logged in?" check that runs on every
     page), **no redirect**. The user is simply shown as logged out. This is
     why the home page `/` works for visitors.
   - If it was a real data request on a protected page, **redirect to
     `/login`**.

### 5.7 Logout

```
Browser                         NestJS                              Postgres
   │ POST /auth/logout             │                                    │
   │ Cookie: vigil_refresh_token   │ delete RefreshToken row ─────────▶ │
   │ ◀──── 200 + clear both cookies│                                    │
   │ react-query cache cleared, router → /login                         │
```

After logout, even if someone copied the refresh token earlier, it no longer
works because its row is gone. A copied access token would still work until it
expires (at most 1 hour). That's the trade-off of JWTs, and it's why they're
short-lived.

### 5.8 Forgot password

```
Browser                         NestJS                          Postgres       Email (Resend)
   │ POST /auth/forgot-password    │                                │                │
   │ {email}                       │ find user ───────────────────▶ │                │
   │                               │ not found → return generic message              │
   │                               │ found:                         │                │
   │                               │  token = random string         │                │
   │                               │  delete old reset tokens ────▶ │                │
   │                               │  save hash(token), +5 min ───▶ │ PasswordReset… │
   │                               │  email link ───────────────────────────────────▶ │
   │                               │   FRONTEND_URL/reset-password?token=…           │
   │ ◀── 200 "If an account exists with this email, a link has been sent."           │
```

- **The response is identical whether or not the email exists.** Otherwise
  anyone could type emails in and find out who has an account.
- The page therefore says "*If* an account exists…". It can't promise an email
  was sent.
- Only the newest link works (older reset tokens are deleted).
- The link expires after **5 minutes**.

### 5.9 Reset password

```
Browser                              NestJS                              Postgres
   │ opens email link                  │                                    │
   │ /reset-password?token=abc…        │                                    │
   │ enters new password (twice)       │                                    │
   │ POST /auth/reset-password         │                                    │
   │ {token, password}                 │ hash(token), find row ───────────▶ │
   │ ─────────────────────────────────▶│ missing/expired → 400 (and delete) │
   │                                   │ in ONE transaction: ─────────────▶ │
   │                                   │   update passwordHash              │
   │                                   │   delete this reset token          │ (single use)
   │                                   │   delete ALL user's RefreshTokens  │ (logout everywhere)
   │                                   │ send "password changed" email      │
   │ ◀──────────── 200                 │                                    │
   │ redirect to /login                │                                    │
```

- **Logging out every device** matters. If someone else knew your old
  password and was logged in, they get kicked out at their next refresh.
- If the confirmation email fails to send, the reset still succeeds. The error
  is logged, and the user isn't told "failed" for something that worked.
- On the frontend, an expired or used link shows "This link has expired" with a
  button to request a new one.

---

## 6. The frontend files explained

### 6.1 `lib/api/axios.ts`: the silent refresh

```ts
const api = axios.create({ baseURL: "/api", withCredentials: true });
```

Every request goes to `/api/...`, which Next.js forwards to the backend.
`withCredentials: true` makes the browser include cookies.

```ts
const NO_REFRESH_URLS = ["/auth/login", "/auth/signup", "/auth/refresh", ...];
```

A 401 from these means "wrong password" or "bad link", **not** "your access
token expired". Refreshing would be pointless. Refreshing when `/auth/refresh`
itself fails would loop forever.

```ts
let refreshPromise: Promise<unknown> | null = null;

function refreshSession() {
  refreshPromise ??= api.post("/auth/refresh").finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
```

This is the **single-flight** trick. Imagine the dashboard loads 5 things at
once and all 5 get a 401. Without this, we'd send 5 refresh requests. Because
of rotation, the first would succeed and the other 4 would use an
already-deleted token, fail, and log the user out.

With it:

- The first 401 starts the refresh and stores the promise.
- The other 4 see `refreshPromise` is already set and **wait on the same one**
  (`??=` means "assign only if currently null").
- When it finishes, `finally` resets it to `null` for next time.

```ts
if (is401 && config && !config._retried && !NO_REFRESH_URLS.includes(config.url ?? "")) {
  config._retried = true;
  try {
    await refreshSession();
    return api(config);          // replay the original request
  } catch {}
}
```

- `_retried` is a flag we attach to the request. Each request gets **one**
  retry. If it fails again after a successful refresh, we don't loop.
- `return api(config)` sends the original request again, now with the new
  cookie. The code that made the request just gets the successful response and
  never knows anything happened.

```ts
const onAuthPage = AUTH_PAGES.includes(window.location.pathname);
const isMeCall = config?.url === "/auth/me";
const isRefreshCall = config?.url === "/auth/refresh";

if (is401 && !onAuthPage && !isMeCall && !isRefreshCall) {
  window.location.href = "/login";
}
```

We reach this point only when the refresh didn't save us. We send the user to
login **except** when:

- They're already on an auth page (a 401 there means "wrong password").
- It's the `/auth/me` check (a logged-out visitor on the home page is normal).
- It's the refresh call itself. Its failure is handled by the *original*
  request's pass through this code, which decides whether to redirect. Without
  this rule, a logged-out visitor on `/` got bounced to `/login` (that was a
  real bug we fixed).

`window.location.href` (a full page load) rather than `router.push` is
intentional. It wipes all in-memory state from the old session.

### 6.2 `proxy.ts`: the gate before pages load

Covered in [5.4](#54-opening-a-page-proxyts). In short:

- `PUBLIC_ROUTES`: pages anyone can see.
- `AUTH_ROUTES`: pages only for logged-out people (a logged-in user is sent
  to `/`). `/reset-password` is deliberately **not** in this list, so a
  logged-in user can still open a reset link from their email.
- `matcher`: the proxy skips `/api`, static files and images. It only runs
  for page navigations.

### 6.3 `context/auth-context.tsx`: who is logged in?

```ts
const { data, isLoading } = useQuery({
  queryKey: ["me"],
  queryFn: async () => (await getMeApi()).data,
  retry: false,
  staleTime: Infinity,
});
```

- Calls `/auth/me` once when the app loads and caches the result under the
  key `["me"]`.
- `retry: false` stops react-query from retrying a 401 three times (axios
  already handles the refresh).
- `staleTime: Infinity` fetches once and reuses the result until someone
  says otherwise.

Components use it like this:

```tsx
const { session, loading, logout } = useAuth();
if (loading) return <Skeleton />;
if (!session) return <LoginButton />;
return <p>Hi {session.user.name}</p>;
```

- `refresh()` re-fetches `/auth/me`, for example after login or a profile edit.
- `logout()` calls the API, clears **all** cached data (so the next user on
  this computer can't see the previous user's data), and goes to `/login`.

### 6.4 Why the password rules exist twice

`lib/validation/password.ts` (frontend, zod) mirrors
`apps/api/src/auth/dto/password-rules.ts` (backend, class-validator):

- **The frontend copy is for convenience.** Users see errors while typing.
- **The backend copy is for security.** Anyone can skip the frontend and call
  the API directly with curl.

**Never trust the frontend alone.** If you change the rules, change both.

---

## 7. Security decisions and what they protect against

| Decision | Attack it stops |
|---|---|
| bcrypt password hashes | Leaked database, where attackers would otherwise read passwords |
| httpOnly cookies (not localStorage) | XSS, where injected scripts would otherwise steal tokens |
| `sameSite: lax` | CSRF, where other sites would otherwise make your browser act for you |
| `secure` in production | Tokens sniffed on insecure networks |
| 1-hour access token | Limits how long a stolen access token works |
| Refresh token stored as a hash | Leaked database, where attackers would otherwise log in as anyone |
| Refresh token rotation | A stolen refresh token being used silently for a long time |
| Same login error for wrong email and wrong password | Finding out which emails have accounts |
| Dummy bcrypt when the email doesn't exist | The same, via response timing |
| Same forgot-password response for every email | The same, via the reset form |
| Reset token: random, hashed, 5 minutes, single use | Guessing or reusing reset links |
| Reset logs out all devices | An attacker who knew the old password staying logged in |
| Empty or missing refresh cookie rejected before the DB query | A real bug we had: an empty cookie logged you in as a random user |
| HTML-escaping names in emails | A user named `<a href=evil>` injecting links into emails |
| DTO validation + `whitelist: true` | Malformed input and unexpected extra fields |

---

## 8. Known limitations

Honest notes for the future:

1. **Two tabs refreshing at the exact same moment.** The single-flight trick
   works within one tab. Two tabs whose access tokens expire together could
   both refresh. One wins, and the other tab gets logged out. This is rare,
   and the user just logs in again. A common fix is a short "grace period"
   where the previous refresh token still works for a few seconds.
2. **Access tokens can't be revoked.** After logout or a password reset, an
   already-issued access token keeps working until it expires (at most 1
   hour).
3. **No rate limiting yet.** Someone could try many passwords quickly. Adding
   `@nestjs/throttler` to `/login` and `/forgot-password` is the next
   improvement.
4. **Multiple organizations.** Login and refresh always pick the user's
   *oldest* membership. An "organization switcher" would need the chosen org
   stored with the refresh token.

---

## 9. Debugging tips

**See the cookies:** DevTools → Application (Chrome) or Storage (Firefox) →
Cookies → `http://localhost:3000`. You should see `vigil_token` and
`vigil_refresh_token`, both marked HttpOnly.

**Simulate an expired access token:** delete only `vigil_token` there, then
reload the dashboard. In the Network tab (filter: `auth`) you should see:

```
GET  /api/auth/me       401
POST /api/auth/refresh  200
GET  /api/auth/me       200
```

**Decode an access token:** copy the `vigil_token` value into
[jwt.io](https://jwt.io) to see `sub`, `orgId`, `role` and `exp`.

**Look at sessions in the database:**

```sql
SELECT "userId", "expiresAt", "createdAt" FROM "RefreshToken" ORDER BY "createdAt" DESC;
```

There's one row per logged-in device or browser. Logout deletes the row, and a
password reset deletes all of that user's rows.

**Common problems:**

| Symptom | Likely cause |
|---|---|
| Reset email link opens nothing / wrong site | `FRONTEND_URL` in `apps/api/.env` is wrong |
| API crashes at startup mentioning `JWT_SECRET` or `FRONTEND_URL` | That variable is missing or empty in `.env` (this is on purpose) |
| Logged out every hour | The refresh call is failing. Check the Network tab for `/auth/refresh`. |
| Always redirected to `/login` | No cookies. Check that requests go through `/api/...`, not straight to port 3001. |
| Signup fails with a password error | The password doesn't meet the rules (8+ characters, upper, lower, number, symbol) |

---

## 10. Explaining it to someone in one minute

> "When you log in, the server checks your password against a bcrypt hash and
> gives your browser two cookies that JavaScript can't read.
>
> The **access token** is a signed JWT that lasts one hour. It's sent with
> every request, and the server verifies the signature without touching the
> database, so it's fast.
>
> The **refresh token** is a random string that lasts 14 days. We store only
> its hash in the database. When the access token expires, the frontend
> quietly trades the refresh token for a fresh pair, and the old refresh token
> is destroyed, so each one works once.
>
> Logging out, or resetting your password, deletes the refresh token from the
> database, so that session can't be renewed.
>
> On the frontend, `proxy.ts` redirects obviously logged-out people before a
> page loads, and the axios interceptor handles the silent refresh. It makes
> sure only one refresh happens at a time and replays the request that failed.
> The backend is always the real gatekeeper."
