# Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users view all their active sessions and revoke them individually or all at once from a web page at `/account/sessions`.

**Architecture:** Refresh tokens gain `userAgent`, `ipAddress`, and `lastUsedAt` metadata captured at login/register. Three new auth endpoints expose and revoke sessions. The current session is identified by direct comparison of the refresh token cookie against the stored plaintext token. A new web page lists sessions using TanStack Query hooks.

**Tech Stack:** Prisma (PostgreSQL), Express, nodemailer, React + TanStack Router + TanStack Query, Tailwind CSS (stone/teal palette)

## Global Constraints

- Refresh tokens are stored as **plaintext** in the DB (not hashed) — `isCurrent` detection is direct string comparison of cookie value vs `stored.token`
- Never commit `.env` or `.env.test`
- All secrets via `fly secrets set`, never in git
- `app.set('trust proxy', 1)` is already set — `req.ip` gives the real client IP
- Tailwind palette: `bg-stone-950` page bg, `bg-stone-900` card bg, `border-stone-800` borders, `text-stone-50` primary text, `text-stone-400`/`text-stone-500` secondary, `bg-teal-700` primary actions, `text-red-400` destructive actions
- TanStack Router: `beforeLoad` guard (not `useEffect`) for auth redirect; `createFileRoute` per file
- pnpm test command (direct jest): `cd apps/api && npx jest --testPathPattern=<pattern>`
- pnpm typecheck: `pnpm typecheck` from repo root

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260706000001_add_session_metadata/migration.sql`

**Interfaces:**
- Produces: `RefreshToken.userAgent: String?`, `RefreshToken.ipAddress: String?`, `RefreshToken.lastUsedAt: DateTime` available in Prisma client

- [ ] **Step 1: Add fields to `apps/api/prisma/schema.prisma`**

Find the `model RefreshToken` block and add three fields after `createdAt`:

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

- [ ] **Step 2: Create the migration file**

Create directory `apps/api/prisma/migrations/20260706000001_add_session_metadata/` and write `migration.sql`:

```sql
ALTER TABLE "RefreshToken" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
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
git commit -m "feat(api): add session metadata fields to RefreshToken"
```

---

### Task 2: Session metadata capture (parseUserAgent + auth service + router)

**Files:**
- Create: `apps/api/src/lib/parseUserAgent.ts`
- Create: `apps/api/tests/parseUserAgent.test.ts`
- Modify: `apps/api/src/services/auth.service.ts`
- Modify: `apps/api/src/routes/auth.router.ts`

**Interfaces:**
- Produces:
  - `parseUserAgent(ua: string | undefined | null): string` in `apps/api/src/lib/parseUserAgent.ts`
  - `createRefreshToken(userId, userAgent?, ipAddress?)` captures metadata
  - `login(data, meta?)` and `register(data, meta?)` accept `meta: { userAgent?: string; ipAddress?: string }`
  - `refresh(token)` carries forward UA/IP from the rotated token internally

- [ ] **Step 1: Write failing tests in `apps/api/tests/parseUserAgent.test.ts`**

```typescript
import { parseUserAgent } from '../src/lib/parseUserAgent';

describe('parseUserAgent', () => {
  it('returns "Unknown device" for undefined', () => {
    expect(parseUserAgent(undefined)).toBe('Unknown device');
  });

  it('returns "Unknown device" for null', () => {
    expect(parseUserAgent(null)).toBe('Unknown device');
  });

  it('detects Chrome on Windows', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome on Windows');
  });

  it('detects Firefox on Mac', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox on Mac');
  });

  it('detects Safari on Mac', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe('Safari on Mac');
  });

  it('detects Chrome on Android', () => {
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36')).toBe('Chrome on Android');
  });

  it('detects Edge on Windows', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')).toBe('Edge on Windows');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=parseUserAgent
```

Expected: FAIL — `Cannot find module '../src/lib/parseUserAgent'`

- [ ] **Step 3: Create `apps/api/src/lib/parseUserAgent.ts`**

```typescript
export function parseUserAgent(ua: string | undefined | null): string {
  if (!ua) return 'Unknown device';
  if (/mobile|android/i.test(ua)) {
    if (/iphone|ipad/i.test(ua)) return 'Safari on iPhone';
    if (/android/i.test(ua)) return 'Chrome on Android';
    return 'Mobile browser';
  }
  if (/edg/i.test(ua)) return 'Edge on ' + getOS(ua);
  if (/chrome/i.test(ua)) return 'Chrome on ' + getOS(ua);
  if (/firefox/i.test(ua)) return 'Firefox on ' + getOS(ua);
  if (/safari/i.test(ua)) return 'Safari on Mac';
  return 'Browser on ' + getOS(ua);
}

function getOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=parseUserAgent
```

Expected: 7/7 PASS.

- [ ] **Step 5: Update `createRefreshToken` in `apps/api/src/services/auth.service.ts`**

Replace the existing `createRefreshToken` function:

```typescript
async function createRefreshToken(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<string> {
  const token = randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt, userAgent, ipAddress },
  });
  return token;
}
```

- [ ] **Step 6: Update `register` to accept and pass metadata**

Change the function signature and the `createRefreshToken` call:

```typescript
export async function register(
  data: Register,
  meta?: { userAgent?: string; ipAddress?: string },
) {
  // ... existing body unchanged ...
  const refreshToken = await createRefreshToken(user.id, meta?.userAgent, meta?.ipAddress);
  return { user, accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}
```

- [ ] **Step 7: Update `login` to accept and pass metadata**

Change the function signature and the `createRefreshToken` call:

```typescript
export async function login(
  data: Login,
  meta?: { userAgent?: string; ipAddress?: string },
) {
  // ... existing body unchanged ...
  const refreshToken = await createRefreshToken(user.id, meta?.userAgent, meta?.ipAddress);
  return { ... };
}
```

- [ ] **Step 8: Update `refresh` to carry forward metadata and update `lastUsedAt`**

After finding `stored`, the existing code creates a new refresh token. Update it to carry forward the stored UA/IP and update `lastUsedAt`:

```typescript
// After the $transaction that deletes old + creates revokedToken:
const newRefreshToken = await createRefreshToken(
  stored.userId,
  stored.userAgent ?? undefined,
  stored.ipAddress ?? undefined,
);
```

Also update `lastUsedAt` on the newly created token immediately after creation — since `createRefreshToken` sets `lastUsedAt` to `now()` via default, no extra update needed.

- [ ] **Step 9: Update `auth.router.ts` to pass metadata from requests**

In the `/register` handler, pass meta:

```typescript
const { user, accessToken, refreshToken, expiresIn } = await authService.register(req.body, {
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
});
```

In the `/login` handler, pass meta:

```typescript
const { user, accessToken, refreshToken, expiresIn } = await authService.login(req.body, {
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
});
```

- [ ] **Step 10: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/lib/parseUserAgent.ts \
        apps/api/tests/parseUserAgent.test.ts \
        apps/api/src/services/auth.service.ts \
        apps/api/src/routes/auth.router.ts
git commit -m "feat(api): capture userAgent and ipAddress on session creation"
```

---

### Task 3: Sessions API endpoints + tests

**Files:**
- Modify: `apps/api/src/services/auth.service.ts`
- Modify: `apps/api/src/routes/auth.router.ts`
- Modify: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: `authenticate` middleware (already in router), `req.cookies['refresh_token']`
- Produces:
  - `getSessions(userId: string, currentToken: string): Promise<SessionItem[]>`
  - `revokeSession(sessionId: string, userId: string, currentToken: string): Promise<{ wasCurrentSession: boolean }>`
  - `revokeOtherSessions(userId: string, currentToken: string): Promise<void>`
  - `GET /api/auth/sessions`
  - `DELETE /api/auth/sessions/:id`
  - `DELETE /api/auth/sessions`

Where `SessionItem` is:
```typescript
type SessionItem = {
  id: string;
  deviceLabel: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};
```

- [ ] **Step 1: Write failing tests in `apps/api/tests/auth.test.ts`**

Add at the end of the file (before the final closing brace, inside the existing describe structure):

```typescript
describe('Session management', () => {
  const sessionEmail = 'sessions@example.com';
  const sessionPassword = 'sesspass123';
  let sessionCookie: string;
  let secondCookie: string;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: sessionEmail, username: 'sessionuser', password: sessionPassword });
    await prisma.user.update({
      where: { email: sessionEmail },
      data: { emailVerified: true },
    });

    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    sessionCookie = login1.headers['set-cookie'][0];

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    secondCookie = login2.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: sessionEmail } });
  });

  it('GET /api/auth/sessions returns active sessions with isCurrent', async () => {
    // Get access token for the first session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const accessToken = loginRes.body.accessToken;
    const cookie = loginRes.headers['set-cookie'][0];

    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const current = res.body.find((s: { isCurrent: boolean }) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current.deviceLabel).toBeDefined();
  });

  it('DELETE /api/auth/sessions/:id revokes another session', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const accessToken = loginRes.body.accessToken;
    const cookie = loginRes.headers['set-cookie'][0];

    const sessions = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);

    const other = sessions.body.find((s: { isCurrent: boolean }) => !s.isCurrent);
    if (!other) return; // skip if only one session

    const res = await request(app)
      .delete(`/api/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('revoked');
  });

  it('DELETE /api/auth/sessions/:id returns 403 for another user session', async () => {
    // Create a second user and try to delete a session from the first user
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'sessions2@example.com', username: 'sessionuser2', password: sessionPassword });
    await prisma.user.update({
      where: { email: 'sessions2@example.com' },
      data: { emailVerified: true },
    });
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sessions2@example.com', password: sessionPassword });
    const accessToken2 = login2.body.accessToken;
    const cookie2 = login2.headers['set-cookie'][0];

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const accessToken = loginRes.body.accessToken;
    const cookie = loginRes.headers['set-cookie'][0];

    const sessions = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    const targetId = sessions.body[0].id;

    const res = await request(app)
      .delete(`/api/auth/sessions/${targetId}`)
      .set('Authorization', `Bearer ${accessToken2}`)
      .set('Cookie', cookie2);

    expect(res.status).toBe(403);

    await prisma.user.deleteMany({ where: { email: 'sessions2@example.com' } });
  });

  it('DELETE /api/auth/sessions revokes all other sessions', async () => {
    // Create two fresh sessions
    const l1 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const l2 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });

    const accessToken = l1.body.accessToken;
    const cookie = l1.headers['set-cookie'][0];

    const before = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(before.body.length).toBeGreaterThanOrEqual(2);

    const res = await request(app)
      .delete('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    const after = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(after.body.every((s: { isCurrent: boolean }) => s.isCurrent)).toBe(true);
    expect(after.body.length).toBe(1);
  });
});
```

Also add `sessions@example.com` and `sessions2@example.com` to the top-level `afterAll` cleanup:

```typescript
afterAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: 'authtest' } } });
  await prisma.user.deleteMany({ where: { email: 'verify@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'reset@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'sessions@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'sessions2@example.com' } });
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=auth
```

Expected: new session tests FAIL (404 on the session endpoints).

- [ ] **Step 3: Add service functions to `apps/api/src/services/auth.service.ts`**

Add this import at the top (add `parseUserAgent` to existing imports):

```typescript
import { parseUserAgent } from '../lib/parseUserAgent';
```

Add this type definition after the `Role` type:

```typescript
type SessionItem = {
  id: string;
  deviceLabel: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};
```

Append these three functions at the bottom of the file:

```typescript
export async function getSessions(userId: string, currentToken: string): Promise<SessionItem[]> {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceLabel: parseUserAgent(s.userAgent),
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    isCurrent: s.token === currentToken,
  }));
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  currentToken: string,
): Promise<{ wasCurrentSession: boolean }> {
  const session = await prisma.refreshToken.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new AppError(403, 'Session not found', 'FORBIDDEN');
  }

  const wasCurrentSession = session.token === currentToken;
  await prisma.refreshToken.delete({ where: { id: sessionId } });
  return { wasCurrentSession };
}

export async function revokeOtherSessions(userId: string, currentToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId, token: { not: currentToken } },
  });
}
```

- [ ] **Step 4: Add endpoints to `apps/api/src/routes/auth.router.ts`**

Append before `export default router;`:

```typescript
router.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentToken = req.cookies[COOKIE] as string | undefined;
    const sessions = await authService.getSessions(req.user!.id, currentToken ?? '');
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/sessions/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentToken = req.cookies[COOKIE] as string | undefined;
      const { wasCurrentSession } = await authService.revokeSession(
        req.params.id,
        req.user!.id,
        currentToken ?? '',
      );
      if (wasCurrentSession) {
        res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict' });
      }
      res.json({ message: 'Session revoked.' });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentToken = req.cookies[COOKIE] as string | undefined;
    await authService.revokeOtherSessions(req.user!.id, currentToken ?? '');
    res.json({ message: 'All other sessions revoked.' });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=auth
```

Expected: all tests PASS (including the new session management suite).

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/auth.service.ts \
        apps/api/src/routes/auth.router.ts \
        apps/api/tests/auth.test.ts
git commit -m "feat(api): add GET/DELETE /api/auth/sessions endpoints"
```

---

### Task 4: Shared SessionSchema

**Files:**
- Modify: `packages/shared/src/schemas/auth.schema.ts`

**Interfaces:**
- Produces: `SessionSchema`, `Session` type exported from `@mh-datapedia/shared`

- [ ] **Step 1: Append to `packages/shared/src/schemas/auth.schema.ts`**

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

- [ ] **Step 2: Build shared package**

```bash
pnpm --filter @mh-datapedia/shared build
```

Expected: no errors.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/auth.schema.ts packages/shared/dist/
git commit -m "feat(shared): add SessionSchema type"
```

---

### Task 5: Web sessions page + navbar link

**Files:**
- Create: `apps/web/src/hooks/useSessions.ts`
- Create: `apps/web/src/hooks/useRevokeSession.ts`
- Create: `apps/web/src/hooks/useRevokeOtherSessions.ts`
- Create: `apps/web/src/routes/account/sessions.tsx`
- Modify: `apps/web/src/components/layout/Navbar.tsx`
- Modify: `apps/web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `Session` type from `@mh-datapedia/shared`, `apiGet`, `apiDelete` from `../lib/api`, `useAuth` from `../context/AuthContext`
- Consumes: `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`, `DELETE /api/auth/sessions`

- [ ] **Step 1: Create `apps/web/src/hooks/useSessions.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { Session } from '@mh-datapedia/shared';

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiGet<Session[]>('/api/auth/sessions'),
  });
}
```

- [ ] **Step 2: Create `apps/web/src/hooks/useRevokeSession.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '../lib/api';

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => apiDelete(`/api/auth/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
```

- [ ] **Step 3: Create `apps/web/src/hooks/useRevokeOtherSessions.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '../lib/api';

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete('/api/auth/sessions'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
```

- [ ] **Step 4: Create `apps/web/src/routes/account/sessions.tsx`**

First read `apps/web/src/context/AuthContext.tsx` to confirm `useAuth` exports `user` and `logout`. Then write:

```tsx
import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useSessions } from '../../hooks/useSessions';
import { useRevokeSession } from '../../hooks/useRevokeSession';
import { useRevokeOtherSessions } from '../../hooks/useRevokeOtherSessions';
import type { Session } from '@mh-datapedia/shared';

export const Route = createFileRoute('/account/sessions')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: SessionsPage,
});

function SessionsPage() {
  const { logout } = useAuth();
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const otherSessions = sessions?.filter((s) => !s.isCurrent) ?? [];

  async function handleRevoke(session: Session) {
    if (session.isCurrent) {
      await revokeSession.mutateAsync(session.id);
      await logout();
    } else {
      revokeSession.mutate(session.id);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-stone-500 hover:text-stone-400 text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-stone-50 mt-2">Active Sessions</h1>
          <p className="text-stone-400 text-sm mt-1">
            Devices currently logged into your account.
          </p>
        </div>

        <div className="bg-stone-900 rounded-lg border border-stone-800 divide-y divide-stone-800">
          {isLoading && (
            <div className="p-6 text-stone-500 text-sm">Loading sessions…</div>
          )}

          {!isLoading && !sessions?.length && (
            <div className="p-6 text-stone-500 text-sm">No active sessions found.</div>
          )}

          {sessions?.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-stone-100 text-sm font-medium truncate">
                    {session.deviceLabel}
                  </span>
                  {session.isCurrent && (
                    <span className="bg-teal-700 text-stone-50 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0">
                      YOU
                    </span>
                  )}
                </div>
                <div className="text-stone-500 text-xs mt-0.5">
                  {session.ipAddress ?? 'Unknown IP'} ·{' '}
                  Last active {new Date(session.lastUsedAt).toLocaleDateString()}
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => handleRevoke(session)}
                  disabled={revokeSession.isPending}
                  className="text-red-400 hover:text-red-300 text-sm shrink-0 disabled:opacity-50"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>

        {otherSessions.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => revokeOthers.mutate()}
              disabled={revokeOthers.isPending}
              className="w-full border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-600 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              {revokeOthers.isPending ? 'Logging out…' : 'Log out all other devices'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add Sessions link to `apps/web/src/components/layout/Navbar.tsx`**

In the authenticated user section (where the username span and logout button are), add a Sessions link before the Logout button:

```tsx
<Link
  to="/account/sessions"
  className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm"
>
  Sessions
</Link>
```

The full authenticated section becomes:

```tsx
{user ? (
  <>
    <span className="text-stone-400 text-sm hidden sm:block">{user.username}</span>
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
    <Link
      to="/account/sessions"
      className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm"
    >
      Sessions
    </Link>
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Logout
    </Button>
  </>
) : (
  // ... unchanged
)}
```

- [ ] **Step 6: Register the new route in `apps/web/src/routeTree.gen.ts`**

Read the file first to understand the pattern. Add the import for `AccountSessionsRoute` following the same style as other route imports. Add it to the `routeTree` and `routesByPath` following the exact same pattern as existing routes (e.g. how `/forgot-password` and `/login` are registered). The route path is `/account/sessions`.

- [ ] **Step 7: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/useSessions.ts \
        apps/web/src/hooks/useRevokeSession.ts \
        apps/web/src/hooks/useRevokeOtherSessions.ts \
        apps/web/src/routes/account/sessions.tsx \
        apps/web/src/components/layout/Navbar.tsx \
        apps/web/src/routeTree.gen.ts
git commit -m "feat(web): add /account/sessions page with session revocation"
```
