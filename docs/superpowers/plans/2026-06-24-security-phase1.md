# Security Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden MH Datapedia with a 4-tier role hierarchy, enhanced ban system, auth hardening (account lockout + token reuse detection), a full audit log, and rate limiting with client-side debounce.

**Architecture:** Backend changes build on top of existing Express + Prisma + JWT patterns. Each security feature is isolated to its own service function and writes to its own DB table. Frontend changes extend the existing React + TanStack Query + TanStack Router stack without adding new UI libraries.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Zod, React, TanStack Query, TanStack Router, Tailwind CSS. Tests use Jest + Supertest against a real test DB (no mocking). Package manager is `pnpm`. Run all commands from repo root unless noted.

## Global Constraints

- Never expose `passwordHash`, `bannedReason`, or audit metadata to non-admin roles.
- All multi-write operations (ban + role downgrade, rotate + revoke token) must use Prisma transactions.
- `MASTER` role is set via DB seed/migration only — no API or UI path to create or promote to MASTER.
- Audit log rows are append-only — never updated or deleted.
- All new Zod schemas go in `packages/shared/src/schemas/`.
- `authorize()` is hierarchy-aware: `authorize('HELPER')` passes for HELPER, ADMIN, MASTER. `authorize('ADMIN')` passes for ADMIN, MASTER. `authorize('MASTER')` passes for MASTER only.
- All new UI follows the existing stone/dark palette: `bg-stone-900/800`, `border-stone-700`, `text-stone-50/400`, `mh-panel`, `mh-section-head`, `text-accent/bg-accent`, `--mh-cut` clipped corners, Oswald font.
- The `MASTER` role cannot be set via the API — the `SetRoleSchema` only allows `USER | HELPER | ADMIN`.
- Shared package must be rebuilt after any schema change: `pnpm --filter @mh-datapedia/shared build`.
- API tests run with `pnpm --filter @mh-datapedia/api test`. They reset the test DB via `prisma migrate reset --force --skip-seed` before the suite.

---

## File Map

**Created:**
- `apps/api/tests/auth-hardening.test.ts` — lockout + token reuse tests
- `apps/api/tests/admin-scope.test.ts` — admin scope + audit log tests
- `apps/web/src/hooks/useDebounce.ts` — debounce hook
- `apps/web/src/components/ui/BannedModal.tsx` — banned screen modal

**Modified:**
- `apps/api/prisma/schema.prisma` — new Role values, new models, new ban fields
- `packages/shared/src/schemas/enums.schema.ts` — RoleSchema + AuditAction
- `packages/shared/src/index.ts` — re-export new types
- `apps/api/src/types/express.d.ts` — role type update
- `apps/api/src/lib/errors.ts` — AppError data payload
- `apps/api/src/middleware/errorHandler.ts` — spread data into response
- `apps/api/src/middleware/authorize.ts` — hierarchy-aware
- `apps/api/src/middleware/authenticate.ts` — role type update
- `apps/api/src/middleware/rateLimiter.ts` — 3 new limiters
- `apps/api/src/services/auth.service.ts` — lockout, reuse detection, BANNED details, auto-unban
- `apps/api/src/services/admin.service.ts` — scope rules, enhanced ban, audit log
- `apps/api/src/services/strategy.service.ts` — role-aware permission check
- `apps/api/src/routes/admin.router.ts` — updated schemas + audit endpoint
- `apps/api/src/routes/monsters.router.ts` — searchLimiter, HELPER access
- `apps/api/src/routes/strategies.router.ts` — strategyLimiter
- `apps/api/tests/helpers.ts` — add registerAndPromoteHelper
- `apps/web/src/lib/types.ts` — AdminUser + AuditEntry types
- `apps/web/src/context/AuthContext.tsx` — BANNED state + BannedModal render
- `apps/web/src/routes/admin.tsx` — tabs, role controls, ban modal, audit log

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `LoginAttempt`, `RevokedToken`, `AdminAction` Prisma models; `HELPER`/`MASTER` Role enum values; `bannedReason`/`bannedAt`/`bannedUntil` on User; `AuditAction` enum.

- [ ] **Step 1: Update schema.prisma**

Replace the file content at `apps/api/prisma/schema.prisma` with the additions below. Keep all existing models (`Monster`, `Strategy`, etc.) exactly as they are — only add/modify what is shown:

```prisma
// Role enum — add HELPER and MASTER
enum Role {
  USER
  HELPER
  ADMIN
  MASTER
}

// AuditAction enum — new
enum AuditAction {
  ROLE_CHANGE
  BAN
  UNBAN
}

// User model — add 3 ban fields (everything else stays the same)
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  username      String         @unique
  passwordHash  String
  role          Role           @default(USER)
  banned        Boolean        @default(false)
  bannedReason  String?
  bannedAt      DateTime?
  bannedUntil   DateTime?
  favorites     Monster[]      @relation("UserFavorites")
  strategies    Strategy[]
  refreshTokens RefreshToken[]
  actorActions  AdminAction[]  @relation("ActorActions")
  targetActions AdminAction[]  @relation("TargetActions")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// LoginAttempt model — new
model LoginAttempt {
  id        String   @id @default(cuid())
  email     String
  createdAt DateTime @default(now())

  @@index([email, createdAt])
}

// RevokedToken model — new
model RevokedToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

// AdminAction model — new
model AdminAction {
  id           String      @id @default(cuid())
  actorId      String
  actor        User        @relation("ActorActions", fields: [actorId], references: [id])
  action       AuditAction
  targetUserId String?
  targetUser   User?       @relation("TargetActions", fields: [targetUserId], references: [id])
  metadata     Json
  createdAt    DateTime    @default(now())

  @@index([actorId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm --filter @mh-datapedia/api prisma:migrate
```

When prompted for a migration name, enter: `security_phase1`

Expected: migration created and applied. Prisma Client regenerated automatically.

- [ ] **Step 3: Verify Prisma Client has new types**

```bash
pnpm --filter @mh-datapedia/api typecheck
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Bootstrap MASTER user (one-time)**

Open Prisma Studio or run a direct SQL query to promote your account to MASTER. Via psql or any DB client connected to your dev DB:

```sql
UPDATE "User" SET role = 'MASTER' WHERE email = 'your-email@example.com';
```

This is a one-time manual step. The MASTER role is never set through the API.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): security phase 1 schema — roles, ban fields, lockout, audit log"
```

---

## Task 2: Shared Package — Role & Audit Types

**Files:**
- Modify: `packages/shared/src/schemas/enums.schema.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: Task 1 (new Role values exist in DB)
- Produces: `RoleSchema` with HELPER/MASTER; `AuditActionSchema` type exported from shared

- [ ] **Step 1: Update RoleSchema**

In `packages/shared/src/schemas/enums.schema.ts`, find the `RoleSchema` and `Role` export at the bottom and replace it:

```ts
export const RoleSchema = z.enum(['USER', 'HELPER', 'ADMIN', 'MASTER']);
export type Role = z.infer<typeof RoleSchema>;

export const AuditActionSchema = z.enum(['ROLE_CHANGE', 'BAN', 'UNBAN']);
export type AuditAction = z.infer<typeof AuditActionSchema>;
```

- [ ] **Step 2: Rebuild shared package**

```bash
pnpm --filter @mh-datapedia/shared build
```

Expected: `packages/shared/dist/` updated with no TypeScript errors.

- [ ] **Step 3: Typecheck API and web**

```bash
pnpm --filter @mh-datapedia/api typecheck
pnpm --filter @mh-datapedia/web typecheck
```

Expected: type errors appear in `express.d.ts`, `authorize.ts`, and `admin.tsx` because they still reference the old `'USER' | 'ADMIN'` union — these will be fixed in later tasks. Any other errors are pre-existing.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/enums.schema.ts packages/shared/dist/
git commit -m "feat(shared): add HELPER/MASTER to RoleSchema, add AuditActionSchema"
```

---

## Task 3: API Core — Types, AppError & Authorize Middleware

**Files:**
- Modify: `apps/api/src/types/express.d.ts`
- Modify: `apps/api/src/lib/errors.ts`
- Modify: `apps/api/src/middleware/errorHandler.ts`
- Modify: `apps/api/src/middleware/authorize.ts`
- Modify: `apps/api/src/middleware/authenticate.ts`

**Interfaces:**
- Consumes: Task 2 (`Role` type now includes HELPER/MASTER)
- Produces:
  - `req.user.role` typed as `'USER' | 'HELPER' | 'ADMIN' | 'MASTER'`
  - `AppError(statusCode, message, code?, data?)` — optional extra data payload
  - `authorize(minRole)` — hierarchy-aware, single min-role parameter
  - Error responses now include `...data` when AppError has a data field

- [ ] **Step 1: Write failing authorize test**

Create `apps/api/tests/middleware/authorize.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../helpers';

function makeToken(role: string) {
  return jwt.sign({ sub: 'test-id', role }, process.env.JWT_SECRET!, { expiresIn: 60 });
}

describe('authorize middleware hierarchy', () => {
  it('allows MASTER through authorize("ADMIN")', async () => {
    const token = makeToken('MASTER');
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    // MASTER should get through authorize('ADMIN') — 200, not 403
    expect(res.status).not.toBe(403);
  });

  it('allows ADMIN through authorize("HELPER")', async () => {
    const token = makeToken('ADMIN');
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(403);
  });

  it('blocks USER from authorize("ADMIN") route', async () => {
    const token = makeToken('USER');
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('blocks HELPER from authorize("ADMIN") route', async () => {
    const token = makeToken('HELPER');
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern="authorize"
```

Expected: FAIL — MASTER gets 403 because old authorize only accepts exact `'ADMIN'`.

- [ ] **Step 3: Update express.d.ts**

Replace `apps/api/src/types/express.d.ts`:

```ts
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      role: 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';
    };
  }
}
```

- [ ] **Step 4: Update AppError**

Replace `apps/api/src/lib/errors.ts`:

```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

- [ ] **Step 5: Update errorHandler to spread data**

In `apps/api/src/middleware/errorHandler.ts`, find the `AppError` branch and update it:

```ts
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.data ?? {}),
    });
  }
```

- [ ] **Step 6: Update authorize middleware**

Replace `apps/api/src/middleware/authorize.ts`:

```ts
import { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  HELPER: 1,
  ADMIN: 2,
  MASTER: 3,
};

export const authorize =
  (minRole: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || ROLE_RANK[req.user.role as Role] < ROLE_RANK[minRole]) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
```

- [ ] **Step 7: Update JwtPayload in authenticate.ts**

In `apps/api/src/middleware/authenticate.ts`, update the `JwtPayload` interface:

```ts
interface JwtPayload {
  sub: string;
  role: 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';
  iat: number;
  exp: number;
}
```

- [ ] **Step 8: Run test to confirm pass**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern="authorize"
```

Expected: PASS — all 4 tests green.

- [ ] **Step 9: Run full test suite**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: all existing tests still pass.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/types/express.d.ts apps/api/src/lib/errors.ts apps/api/src/middleware/
git add apps/api/tests/middleware/authorize.test.ts
git commit -m "feat(api): hierarchy-aware authorize, AppError data payload, 4-tier role types"
```

---

## Task 4: Auth Hardening — Login Lockout & Token Reuse Detection

**Files:**
- Modify: `apps/api/src/services/auth.service.ts`
- Create: `apps/api/tests/auth-hardening.test.ts`

**Interfaces:**
- Consumes: Task 1 (`LoginAttempt`, `RevokedToken` models), Task 3 (`AppError` with data)
- Produces:
  - `login()` — lockout after 5 failed attempts in 15 min; BANNED returns `{ bannedReason, bannedAt, bannedUntil }`; auto-unban on expired `bannedUntil`
  - `refresh()` — token reuse detection; auto-unban; BANNED returns details
  - `signAccessToken(userId, role)` — role param now accepts all 4 roles

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/auth-hardening.test.ts`:

```ts
import request from 'supertest';
import { app, prisma } from './helpers';

const LOCK_EMAIL = 'lockout@example.com';
const LOCK_USER = { email: LOCK_EMAIL, username: 'lockoutuser', password: 'password123' };

afterAll(async () => {
  await prisma.loginAttempt.deleteMany({ where: { email: LOCK_EMAIL } });
  await prisma.user.deleteMany({ where: { email: LOCK_EMAIL } });
  await prisma.$disconnect();
});

describe('Login lockout', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send(LOCK_USER);
  });

  it('allows login with correct password before lockout', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: LOCK_USER.password });
    expect(res.status).toBe(200);
  });

  it('returns 429 after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: 'wrongpassword' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: LOCK_USER.password });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.lockedUntil).toBeDefined();
  });

  it('clears lockout on successful login after window passes', async () => {
    // Manually clear attempts to simulate window expiry
    await prisma.loginAttempt.deleteMany({ where: { email: LOCK_EMAIL } });
    const res = await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: LOCK_USER.password });
    expect(res.status).toBe(200);
  });
});

describe('Token reuse detection', () => {
  const REUSE_EMAIL = 'reuse@example.com';

  afterAll(async () => {
    await prisma.revokedToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({ where: { email: REUSE_EMAIL } });
  });

  it('returns 401 TOKEN_REUSE_DETECTED when old refresh token is reused', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: REUSE_EMAIL, username: 'reuseuser', password: 'password123' });

    const cookie = reg.headers['set-cookie']?.[0] ?? '';

    // First refresh — rotates token
    await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    // Use the OLD cookie again (reuse)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REUSE_DETECTED');
  });
});

describe('BANNED error includes details', () => {
  const BAN_EMAIL = 'banned@example.com';

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({ where: { email: BAN_EMAIL } });
  });

  it('returns 403 BANNED with reason and dates', async () => {
    await request(app).post('/api/auth/register').send({ email: BAN_EMAIL, username: 'banneduser', password: 'password123' });
    await prisma.user.update({
      where: { email: BAN_EMAIL },
      data: {
        banned: true,
        bannedReason: 'Violated community rules',
        bannedAt: new Date(),
        bannedUntil: null,
      },
    });

    const res = await request(app).post('/api/auth/login').send({ email: BAN_EMAIL, password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BANNED');
    expect(res.body.bannedReason).toBe('Violated community rules');
    expect(res.body.bannedAt).toBeDefined();
    expect(res.body.bannedUntil).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern="auth-hardening"
```

Expected: FAIL — lockout returns 401, reuse returns 401 without DETECTED code, BANNED doesn't include details.

- [ ] **Step 3: Update auth.service.ts**

Replace `apps/api/src/services/auth.service.ts` with:

```ts
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import type { Register, Login } from '@mh-datapedia/shared';

const SALT_ROUNDS = 12;
export const ACCESS_TOKEN_TTL_S = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

export function signAccessToken(userId: string, role: Role) {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_S,
  });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createRefreshToken(userId: string) {
  const token = randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function register(data: Register) {
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: data.email, username: data.username, passwordHash },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);
  return { user, accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}

export async function login(data: Login) {
  // Check lockout before anything else
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const attemptCount = await prisma.loginAttempt.count({
    where: { email: data.email, createdAt: { gte: windowStart } },
  });
  if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
    const oldest = await prisma.loginAttempt.findFirst({
      where: { email: data.email, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
    });
    const lockedUntil = new Date(oldest!.createdAt.getTime() + LOCKOUT_WINDOW_MS);
    throw new AppError(429, 'Account temporarily locked', 'RATE_LIMITED', {
      lockedUntil: lockedUntil.toISOString(),
    });
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    await prisma.loginAttempt.create({ data: { email: data.email } });
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    await prisma.loginAttempt.create({ data: { email: data.email } });
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // Auto-unban if temporary ban has expired
  if (user.banned && user.bannedUntil && user.bannedUntil < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { banned: false, bannedReason: null, bannedAt: null, bannedUntil: null },
    });
    user.banned = false;
  }

  if (user.banned) {
    throw new AppError(403, 'Account is banned', 'BANNED', {
      bannedReason: user.bannedReason,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      bannedUntil: user.bannedUntil?.toISOString() ?? null,
    });
  }

  // Clear lockout on success
  await prisma.loginAttempt.deleteMany({ where: { email: data.email } });

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_S,
  };
}

export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!stored) {
    // Not in active tokens — check revoked tokens for reuse detection
    const tokenHash = hashToken(token);
    const revoked = await prisma.revokedToken.findUnique({ where: { tokenHash } });
    if (revoked) {
      // Token reuse detected — revoke all sessions for this user
      await prisma.refreshToken.deleteMany({ where: { userId: revoked.userId } });
      throw new AppError(401, 'Token reuse detected', 'TOKEN_REUSE_DETECTED');
    }
    throw new AppError(401, 'Invalid or expired refresh token', 'UNAUTHORIZED');
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token } });
    throw new AppError(401, 'Invalid or expired refresh token', 'UNAUTHORIZED');
  }

  // Auto-unban if ban expired
  let currentUser = stored.user;
  if (currentUser.banned) {
    if (currentUser.bannedUntil && currentUser.bannedUntil < new Date()) {
      currentUser = await prisma.user.update({
        where: { id: stored.userId },
        data: { banned: false, bannedReason: null, bannedAt: null, bannedUntil: null },
      });
    } else {
      await prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
      throw new AppError(403, 'Account is banned', 'BANNED', {
        bannedReason: currentUser.bannedReason,
        bannedAt: currentUser.bannedAt?.toISOString() ?? null,
        bannedUntil: currentUser.bannedUntil?.toISOString() ?? null,
      });
    }
  }

  // Rotate: move old token to revoked, issue new one
  const tokenHash = hashToken(stored.token);
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token } }),
    prisma.revokedToken.create({
      data: { tokenHash, userId: stored.userId, expiresAt: stored.expiresAt },
    }),
  ]);

  const newRefreshToken = await createRefreshToken(stored.userId);
  const accessToken = signAccessToken(stored.userId, currentUser.role);
  return { accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  return user;
}
```

- [ ] **Step 4: Run auth-hardening tests**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern="auth-hardening"
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: all tests pass. The existing `auth.test.ts` should still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/auth.service.ts apps/api/tests/auth-hardening.test.ts
git commit -m "feat(api): login lockout (5 attempts), token reuse detection, BANNED details"
```

---

## Task 5: Admin & Strategy Services — Scope Rules, Enhanced Ban & Audit Log

**Files:**
- Modify: `apps/api/src/services/admin.service.ts`
- Modify: `apps/api/src/services/strategy.service.ts`
- Modify: `apps/api/src/routes/admin.router.ts`
- Modify: `apps/api/tests/helpers.ts`
- Create: `apps/api/tests/admin-scope.test.ts`

**Interfaces:**
- Consumes: Task 1 (`AdminAction` model), Task 3 (`authorize` hierarchy), Task 4 (`AppError` data)
- Produces:
  - `setRole(id, role, requesterId, requesterRole)` — enforces ADMIN can only touch USER/HELPER targets and set USER/HELPER roles; MASTER unrestricted
  - `setBanned(id, banned, requesterId, requesterRole, reason?, bannedUntil?)` — enforces scope, requires reason on ban, downgrades HELPER/ADMIN to USER on ban, writes audit log inside transaction
  - `listAuditLog(page, limit)` — paginated audit entries with actor/target usernames
  - `GET /api/admin/audit` — new route, authorize('ADMIN')
  - Strategy service: HELPER+ can edit any strategy; only ADMIN+ can delete others' strategies

- [ ] **Step 1: Add registerAndPromoteHelper to test helpers**

In `apps/api/tests/helpers.ts`, add after `registerAndPromoteAdmin`:

```ts
export async function registerAndPromoteHelper(
  email = 'helper@example.com',
  username = 'helperuser',
  password = 'helperpass123',
) {
  await request(app).post('/api/auth/register').send({ email, username, password });
  await prisma.user.update({ where: { email }, data: { role: 'HELPER' } });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}
```

- [ ] **Step 2: Write failing tests**

Create `apps/api/tests/admin-scope.test.ts`:

```ts
import request from 'supertest';
import { app, prisma, registerAndPromoteAdmin, registerAndPromoteHelper } from './helpers';

let adminToken: string;
let helperToken: string;
let masterToken: string;
let userId: string;
let helperId: string;
let adminId: string;

beforeAll(async () => {
  adminToken = await registerAndPromoteAdmin('admin-scope@example.com', 'adminscope', 'adminpass123');
  helperToken = await registerAndPromoteHelper('helper-scope@example.com', 'helperscope', 'helperpass123');

  // Create a plain user
  const userRes = await request(app).post('/api/auth/register').send({
    email: 'target-user@example.com', username: 'targetuser', password: 'password123',
  });
  const user = await prisma.user.findUnique({ where: { email: 'target-user@example.com' }, select: { id: true } });
  userId = user!.id;

  const helper = await prisma.user.findUnique({ where: { email: 'helper-scope@example.com' }, select: { id: true } });
  helperId = helper!.id;

  const admin = await prisma.user.findUnique({ where: { email: 'admin-scope@example.com' }, select: { id: true } });
  adminId = admin!.id;

  // Create a MASTER (set via DB)
  await request(app).post('/api/auth/register').send({
    email: 'master-scope@example.com', username: 'masterscope', password: 'masterpass123',
  });
  await prisma.user.update({ where: { email: 'master-scope@example.com' }, data: { role: 'MASTER' } });
  const masterRes = await request(app).post('/api/auth/login').send({
    email: 'master-scope@example.com', password: 'masterpass123',
  });
  masterToken = masterRes.body.accessToken;
});

afterAll(async () => {
  await prisma.adminAction.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'admin-scope@example.com',
          'helper-scope@example.com',
          'target-user@example.com',
          'master-scope@example.com',
        ],
      },
    },
  });
  await prisma.$disconnect();
});

describe('setRole scope', () => {
  it('ADMIN can promote USER to HELPER', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'HELPER' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('HELPER');
    // Reset
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });

  it('ADMIN cannot promote USER to ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('ADMIN cannot touch another ADMIN', async () => {
    const admin2Token = await registerAndPromoteAdmin('admin2-scope@example.com', 'adminscope2', 'adminpass123');
    const admin2 = await prisma.user.findUnique({ where: { email: 'admin2-scope@example.com' }, select: { id: true } });
    const res = await request(app)
      .patch(`/api/admin/users/${admin2!.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'USER' });
    expect(res.status).toBe(403);
    await prisma.user.deleteMany({ where: { email: 'admin2-scope@example.com' } });
  });

  it('MASTER can promote USER to ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });
});

describe('setBanned scope', () => {
  it('ADMIN can ban a USER with reason', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, reason: 'Spamming the forums repeatedly', bannedUntil: null });
    expect(res.status).toBe(200);
    expect(res.body.user.banned).toBe(true);
    expect(res.body.user.bannedReason).toBe('Spamming the forums repeatedly');
    await prisma.user.update({ where: { id: userId }, data: { banned: false, bannedReason: null, bannedAt: null } });
  });

  it('requires reason when banning', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, bannedUntil: null });
    expect(res.status).toBe(422);
  });

  it('ADMIN cannot ban another ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${adminId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, reason: 'Trying to ban admin', bannedUntil: null });
    expect(res.status).toBe(403);
  });

  it('banning a HELPER downgrades their role to USER', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${helperId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, reason: 'Posting inappropriate content repeatedly', bannedUntil: null });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.banned).toBe(true);
    await prisma.user.update({ where: { id: helperId }, data: { banned: false, bannedReason: null, bannedAt: null, role: 'HELPER' } });
  });

  it('MASTER can ban an ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${adminId}/ban`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ banned: true, reason: 'Admin abusing their privileges', bannedUntil: null });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('USER');
    await prisma.user.update({ where: { id: adminId }, data: { banned: false, bannedReason: null, bannedAt: null, role: 'ADMIN' } });
  });
});

describe('audit log', () => {
  it('records role change in audit log', async () => {
    await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'HELPER' });

    const res = await request(app)
      .get('/api/admin/audit?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const entries = res.body.entries;
    const roleChange = entries.find((e: any) => e.action === 'ROLE_CHANGE' && e.targetUserId === userId);
    expect(roleChange).toBeDefined();
    expect(roleChange.metadata.from).toBe('USER');
    expect(roleChange.metadata.to).toBe('HELPER');
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern="admin-scope"
```

Expected: multiple failures — scope not enforced, ban doesn't require reason, audit log endpoint doesn't exist.

- [ ] **Step 4: Update admin.service.ts**

Replace `apps/api/src/services/admin.service.ts`:

```ts
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  banned: true,
  bannedReason: true,
  bannedAt: true,
  bannedUntil: true,
  createdAt: true,
} as const;

const ADMIN_MANAGEABLE_ROLES: Role[] = ['USER', 'HELPER'];

export async function listUsers(search?: string) {
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;
  return prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' } });
}

export async function setRole(
  id: string,
  newRole: Role,
  requesterId: string,
  requesterRole: Role,
) {
  if (id === requesterId) throw new AppError(400, 'Cannot change your own role', 'SELF_ACTION');

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) throw new AppError(404, 'User not found', 'NOT_FOUND');

  if (requesterRole === 'ADMIN') {
    if (!ADMIN_MANAGEABLE_ROLES.includes(target.role as Role)) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
    if (!ADMIN_MANAGEABLE_ROLES.includes(newRole)) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
  }

  const oldRole = target.role;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { role: newRole }, select: USER_SELECT });
    await tx.adminAction.create({
      data: {
        actorId: requesterId,
        action: 'ROLE_CHANGE',
        targetUserId: id,
        metadata: { from: oldRole, to: newRole },
      },
    });
    return user;
  });
}

export async function setBanned(
  id: string,
  banned: boolean,
  requesterId: string,
  requesterRole: Role,
  reason?: string,
  bannedUntil?: string | null,
) {
  if (id === requesterId) throw new AppError(400, 'Cannot ban yourself', 'SELF_ACTION');

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) throw new AppError(404, 'User not found', 'NOT_FOUND');

  if (requesterRole === 'ADMIN' && !ADMIN_MANAGEABLE_ROLES.includes(target.role as Role)) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: id } });

    const roleDowngrade = banned && (['HELPER', 'ADMIN'] as Role[]).includes(target.role as Role);

    const updateData = banned
      ? {
          banned: true,
          bannedReason: reason!,
          bannedAt: new Date(),
          bannedUntil: bannedUntil ? new Date(bannedUntil) : null,
          ...(roleDowngrade ? { role: 'USER' as const } : {}),
        }
      : {
          banned: false,
          bannedReason: null,
          bannedAt: null,
          bannedUntil: null,
        };

    const user = await tx.user.update({ where: { id }, data: updateData, select: USER_SELECT });

    await tx.adminAction.create({
      data: {
        actorId: requesterId,
        action: banned ? 'BAN' : 'UNBAN',
        targetUserId: id,
        metadata: banned
          ? { reason: reason!, bannedUntil: bannedUntil ?? null, roleDowngraded: roleDowngrade }
          : {},
      },
    });

    return user;
  });
}

export async function listAuditLog(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [entries, total] = await prisma.$transaction([
    prisma.adminAction.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { username: true } },
        targetUser: { select: { username: true } },
      },
    }),
    prisma.adminAction.count(),
  ]);
  return {
    entries: entries.map((e) => ({
      id: e.id,
      actorId: e.actorId,
      actorUsername: e.actor.username,
      action: e.action,
      targetUserId: e.targetUserId,
      targetUsername: e.targetUser?.username ?? null,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```

- [ ] **Step 5: Update strategy.service.ts**

Replace `apps/api/src/services/strategy.service.ts`:

```ts
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { CreateStrategy, UpdateStrategy } from '@mh-datapedia/shared';

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

const CAN_EDIT_ANY: Role[] = ['HELPER', 'ADMIN', 'MASTER'];
const CAN_DELETE_ANY: Role[] = ['ADMIN', 'MASTER'];

export async function createStrategy(authorId: string, data: CreateStrategy) {
  const exists = await prisma.monster.findUnique({
    where: { id: data.monsterId },
    select: { id: true },
  });
  if (!exists) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
  return prisma.strategy.create({
    data: { ...data, authorId },
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function updateStrategy(
  id: string,
  userId: string,
  role: Role,
  data: UpdateStrategy,
) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (!CAN_EDIT_ANY.includes(role) && strategy.authorId !== userId) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
  return prisma.strategy.update({
    where: { id },
    data,
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function deleteStrategy(id: string, userId: string, role: Role) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (!CAN_DELETE_ANY.includes(role) && strategy.authorId !== userId) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
  await prisma.strategy.delete({ where: { id } });
}
```

- [ ] **Step 6: Update admin.router.ts**

Replace `apps/api/src/routes/admin.router.ts`:

```ts
import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { adminLimiter } from '../middleware/rateLimiter';
import * as adminService from '../services/admin.service';

const router: IRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// MASTER excluded — cannot be set via API
const SetRoleSchema = z.object({ role: z.enum(['USER', 'HELPER', 'ADMIN']) });

const BanSchema = z.discriminatedUnion('banned', [
  z.object({
    banned: z.literal(true),
    reason: z.string().min(10, 'Reason must be at least 10 characters'),
    bannedUntil: z.string().datetime().nullable(),
  }),
  z.object({ banned: z.literal(false) }),
]);

router.get(
  '/users',
  authenticate,
  authorize('HELPER'),
  wrap(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const users = await adminService.listUsers(search);
    res.json({ users });
  }),
);

router.patch(
  '/users/:id/role',
  authenticate,
  authorize('ADMIN'),
  adminLimiter,
  validate(SetRoleSchema),
  wrap(async (req, res) => {
    const user = await adminService.setRole(
      req.params.id,
      req.body.role,
      req.user!.id,
      req.user!.role,
    );
    res.json({ user });
  }),
);

router.patch(
  '/users/:id/ban',
  authenticate,
  authorize('ADMIN'),
  adminLimiter,
  validate(BanSchema),
  wrap(async (req, res) => {
    const { banned } = req.body;
    const user = await adminService.setBanned(
      req.params.id,
      banned,
      req.user!.id,
      req.user!.role,
      banned ? req.body.reason : undefined,
      banned ? req.body.bannedUntil : undefined,
    );
    res.json({ user });
  }),
);

router.get(
  '/audit',
  authenticate,
  authorize('ADMIN'),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await adminService.listAuditLog(page, limit);
    res.json(result);
  }),
);

export default router;
```

Note: `adminLimiter` is imported here but defined in Task 6. For now, comment it out or temporarily import an empty pass-through. It will be uncommented in Task 6.

Actually — add `adminLimiter` placeholder in `rateLimiter.ts` now to avoid the import error:

In `apps/api/src/middleware/rateLimiter.ts`, add at the end:

```ts
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests', code: 'RATE_LIMITED' },
});
```

- [ ] **Step 7: Run admin-scope tests**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern="admin-scope"
```

Expected: all tests PASS.

- [ ] **Step 8: Run full test suite**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/admin.service.ts apps/api/src/services/strategy.service.ts
git add apps/api/src/routes/admin.router.ts apps/api/src/middleware/rateLimiter.ts
git add apps/api/tests/helpers.ts apps/api/tests/admin-scope.test.ts
git commit -m "feat(api): admin scope rules, enhanced ban, role downgrade on ban, audit log"
```

---

## Task 6: Rate Limiters — Complete & Apply

**Files:**
- Modify: `apps/api/src/middleware/rateLimiter.ts`
- Modify: `apps/api/src/routes/monsters.router.ts`
- Modify: `apps/api/src/routes/strategies.router.ts`

**Interfaces:**
- Consumes: Task 5 (`adminLimiter` already added to rateLimiter.ts)
- Produces: `strategyLimiter`, `searchLimiter` applied to their routes; `authorize('HELPER')` on monster write routes

- [ ] **Step 1: Complete rateLimiter.ts**

Replace `apps/api/src/middleware/rateLimiter.ts` with the full version:

```ts
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts', code: 'RATE_LIMITED' },
});

export const strategyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many strategy submissions', code: 'RATE_LIMITED' },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests', code: 'RATE_LIMITED' },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests', code: 'RATE_LIMITED' },
});
```

- [ ] **Step 2: Apply strategyLimiter and searchLimiter**

In `apps/api/src/routes/strategies.router.ts`, import `strategyLimiter` and add it to the POST route:

```ts
import { strategyLimiter } from '../middleware/rateLimiter';

// Change this line:
router.post('/', authenticate, validate(CreateStrategySchema), wrap(async (req, res) => {
// To:
router.post('/', authenticate, strategyLimiter, validate(CreateStrategySchema), wrap(async (req, res) => {
```

In `apps/api/src/routes/monsters.router.ts`:
1. Import `searchLimiter` from rateLimiter.
2. Add `searchLimiter` to the GET `/` route.
3. Change `authorize('ADMIN')` to `authorize('HELPER')` on write routes (POST, PUT, DELETE).

The updated write routes in monsters.router.ts:

```ts
import { searchLimiter } from '../middleware/rateLimiter';

// GET / — add searchLimiter
router.get('/', searchLimiter, validate(MonsterFiltersSchema, 'query'), wrap(async (req, res) => {
  // ...
}));

// POST / — change ADMIN to HELPER
router.post('/', authenticate, authorize('HELPER'), validate(CreateMonsterSchema), wrap(async (req, res) => {
  // ...
}));

// PUT /:id
router.put('/:id', authenticate, authorize('HELPER'), validate(IdParamSchema, 'params'), validate(UpdateMonsterSchema), wrap(async (req, res) => {
  // ...
}));

// PUT /:id/weaknesses
router.put('/:id/weaknesses', authenticate, authorize('HELPER'), validate(IdParamSchema, 'params'), validate(UpsertWeaknessesSchema), wrap(async (req, res) => {
  // ...
}));

// PUT /:id/hitzones
router.put('/:id/hitzones', authenticate, authorize('HELPER'), validate(IdParamSchema, 'params'), validate(UpsertHitzonesSchema), wrap(async (req, res) => {
  // ...
}));

// DELETE /:id
router.delete('/:id', authenticate, authorize('HELPER'), validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  // ...
}));
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/rateLimiter.ts apps/api/src/routes/monsters.router.ts apps/api/src/routes/strategies.router.ts
git commit -m "feat(api): strategy/search/admin rate limiters, HELPER access on monster write routes"
```

---

## Task 7: Frontend — Types & AuthContext Banned State

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: Task 2 (shared `Role` type updated), Task 4 (BANNED response shape)
- Produces:
  - `AdminUser` includes `role: 'USER' | 'HELPER' | 'ADMIN' | 'MASTER'` and ban detail fields
  - `AuditEntry` interface
  - `BanDetails` interface
  - `AuthState` exposes `bannedDetails: BanDetails | null` and `clearBannedDetails: () => void`
  - `login()` catches `BANNED` error and sets `bannedDetails` instead of re-throwing
  - `silentRefresh()` catches `BANNED` error and sets `bannedDetails`

- [ ] **Step 1: Update types.ts**

Replace `apps/web/src/lib/types.ts`:

```ts
export interface ElementWeakness {
  id: string;
  element: string;
  rating: number;
  isImmune: boolean;
}

export interface Hitzone {
  id: string;
  part: string;
  cut: number;
  blunt: number;
  bullet: number;
  fire: number;
  water: number;
  thunder: number;
  ice: number;
  dragon: number;
  stun: number;
}

export interface MonsterDrop {
  id: string;
  game: string;
  rank: string;
  method: string;
  part: string | null;
  itemName: string;
  quantity: number;
  rate: number;
}

export interface Strategy {
  id: string;
  title: string;
  content: string;
  difficulty: string;
  game: string;
  authorId: string;
  author: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export interface MonsterListItem {
  id: string;
  name: string;
  title: string;
  type: string;
  imageUrl: string | null;
  iconUrl: string | null;
  isBoss: boolean;
  habitats: string[];
  weaknesses: ElementWeakness[];
}

export interface MonsterDetail extends MonsterListItem {
  description: string;
  parentId: string | null;
  hitzones: Hitzone[];
  strategies: Strategy[];
  ailments: { id: string; ailment: string }[];
  drops: MonsterDrop[];
  subspecies: { id: string; name: string; type: string; iconUrl: string | null; imageUrl: string | null; title: string }[];
  parent: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';
  banned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  bannedUntil: string | null;
  createdAt: string;
}

export interface BanDetails {
  bannedReason: string;
  bannedAt: string | null;
  bannedUntil: string | null;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorUsername: string;
  action: 'ROLE_CHANGE' | 'BAN' | 'UNBAN';
  targetUserId: string | null;
  targetUsername: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

- [ ] **Step 2: Update AuthContext.tsx**

Replace `apps/web/src/context/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { apiPost, apiGet, setAccessToken, setRefreshCallback, ApiError } from '../lib/api';
import type { User } from '@mh-datapedia/shared';
import type { BanDetails } from '../lib/types';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  bannedDetails: BanDetails | null;
  clearBannedDetails: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function extractBanDetails(body: unknown): BanDetails | null {
  if (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    (body as Record<string, unknown>).code === 'BANNED'
  ) {
    const b = body as Record<string, unknown>;
    return {
      bannedReason: (b.bannedReason as string) ?? 'No reason provided',
      bannedAt: (b.bannedAt as string | null) ?? null,
      bannedUntil: (b.bannedUntil as string | null) ?? null,
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bannedDetails, setBannedDetails] = useState<BanDetails | null>(null);

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const data = await apiPost<{ accessToken: string }>('/api/auth/refresh');
      setToken(data.accessToken);
      setAccessToken(data.accessToken);
      const me = await apiGet<{ user: User }>('/api/auth/me');
      setUser(me.user);
      return data.accessToken;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const details = extractBanDetails(e.body);
        if (details) setBannedDetails(details);
      }
      setToken(null);
      setUser(null);
      setAccessToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setRefreshCallback(silentRefresh);
    silentRefresh().finally(() => setIsLoading(false));
  }, [silentRefresh]);

  async function login(email: string, password: string): Promise<void> {
    try {
      const data = await apiPost<{ user: User; accessToken: string }>(
        '/api/auth/login',
        { email, password },
      );
      setToken(data.accessToken);
      setUser(data.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const details = extractBanDetails(e.body);
        if (details) {
          setBannedDetails(details);
          return;
        }
      }
      throw e;
    }
  }

  async function register(email: string, username: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/register',
      { email, username, password },
    );
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    await apiPost('/api/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    setAccessToken(null);
  }

  function clearBannedDetails() {
    setBannedDetails(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, bannedDetails, clearBannedDetails, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: no new errors (some pre-existing errors may remain from admin.tsx — fixed in Task 9).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/context/AuthContext.tsx
git commit -m "feat(web): AdminUser/AuditEntry types, AuthContext BANNED state handling"
```

---

## Task 8: Frontend — Banned Modal Component

**Files:**
- Create: `apps/web/src/components/ui/BannedModal.tsx`
- Modify: `apps/web/src/context/AuthContext.tsx` (render modal inside provider)

**Interfaces:**
- Consumes: Task 7 (`BanDetails` type, `bannedDetails` + `clearBannedDetails` + `logout` from AuthContext)
- Produces: `BannedModal` component displayed when `bannedDetails !== null`; auto-logout at 100s

- [ ] **Step 1: Create BannedModal.tsx**

Create `apps/web/src/components/ui/BannedModal.tsx`:

```tsx
import { useEffect, useState } from 'react';

interface Props {
  bannedReason: string;
  bannedAt: string | null;
  bannedUntil: string | null;
  onLogout: () => void;
}

const COUNTDOWN_SECONDS = 100;

export function BannedModal({ bannedReason, bannedAt, bannedUntil, onLogout }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          onLogout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onLogout]);

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Permanent';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 backdrop-blur-sm">
      <div
        className="mh-panel w-full max-w-md mx-4 p-8"
        style={{ '--mh-cut': '16px' } as React.CSSProperties}
      >
        <div className="mh-section-head text-red-400 text-xl mb-6">Account Suspended</div>

        <div className="space-y-4 mb-8">
          <div>
            <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Reason</p>
            <p className="text-stone-100 text-sm">{bannedReason}</p>
          </div>

          {bannedAt && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Banned since</p>
              <p className="text-stone-100 text-sm">{formatDate(bannedAt)}</p>
            </div>
          )}

          <div>
            <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Duration</p>
            <p className="text-stone-100 text-sm">
              {bannedUntil ? `Until ${formatDate(bannedUntil)}` : 'Permanent'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-stone-500 text-sm">
            Auto-logout in{' '}
            <span className="text-accent font-semibold font-mono">{seconds}s</span>
          </div>
          <button
            onClick={onLogout}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-stone-950 text-sm font-semibold rounded transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render BannedModal inside AuthProvider**

In `apps/web/src/context/AuthContext.tsx`, update the `AuthProvider` return to include the modal. Also add a `handleBannedLogout` function:

```tsx
// Add this import at the top:
import { BannedModal } from '../components/ui/BannedModal';

// Inside AuthProvider, add handleBannedLogout before the return:
async function handleBannedLogout() {
  await logout();
  clearBannedDetails();
  window.location.replace('/');
}

// Update the return statement:
return (
  <AuthContext.Provider
    value={{ user, accessToken, isLoading, bannedDetails, clearBannedDetails, login, register, logout }}
  >
    {children}
    {bannedDetails && (
      <BannedModal
        bannedReason={bannedDetails.bannedReason}
        bannedAt={bannedDetails.bannedAt}
        bannedUntil={bannedDetails.bannedUntil}
        onLogout={handleBannedLogout}
      />
    )}
  </AuthContext.Provider>
);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/BannedModal.tsx apps/web/src/context/AuthContext.tsx
git commit -m "feat(web): BannedModal with countdown, auto-logout, ban details display"
```

---

## Task 9: Frontend — Admin Panel UI

**Files:**
- Modify: `apps/web/src/routes/admin.tsx`
- Create: `apps/web/src/hooks/useDebounce.ts`

**Interfaces:**
- Consumes: Task 7 (`AdminUser` with 4 roles + ban fields, `AuditEntry`), Task 8 (no deps)
- Produces: Full admin panel with Users tab (role-gated controls, ban modal with reason/duration) + Audit Log tab; debounced search on Users tab; `useDebounce` hook available for other pages

- [ ] **Step 1: Create useDebounce hook**

Create `apps/web/src/hooks/useDebounce.ts`:

```ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
```

- [ ] **Step 2: Apply useDebounce to monster list search**

Find the monster list page (likely `apps/web/src/routes/index.tsx` or similar) and wrap the search query state with `useDebounce` where the query key is updated. The pattern is:

```tsx
import { useDebounce } from '../hooks/useDebounce';

// Inside the component:
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 400);

// Use debouncedSearch as the query key instead of search
useQuery({ queryKey: ['monsters', debouncedSearch], queryFn: () => apiGet(`/api/monsters?search=${debouncedSearch}`) })
```

Apply this pattern wherever the monster list fetches based on user input.

- [ ] **Step 3: Replace admin.tsx**

Replace `apps/web/src/routes/admin.tsx` with:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../lib/api';
import type { AdminUser, AuditEntry } from '../lib/types';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import type { Role } from '@mh-datapedia/shared';

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/' });
    const role = context.auth.user.role as Role;
    if (!(['HELPER', 'ADMIN', 'MASTER'] as Role[]).includes(role)) throw redirect({ to: '/' });
  },
  component: AdminPage,
});

// ── Hooks ────────────────────────────────────────────────────────────────────

function useAdminUsers(search: string) {
  const debouncedSearch = useDebounce(search, 400);
  return useQuery({
    queryKey: ['admin', 'users', debouncedSearch],
    queryFn: () =>
      apiGet<{ users: AdminUser[] }>(
        `/api/admin/users${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ).then((r) => r.users),
  });
}

function useAuditLog(page: number) {
  return useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () =>
      apiGet<{
        entries: AuditEntry[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/admin/audit?page=${page}&limit=20`),
  });
}

// ── Role badge ───────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  USER: 'bg-stone-700 text-stone-300',
  HELPER: 'bg-blue-900/40 text-blue-400 border border-blue-800/50',
  ADMIN: 'bg-accent/20 text-accent border border-accent/40',
  MASTER: 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_BADGE[role] ?? ROLE_BADGE.USER}`}>
      {role}
    </span>
  );
}

// ── Ban Modal ─────────────────────────────────────────────────────────────────

interface BanTarget { id: string; username: string }

const DURATION_OPTIONS = [
  { label: 'Permanent', value: null },
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
] as const;

function BanModal({
  target,
  onConfirm,
  onCancel,
  isPending,
}: {
  target: BanTarget;
  onConfirm: (reason: string, bannedUntil: string | null) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [durationKey, setDurationKey] = useState<number>(0); // index into DURATION_OPTIONS
  const [customDays, setCustomDays] = useState('');
  const isCustom = durationKey === DURATION_OPTIONS.length; // past the last fixed option

  function computeBannedUntil(): string | null {
    if (isCustom) {
      const days = parseInt(customDays);
      if (!days || days < 1) return null;
      return new Date(Date.now() + days * 86400000).toISOString();
    }
    const opt = DURATION_OPTIONS[durationKey];
    if (!opt || !('days' in opt)) return null; // Permanent
    return new Date(Date.now() + opt.days * 86400000).toISOString();
  }

  const canSubmit = reason.trim().length >= 10 && (!isCustom || parseInt(customDays) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm">
      <div
        className="mh-panel w-full max-w-md mx-4 p-6"
        style={{ '--mh-cut': '14px' } as React.CSSProperties}
      >
        <div className="mh-section-head text-sm mb-4">Ban {target.username}</div>

        <div className="space-y-4">
          <div>
            <label className="block text-stone-400 text-xs mb-1 uppercase tracking-wider">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-accent resize-none"
              rows={3}
              placeholder="Minimum 10 characters…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="text-red-400 text-xs mt-1">At least 10 characters required.</p>
            )}
          </div>

          <div>
            <label className="block text-stone-400 text-xs mb-2 uppercase tracking-wider">Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setDurationKey(i)}
                  className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                    durationKey === i && !isCustom
                      ? 'bg-accent/20 text-accent border-accent/40'
                      : 'border-stone-700 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setDurationKey(DURATION_OPTIONS.length)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                  isCustom
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'border-stone-700 text-stone-400 hover:border-stone-500'
                }`}
              >
                Custom
              </button>
            </div>
            {isCustom && (
              <input
                type="number"
                min={1}
                className="mt-2 w-28 bg-stone-900 border border-stone-700 rounded px-3 py-1.5 text-sm text-stone-100 focus:outline-none focus:border-accent"
                placeholder="Days"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-stone-700 hover:border-stone-500 text-stone-400 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit || isPending}
            onClick={() => onConfirm(reason.trim(), computeBannedUntil())}
            className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-40 text-stone-100 font-semibold rounded transition-colors"
          >
            {isPending ? 'Banning…' : 'Confirm Ban'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audit log helpers ─────────────────────────────────────────────────────────

function formatAction(entry: AuditEntry): string {
  switch (entry.action) {
    case 'ROLE_CHANGE': {
      const m = entry.metadata as { from: string; to: string };
      return `Role changed ${m.from} → ${m.to}`;
    }
    case 'BAN': {
      const m = entry.metadata as { reason: string; bannedUntil: string | null };
      return `Banned${m.bannedUntil ? ` until ${new Date(m.bannedUntil).toLocaleDateString()}` : ' permanently'} — ${m.reason}`;
    }
    case 'UNBAN':
      return 'Unbanned';
    default:
      return entry.action;
  }
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ viewerRole }: { viewerRole: Role }) {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { data: users, isLoading } = useAdminUsers(search);
  const [banTarget, setBanTarget] = useState<BanTarget | null>(null);

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason, bannedUntil }: { id: string; reason: string; bannedUntil: string | null }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/ban`, {
        banned: true,
        reason,
        bannedUntil,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setBanTarget(null);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/ban`, { banned: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const busy = (id: string) =>
    (roleMutation.isPending && (roleMutation.variables as any)?.id === id) ||
    (banMutation.isPending && (banMutation.variables as any)?.id === id) ||
    (unbanMutation.isPending && (unbanMutation.variables as any)?.id === id);

  function canManage(targetRole: Role): boolean {
    if (viewerRole === 'MASTER') return true;
    if (viewerRole === 'ADMIN') return targetRole === 'USER' || targetRole === 'HELPER';
    return false;
  }

  function roleControls(u: AdminUser) {
    if (viewerRole === 'HELPER') return null;
    if (!canManage(u.role as Role)) return null;

    const controls: JSX.Element[] = [];

    if (viewerRole === 'ADMIN') {
      if (u.role === 'USER') {
        controls.push(
          <button
            key="promote-helper"
            disabled={busy(u.id)}
            onClick={() => roleMutation.mutate({ id: u.id, role: 'HELPER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
          >
            → Helper
          </button>,
        );
      }
      if (u.role === 'HELPER') {
        controls.push(
          <button
            key="demote-user"
            disabled={busy(u.id)}
            onClick={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            Revoke Helper
          </button>,
        );
      }
    }

    if (viewerRole === 'MASTER') {
      if (u.role === 'USER') {
        controls.push(
          <button key="promote-helper" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'HELPER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-blue-800/60 text-blue-400 hover:bg-blue-900/20 transition-colors disabled:opacity-40">
            → Helper
          </button>,
          <button key="promote-admin" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'ADMIN' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40">
            → Admin
          </button>,
        );
      }
      if (u.role === 'HELPER') {
        controls.push(
          <button key="demote-user" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40">
            → User
          </button>,
          <button key="promote-admin" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'ADMIN' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40">
            → Admin
          </button>,
        );
      }
      if (u.role === 'ADMIN') {
        controls.push(
          <button key="demote-user" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40">
            → User
          </button>,
        );
      }
    }

    // Ban / unban
    if (!u.banned) {
      controls.push(
        <button
          key="ban"
          disabled={busy(u.id)}
          onClick={() => setBanTarget({ id: u.id, username: u.username })}
          className="px-3 py-1 rounded text-xs font-semibold border border-red-800/60 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
        >
          Ban
        </button>,
      );
    } else {
      controls.push(
        <button
          key="unban"
          disabled={busy(u.id)}
          onClick={() => unbanMutation.mutate({ id: u.id })}
          className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-accent/50 hover:text-accent transition-colors disabled:opacity-40"
        >
          Unban
        </button>,
      );
    }

    return <div className="flex gap-2 justify-end">{controls}</div>;
  }

  return (
    <>
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-50 placeholder-stone-500 focus:outline-none focus:border-accent"
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="mh-panel overflow-hidden" style={{ '--mh-cut': '16px' } as React.CSSProperties}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-700 text-stone-400 uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-center px-4 py-3">Role</th>
                <th className="text-center px-4 py-3">Status</th>
                {viewerRole !== 'HELPER' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-stone-100">{u.username}</td>
                  <td className="px-4 py-3 text-stone-400">{u.email}</td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      u.banned
                        ? 'bg-red-900/40 text-red-400 border border-red-800/50'
                        : 'bg-stone-700 text-stone-300'
                    }`}>
                      {u.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  {viewerRole !== 'HELPER' && (
                    <td className="px-4 py-3">{roleControls(u)}</td>
                  )}
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {banTarget && (
        <BanModal
          target={banTarget}
          onConfirm={(reason, bannedUntil) => banMutation.mutate({ id: banTarget.id, reason, bannedUntil })}
          onCancel={() => setBanTarget(null)}
          isPending={banMutation.isPending}
        />
      )}
    </>
  );
}

// ── Audit Log tab ─────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog(page);

  return (
    <>
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="mh-panel overflow-hidden" style={{ '--mh-cut': '16px' } as React.CSSProperties}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-700 text-stone-400 uppercase text-xs tracking-wider">
                  <th className="text-left px-4 py-3">Actor</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Target</th>
                  <th className="text-left px-4 py-3">Details</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.entries.map((e) => (
                  <tr key={e.id} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-stone-100">{e.actorUsername}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        e.action === 'BAN'
                          ? 'bg-red-900/40 text-red-400 border border-red-800/50'
                          : e.action === 'UNBAN'
                          ? 'bg-stone-700 text-stone-300'
                          : 'bg-blue-900/40 text-blue-400 border border-blue-800/50'
                      }`}>
                        {e.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-400">{e.targetUsername ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs max-w-xs truncate">
                      {formatAction(e)}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-xs">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {data?.entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      No audit entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border border-stone-700 text-stone-400 rounded hover:border-stone-500 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-stone-500">
                {page} / {data.meta.totalPages}
              </span>
              <button
                disabled={page === data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border border-stone-700 text-stone-400 rounded hover:border-stone-500 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'users' | 'audit';

function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const viewerRole = (user?.role ?? 'USER') as Role;

  const tabs: { key: Tab; label: string; minRole: Role }[] = [
    { key: 'users', label: 'Users', minRole: 'HELPER' },
    { key: 'audit', label: 'Audit Log', minRole: 'ADMIN' },
  ];

  const visibleTabs = tabs.filter((t) => {
    const rank = { USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3 };
    return rank[viewerRole] >= rank[t.minRole];
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mh-section-head text-2xl mb-8">Admin Panel</div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-stone-700 mb-8">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab viewerRole={viewerRole} />}
      {tab === 'audit' && <AuditLogTab />}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: no errors.

- [ ] **Step 5: Run API test suite one final time**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useDebounce.ts apps/web/src/routes/admin.tsx
git commit -m "feat(web): admin panel tabs, role-gated controls, ban modal, audit log, debounce"
```
