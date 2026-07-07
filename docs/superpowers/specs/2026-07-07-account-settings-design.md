# Account Settings Design

**Date:** 2026-07-07
**Scope:** `apps/api` + `apps/web`

---

## Goal

Replace the raw "Sessions" navbar link with a username dropdown that gives authenticated users quick access to account actions. Add a change-password modal accessible from that dropdown.

---

## Out of scope

- Profile editing (username, email)
- Delete account
- 2FA (separate phase)
- Mobile app changes

---

## Navbar Dropdown

Replace the current `<Link to="/account/sessions">Sessions</Link>` with a dropdown triggered by clicking the username. The dropdown contains three items:

- **Sessions** — navigates to `/account/sessions`
- **Change Password** — opens the change-password modal
- **Logout** — existing logout behaviour

### Behaviour

- Click username → dropdown opens
- Click anywhere outside → dropdown closes
- Dropdown is positioned below the username, right-aligned
- Keyboard: `Escape` closes it

### Styling

Consistent with existing dark stone theme:
- Dropdown container: `bg-stone-900 border border-stone-700 rounded-md shadow-lg` min-w of ~160px
- Items: `text-stone-300 hover:bg-stone-800 hover:text-stone-50 px-4 py-2 text-sm w-full text-left`
- Logout item: `text-red-400 hover:bg-stone-800 hover:text-red-300`
- Divider between Sessions/Change Password and Logout: `border-t border-stone-700`
- Username trigger: existing styling + a small chevron icon (▾) to hint it's interactive

---

## Change Password Modal

Opens from the dropdown. Uses the existing `Modal` component at `apps/web/src/components/ui/Modal.tsx`.

### Fields

1. **Current Password** — `<input type="password" />`
2. **New Password** — `<input type="password" />`
3. **Confirm New Password** — `<input type="password" />`

### Validation (client-side)

- All fields required
- New Password ≥ 8 characters
- Confirm must match New Password — show inline error if not

### Submit flow

1. POST `{ currentPassword, newPassword }` to `POST /api/auth/change-password`
2. Success → close modal (no toast needed — the form disappearing is sufficient feedback)
3. Error `INVALID_PASSWORD` → show inline error: "Current password is incorrect"
4. Other errors → generic "Something went wrong"

### Styling

- Title: "Change Password"
- Submit button: primary variant, label "Update Password", shows spinner while pending
- Cancel button: ghost variant

---

## API

### `POST /api/auth/change-password`

**Auth required** (`authenticate` middleware).

**Request body:**
```json
{ "currentPassword": "...", "newPassword": "..." }
```

**Logic:**
1. Fetch user by `req.user.userId` including `passwordHash`
2. `bcrypt.compare(currentPassword, user.passwordHash)` — if false → `400 { error: 'INVALID_PASSWORD' }`
3. `bcrypt.hash(newPassword, SALT_ROUNDS)` → update `user.passwordHash` in DB
4. Return `200 { message: 'Password updated.' }`

**No token rotation** — existing sessions stay alive after a password change.

**New Zod schema** in `packages/shared/src/schemas/auth.schema.ts`:
```typescript
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
```

---

## Web files

| File | Action |
|---|---|
| `apps/web/src/components/layout/Navbar.tsx` | Replace Sessions link with username dropdown |
| `apps/web/src/components/account/ChangePasswordModal.tsx` | New modal component |
| `apps/web/src/hooks/useChangePassword.ts` | New `useMutation` for POST /api/auth/change-password |
| `packages/shared/src/schemas/auth.schema.ts` | Add `ChangePasswordSchema` + `ChangePassword` type |
| `apps/api/src/services/auth.service.ts` | Add `changePassword()` function |
| `apps/api/src/routes/auth.router.ts` | Add `POST /change-password` route |
| `apps/api/tests/auth.test.ts` | Add change-password integration tests |

---

## Testing

New tests in `apps/api/tests/auth.test.ts`:

- `POST /api/auth/change-password` returns 200 with correct current password
- `POST /api/auth/change-password` returns 400 `INVALID_PASSWORD` with wrong current password
- `POST /api/auth/change-password` returns 401 without auth
