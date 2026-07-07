# Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a username dropdown to the web navbar with Sessions, Change Password, and Logout actions, plus a change-password modal backed by a new API endpoint.

**Architecture:** Three tasks in dependency order — API first (change-password endpoint + shared schema), then the web modal + hook, then the navbar dropdown that wires them together. No new pages; everything lives in existing files plus two new files.

**Tech Stack:** Express + Prisma + bcrypt (API); React + TanStack Query + existing `Modal` component (web); Zod (shared schema)

## Global Constraints

- Never commit `.env` or `.env.test`
- All tests pass: `pnpm test`; typecheck clean: `pnpm typecheck`
- No third-party libraries added
- `ChangePasswordSchema`: `{ currentPassword: z.string().min(1), newPassword: z.string().min(8) }`
- Endpoint: `POST /api/auth/change-password`, auth required, returns `200 { message: 'Password updated.' }` or `400 { error: 'INVALID_PASSWORD' }`
- Dropdown closes on outside click and `Escape`; modal closes on success

---

### Task 1: API — change-password endpoint + shared schema

**Files:**
- Modify: `packages/shared/src/schemas/auth.schema.ts`
- Modify: `apps/api/src/services/auth.service.ts`
- Modify: `apps/api/src/routes/auth.router.ts`
- Test: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Produces: `changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>` (throws `AppError(400, 'Invalid current password', 'INVALID_PASSWORD')` on mismatch)
- Produces: `POST /api/auth/change-password` (body: `{ currentPassword, newPassword }`)
- Produces: `ChangePasswordSchema`, `ChangePassword` type from `@mh-datapedia/shared`

- [ ] **Step 1: Add `ChangePasswordSchema` to shared package**

In `packages/shared/src/schemas/auth.schema.ts`, append after the `SessionSchema` block:

```typescript
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
```

- [ ] **Step 2: Build shared package**

```bash
pnpm --filter @mh-datapedia/shared build
```

Expected: no errors.

- [ ] **Step 3: Write the failing tests**

In `apps/api/tests/auth.test.ts`, add to the `afterAll` cleanup:

```typescript
await prisma.user.deleteMany({ where: { email: 'changepw@example.com' } });
```

Then append this describe block at the end of the file:

```typescript
describe('POST /api/auth/change-password', () => {
  let accessToken: string;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'changepw@example.com', username: 'changepw', password: 'oldpassword1' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'changepw@example.com', password: 'oldpassword1' });
    await prisma.user.update({
      where: { email: 'changepw@example.com' },
      data: { emailVerified: true },
    });
    accessToken = loginRes.body.accessToken;
  });

  it('returns 200 with correct current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'oldpassword1', newPassword: 'newpassword1' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password updated.');
  });

  it('returns 400 INVALID_PASSWORD with wrong current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PASSWORD');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'oldpassword1', newPassword: 'newpassword1' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pnpm test
```

Expected: the three new change-password tests fail with 404 (route not yet defined).

- [ ] **Step 5: Add `changePassword` to auth service**

In `apps/api/src/services/auth.service.ts`, add this export at the end of the file:

```typescript
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(400, 'Invalid current password', 'INVALID_PASSWORD');
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
```

- [ ] **Step 6: Add the route to auth router**

In `apps/api/src/routes/auth.router.ts`, add the import for `ChangePasswordSchema` to the existing import line:

```typescript
import { RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema } from '@mh-datapedia/shared';
```

Then add the route before `export default router;`:

```typescript
router.post(
  '/change-password',
  authenticate,
  validate(ChangePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.changePassword(
        req.user!.id,
        req.body.currentPassword,
        req.body.newPassword,
      );
      res.json({ message: 'Password updated.' });
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pnpm test
```

Expected: all tests pass including the three new change-password tests.

- [ ] **Step 8: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/schemas/auth.schema.ts packages/shared/dist apps/api/src/services/auth.service.ts apps/api/src/routes/auth.router.ts apps/api/tests/auth.test.ts
git commit -m "feat(api): add change-password endpoint"
```

---

### Task 2: Web — useChangePassword hook + ChangePasswordModal

**Files:**
- Create: `apps/web/src/hooks/useChangePassword.ts`
- Create: `apps/web/src/components/account/ChangePasswordModal.tsx`

**Interfaces:**
- Consumes: `ChangePassword` type from `@mh-datapedia/shared`; `apiPost` from `apps/web/src/lib/api.ts`; `Modal` from `apps/web/src/components/ui/Modal.tsx`
- Produces: `useChangePassword()` — TanStack Query `useMutation` returning `{ mutate, isPending, isError, error }`
- Produces: `<ChangePasswordModal open={boolean} onClose={() => void} />` — standalone modal component; closes itself on success

- [ ] **Step 1: Create `useChangePassword.ts`**

Create `apps/web/src/hooks/useChangePassword.ts`:

```typescript
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { ChangePassword } from '@mh-datapedia/shared';

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePassword) =>
      apiPost<{ message: string }>('/api/auth/change-password', data),
  });
}
```

- [ ] **Step 2: Create `ChangePasswordModal.tsx`**

Create `apps/web/src/components/account/ChangePasswordModal.tsx`:

```typescript
import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useChangePassword } from '../../hooks/useChangePassword';
import { ApiError } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState('');
  const changePassword = useChangePassword();

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setClientError('');
    changePassword.reset();
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setClientError('');
    if (newPassword !== confirmPassword) {
      setClientError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setClientError('New password must be at least 8 characters.');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      handleClose();
    } catch {
      // error displayed below
    }
  }

  const serverError =
    changePassword.error instanceof ApiError &&
    (changePassword.error.body as { code?: string })?.code === 'INVALID_PASSWORD'
      ? 'Current password is incorrect.'
      : changePassword.isError
        ? 'Something went wrong. Please try again.'
        : '';

  const error = clientError || serverError;

  return (
    <Modal open={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-stone-400 text-sm mb-1">Current Password</label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-stone-400 text-sm mb-1">New Password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-stone-400 text-sm mb-1">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Updating…' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useChangePassword.ts apps/web/src/components/account/ChangePasswordModal.tsx
git commit -m "feat(web): add ChangePasswordModal and useChangePassword hook"
```

---

### Task 3: Web — Navbar username dropdown

**Files:**
- Modify: `apps/web/src/components/layout/Navbar.tsx`

**Interfaces:**
- Consumes: `<ChangePasswordModal>` from Task 2
- Current Navbar authenticated section has: username span, role badge(s), Sessions link, Logout button — replace Sessions link with dropdown trigger

- [ ] **Step 1: Rewrite Navbar.tsx**

Replace the entire contents of `apps/web/src/components/layout/Navbar.tsx` with:

```typescript
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useLoginModal } from '../../context/LoginModalContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ChangePasswordModal } from '../account/ChangePasswordModal';

export function Navbar() {
  const { user, logout } = useAuth();
  const { open } = useLoginModal();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate({ to: '/' });
  };

  return (
    <>
      <nav className="bg-stone-950 border-b border-stone-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="font-display font-bold text-lg tracking-wide uppercase text-stone-50 hover:text-stone-50"
              >
                <span className="text-accent">MH</span> Datapedia
              </Link>
              <Link
                to="/monsters"
                className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
                activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
              >
                Monsters
              </Link>
              {user && (
                <Link
                  to="/favorites"
                  className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
                  activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
                >
                  Favorites
                </Link>
              )}
              {user && ['HELPER', 'ADMIN', 'MASTER'].includes(user.role) && (
                <Link
                  to="/admin"
                  className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
                  activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
                >
                  Admin
                </Link>
              )}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {user.role === 'HELPER' && (
                    <Badge className="bg-transparent text-blue-400 border border-blue-800 font-mono text-[11px] hidden sm:inline-flex">
                      HELPER
                    </Badge>
                  )}
                  {user.role === 'ADMIN' && (
                    <Badge className="bg-transparent text-accent border border-accent font-mono text-[11px] hidden sm:inline-flex">
                      ADMIN
                    </Badge>
                  )}
                  {user.role === 'MASTER' && (
                    <Badge className="bg-transparent text-yellow-400 border border-yellow-700 font-mono text-[11px] hidden sm:inline-flex">
                      MASTER
                    </Badge>
                  )}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen((v) => !v)}
                      className="flex items-center gap-1 text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm hidden sm:flex"
                    >
                      {user.username}
                      <span className="text-xs leading-none">▾</span>
                    </button>
                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-44 bg-stone-900 border border-stone-700 rounded-md shadow-lg z-50">
                        <Link
                          to="/account/sessions"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-50 transition-colors"
                        >
                          Sessions
                        </Link>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setChangePasswordOpen(true);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-50 transition-colors"
                        >
                          Change Password
                        </button>
                        <div className="border-t border-stone-700" />
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-stone-800 hover:text-red-300 transition-colors"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="sm:hidden" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => open('login')}>Login</Button>
                  <Button variant="primary" size="sm" onClick={() => open('register')}>Register</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/Navbar.tsx
git commit -m "feat(web): replace Sessions navbar link with username dropdown"
```
