# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add forgot-password / reset-password flow and replace the Resend email SDK with Gmail SMTP via nodemailer so emails reach any address.

**Architecture:** Five tasks in sequence: (1) swap email service, (2) DB schema, (3) API logic + tests, (4) web pages, (5) mobile link. Tasks 1–2 have no external test gate (email is a side effect, schema has no logic); Task 3 is the core TDD task; Tasks 4–5 are UI-only.

**Tech Stack:** Express + Prisma + PostgreSQL + nodemailer (Gmail SMTP) | React + TanStack Router | React Native + Expo

## Global Constraints

- Monorepo managed with pnpm workspaces. Never run bare `npm`/`yarn`. Use `pnpm --filter <pkg> <cmd>`.
- Package names: `@mh-datapedia/api`, `@mh-datapedia/shared`, `@mh-datapedia/web`, `@mh-datapedia/mobile`.
- Test runner: Vitest (`pnpm test` at repo root runs `apps/api` tests only). Test files live in `apps/api/tests/`.
- TypeScript strict mode. Run `pnpm typecheck` to verify.
- Never commit `.env` or `.env.test`. Secrets are set via `fly secrets set`.
- Forgot-password endpoint always returns 200 regardless of whether the email is registered — never reveal existence.
- Token expiry check must be fail-closed: `if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date())`.
- Reset password revokes ALL refresh tokens for the user (kicks all sessions).
- `NODE_ENV === 'test'` → email functions return immediately without sending.

---

### Task 1: Replace Resend with Gmail SMTP (nodemailer)

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/services/email.service.ts`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces:
  - `sendVerificationEmail(to: string, token: string): Promise<void>` — same signature as before
  - `sendPasswordResetEmail(to: string, token: string): Promise<void>` — new export

- [ ] **Step 1: Install nodemailer**

From the repo root:
```bash
pnpm --filter @mh-datapedia/api add nodemailer
pnpm --filter @mh-datapedia/api add -D @types/nodemailer
```

- [ ] **Step 2: Update `apps/api/src/config/env.ts`**

Remove `RESEND_API_KEY`, add `GMAIL_USER` and `GMAIL_APP_PASSWORD`:

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  GMAIL_USER: z.string().default(''),
  GMAIL_APP_PASSWORD: z.string().default(''),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
```

- [ ] **Step 3: Rewrite `apps/api/src/services/email.service.ts`**

```typescript
import nodemailer from 'nodemailer';
import { env } from '../config/env';

const isTest = env.NODE_ENV === 'test';
let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  if (isTest) return;
  const link = `https://mh-datapedia-web.fly.dev/verify-email?token=${token}`;
  await getTransporter().sendMail({
    from: `"MH Datapedia" <${env.GMAIL_USER}>`,
    to,
    subject: 'Verify your MH Datapedia account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0c0a09;color:#fafaf9;border-radius:8px;">
        <h1 style="color:#2f9e8f;font-size:20px;margin-bottom:16px;">MH Datapedia</h1>
        <p style="margin-bottom:24px;">Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${link}" style="display:inline-block;background:#2f9e8f;color:#fafaf9;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify Email</a>
        <p style="margin-top:24px;font-size:12px;color:#78716c;">If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  if (isTest) return;
  const link = `https://mh-datapedia-web.fly.dev/reset-password?token=${token}`;
  await getTransporter().sendMail({
    from: `"MH Datapedia" <${env.GMAIL_USER}>`,
    to,
    subject: 'Reset your MH Datapedia password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0c0a09;color:#fafaf9;border-radius:8px;">
        <h1 style="color:#2f9e8f;font-size:20px;margin-bottom:16px;">MH Datapedia</h1>
        <p style="margin-bottom:24px;">Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#2f9e8f;color:#fafaf9;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Reset Password</a>
        <p style="margin-top:24px;font-size:12px;color:#78716c;">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 4: Update `.github/workflows/deploy.yml` test env block**

Find the `Create test env file` step. Replace the `printf 'RESEND_API_KEY=\n'` line with two new lines. The block should look like this after the change:

```yaml
      - name: Create test env file
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
        run: |
          printf 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mh_datapedia_test\n' > apps/api/.env.test
          printf 'JWT_SECRET=%s\n' "$JWT_SECRET" >> apps/api/.env.test
          printf 'JWT_REFRESH_SECRET=%s\n' "$JWT_REFRESH_SECRET" >> apps/api/.env.test
          printf 'NODE_ENV=test\n' >> apps/api/.env.test
          printf 'PORT=3002\n' >> apps/api/.env.test
          printf 'CORS_ORIGIN=http://localhost:5173\n' >> apps/api/.env.test
          printf 'GMAIL_USER=\n' >> apps/api/.env.test
          printf 'GMAIL_APP_PASSWORD=\n' >> apps/api/.env.test
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/services/email.service.ts .github/workflows/deploy.yml pnpm-lock.yaml apps/api/package.json
git commit -m "feat(api): replace Resend with nodemailer/Gmail SMTP"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260706000000_add_password_reset/migration.sql`

**Interfaces:**
- Produces: `User.resetPasswordToken: String? @unique` and `User.resetPasswordTokenExpiry: DateTime?` fields available in Prisma client

- [ ] **Step 1: Add fields to `apps/api/prisma/schema.prisma`**

In the `model User` block, add two lines after `verifyEmailTokenExpiry DateTime?`:

```prisma
  resetPasswordToken       String?   @unique
  resetPasswordTokenExpiry DateTime?
```

The User model block should now include (among other fields):
```prisma
  emailVerified          Boolean   @default(false)
  verifyEmailToken       String?   @unique
  verifyEmailTokenExpiry DateTime?
  resetPasswordToken       String?   @unique
  resetPasswordTokenExpiry DateTime?
```

- [ ] **Step 2: Create the migration file**

Create directory `apps/api/prisma/migrations/20260706000000_add_password_reset/` and write `migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN "resetPasswordToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetPasswordTokenExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm --filter @mh-datapedia/api exec prisma generate
```

Expected: output ends with `✔ Generated Prisma Client`.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): add resetPasswordToken fields to User schema"
```

---

### Task 3: Shared types + auth service + endpoints + tests

**Files:**
- Modify: `packages/shared/src/schemas/auth.schema.ts`
- Modify: `apps/api/src/services/auth.service.ts`
- Modify: `apps/api/src/middleware/rateLimiter.ts`
- Modify: `apps/api/src/routes/auth.router.ts`
- Modify: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes (from Task 1): `sendPasswordResetEmail(to: string, token: string): Promise<void>`
- Consumes (from Task 2): `User.resetPasswordToken`, `User.resetPasswordTokenExpiry`
- Produces:
  - `forgotPassword(email: string): Promise<void>` on auth service
  - `resetPassword(token: string, password: string): Promise<void>` on auth service
  - `POST /api/auth/forgot-password` endpoint
  - `POST /api/auth/reset-password` endpoint

- [ ] **Step 1: Write failing tests in `apps/api/tests/auth.test.ts`**

Add a new `describe` block at the end of the file (before the final `afterAll` or after all existing describes):

```typescript
describe('POST /api/auth/forgot-password + POST /api/auth/reset-password', () => {
  const resetEmail = 'reset@example.com';
  const resetUsername = 'resetuser';
  const originalPassword = 'original123';
  const newPassword = 'newpassword456';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: resetEmail, username: resetUsername, password: originalPassword });
    await prisma.user.update({
      where: { email: resetEmail },
      data: { emailVerified: true, verifyEmailToken: null, verifyEmailTokenExpiry: null },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: resetEmail } });
  });

  it('forgot-password returns 200 for registered email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: resetEmail });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If that email exists');
  });

  it('forgot-password returns 200 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If that email exists');
  });

  it('forgot-password generates a token in the database', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true, resetPasswordTokenExpiry: true },
    });
    expect(user?.resetPasswordToken).not.toBeNull();
    expect(user?.resetPasswordTokenExpiry).not.toBeNull();
  });

  it('reset-password with valid token changes password and revokes sessions', async () => {
    // Get a fresh token
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true },
    });
    const token = user!.resetPasswordToken!;

    // Create a session to verify it gets revoked
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: originalPassword });
    expect(loginRes.status).toBe(200);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPassword });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Password reset successfully');

    // Can now log in with new password
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: newPassword });
    expect(newLoginRes.status).toBe(200);

    // Old password no longer works
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: originalPassword });
    expect(oldLoginRes.status).toBe(401);

    // Sessions were revoked — verify no refresh tokens remain
    const tokens = await prisma.refreshToken.findMany({
      where: { user: { email: resetEmail } },
    });
    expect(tokens).toHaveLength(0);
  });

  it('reset-password with invalid token returns 400 INVALID_TOKEN', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'notarealtoken', password: newPassword });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('reset-password with expired token returns 400 INVALID_TOKEN', async () => {
    // Generate a token then manually set its expiry to the past
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true },
    });
    const token = user!.resetPasswordToken!;
    await prisma.user.update({
      where: { email: resetEmail },
      data: { resetPasswordTokenExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPassword });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('reset-password token can only be used once', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true },
    });
    const token = user!.resetPasswordToken!;

    // First use
    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'yetanother789' });
    expect(first.status).toBe(200);

    // Second use — token is already cleared
    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'yetanother789' });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('INVALID_TOKEN');
  });
});
```

Also add `'reset@example.com'` to the `afterAll` cleanup at the top of the file:
```typescript
afterAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: 'authtest' } } });
  await prisma.user.deleteMany({ where: { email: 'verify@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'reset@example.com' } });
  await prisma.$disconnect();
});
```

(The `afterAll` inside the new describe block handles the cleanup for its email, but adding it to the top-level cleanup is belt-and-suspenders.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- --testPathPattern=auth
```

Expected: multiple failures — `Cannot find module`, route not found (404), etc.

- [ ] **Step 3: Add schemas to `packages/shared/src/schemas/auth.schema.ts`**

Append to the bottom of the file:

```typescript
export const ForgotPasswordSchema = z.object({ email: z.string().email() });
export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});
export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
```

- [ ] **Step 4: Build shared**

```bash
pnpm --filter @mh-datapedia/shared build
```

- [ ] **Step 5: Add `forgotPasswordLimiter` to `apps/api/src/middleware/rateLimiter.ts`**

Append to the bottom of the file:

```typescript
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
  skip: () => isTest,
});
```

- [ ] **Step 6: Add `forgotPassword` and `resetPassword` to `apps/api/src/services/auth.service.ts`**

At the top of the file, add `sendPasswordResetEmail` to the import:

```typescript
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service';
```

Add this constant near the other TTL constants (around line 15):

```typescript
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
```

Append both functions to the bottom of the file:

```typescript
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const resetPasswordToken = randomBytes(32).toString('hex');
  const resetPasswordTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken, resetPasswordTokenExpiry },
  });

  try {
    await sendPasswordResetEmail(email, resetPasswordToken);
  } catch (err) {
    console.error('[forgotPassword] Failed to send reset email:', err);
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { resetPasswordToken: token },
    select: { id: true, resetPasswordTokenExpiry: true },
  });

  if (!user) throw new AppError(400, 'Invalid or expired reset link', 'INVALID_TOKEN');
  if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
    throw new AppError(400, 'Invalid or expired reset link', 'INVALID_TOKEN');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetPasswordToken: null, resetPasswordTokenExpiry: null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);
}
```

- [ ] **Step 7: Add endpoints to `apps/api/src/routes/auth.router.ts`**

Update the import at the top to include the new limiter and schemas:

```typescript
import { authLimiter, resendLimiter, forgotPasswordLimiter } from '../middleware/rateLimiter';
import { RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema } from '@mh-datapedia/shared';
```

Append both endpoints before `export default router;`:

```typescript
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(ForgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.forgotPassword(req.body.email);
      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/reset-password',
  validate(ResetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      res.json({ message: 'Password reset successfully.' });
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
pnpm test -- --testPathPattern=auth
```

Expected: all tests PASS.

- [ ] **Step 9: Run full test suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/schemas/auth.schema.ts \
        apps/api/src/services/auth.service.ts \
        apps/api/src/middleware/rateLimiter.ts \
        apps/api/src/routes/auth.router.ts \
        apps/api/tests/auth.test.ts
git commit -m "feat(api): add forgot-password and reset-password endpoints"
```

---

### Task 4: Web pages — /forgot-password, /reset-password, login form link

**Files:**
- Create: `apps/web/src/routes/forgot-password.tsx`
- Create: `apps/web/src/routes/reset-password.tsx`
- Modify: `apps/web/src/components/auth/LoginForm.tsx`
- Modify: `apps/web/src/components/auth/LoginModal.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` from Task 3
- Consumes: `apiPost` from `../../lib/api` (same pattern as VerificationBanner.tsx)
- Consumes: `useLoginModal` from `../../context/LoginModalContext` (provides `close()`)

- [ ] **Step 1: Create `apps/web/src/routes/forgot-password.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { apiPost } from '../lib/api';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost('/api/auth/forgot-password', { email });
    } catch {
      // always show success — don't reveal whether email is registered
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-2">Forgot password</h1>

        {submitted ? (
          <div className="text-center mt-4">
            <p className="text-stone-400 mb-6">
              If that email is registered, you'll receive a reset link shortly. Check your inbox.
            </p>
            <Link to="/" className="text-teal-500 hover:text-teal-400 text-sm">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <p className="text-stone-400 text-sm">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="fp-email" className="block text-sm font-medium text-stone-300 mb-1">
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-stone-50 px-4 py-2 rounded font-medium transition-colors"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <div className="text-center">
              <Link to="/" className="text-stone-500 hover:text-stone-400 text-sm">
                Back to home
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/routes/reset-password.tsx`**

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { apiPost, ApiError } from '../lib/api';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search) => ({ token: search.token as string | undefined }),
});

type Status = 'idle' | 'loading' | 'success' | 'error';

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => navigate({ to: '/' }), 3000);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 text-center border border-stone-800">
          <h1 className="text-2xl font-bold text-stone-50 mb-4">Invalid link</h1>
          <p className="text-stone-400 mb-6">This reset link is missing a token.</p>
          <Link to="/forgot-password" className="text-teal-500 hover:text-teal-400 text-sm">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      await apiPost('/api/auth/reset-password', { token, password });
      setStatus('success');
      setMessage('Password reset — redirecting to home in 3 seconds.');
    } catch (err) {
      setStatus('error');
      const code = (err instanceof ApiError ? (err.body as { code?: string })?.code : undefined);
      if (code === 'INVALID_TOKEN') {
        setMessage('This link has expired or has already been used.');
      } else {
        setMessage('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-2">Reset password</h1>

        {status === 'success' ? (
          <div className="text-center mt-4">
            <p className="text-stone-400">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label htmlFor="rp-password" className="block text-sm font-medium text-stone-300 mb-1">
                New password
              </label>
              <input
                id="rp-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label htmlFor="rp-confirm" className="block text-sm font-medium text-stone-300 mb-1">
                Confirm password
              </label>
              <input
                id="rp-confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600"
              />
            </div>
            {status === 'error' && <p className="text-red-400 text-sm">{message}</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-stone-50 px-4 py-2 rounded font-medium transition-colors"
            >
              {status === 'loading' ? 'Resetting…' : 'Reset password'}
            </button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-stone-500 hover:text-stone-400 text-sm">
                Request a new link
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `apps/web/src/components/auth/LoginForm.tsx`**

Add `onForgotPassword?: () => void` prop and a "Forgot password?" link below the submit button.

The updated file:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema } from '@mh-datapedia/shared';
import type { Login } from '@mh-datapedia/shared';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ApiError } from '../../lib/api';

interface LoginFormProps {
  onSuccess: () => void;
  onForgotPassword?: () => void;
}

export function LoginForm({ onSuccess, onForgotPassword }: LoginFormProps) {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Login>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = async (data: Login) => {
    try {
      await login(data.email, data.password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('root', { message: 'Invalid email or password.' });
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="login-email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        id="login-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      {errors.root && <p className="text-red-400 text-sm">{errors.root.message}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      {onForgotPassword && (
        <div className="text-center">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-stone-500 hover:text-stone-400 text-sm transition-colors"
          >
            Forgot password?
          </button>
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Update `apps/web/src/components/auth/LoginModal.tsx`**

Add `useNavigate` import and pass `onForgotPassword` to `LoginForm`:

```tsx
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useLoginModal } from '../../context/LoginModalContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function LoginModal() {
  const { isOpen, mode, close, switchMode } = useLoginModal();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isLogin = mode === 'login';

  function handleForgotPassword() {
    close();
    navigate({ to: '/forgot-password' });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="mh-panel mh-panel--accent mh-glass relative w-full"
        style={{ '--mh-cut': '18px', maxWidth: 400, padding: '30px 28px' } as React.CSSProperties}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3.5 right-4 text-stone-500 hover:text-stone-200 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="mh-section-head text-sm mb-2">
          {isLogin ? 'Hunter Login' : 'Create Account'}
        </div>
        <p className="text-stone-400 text-sm mb-6">
          {isLogin
            ? 'Sign in to save favorites and write strategies.'
            : 'Join to save favorites and contribute strategies.'}
        </p>

        {isLogin
          ? <LoginForm onSuccess={close} onForgotPassword={handleForgotPassword} />
          : <RegisterForm onSuccess={close} />
        }

        <p className="mt-5 text-center text-stone-500 text-sm">
          {isLogin ? (
            <>
              No account?{' '}
              <button
                onClick={() => switchMode('register')}
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/forgot-password.tsx \
        apps/web/src/routes/reset-password.tsx \
        apps/web/src/components/auth/LoginForm.tsx \
        apps/web/src/components/auth/LoginModal.tsx
git commit -m "feat(web): add forgot-password and reset-password pages"
```

---

### Task 5: Mobile — "Forgot password?" link in LoginSheet

**Files:**
- Modify: `apps/mobile/src/components/auth/LoginSheet.tsx`

**Interfaces:**
- Consumes: `Linking` from `react-native` (already in RN stdlib, no install needed)

- [ ] **Step 1: Update `apps/mobile/src/components/auth/LoginSheet.tsx`**

Add `Linking` to the react-native import at the top:

```typescript
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Linking } from 'react-native';
```

Change `snapPoints` from `['44%']` to `['52%']` to fit the extra link:

```typescript
snapPoints={['52%']}
```

Add a "Forgot password?" pressable below the Register link (after the existing `<Pressable onPress={onSwitchToRegister} ...>` block):

```tsx
<Pressable
  onPress={() => Linking.openURL('https://mh-datapedia-web.fly.dev/forgot-password')}
  style={styles.forgotLink}
>
  <Text style={styles.forgotText}>Forgot password?</Text>
</Pressable>
```

Add styles for the new elements at the bottom of the `StyleSheet.create({})` call:

```typescript
  forgotLink: { alignItems: 'center', paddingVertical: 2 },
  forgotText: { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/auth/LoginSheet.tsx
git commit -m "feat(mobile): add Forgot password link to login sheet"
```

---

## Post-implementation: set Fly secrets

After CI deploys, set the Gmail credentials on Fly.io:

```bash
fly secrets set GMAIL_USER=<your-gmail-address> GMAIL_APP_PASSWORD=<your-app-password> -a mh-datapedia-api
```

To generate a Gmail App Password:
1. Go to myaccount.google.com → Security → 2-Step Verification (must be enabled)
2. Under "2-Step Verification", scroll to "App passwords"
3. Create a new app password (name it "MH Datapedia")
4. Copy the 16-character password — use it as `GMAIL_APP_PASSWORD`
