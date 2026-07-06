# Security Phase 2 — Email Verification Design

**Date:** 2026-07-05
**Scope:** `apps/api` + `apps/web` + `apps/mobile`
**Part of:** Security Phase 2 (4 sub-specs: email verification → password reset → session management → 2FA)

---

## Goal

Require every new account to confirm their email address before they can write any data. Unverified users can read all content (monsters, hitzones, strategies) but cannot submit strategies, add/remove favorites, or perform any write action.

---

## Database reset

Before implementation, truncate user-related tables only. Monster data is preserved.

**Tables to truncate (in order to respect FK constraints):**
1. `_UserFavorites` (join table)
2. `Strategy`
3. `AdminAction`
4. `RevokedToken`
5. `RefreshToken`
6. `User`
7. `LoginAttempt`

After the wipe, `silverkx@mh.com` must re-register and be promoted to MASTER via Fly SSH.

---

## Data model

Add three fields to `User`:

```prisma
emailVerified          Boolean   @default(false)
verifyEmailToken       String?   @unique
verifyEmailTokenExpiry DateTime?
```

No migration for existing users — DB is wiped before deployment.

---

## Email service

**Provider:** Resend (free tier — 3,000 emails/month)
**SDK:** `resend` npm package, installed in `apps/api`
**From address:** `onboarding@resend.dev` (Resend shared domain, no custom domain required)
**New env var:** `RESEND_API_KEY` — set via `fly secrets set RESEND_API_KEY=<key> -a mh-datapedia-api`

New file: `apps/api/src/services/email.service.ts`

Exports one function:

```typescript
sendVerificationEmail(to: string, token: string): Promise<void>
```

The verification link format:
```
https://mh-datapedia-web.fly.dev/verify-email?token=<token>
```

Email is plain HTML — no template engine. Subject: `Verify your MH Datapedia account`.

---

## Token generation

- `randomBytes(32).toString('hex')` — 64-character hex string
- Stored as `verifyEmailToken` on `User`
- Expiry: 24 hours from generation, stored as `verifyEmailTokenExpiry`
- On successful verification: both fields set to `null`, `emailVerified` set to `true`
- On resend: old token is replaced with a new one (new expiry)

---

## API — new endpoints

### `GET /api/auth/verify-email?token=<token>`

- No authentication required
- Looks up `User` by `verifyEmailToken`
- Returns `400 INVALID_TOKEN` if not found or expired
- Returns `400 ALREADY_VERIFIED` if `emailVerified` is already true
- On success: sets `emailVerified = true`, clears `verifyEmailToken` and `verifyEmailTokenExpiry`, returns `200 { message: 'Email verified' }`

### `POST /api/auth/resend-verification`

- Requires authentication (`authenticate` middleware)
- Rate limited: 3 requests per hour, keyed by authenticated user ID (separate `resendLimiter` using a custom key function on `req.user!.id`)
- Returns `400 ALREADY_VERIFIED` if already verified
- Generates a new token (replaces old one), sends email
- Returns `200 { message: 'Verification email sent' }`

---

## API — updated endpoints

### `POST /api/auth/register`

After creating the user:
1. Generate verification token
2. Store token + expiry on the user record
3. Send verification email via `email.service.ts`
4. Return the normal auth response (user, accessToken, refreshToken)

The user is logged in immediately — they just can't write until verified.

---

## Middleware — `requireVerified`

New file: `apps/api/src/middleware/requireVerified.ts`

```typescript
export const requireVerified: RequestHandler = async (req, _res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { emailVerified: true },
  });
  if (!user?.emailVerified) {
    return next(new AppError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED'));
  }
  next();
};
```

Applied after `authenticate` on all write routes:

| Route | Change |
|-------|--------|
| `POST /api/strategies` | Add `requireVerified` |
| `PATCH /api/strategies/:id` | Add `requireVerified` |
| `DELETE /api/strategies/:id` | Add `requireVerified` |
| `POST /api/users/me/favorites/:monsterId` | Add `requireVerified` |
| `DELETE /api/users/me/favorites/:monsterId` | Add `requireVerified` |

---

## Web — new page: `/verify-email`

Route: `apps/web/src/routes/verify-email.tsx`

Behaviour:
- On mount, reads `?token=` from the URL
- If no token: shows error state ("Invalid link")
- Calls `GET /api/auth/verify-email?token=xxx`
- Shows loading → success ("Email verified! You can now submit strategies and add favorites.") or error ("Link expired or already used.")
- Success state includes a link back to the home page

---

## Web — unverified banner

Shown on all authenticated pages when `user.emailVerified === false`.

- Yellow/amber strip at the top: "Please verify your email. Check your inbox for a link from onboarding@resend.dev."
- "Resend email" button — calls `POST /api/auth/resend-verification`, shows feedback
- Dismissed automatically when the user refreshes after verifying

The banner reads `emailVerified` from the auth context. `GET /api/auth/me` already returns the live DB value, so after verification the user just needs to refresh or re-login to see the banner disappear.

`emailVerified` must be added to `UserSchema` in `packages/shared/src/schemas/auth.schema.ts` and returned by `GET /api/auth/me` and the login/register responses.

---

## Web — write action error handling

Any component that calls a write endpoint must handle the `EMAIL_NOT_VERIFIED` 403:

- Strategy form submit → toast: "Verify your email to submit strategies."
- Favorites toggle → toast: "Verify your email to save favorites."

---

## Mobile

### Verification flow

Mobile users receive the email → tap the link → browser opens → verification page runs → account is verified. No deep linking required.

After returning to the app, the unverified banner disappears on the next silent token refresh (which calls `getMe` and gets the updated `emailVerified: true`).

### Unverified banner

Shown below the header on all screens when `user.emailVerified === false`:

- Amber strip: "Verify your email to unlock all features."
- Tap → opens the device's email app (`Linking.openURL('mailto:')`)

### Write action error handling

Any mutation that returns `EMAIL_NOT_VERIFIED`:
- Strategy submission → Alert: "Email not verified. Check your inbox."
- Favorites toggle → silently ignored (no crash), toast if possible

---

## Shared package

Add `emailVerified: z.boolean()` to `UserSchema` in `packages/shared/src/schemas/auth.schema.ts`. The inferred `User` type propagates to all consumers automatically. All login, register, and `getMe` API responses include this field.

---

## Environment variables

| Variable | Where set | Notes |
|----------|-----------|-------|
| `RESEND_API_KEY` | `fly secrets set` on `mh-datapedia-api` | Never committed to git |

---

## Out of scope

- Custom email domain (using Resend shared domain for now)
- Email template engine (plain HTML string)
- Admin ability to manually verify accounts
- Verification status visible in admin panel
- 2FA, password reset, session management (separate specs)
