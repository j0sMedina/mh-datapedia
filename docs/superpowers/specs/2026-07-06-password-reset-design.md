# Security Phase 2b — Password Reset Design

**Date:** 2026-07-06
**Scope:** `apps/api` + `apps/web` + `apps/mobile`
**Part of:** Security Phase 2 (email verification → password reset → session management → 2FA)

---

## Goal

Allow users to reset their password via an emailed link. Resetting invalidates all existing sessions.

---

## Email service migration

Replace the Resend SDK with `nodemailer` + Gmail SMTP. A dedicated Gmail account is used as the sender — not a personal account.

**New package:** `nodemailer` + `@types/nodemailer` installed in `apps/api`

**New env vars:**

| Variable | Where set | Notes |
|----------|-----------|-------|
| `GMAIL_USER` | `fly secrets set` on `mh-datapedia-api` | The dedicated Gmail address |
| `GMAIL_APP_PASSWORD` | `fly secrets set` on `mh-datapedia-api` | Google App Password (requires 2FA on the Gmail account) |

**Remove:** `RESEND_API_KEY` from `apps/api/src/config/env.ts` and Fly secrets.

**File:** `apps/api/src/services/email.service.ts` — rewritten to use nodemailer. Exports two functions:

```typescript
sendVerificationEmail(to: string, token: string): Promise<void>
sendPasswordResetEmail(to: string, token: string): Promise<void>
```

Lazy transporter initialization — create `nodemailer.createTransport(...)` only on first call, same lazy pattern as the old Resend client. In test mode (`NODE_ENV === 'test'`) both functions return immediately without sending.

Gmail SMTP config:
- host: `smtp.gmail.com`
- port: `587`
- secure: `false` (STARTTLS)
- auth: `{ user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD }`

---

## Database

Add two fields to the `User` model in `apps/api/prisma/schema.prisma`:

```prisma
resetPasswordToken       String?   @unique
resetPasswordTokenExpiry DateTime?
```

New migration: `apps/api/prisma/migrations/20260706000000_add_password_reset/migration.sql`

```sql
ALTER TABLE "User" ADD COLUMN "resetPasswordToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetPasswordTokenExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");
```

---

## API

### `POST /api/auth/forgot-password`

- Public, rate-limited: 3 requests per hour per IP (new `forgotPasswordLimiter`)
- Body: `{ email: string }`
- Always returns `200 { message: 'If that email exists, a reset link has been sent.' }` — never reveals whether the email is registered (prevents enumeration)
- If user found: generate `randomBytes(32).toString('hex')` token, set expiry to 1 hour from now, store on user, send password reset email
- If user not found: return 200 with same message, do nothing

### `POST /api/auth/reset-password`

- Public, no auth required
- Body: `{ token: string, password: string }` (password validated: min 8 chars, same rule as register)
- Look up user by `resetPasswordToken`
- If not found or `resetPasswordTokenExpiry` is null or expired → `400 INVALID_TOKEN`
- Hash new password with bcrypt (same cost factor as registration)
- Update user: set new `passwordHash`, clear `resetPasswordToken` and `resetPasswordTokenExpiry`
- Revoke all refresh tokens: `prisma.refreshToken.deleteMany({ where: { userId } })`
- Return `200 { message: 'Password reset successfully.' }`

Token expiry check is fail-closed:
```typescript
if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
  throw new AppError(400, 'Reset link has expired or is invalid', 'INVALID_TOKEN');
}
```

---

## Rate limiting

New `forgotPasswordLimiter` in `apps/api/src/middleware/rateLimiter.ts`:
- 3 requests per hour
- Keyed by IP
- Skipped in test environment

---

## Shared types

Add to `packages/shared/src/schemas/auth.schema.ts`:

```typescript
export const ForgotPasswordSchema = z.object({ email: z.string().email() });
export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});
export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
```

---

## Web

### Login page update

Add "Forgot password?" link below the login form pointing to `/forgot-password`.

### `/forgot-password`

**File:** `apps/web/src/routes/forgot-password.tsx`

- Email input + submit button
- On submit: calls `POST /api/auth/forgot-password`
- After submit (success or error): shows success message regardless — "If that email is registered, you'll receive a reset link shortly."
- Link back to `/login`

### `/reset-password`

**File:** `apps/web/src/routes/reset-password.tsx`

- `validateSearch` for `token` query param
- If no token: shows error state with link to `/forgot-password`
- Form: new password + confirm password fields (client-side match validation)
- On submit: calls `POST /api/auth/reset-password`
- On success: shows "Password reset — you can now log in." then redirects to `/login` after 3 seconds
- On `INVALID_TOKEN` error: shows "This link has expired or already been used." with link to `/forgot-password`

---

## Mobile

No dedicated screens. On the login screen, a "Forgot password?" text link opens the web forgot-password page via:

```typescript
Linking.openURL('https://mh-datapedia-web.fly.dev/forgot-password');
```

---

## Email templates

### Password reset email

- Subject: `Reset your MH Datapedia password`
- From: `GMAIL_USER` env var
- Reset link: `https://mh-datapedia-web.fly.dev/reset-password?token=<token>`
- Link expires in 1 hour
- Plain HTML, same dark card style as verification email

---

## Test helpers

`registerUser()` in `apps/api/tests/helpers.ts` already sets `emailVerified: true` — no change needed for password reset tests. New tests cover:

- `POST /api/auth/forgot-password` — unknown email returns 200, known email generates token
- `POST /api/auth/reset-password` — valid token resets password and revokes sessions, expired token returns 400, already-used token returns 400

---

## Out of scope

- Password strength meter (frontend)
- Email notification when password is changed (separate email)
- Admin ability to force-reset a user's password
- Session management UI (separate spec)
