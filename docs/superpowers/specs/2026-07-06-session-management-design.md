# Security Phase 2c — Session Management Design

**Date:** 2026-07-06
**Scope:** `apps/api` + `apps/web`
**Part of:** Security Phase 2 (email verification → password reset → session management → 2FA)

---

## Goal

Let authenticated users view all their active sessions and revoke any of them individually or all at once ("log out everywhere else"). The current session is clearly marked so users don't accidentally log themselves out.

---

## Out of scope

- Mobile session management UI (deferred to a later phase)
- Full account settings page (profile, strategies, likes — separate spec)
- Geographic location from IP (no GeoIP lookup)

---

## Database

Add three fields to the `RefreshToken` model in `apps/api/prisma/schema.prisma`:

```prisma
model RefreshToken {
  id         String   @id @default(cuid())
  token      String   @unique
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  userAgent  String?
  ipAddress  String?
  lastUsedAt DateTime @default(now())
}
```

New migration: `apps/api/prisma/migrations/20260706000001_add_session_metadata/migration.sql`

```sql
ALTER TABLE "RefreshToken" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

### Populating the fields

**On login** (`auth.service.ts` → `login()`): capture `userAgent` and `ipAddress` from the request and store them when creating the `RefreshToken` record.

**On token rotation** (`auth.service.ts` → `refreshTokens()`): update `lastUsedAt` to `new Date()` when rotating the token.

The `login` and `refreshTokens` service functions need `userAgent: string | undefined` and `ipAddress: string | undefined` as additional parameters. The router passes these from `req.headers['user-agent']` and `req.ip`.

---

## Device label parsing

No third-party library. A single pure function in `apps/api/src/lib/parseUserAgent.ts`:

```typescript
export function parseUserAgent(ua: string | undefined | null): string {
  if (!ua) return 'Unknown device';
  if (/mobile|android/i.test(ua)) {
    if (/iphone|ipad/i.test(ua)) return 'Safari on iPhone';
    if (/android/i.test(ua)) return 'Chrome on Android';
    return 'Mobile browser';
  }
  if (/chrome/i.test(ua) && !/edg|opr/i.test(ua)) return 'Chrome on ' + getOS(ua);
  if (/firefox/i.test(ua)) return 'Firefox on ' + getOS(ua);
  if (/safari/i.test(ua)) return 'Safari on Mac';
  if (/edg/i.test(ua)) return 'Edge on ' + getOS(ua);
  return 'Browser on ' + getOS(ua);
}

function getOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}
```

---

## API

All three endpoints require authentication (`authenticate` middleware). The current session is identified by hashing the incoming refresh token cookie and comparing it to stored token hashes.

### `GET /api/auth/sessions`

Returns all non-expired sessions for the authenticated user, ordered by `lastUsedAt` descending.

Response:
```json
[
  {
    "id": "clxxx",
    "deviceLabel": "Chrome on Windows",
    "ipAddress": "203.0.113.1",
    "createdAt": "2026-07-01T12:00:00.000Z",
    "lastUsedAt": "2026-07-06T20:00:00.000Z",
    "isCurrent": true
  }
]
```

`isCurrent` is `true` when the session's token hash matches the refresh token in the current request cookie.

### `DELETE /api/auth/sessions/:id`

Revokes the session with the given ID. If it belongs to another user → `403 FORBIDDEN`. If it is the current session → revoke it and clear the refresh token cookie (same behaviour as logout). Returns `200 { message: 'Session revoked.' }`.

### `DELETE /api/auth/sessions`

Revokes all sessions for the authenticated user **except** the current one. Returns `200 { message: 'All other sessions revoked.' }`.

---

## Shared types

Add to `packages/shared/src/schemas/auth.schema.ts`:

```typescript
export const SessionSchema = z.object({
  id: z.string(),
  deviceLabel: z.string(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  isCurrent: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;
```

---

## Web

### `/account/sessions` page

**File:** `apps/web/src/routes/account/sessions.tsx`

- Requires authentication: if no user, redirect to `/login`
- Fetches `GET /api/auth/sessions` on mount via TanStack Query
- Lists sessions in a dark stone card, ordered by `lastUsedAt` desc

**Session row:**
- Left: device label in `text-stone-100` + `YOU` badge (`bg-teal-700 text-xs px-1.5 py-0.5 rounded`) for the current session
- Below device label: IP address + "Last active" date in `text-stone-500 text-sm`
- Right: **Revoke** button (`text-red-400 hover:text-red-300 text-sm`) — hidden on the current session row

**Footer:**
- "Log out all other devices" button (`border border-stone-700 text-stone-300`) — hidden if the user has only one session
- Calls `DELETE /api/auth/sessions`, then refetches the session list

**Header:**
- `← Account` back link (navigates to `/` for now, updated when the full account page is built)
- Page title: "Active Sessions"

### Navbar link

Add a "Sessions" link to wherever the logout button currently lives in the web navbar/user menu, pointing to `/account/sessions`.

---

## Testing

New tests in `apps/api/tests/auth.test.ts`:

- `GET /api/auth/sessions` returns the current user's sessions with `isCurrent: true` on the active one
- `GET /api/auth/sessions` does not return expired sessions
- `DELETE /api/auth/sessions/:id` revokes the target session
- `DELETE /api/auth/sessions/:id` returns `403` when targeting another user's session
- `DELETE /api/auth/sessions` revokes all sessions except current
- Login captures `userAgent` and `ipAddress` on the stored token
