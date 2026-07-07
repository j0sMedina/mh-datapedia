# Security Phase 2d — TOTP Two-Factor Authentication Design

**Date:** 2026-07-07
**Scope:** `apps/api` + `apps/web` + `packages/shared`

---

## Goal

Let users opt into TOTP-based 2FA (Google Authenticator, Authy, etc.). When enabled, every login requires a valid 6-digit TOTP code or a one-time backup code after the password check passes.

---

## Out of scope

- SMS or email OTP
- "Remember this device" / trusted device cookies
- Mobile app 2FA UI (deferred)
- Recovery via admin bypass

---

## Database

Add to `User` model in `apps/api/prisma/schema.prisma`:

```prisma
totpSecret    String?
totpEnabled   Boolean  @default(false)
backupCodes   String[]
```

- `totpSecret` — base32 TOTP secret, stored plaintext. Saved on setup, cleared on disable.
- `totpEnabled` — false until the user confirms setup with a valid code.
- `backupCodes` — array of bcrypt hashes of the 10 one-time backup codes. Cleared on disable.

New migration: `apps/api/prisma/migrations/20260707000001_add_totp_fields/migration.sql`

```sql
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "backupCodes" TEXT[] NOT NULL DEFAULT '{}';
```

---

## Libraries

- `otplib` — TOTP generation + verification (no transitive deps)
- `qrcode` — generates a base64 PNG data URL from the OTP auth URI

Install in `apps/api`:
```bash
pnpm --filter @mh-datapedia/api add otplib qrcode
pnpm --filter @mh-datapedia/api add -D @types/qrcode
```

---

## API

All new endpoints are under `POST|GET /api/auth/totp/...`.

### `GET /api/auth/totp/setup`

Auth required. Generates a new TOTP secret, saves it to `user.totpSecret` (replacing any existing one — `totpEnabled` stays unchanged), returns the QR code and secret for display.

Response:
```json
{
  "qrCodeDataUrl": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

The `otpAuthUrl` used to generate the QR code:
```
otpauth://totp/MH%20Datapedia:<email>?secret=<secret>&issuer=MH%20Datapedia
```

### `POST /api/auth/totp/enable`

Auth required. Verifies the 6-digit TOTP code against `user.totpSecret`. If valid:
1. Sets `totpEnabled = true`
2. Generates 10 random backup codes (`randomBytes(5).toString('hex')` → 10-char hex string per code)
3. Hashes each with `bcrypt.hash(code, SALT_ROUNDS)`
4. Saves hashes to `user.backupCodes`
5. Returns plaintext codes (shown once)

Body: `{ code: string }` (6 digits)

Response: `{ backupCodes: string[] }` (10 plaintext codes, shown once to the user)

Error: `400 { code: 'INVALID_CODE' }` if the TOTP code is wrong or no secret exists.

### `POST /api/auth/totp/disable`

Auth required. Verifies `{ password }` against `user.passwordHash`. If valid:
1. Sets `totpEnabled = false`
2. Clears `totpSecret` to `null`
3. Clears `backupCodes` to `[]`

Body: `{ password: string }`
Response: `200 { message: 'Two-factor authentication disabled.' }`
Error: `400 { code: 'INVALID_PASSWORD' }` if password is wrong.

### `POST /api/auth/totp/verify` (login step 2)

No auth required. Used after login returns `mfaRequired: true`.

Body: `{ mfaPendingToken: string, code: string }`

The `code` field accepts either:
- A 6-digit TOTP code — verified with `otplib`
- A 10-char backup code — compared with `bcrypt.compare` against each stored hash; the matching hash is deleted from `user.backupCodes` on success

The `mfaPendingToken` is a short-lived JWT signed with `JWT_SECRET`, payload `{ sub: userId, mfa: true }`, expiry 5 minutes. Verify it with `jwt.verify`; if expired or invalid → `401 { code: 'UNAUTHORIZED' }`.

On success: create a full session (refresh token + access token), set the `refresh_token` cookie, return `{ user, accessToken, expiresIn }`.

Error: `400 { code: 'INVALID_CODE' }` if neither TOTP nor backup code matches.

### Modified: `POST /api/auth/login`

After the existing password + lockout checks, if `user.totpEnabled`:
1. Do **not** create a refresh token
2. Sign a 5-minute JWT: `jwt.sign({ sub: user.id, mfa: true }, env.JWT_SECRET, { expiresIn: 300 })`
3. Return `{ mfaRequired: true, mfaPendingToken: <token> }` (no cookie set, no accessToken)

If `totpEnabled` is false, the existing login flow continues unchanged.

---

## Shared types

Add to `packages/shared/src/schemas/auth.schema.ts`:

```typescript
export const TotpVerifySchema = z.object({
  mfaPendingToken: z.string().min(1),
  code: z.string().min(1),
});
export type TotpVerify = z.infer<typeof TotpVerifySchema>;

export const TotpEnableSchema = z.object({ code: z.string().length(6) });
export type TotpEnable = z.infer<typeof TotpEnableSchema>;

export const TotpDisableSchema = z.object({ password: z.string().min(1) });
export type TotpDisable = z.infer<typeof TotpDisableSchema>;
```

Also add `totpEnabled: z.boolean()` to `UserSchema`.

---

## Web

### `AuthContext` changes

`login()` updated to return `{ mfaRequired: true } | void`:

```typescript
async function login(email: string, password: string): Promise<{ mfaRequired: true } | void> {
  const data = await apiPost<{ user?: User; accessToken?: string; mfaRequired?: boolean; mfaPendingToken?: string }>(
    '/api/auth/login', { email, password }
  );
  if (data.mfaRequired && data.mfaPendingToken) {
    sessionStorage.setItem('mfaPendingToken', data.mfaPendingToken);
    return { mfaRequired: true };
  }
  setToken(data.accessToken!);
  setUser(data.user!);
}
```

`LoginForm` checks the return value and navigates to `/verify-2fa` if `mfaRequired`.

### `/verify-2fa` page

**File:** `apps/web/src/routes/verify-2fa.tsx`

- No auth guard — user isn't logged in yet
- On mount: reads `mfaPendingToken` from `sessionStorage`. If missing → redirect to `/login`.
- Shows a single code input (type `text`, maxLength 10)
- Helper text: "Enter your 6-digit authenticator code, or a 10-character backup code."
- Submit: `POST /api/auth/totp/verify` with `{ mfaPendingToken, code }`
- On success: clears sessionStorage, updates AuthContext with the returned user + accessToken, navigates to `/`
- Error `INVALID_CODE` → "Invalid code. Try again."
- Error `UNAUTHORIZED` → "Session expired. Please log in again." + redirect to `/login`

### `/account/two-factor-auth` page

**File:** `apps/web/src/routes/account/two-factor-auth.tsx`

- Auth required (`beforeLoad` guard)
- Reads `user.totpEnabled` from `useAuth()`

**When disabled — setup flow:**
1. "Two-Factor Authentication" heading + description
2. "Set up" button → calls `GET /api/auth/totp/setup`
3. Shows QR code (`<img src={qrCodeDataUrl} />`) + the manual secret in a monospace code block
4. 6-digit input + "Verify and enable" button → `POST /api/auth/totp/enable`
5. On success: shows backup codes modal (list of 10 codes, one per line, copy-friendly)
6. After closing modal: page shows "enabled" state (calls `fetchUser()` to refresh)

**When enabled:**
- "Two-factor authentication is active." with a green checkmark
- "Disable" button → opens a small inline form asking for current password
- Submit → `POST /api/auth/totp/disable` → on success: `fetchUser()`, page flips to disabled state

### Navbar dropdown

Add "Two-Factor Auth" link in the dropdown, between "Change Password" and the divider:

```tsx
<Link to="/account/two-factor-auth" onClick={() => setDropdownOpen(false)}
  className="block px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-50 transition-colors">
  Two-Factor Auth
</Link>
```

### New hooks

- `apps/web/src/hooks/useTotpSetup.ts` — `useMutation` for `GET /api/auth/totp/setup` (via `apiGet`)
- `apps/web/src/hooks/useTotpEnable.ts` — `useMutation` for `POST /api/auth/totp/enable`
- `apps/web/src/hooks/useTotpDisable.ts` — `useMutation` for `POST /api/auth/totp/disable`
- `apps/web/src/hooks/useTotpVerify.ts` — `useMutation` for `POST /api/auth/totp/verify`

---

## Testing

New tests in `apps/api/tests/auth.test.ts` (or a new `apps/api/tests/totp.test.ts`):

- `GET /api/auth/totp/setup` returns qrCodeDataUrl and secret
- `POST /api/auth/totp/enable` with correct code → enables 2FA and returns 10 backup codes
- `POST /api/auth/totp/enable` with wrong code → 400 INVALID_CODE
- `POST /api/auth/totp/disable` with correct password → disables 2FA
- `POST /api/auth/totp/disable` with wrong password → 400 INVALID_PASSWORD
- `POST /api/auth/login` with 2FA user → returns `{ mfaRequired: true, mfaPendingToken }`
- `POST /api/auth/totp/verify` with valid TOTP code → returns full session
- `POST /api/auth/totp/verify` with valid backup code → returns full session and consumes the code
- `POST /api/auth/totp/verify` with invalid code → 400 INVALID_CODE
- `POST /api/auth/totp/verify` with expired/invalid mfaPendingToken → 401
