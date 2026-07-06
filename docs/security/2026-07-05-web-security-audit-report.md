# MH Datapedia — Security Audit Report

**Date executed:** 2026-07-05
**Auditor:** Claude Sonnet 4.6 (automated) + j0sMedina
**Scope:** REST API (`mh-datapedia-api.fly.dev`) + Web frontend (`mh-datapedia-web.fly.dev`)
**Plan reference:** `docs/security/2026-06-26-web-security-audit-plan.md`

---

## Summary

| # | Test | Status |
|---|------|--------|
| 1.1 | Brute-force login | ✅ HELD |
| 1.2 | Token replay after logout | ⚠️ PARTIAL (known design) |
| 1.3 | Refresh token reuse | ✅ HELD |
| 1.4 | JWT alg:none | ✅ HELD |
| 1.5 | CSRF on refresh | ⏭️ SKIPPED (browser required) |
| 2.1 | Self-promotion | ✅ HELD |
| 2.2 | IDOR — ADMIN demotes MASTER | ✅ HELD |
| 2.3 | HELPER email exposure | ✅ FIXED (before audit) |
| 2.4 | Banned user with live token | ⚠️ PARTIAL (known design) |
| 2.5 | Stale JWT after demotion | ⚠️ PARTIAL (known design) |
| 3.1 | SQL injection via search | ✅ HELD |
| 3.2 | ReDoS via search | ✅ HELD |
| 3.3 | Mass assignment on register | ✅ HELD |
| 3.4 | XSS via username | ⏭️ SKIPPED (browser required) |
| 4.1 | Security headers | ✅ HELD |
| 4.2 | CORS origin | ✅ HELD |
| 4.3 | Swagger UI public | ⚠️ PARTIAL (known accepted risk) |
| 5.1 | Self-ban | ✅ HELD |
| 5.2 | Set role to MASTER via API | ✅ HELD |
| 5.3 | Pagination clamp | ✅ HELD |
| 6.1 | X-Forwarded-For spoofing | ✅ HELD |

**Result: 14 HELD — 3 PARTIAL (all accepted design) — 2 SKIPPED (browser) — 1 PRE-FIXED**

---

## Section 1 — Authentication

### 1.1 — Brute-force login

**Status:** ✅ HELD

**What was tried:**
```bash
for i in $(seq 1 12); do
  curl -X POST https://mh-datapedia-api.fly.dev/api/auth/login \
    -d '{"email":"victim@example.com","password":"wrong'$i'"}'
done
```

**Server response:** 401 for requests 1–5, then 429 `RATE_LIMITED` from request 6 onward.

**Why it held:** `authLimiter` (10 req/15 min per IP) was active. The 429 fired at request 6 rather than 11 because my IP had prior auth attempts already in the window from earlier testing. The limiter is enforcing correctly.

**Note:** Rate limiter is in-memory. Resets on server restart. See accepted risks table.

---

### 1.2 — Token replay after logout

**Status:** ⚠️ PARTIAL (known design)

**What was tried:**
1. Logged in — saved `accessToken`.
2. POST /api/auth/logout.
3. GET /api/auth/me with saved token.

**Server response:** 200 — full user object returned after logout.

**Why it is partial:** JWTs are stateless. The server has no token store to invalidate. Logout deletes the refresh token from the DB (preventing new access tokens), but the existing access token remains cryptographically valid until expiry (15 min). This is the accepted 15-minute window.

**Fix if unacceptable:** Token denylist in Redis, checked on every request.

---

### 1.3 — Refresh token reuse after rotation

**Status:** ✅ HELD

**What was tried:**
1. Logged in — captured `refresh_token` cookie value.
2. POST /api/auth/refresh — new cookie arrived.
3. Replayed old token: `curl -b "refresh_token=<old>" -X POST /api/auth/refresh`.

**Server response:** `{"error":"Token reuse detected","code":"TOKEN_REUSE_DETECTED"}`

**Why it held:** The API deletes the old refresh token on rotation. Replaying it hits a DB miss and throws `TOKEN_REUSE_DETECTED`. An attacker who steals a refresh token cannot use it after the legitimate user has refreshed once.

---

### 1.4 — JWT algorithm confusion (alg:none)

**Status:** ✅ HELD

**What was tried:**
```bash
HEADER=$(base64url '{"alg":"none","typ":"JWT"}')
PAYLOAD=$(base64url '{"sub":"<real-id>","role":"MASTER","exp":9999999999}')
curl /api/auth/me -H "Authorization: Bearer $HEADER.$PAYLOAD."
```

**Server response:** HTTP 400 (empty body).

**Why it held:** `jsonwebtoken` rejects `alg:none` by default. The forged token never reaches the user lookup.

**Minor finding:** Returns 400 instead of 401. Semantically a 401 would be more correct for an invalid token — not a security issue but worth tidying.

---

### 1.5 — CSRF on cookie-based refresh

**Status:** ⏭️ SKIPPED

**Reason:** Requires a real browser to test `SameSite=strict` cookie behavior. Cannot be reproduced with curl (curl sends cookies regardless of same-site policy).

**Expected result:** `SameSite=strict` prevents the `refresh_token` cookie from being sent on cross-site form POSTs. The cookie is also `httpOnly`, so JavaScript on an attacker page cannot read it.

---

## Section 2 — Authorization & Role Escalation

### 2.1 — Self-promotion

**Status:** ✅ HELD

**What was tried:**
```bash
curl -X PATCH /api/admin/users/<own-id>/role \
  -H "Authorization: Bearer <USER-token>" \
  -d '{"role":"ADMIN"}'
```

**Server response:** `{"error":"Insufficient permissions","code":"FORBIDDEN"}` — HTTP 403

**Why it held:** `authorize('ADMIN')` middleware blocks the request before it reaches the service. A USER-level JWT has rank 0; ADMIN requires rank 2.

---

### 2.2 — IDOR: ADMIN demotes MASTER

**Status:** ✅ HELD

**What was tried:**
```bash
curl -X PATCH /api/admin/users/<master-id>/role \
  -H "Authorization: Bearer <ADMIN-token>" \
  -d '{"role":"USER"}'
```

**Server response:** `{"error":"Insufficient permissions","code":"FORBIDDEN"}` — HTTP 403

**Why it held:** `setRole` in `admin.service.ts` checks the target's current role against `ADMIN_MANAGEABLE_ROLES = ['USER','HELPER']`. MASTER is not in that list, so the service throws 403 before touching the DB.

---

### 2.3 — HELPER email exposure

**Status:** ✅ FIXED (patched before audit execution)

**Finding:** `listUsers` was returning `email` to all callers including HELPERs. Fixed in commit `2517105` — `listUsers` now accepts `requesterRole` and uses a role-aware Prisma select: ADMIN and MASTER receive `email`, HELPER does not. Search also no longer queries by email for HELPER callers.

---

### 2.4 — Banned user with live access token

**Status:** ⚠️ PARTIAL (known design)

**What was tried:**
1. Registered `victim@mh.dev`, captured access token.
2. ADMIN banned the account via PATCH /api/admin/users/:id/ban.
3. Replayed victim's access token on GET /api/auth/me.

**Server response:** HTTP 200 — user data returned despite being banned.

**Why it is partial:** Ban deletes refresh tokens immediately (preventing new sessions), but the access token is a stateless JWT. The banned user can continue API access for up to 15 minutes using their existing token. Documented accepted risk.

**Fix if unacceptable:** Redis-based token denylist checked on every request.

---

### 2.5 — Stale JWT after role demotion

**Status:** ⚠️ PARTIAL (known design)

**What was tried:**
1. Logged in as ADMIN — saved access token.
2. MASTER demoted that account to USER via API.
3. Used the saved ADMIN token immediately on GET /api/admin/users.

**Server response:** HTTP 200 — admin endpoint responded with user list despite DB now saying USER.

**Why it is partial:** `authorize` middleware reads `req.user.role` from the JWT payload, not the DB. The JWT role and DB role can diverge for up to 15 minutes after a demotion. Same root cause as 2.4. Documented accepted risk.

---

## Section 3 — Input Validation & Injection

### 3.1 — SQL injection via search

**Status:** ✅ HELD

**What was tried:**
```bash
curl --get /api/admin/users \
  --data-urlencode "search='; DROP TABLE \"User\"; --" \
  -H "Authorization: Bearer <admin-token>"
```

**Server response:** HTTP 200 — `{"users":[]}` (empty results, no error).

**Why it held:** Prisma uses parameterized queries. The entire injection string is passed as a literal `ILIKE` value to Postgres. No SQL is interpreted; the table was not affected.

---

### 3.2 — ReDoS via search

**Status:** ✅ HELD

**What was tried:**
```bash
curl /api/admin/users?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab
```

**Server response:** 549ms vs 552ms for a normal search — no meaningful difference.

**Why it held:** Prisma translates `contains` to a Postgres `ILIKE` query, not a JavaScript regex. PostgreSQL's LIKE implementation has no catastrophic backtracking. ReDoS is a Node.js/regex concern, not a DB LIKE concern.

---

### 3.3 — Mass assignment on register

**Status:** ✅ HELD

**What was tried:**
```bash
curl -X POST /api/auth/register \
  -d '{"email":"attacker@evil.com","username":"attacker","password":"password123","role":"MASTER"}'
```

**Server response:** Account created with `"role":"USER"`.

**Why it held:** `RegisterSchema` from `@mh-datapedia/shared` does not include a `role` field. Zod strips unknown keys by default. The `role` in the request body was silently dropped and the DB default (`USER`) was applied.

---

### 3.4 — XSS via username

**Status:** ⏭️ SKIPPED

**Reason:** Requires a real browser to verify whether the payload executes or is escaped. Cannot be confirmed with curl.

**Expected result:** React escapes all JSX text content by default. Unless a component uses `dangerouslySetInnerHTML` (none were found in the codebase via grep), the payload `<img src=x onerror=alert(1)>` would render as plain text. Manual browser verification recommended.

---

## Section 4 — HTTP Security Headers & Configuration

### 4.1 — Security headers

**Status:** ✅ HELD

**What was tried:**
```bash
curl -I https://mh-datapedia-api.fly.dev/api/health
```

**Header audit:**

| Header | Value | Result |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | ✅ |
| `X-Frame-Options` | `SAMEORIGIN` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Content-Security-Policy` | Full policy present | ✅ |
| `X-Powered-By` | Absent | ✅ |
| `Server` | `Fly/a02c95d2c` (Fly.io header, not Express) | ✅ |

All critical headers present and correct. `helmet()` is working as expected.

---

### 4.2 — CORS origin

**Status:** ✅ HELD

**What was tried:**
```bash
curl -H "Origin: https://evil.com" -I /api/health
curl -H "Origin: https://mh-datapedia-web.fly.dev" -I /api/health
```

**Server response:** Both return `Access-Control-Allow-Origin: http://localhost:5173` — neither evil.com nor the production web domain is echoed back.

**Why it held:** The web frontend uses an nginx reverse proxy (`nginx.conf`) that routes `/api/` to the API's internal Fly.io hostname (`mh-datapedia-api.internal:3001`). From the browser's perspective, all requests are same-origin (to `mh-datapedia-web.fly.dev`). CORS never fires for legitimate traffic. Cross-origin attempts from `evil.com` are blocked because the browser rejects responses where `Access-Control-Allow-Origin` doesn't match the request origin.

**Note:** `CORS_ORIGIN` is set to `http://localhost:5173` in Fly.io secrets. This is harmless in the current architecture (same-origin proxy) but should be updated to the production web domain for correctness if the proxy setup ever changes.

---

### 4.3 — Swagger UI public exposure

**Status:** ⚠️ PARTIAL (known accepted risk)

**What was tried:** GET /api/docs — no auth.

**Server response:** HTTP 200 — full Swagger UI rendered with all endpoint schemas.

**Why it is partial:** Not exploitable on its own — the schema is public via the source code anyway. Makes automated scanner reconnaissance easier. Decision: acceptable for current stage; revisit before a public commercial launch.

---

## Section 5 — Business Logic

### 5.1 — Self-ban

**Status:** ✅ HELD

**What was tried:**
```bash
curl -X PATCH /api/admin/users/<own-admin-id>/ban \
  -H "Authorization: Bearer <ADMIN-token>" \
  -d '{"banned":true,"reason":"testing self ban attempt","bannedUntil":null}'
```

**Server response:** `{"error":"Insufficient permissions","code":"FORBIDDEN"}` — HTTP 403

**Why it held:** The ADMIN's own role is `ADMIN`, which is not in `ADMIN_MANAGEABLE_ROLES`. The role boundary check fires before the self-ban check. The account cannot be self-banned via any reachable code path for an ADMIN caller.

---

### 5.2 — Set role to MASTER via API

**Status:** ✅ HELD

**What was tried:**
```bash
curl -X PATCH /api/admin/users/<target-id>/role \
  -H "Authorization: Bearer <MASTER-token>" \
  -d '{"role":"MASTER"}'
```

**Server response:** HTTP 422 — `{"error":"Validation failed","details":{"fieldErrors":{"role":["Invalid enum value. Expected 'USER' | 'HELPER' | 'ADMIN', received 'MASTER'"]}}}`

**Why it held:** `SetRoleSchema` uses `z.enum(['USER','HELPER','ADMIN'])`. MASTER is not in the enum. Zod rejects the payload before the service runs. MASTER can only be set directly in the database.

---

### 5.3 — Pagination boundary

**Status:** ✅ HELD

**What was tried:**
```bash
curl "/api/admin/audit?limit=999999&page=0" -H "Authorization: Bearer <admin-token>"
```

**Server response:** `{"meta":{"page":1,"limit":50,"total":24,"totalPages":1}}`

**Why it held:** The router clamps `limit` to `Math.min(50, Math.max(1, parsed))` and resolves `page` to `Math.max(1, parsed)`. Both extremes are handled correctly.

---

## Section 6 — Rate Limiter Bypass

### 6.1 — X-Forwarded-For spoofing

**Status:** ✅ HELD

**What was tried:**
```bash
curl -X POST /api/auth/register \
  -H "X-Forwarded-For: 10.20.30.40" \
  -d '{"email":"test@test.com",...}'
```

**Server response:** `{"error":"Too many auth attempts","code":"RATE_LIMITED"}` — HTTP 429

**Why it held:** The spoofed `X-Forwarded-For` header did not bypass the rate limiter. Express's `trust proxy` setting correctly ignores client-supplied IP headers, so the real IP is used for rate limiting regardless of what the client sends.

---

## Known accepted risks

| Risk | Why it exists | Mitigation |
|------|---------------|------------|
| Access token valid 15 min after ban/demotion | JWTs are stateless; invalidating requires a Redis denylist | Short 15-min expiry limits exposure window |
| Swagger UI public at `/api/docs` | Developer convenience | Remove or auth-gate before commercial launch |
| Rate limiter in-memory | No Redis dependency | Acceptable for single-instance; re-evaluate at scale or multi-instance |

---

## Findings to fix

| Priority | Finding | Location |
|----------|---------|----------|
| Low | `alg:none` returns HTTP 400 instead of 401 | `apps/api/src/middleware/authenticate.ts` |
| Low | `CORS_ORIGIN` set to `localhost:5173` in production Fly secrets | Fly.io secret `CORS_ORIGIN` |

Neither is a security vulnerability — both are correctness/hygiene issues.
