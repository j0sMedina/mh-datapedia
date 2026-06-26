# MH Datapedia — Web Security Audit Plan

**Date written:** 2026-06-26
**Scope:** Web frontend (`apps/web`) + REST API (`apps/api`) running on Fly.io
**Goal:** Find every exploitable weakness before a real attacker does. For each attack: document what was tried, what the server returned, and why it succeeded or failed.
**Output:** A companion report file filled in during the session (one section per attack).

---

## How to run this audit

1. Open the live app in a browser while logged in as a normal USER account.
2. Also keep a second browser tab / curl session open as an unauthenticated visitor.
3. For each section below, execute the attack, capture the raw response, and write the result in the companion report.
4. Mark each test ✅ HELD, ⚠️ PARTIAL, or ❌ BROKEN.

---

## Section 1 — Authentication

### 1.1 Brute-force login (rate limiter)

**What we're testing:** `authLimiter` allows 10 POST /api/auth/login attempts per 15 minutes per IP.

**Attack:**
```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"victim@example.com","password":"wrong'$i'"}'
done
```

**What to record:** At which request number does the API return 429? Does it return 429 at all? Does the error body include `RATE_LIMITED`?

**Why it matters:** Without a rate limit, an attacker can try hundreds of passwords per minute. The limit is set to 10/15min — confirm it actually enforces.

**Known risk:** The rate limiter is in-memory (`express-rate-limit` default store). If the API has more than one Fly.io instance or restarts, the counter resets. Check `fly status` to see instance count.

---

### 1.2 Token replay after logout

**What we're testing:** After a user logs out, their access token should no longer work.

**Attack:**
1. Log in — save the `accessToken` from the response body.
2. Call POST /api/auth/logout.
3. Immediately use the saved token on GET /api/auth/me.

**What to record:** Does /api/auth/me return 200 or 401 after logout?

**Why it matters:** Access tokens are JWTs — they are stateless and valid until expiry (15 min). The server cannot invalidate them without a denylist. Refresh tokens are revoked on logout (deleted from DB), but the short-lived access token stays valid. A 200 here is expected (by design), but it must be documented so the team is aware of the 15-minute window.

---

### 1.3 Refresh token reuse after rotation

**What we're testing:** After a token refresh, the old refresh token must be invalid.

**Attack:**
1. Log in — the `refresh_token` cookie is set.
2. Call POST /api/auth/refresh — a new cookie arrives.
3. Manually replay the **old** refresh token cookie: `curl -b "refresh_token=<old>" /api/auth/refresh`.

**What to record:** Does the server accept the old refresh token a second time?

**Why it matters:** If refresh tokens are not rotated (or old ones not deleted), an attacker who steals a refresh token can use it indefinitely.

---

### 1.4 JWT algorithm confusion (alg:none)

**What we're testing:** The API must reject tokens signed with `alg: none` or an unexpected algorithm.

**Attack:**
1. Take any valid JWT, decode the header, change `"alg"` to `"none"`, strip the signature, re-encode.
2. Send it as `Authorization: Bearer <forged-token>`.

```bash
# Craft a none-algorithm token (python):
import base64, json
header = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b'=').decode()
payload = base64.urlsafe_b64encode(json.dumps({"sub":"<real-user-id>","role":"MASTER"}).encode()).rstrip(b'=').decode()
token = f"{header}.{payload}."
```

**What to record:** Does the API return 401 or does it accept the forged token?

**Why it matters:** Some JWT libraries defaulted to accepting `alg:none` in older versions. The `jsonwebtoken` npm package rejects it by default — but confirming is non-negotiable for a MASTER-role application.

---

### 1.5 CSRF on cookie-based refresh

**What we're testing:** POST /api/auth/refresh uses only the `refresh_token` httpOnly cookie — no CSRF token. `SameSite=strict` is the defense.

**Attack:**
1. Log in on the real domain.
2. From a **different origin** (attacker page), submit a form POST to `https://<host>/api/auth/refresh`.
3. Check whether the cookie is sent and whether the server issues a new access token.

**What to record:** Does `SameSite=strict` block the cross-origin cookie? Capture the browser's Network tab.

**Why it matters:** `SameSite=strict` prevents the cookie from being sent on cross-site requests. If the browser sends it anyway (older browser or misconfigured), the server would issue tokens to a third-party attacker page.

---

## Section 2 — Authorization & Role Escalation

### 2.1 Self-promotion via the role endpoint

**What we're testing:** Can a regular USER send PATCH /api/admin/users/{own-id}/role to promote themselves?

**Attack:**
1. Log in as a plain USER — get your own `id` from GET /api/auth/me.
2. Send: `PATCH /api/admin/users/{own-id}/role` with `{"role":"ADMIN"}`.

**What to record:** HTTP status and body. Expected: 403 FORBIDDEN (authorize('ADMIN') blocks it).

**Why it matters:** If the authorization middleware is missing or ordered wrong, a user could escalate their own role.

---

### 2.2 IDOR — promote a stranger's account

**What we're testing:** A logged-in ADMIN can send a role change to any user ID, including one they don't manage. Can they target a MASTER?

**Attack:**
1. Log in as an ADMIN.
2. Find the MASTER account's UUID (from the user list endpoint).
3. Send: `PATCH /api/admin/users/{master-id}/role` with `{"role":"USER"}`.

**What to record:** HTTP status. Expected: 403 — `setRole` checks `ADMIN_MANAGEABLE_ROLES` does not include MASTER.

**Why it matters:** The route accepts any UUID in the path. The service must enforce the role boundary. If the check is missing or the roles list is wrong, an ADMIN could demote the MASTER.

---

### 2.3 HELPER reads full user list (email exposure)

**What we're testing:** `GET /api/admin/users` requires only HELPER role. HELPERs can see every user's email, role, and ban status.

**Attack:**
1. Log in as a HELPER account.
2. Call GET /api/admin/users — list all users.

**What to record:** What fields are returned? Does it include email addresses? How many users are listed?

**Why it matters:** This is intentional by design, but it must be documented. If a HELPER account is compromised, the attacker gets the full user directory including emails. Evaluate whether HELPERs need emails or only usernames.

---

### 2.4 Banned user with live access token

**What we're testing:** When a user is banned, their refresh tokens are deleted (`deleteMany`). But existing access tokens remain valid until expiry (15 min).

**Attack:**
1. Log in as User A — save the access token.
2. As ADMIN, ban User A immediately.
3. Within 15 minutes, use User A's saved access token to call GET /api/monsters (or any authenticated endpoint).

**What to record:** Does the request succeed (200) or fail (401/403)?

**Why it matters:** By design, the access token is not invalidated. This is the known 15-minute window. Document it explicitly — if the team decides this is unacceptable, a token denylist (Redis) would be the fix.

---

### 2.5 Role in JWT vs. role in DB (stale token attack)

**What we're testing:** Authorization in the API uses `req.user.role` from the JWT payload, not the live DB value. If a user's role is downgraded, their existing access token still says the old (higher) role.

**Attack:**
1. Log in as an ADMIN — save the access token (15-min window).
2. As MASTER, demote that user to USER via the API.
3. Within 15 minutes, use the saved ADMIN-level token to call PATCH /api/admin/users/{id}/role.

**What to record:** Does the API honor the (now-stale) ADMIN claim in the JWT?

**Why it matters:** Same 15-minute window as 2.4. JWT role and DB role can diverge for up to 15 minutes. Document clearly.

---

## Section 3 — Input Validation & Injection

### 3.1 SQL injection via search parameter

**What we're testing:** `GET /api/admin/users?search=` passes the value to Prisma `contains`. Prisma uses parameterized queries — raw SQL injection should be impossible.

**Attack:**
```bash
curl "https://<host>/api/admin/users?search='; DROP TABLE \"User\"; --" \
  -H "Authorization: Bearer <admin-token>"
```

**What to record:** HTTP status and body. Expected: 200 with normal (empty) results — Prisma treats the whole string as a literal search value.

**Why it matters:** Even though Prisma parameterizes, confirming it with a live test closes the gap between "should be safe" and "is safe."

---

### 3.2 ReDoS via search parameter

**What we're testing:** Certain regex patterns can cause catastrophic backtracking. The search uses `mode: insensitive` (case-insensitive DB-level LIKE) — not a JS regex — so ReDoS is a DB concern, not a Node concern.

**Attack:**
```bash
curl "https://<host>/api/admin/users?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab" \
  -H "Authorization: Bearer <admin-token>"
```

**What to record:** Response time. Compare to a normal search. Long delay = potential concern.

---

### 3.3 Mass assignment on registration

**What we're testing:** Can a user register with `"role": "MASTER"` in the body and have it accepted?

**Attack:**
```bash
curl -X POST https://<host>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","username":"attacker","password":"password123","role":"MASTER"}'
```

**What to record:** Does the created user have role MASTER, or USER (the default)?

**Why it matters:** `RegisterSchema` (from `@mh-datapedia/shared`) must not include a `role` field. Zod's `.strip()` behavior removes unknown keys — but confirm it actually does.

---

### 3.4 XSS via username field

**What we're testing:** If a malicious username is stored and then rendered in the web frontend without escaping, it could execute JavaScript.

**Attack:**
1. Register with username: `<img src=x onerror=alert(1)>`.
2. Log in and navigate to any page that renders usernames.
3. Also check the admin panel — it displays usernames from the user list.

**What to record:** Does the browser execute the payload, or does it render as plain text? Check browser console.

**Why it matters:** React escapes JSX text by default, but if any component uses `dangerouslySetInnerHTML` or `innerHTML`, it could execute. This confirms React's built-in XSS protection is actually in use.

---

## Section 4 — HTTP Security Headers & Configuration

### 4.1 Security headers inspection

**What we're testing:** `helmet()` sets a default set of headers. Confirm all critical ones are present and correctly configured.

**Attack:**
```bash
curl -I https://<host>/api/health
```

**Headers to verify:**
| Header | Expected value |
|--------|---------------|
| `Strict-Transport-Security` | `max-age=...` present |
| `X-Frame-Options` | `SAMEORIGIN` or `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Content-Security-Policy` | Any value present |
| `X-Powered-By` | Must be **absent** (helmet removes it) |
| `Server` | Ideally absent or generic |

**What to record:** Raw header output. Mark each row above as present/absent/correct.

---

### 4.2 CORS origin check

**What we're testing:** The API sets `cors({ origin: env.CORS_ORIGIN, credentials: true })`. Requests from other origins must be rejected.

**Attack:**
```bash
curl -H "Origin: https://evil.com" -I https://<host>/api/health
```

**What to record:** Is `Access-Control-Allow-Origin: https://evil.com` in the response? It must not be.

**Why it matters:** If CORS is misconfigured (e.g., `origin: '*'` with `credentials: true`, which browsers block anyway), it could allow cross-origin credential requests.

---

### 4.3 Swagger UI exposed without auth

**What we're testing:** `GET /api/docs` serves full API documentation to anyone — no authentication required.

**Attack:** Open `https://<host>/api/docs` in a private/incognito browser with no cookies.

**What to record:** Is the Swagger UI visible? Can an unauthenticated user read all endpoint schemas, request bodies, and response shapes?

**Why it matters:** Not a critical vulnerability (the schema is already public knowledge from the source code), but it makes an attacker's job easier. Worth deciding: should `/api/docs` be removed in production or protected behind auth?

---

## Section 5 — Business Logic

### 5.1 Ban self

**What we're testing:** `setBanned` checks `id === requesterId` — an admin cannot ban themselves.

**Attack:** As ADMIN, send `PATCH /api/admin/users/{own-id}/ban` with `{"banned":true,"reason":"testing self-ban","bannedUntil":null}`.

**What to record:** HTTP status. Expected: 400 SELF_ACTION.

---

### 5.2 Set role to MASTER via API

**What we're testing:** `SetRoleSchema` uses `z.enum(['USER','HELPER','ADMIN'])` — MASTER is excluded.

**Attack:** As MASTER, send `PATCH /api/admin/users/{target-id}/role` with `{"role":"MASTER"}`.

**What to record:** HTTP status. Expected: 400 validation error from Zod.

---

### 5.3 Pagination boundary on audit log

**What we're testing:** `GET /api/admin/audit?limit=999999` — the service clamps limit to 50.

**Attack:**
```bash
curl "https://<host>/api/admin/audit?limit=999999&page=0" \
  -H "Authorization: Bearer <admin-token>"
```

**What to record:** What limit is actually used in the response `meta`? Expected: 50. Page 0 should resolve to page 1.

---

### 5.4 Role check ordering in setBanned

**Observation (code review finding, not a test):** `setBanned` checks `id === requesterId` (self-ban) AFTER checking the target exists and the role boundary. This means:
- If an ADMIN tries to ban themselves, the DB is queried first (minor extra cost).
- No security impact — the self-ban error is still thrown before any write.

Document as code quality note, not a vulnerability.

---

## Section 6 — Rate Limiter Bypass

### 6.1 X-Forwarded-For spoofing

**What we're testing:** `express-rate-limit` uses the client IP by default. On Fly.io behind a proxy, it may use `X-Forwarded-For`. If it trusts that header from the client, an attacker can rotate IPs and bypass the limit.

**Attack:**
```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/api/auth/login \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 1.2.3.$i" \
    -d '{"email":"victim@example.com","password":"wrong"}'
done
```

**What to record:** Does each spoofed IP get its own rate limit counter, allowing unlimited attempts in total?

**Why it matters:** Fly.io sets `X-Forwarded-For` but `express-rate-limit`'s trust behavior depends on Express's `trust proxy` setting. If `app.set('trust proxy', 1)` is not configured correctly, the limiter may trust client-supplied IPs.

---

## Report template (fill in during execution)

Copy this block for each test above:

```
### [Section X.Y — Test name]

**Status:** ✅ HELD / ⚠️ PARTIAL / ❌ BROKEN

**What was tried:**
(exact curl command or browser steps)

**Server response:**
(exact HTTP status + body)

**Why it held / why it broke:**
(explanation in plain language)

**Recommended fix (if broken):**
```

---

## Known accepted risks (document before starting)

These are not bugs — they are intentional design trade-offs. Record them so they are not re-flagged:

| Risk | Why it exists | Mitigation |
|------|---------------|------------|
| Access token valid 15 min after ban/demotion | JWTs are stateless; invalidating requires a denylist | Short expiry (15 min) limits the window |
| HELPER can read all user emails | HELPERs need the user list to moderate | Evaluate if email should be excluded from HELPER view |
| Swagger UI public | Developer convenience | Remove in production or add auth gate |
| Rate limiter in-memory | No Redis dependency | Acceptable for single-instance deploy; re-evaluate at scale |
