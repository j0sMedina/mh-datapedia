# Security Phase 1 Design Spec

## Goal

Harden MH Datapedia with a 4-tier role hierarchy, enhanced ban system, auth hardening (account lockout + token reuse detection), a full audit log, and rate limiting improvements with client-side debounce.

## Scope

Phase 1 only. Phase 2 (content moderation: strategy queue, reports, monster edit diff) is a separate spec.

## Stack

TypeScript, Express, Prisma (PostgreSQL), React + TanStack Query + TanStack Router, Tailwind CSS + NativeWind, Zod. All new UI must follow the existing stone/dark palette (`bg-stone-900/800`, `border-stone-700`, `text-stone-50/400`), `mh-panel`, `mh-section-head`, accent color (`text-accent`, `bg-accent`), clipped corners (`--mh-cut`), and Oswald font.

---

## Global Constraints

- Never expose `passwordHash`, `bannedReason`, or audit log metadata to non-admin roles.
- All sensitive multi-write operations (ban + role downgrade) must use Prisma transactions.
- The `MASTER` role is set via DB seed/migration only — no API or UI path to create or promote to MASTER.
- Audit log rows are append-only — never updated or deleted.
- All new Zod schemas go in `packages/shared/src/schemas/`.
- All new API routes follow the existing `wrap()` + `validate()` + `authenticate()` + `authorize()` pattern in `apps/api/src/routes/`.
- `authorize()` must be hierarchy-aware: `authorize('HELPER')` passes for HELPER, ADMIN, MASTER. `authorize('ADMIN')` passes for ADMIN, MASTER. `authorize('MASTER')` passes for MASTER only.

---

## 1. Role Hierarchy

### Roles (ordered lowest → highest)

`USER → HELPER → ADMIN → MASTER`

### Permissions Matrix

| Action | USER | HELPER | ADMIN | MASTER |
|---|:---:|:---:|:---:|:---:|
| Read public content | ✓ | ✓ | ✓ | ✓ |
| Write own strategies (→ PENDING) | ✓ | — | — | — |
| Write strategies (→ APPROVED immediately) | — | ✓ | ✓ | ✓ |
| Approve / reject strategies | — | ✓ | ✓ | ✓ |
| Create / edit monster data | — | ✓ | ✓ | ✓ |
| Ban / unban USERs | — | — | ✓ | ✓ |
| Promote USER → HELPER / revoke HELPER → USER | — | — | ✓ | ✓ |
| Ban / unban HELPERs | — | — | ✓ | ✓ |
| Ban / unban ADMINs | — | — | — | ✓ |
| Promote USER → ADMIN / revoke ADMIN → USER | — | — | — | ✓ |
| View audit log | — | — | ✓ | ✓ |
| Set MASTER | DB only | — | — | — |

### DB Change

Add `HELPER` and `MASTER` to the `Role` enum in `schema.prisma`. Migration required.

```prisma
enum Role {
  USER
  HELPER
  ADMIN
  MASTER
}
```

### authorize() middleware update

Replace the flat role check with a hierarchy-aware check:

```ts
const ROLE_RANK: Record<string, number> = {
  USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3,
};

export const authorize =
  (minRole: 'USER' | 'HELPER' | 'ADMIN' | 'MASTER'): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
```

Update `JwtPayload` and `req.user` type to include `'HELPER' | 'MASTER'`.

### Scope enforcement in admin.service.ts

- `setRole(id, newRole, requesterId, requesterRole)`:
  - ADMIN can only set roles `USER` or `HELPER` on targets whose current role is `USER` or `HELPER`. Cannot touch ADMIN or MASTER targets.
  - MASTER can set any role on any target.
  - Self-action still blocked.
- `setBanned(id, banned, requesterId, requesterRole)`:
  - ADMIN can ban/unban targets whose role is `USER` or `HELPER` only.
  - MASTER can ban/unban anyone.
  - Self-action still blocked.
- When banning a HELPER or ADMIN, atomically: set `banned = true` + downgrade `role = USER` + delete all refresh tokens in a single transaction.
- To re-grant role after unban: separate `setRole` call required (ADMIN for HELPER, MASTER for ADMIN).

### Shared schema update

Add `HELPER` and `MASTER` to `RoleSchema` in `packages/shared/src/schemas/enums.schema.ts`.

---

## 2. Enhanced Ban System

### DB changes on `User`

```prisma
bannedReason  String?
bannedAt      DateTime?
bannedUntil   DateTime?   // null = permanent ban
```

### Ban durations

Admin selects from: Permanent (null), 1 day, 7 days, 30 days, or custom (free-text number of days). Backend receives `{ banned: true, reason: string, bannedUntil: string | null }`.

### Auto-unban on login

In `auth.service.ts` `login()` and `refresh()`: if user is banned and `bannedUntil` is set and `bannedUntil < now`, silently clear ban fields (`banned = false`, `bannedReason = null`, `bannedAt = null`, `bannedUntil = null`) before proceeding.

### Login / refresh response when still banned

Return `403 BANNED` with body:
```json
{
  "error": "Account is banned",
  "code": "BANNED",
  "bannedReason": "...",
  "bannedAt": "ISO date",
  "bannedUntil": "ISO date or null"
}
```

### Banned modal (frontend)

Appears immediately when login or token refresh returns `BANNED`. It is a full-screen modal overlay (not dismissable by clicking outside).

Content:
- Title: "Account Suspended"
- Ban reason text
- "Banned since" date
- "Banned until" date or "Permanent"
- 100-second countdown (visible, counts down live)
- "Log out" button

On button click or countdown reaching 0: clear auth state, clear refresh token cookie (call `POST /api/auth/logout`), redirect to `/`.

Style: follows existing dark theme. Uses `mh-panel` and `mh-section-head`. Accent color for the countdown. Red (`text-red-400`, `border-red-800/50`) for the "Suspended" heading and status.

If user tries to log in again while still banned, the same modal appears again.

### Ban action modal (admin panel)

Appears when admin clicks "Ban" on a user row.

Fields:
- Reason (textarea, required, min 10 chars)
- Duration selector: Permanent | 1 day | 7 days | 30 days | Custom (shows day input)
- Confirm and Cancel buttons

On confirm: calls `PATCH /api/admin/users/:id/ban` with `{ banned: true, reason, bannedUntil }`.

---

## 3. Auth Hardening

### 3a. Account Lockout

**New DB model:**

```prisma
model LoginAttempt {
  id        String   @id @default(cuid())
  email     String
  createdAt DateTime @default(now())

  @@index([email, createdAt])
}
```

**Logic in `auth.service.ts` `login()`:**

1. Count `LoginAttempt` rows for this email where `createdAt > now - 15 minutes`.
2. If count ≥ 5, return `429 RATE_LIMITED` with `{ lockedUntil: <oldest attempt + 15min> }`. Do not check password.
3. If password check fails, insert a `LoginAttempt` row.
4. If login succeeds, delete all `LoginAttempt` rows for this email.

**New `LoginAttemptSchema`** in shared (for the 429 response shape): `{ code: 'RATE_LIMITED', lockedUntil: string }`.

No cleanup job needed — old rows outside the 15-minute window are ignored automatically. A weekly Prisma query to purge rows older than 24 hours can be added later if table grows large.

### 3b. Refresh Token Reuse Detection

**Current flow:** on `POST /api/auth/refresh`, the stored token is deleted and a new one is issued.

**Change:** add a `RevokedToken` table that stores the hashed value of every rotated-out token for 7 days (the max refresh TTL):

```prisma
model RevokedToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

On `POST /api/auth/refresh`:
1. If token not found in `RefreshToken` table AND found in `RevokedToken` table → token reuse detected. Delete all `RefreshToken` rows for that `userId`. Return `401 TOKEN_REUSE_DETECTED`.
2. If token not found in either table → standard `401 UNAUTHORIZED`.
3. If token found and valid → proceed as now, move old token hash to `RevokedToken`, issue new `RefreshToken`.

Hash stored using `crypto.createHash('sha256')` — never store raw token values in the revoked table.

---

## 4. Audit Log

### DB model

```prisma
model AdminAction {
  id               String    @id @default(cuid())
  actorId          String
  actor            User      @relation("ActorActions", fields: [actorId], references: [id])
  action           AuditAction
  targetUserId     String?
  targetUser       User?     @relation("TargetActions", fields: [targetUserId], references: [id])
  targetStrategyId String?
  metadata         Json
  createdAt        DateTime  @default(now())

  @@index([actorId])
  @@index([createdAt])
}

enum AuditAction {
  ROLE_CHANGE
  BAN
  UNBAN
}
```

Phase 2 will add `STRATEGY_APPROVE`, `STRATEGY_REJECT` to `AuditAction`.

### metadata shape per action

- `ROLE_CHANGE`: `{ from: Role, to: Role }`
- `BAN`: `{ reason: string, bannedUntil: string | null }`
- `UNBAN`: `{}`

### When to write

Write an `AdminAction` row inside the same transaction as the operation it records. Never write after the fact.

### API

`GET /api/admin/audit?page=1&limit=20` — `authorize('ADMIN')`. Returns paginated list newest first. Response includes: `actorUsername`, `action`, `targetUsername`, `metadata`, `createdAt`.

### Admin panel — Audit Log tab

Table columns: Actor | Action | Target | Details | Date. Paginated, 20 rows per page. Read-only. Accessible to ADMIN and MASTER only. Follows existing table style from the Users tab.

---

## 5. Rate Limiting + Debounce

### New server-side limiters (`apps/api/src/middleware/rateLimiter.ts`)

```ts
export const strategyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many strategy submissions', code: 'RATE_LIMITED' },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many admin requests', code: 'RATE_LIMITED' },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many search requests', code: 'RATE_LIMITED' },
});
```

Applied:
- `strategyLimiter` → `POST /api/strategies`
- `adminLimiter` → all `PATCH /api/admin/*` routes
- `searchLimiter` → `GET /api/monsters` and `GET /api/admin/users`

Existing `authLimiter` and `generalLimiter` unchanged.

### Client-side debounce (`apps/web/src/hooks/useDebounce.ts`)

```ts
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

Applied to:
- Monster list search input — replaces current immediate query key update
- Admin panel user search input — replaces current Enter-to-search pattern with live debounced search

---

## 6. Admin Panel UI Updates

### Route guard

`apps/web/src/routes/admin.tsx` `beforeLoad`: allow `HELPER`, `ADMIN`, `MASTER` (currently only `ADMIN`). Each role sees only the controls it can perform.

### Tabs

Three tabs: **Users** | **Audit Log** | *(Moderation — Phase 2 placeholder, greyed out)*

Tab style: follows existing `mh-section-head` underline pattern.

### Users tab

Role badge colors:
- USER: `bg-stone-700 text-stone-300`
- HELPER: `bg-blue-900/40 text-blue-400 border border-blue-800/50`
- ADMIN: `bg-accent/20 text-accent border border-accent/40` (existing)
- MASTER: `bg-yellow-900/40 text-yellow-400 border border-yellow-700/50`

Action controls visible per viewer role:
- HELPER viewer: no action controls (read-only)
- ADMIN viewer: sees promote/demote USER↔HELPER and ban/unban on USER and HELPER rows only. No controls on ADMIN or MASTER rows.
- MASTER viewer: sees all controls on all rows except MASTER row (no self-action).

Ban button opens the ban modal (Section 2). Role change is a direct button (promote/demote), no modal.

### Audit Log tab

Table: Actor | Action | Target | Details | Date. Paginated (20/page), newest first. Read-only. ADMIN and MASTER only.

Action labels: `Role changed`, `Banned`, `Unbanned`. Details column shows `metadata` rendered as human-readable text (e.g. "USER → HELPER", "Reason: spamming. Until: 2026-07-01").

---

## Out of Scope (Phase 2)

- Strategy moderation queue (PENDING/APPROVED/REJECTED)
- Reports system
- Monster edit pending queue with diff view
- `STRATEGY_APPROVE` / `STRATEGY_REJECT` audit actions
- Email notifications on ban/role change
