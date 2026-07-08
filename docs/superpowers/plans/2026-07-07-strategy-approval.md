# Strategy Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PENDING → APPROVED / REJECTED approval workflow for strategies, with helpers, admins, and masters as reviewers and a dedicated web review queue.

**Architecture:** New `StrategyStatus` enum and three fields on `Strategy` gate visibility at the DB query level. The strategies fetch endpoint gains optional JWT parsing to return the requester's own pending/rejected items alongside approved ones. A new `PATCH /api/strategies/:id/review` endpoint handles approval/rejection. A new `/review` web page shows the pending queue to elevated roles.

**Tech Stack:** Prisma + PostgreSQL (schema + migration), Express (API), React + TanStack Router + TanStack Query (web), Zod (shared validation), Lucide React (icons), Jest + Supertest (tests).

## Global Constraints

- Monorepo root: `D:\Programacion\VSCode\mh-datapedia`
- API: `apps/api` — Express + Prisma + PostgreSQL
- Web: `apps/web` — React + TanStack Router + TanStack Query
- Shared: `packages/shared` — Zod schemas exported from `src/index.ts`
- All enums in Prisma use PascalCase; column names use camelCase
- `authorize('HELPER')` admits HELPER, ADMIN, and MASTER (rank-based, see `src/middleware/authorize.ts`)
- After editing `packages/shared`, run `pnpm --filter @mh-datapedia/shared build` before running API tests
- Test command: `pnpm --filter @mh-datapedia/api test` (runs serially via `maxWorkers: 1`)
- Existing test helpers in `apps/api/tests/helpers.ts`: `registerUser`, `registerAndPromoteAdmin`, `registerAndPromoteHelper`

---

### Task 1: DB schema + migration + shared Zod schemas

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (lines 106–118 — Strategy model; add enum before line 106)
- Create: `apps/api/prisma/migrations/<timestamp>_strategy_status/migration.sql`
- Modify: `packages/shared/src/schemas/strategy.schema.ts`

**Interfaces:**
- Produces:
  - `StrategyStatus` Prisma enum: `'PENDING' | 'APPROVED' | 'REJECTED'`
  - `Strategy` model gains: `status StrategyStatus @default(PENDING)`, `rejectionReason String?`, `rejectedAt DateTime?`
  - `StrategyStatusSchema` Zod enum exported from shared
  - `ReviewStrategySchema` Zod object exported from shared
  - Updated `StrategySchema` with `status`, `rejectionReason`, `rejectedAt` fields

- [ ] **Step 1: Update `schema.prisma`**

Add the enum directly before the `Strategy` model, and add the three new fields to `Strategy`:

```prisma
// Add this enum before the Strategy model (around line 106):
enum StrategyStatus {
  PENDING
  APPROVED
  REJECTED
}

model Strategy {
  id              String         @id @default(cuid())
  monsterId       String
  monster         Monster        @relation(fields: [monsterId], references: [id], onDelete: Cascade)
  title           String
  content         String         @db.Text
  difficulty      Difficulty
  game            MHGame
  authorId        String
  author          User           @relation(fields: [authorId], references: [id])
  status          StrategyStatus @default(PENDING)
  rejectionReason String?
  rejectedAt      DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

- [ ] **Step 2: Generate migration SQL**

From `apps/api/`:
```bash
pnpm prisma migrate dev --name strategy_status --create-only
```

This creates `apps/api/prisma/migrations/<timestamp>_strategy_status/migration.sql` with the schema diff. Open it and verify it contains the `CREATE TYPE "StrategyStatus"` and `ALTER TABLE "Strategy" ADD COLUMN` statements.

- [ ] **Step 3: Add the backfill to migration.sql**

Append this line to the generated `migration.sql`, after the `ALTER TABLE` statements:

```sql
-- Backfill: all existing strategies are considered approved
UPDATE "Strategy" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
```

(The `ADD COLUMN` statement defaults new rows to `'PENDING'`; existing rows are created with `'PENDING'` then immediately updated to `'APPROVED'` by this line.)

- [ ] **Step 4: Apply the migration**

```bash
pnpm prisma migrate dev
```

Expected output: `The following migration(s) have been applied: ... strategy_status`

- [ ] **Step 5: Update `packages/shared/src/schemas/strategy.schema.ts`**

Replace the entire file with:

```typescript
import { z } from 'zod';
import { MHGameSchema, DifficultySchema } from './enums.schema';

export const StrategyStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type StrategyStatus = z.infer<typeof StrategyStatusSchema>;

export const StrategySchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  title: z.string(),
  content: z.string(),
  difficulty: DifficultySchema,
  game: MHGameSchema,
  authorId: z.string(),
  author: z.object({ id: z.string(), username: z.string() }),
  status: StrategyStatusSchema,
  rejectionReason: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const CreateStrategySchema = z.object({
  monsterId: z.string().cuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  difficulty: DifficultySchema,
  game: MHGameSchema,
});
export type CreateStrategy = z.infer<typeof CreateStrategySchema>;

export const UpdateStrategySchema = CreateStrategySchema.partial().omit({ monsterId: true });
export type UpdateStrategy = z.infer<typeof UpdateStrategySchema>;

export const ReviewStrategySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(1).optional(),
}).refine(
  (data) => data.action !== 'reject' || !!data.reason,
  { message: 'Rejection reason is required', path: ['reason'] },
);
export type ReviewStrategy = z.infer<typeof ReviewStrategySchema>;
```

- [ ] **Step 6: Build shared package**

```bash
pnpm --filter @mh-datapedia/shared build
```

Expected: `dist/` updated with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/ packages/shared/
git commit -m "feat: add StrategyStatus enum and review Zod schema"
```

---

### Task 2: API — optional-auth strategies endpoint + review endpoint + pending queue

**Files:**
- Modify: `apps/api/src/services/monster.service.ts` (lines 6–19 `MONSTER_DETAIL_INCLUDE`, lines 80–87 `getStrategies`)
- Modify: `apps/api/src/services/strategy.service.ts` (add `reviewStrategy`, `getPendingStrategies`)
- Modify: `apps/api/src/routes/monsters.router.ts` (lines 62–64 `GET /:id/strategies`)
- Modify: `apps/api/src/routes/strategies.router.ts` (add `GET /pending` and `PATCH /:id/review`)
- Create: `apps/api/tests/strategies.test.ts`

**Interfaces:**
- Consumes from Task 1: `StrategyStatus` Prisma enum values (`'PENDING'`, `'APPROVED'`, `'REJECTED'`); `ReviewStrategySchema` from shared
- Produces:
  - `getStrategies(monsterId: string, requesterId?: string): Promise<Strategy[]>` — filters by status, lazy-cleans expired rejections
  - `reviewStrategy(id: string, action: 'approve' | 'reject', reason?: string): Promise<Strategy>` — updates status
  - `getPendingStrategies(): Promise<Strategy[]>` — all PENDING across all monsters

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/strategies.test.ts`:

```typescript
import request from 'supertest';
import { app, prisma, registerUser, registerAndPromoteAdmin, registerAndPromoteHelper } from './helpers';

let adminToken: string;
let helperToken: string;
let userToken: string;
let monsterId: string;

const STRATEGY_BODY = {
  title: 'Fire is effective',
  content: 'Use fire weapons for best results.',
  difficulty: 'Beginner',
  game: 'MONSTER_HUNTER_WILDS',
};

beforeAll(async () => {
  adminToken = await registerAndPromoteAdmin('strat-admin@example.com', 'stratadmin');
  helperToken = await registerAndPromoteHelper('strat-helper@example.com', 'strathelper');
  userToken = await registerUser('strat-user@example.com', 'stratuser');

  const res = await request(app)
    .post('/api/monsters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Approval Test Monster', title: 'Test', description: 'For testing.', type: 'FlyingWyvern' });
  monsterId = res.body.data.id;
});

afterAll(async () => {
  await prisma.strategy.deleteMany({ where: { monsterId } });
  await prisma.monster.deleteMany({ where: { id: monsterId } });
  await prisma.user.deleteMany({
    where: { email: { in: ['strat-admin@example.com', 'strat-helper@example.com', 'strat-user@example.com'] } },
  });
  await prisma.$disconnect();
});

describe('POST /api/strategies — creates as PENDING', () => {
  it('creates strategy with PENDING status', async () => {
    const res = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    await prisma.strategy.deleteMany({ where: { id: res.body.data.id } });
  });
});

describe('GET /monsters/:id/strategies — status filtering', () => {
  let pendingId: string;
  let approvedId: string;
  let rejectedId: string;

  beforeAll(async () => {
    // Create a PENDING strategy
    const p = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY });
    pendingId = p.body.data.id;

    // Approve one
    const a = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Approved strategy' });
    approvedId = a.body.data.id;
    await request(app)
      .patch(`/api/strategies/${approvedId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });

    // Reject one
    const r = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Rejected strategy' });
    rejectedId = r.body.data.id;
    await request(app)
      .patch(`/api/strategies/${rejectedId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject', reason: 'Inaccurate information' });
  });

  afterAll(async () => {
    await prisma.strategy.deleteMany({ where: { id: { in: [pendingId, approvedId, rejectedId] } } });
  });

  it('unauthenticated request returns only APPROVED', async () => {
    const res = await request(app).get(`/api/monsters/${monsterId}/strategies`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(pendingId);
    expect(ids).not.toContain(rejectedId);
  });

  it('authenticated request includes own PENDING and REJECTED', async () => {
    const res = await request(app)
      .get(`/api/monsters/${monsterId}/strategies`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(approvedId);
    expect(ids).toContain(pendingId);
    expect(ids).toContain(rejectedId);
  });

  it('lazy-deletes REJECTED strategies older than 3 days on fetch', async () => {
    // Create a rejected strategy then manually backdate its rejectedAt
    const s = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Old rejected' });
    const oldId = s.body.data.id;
    await request(app)
      .patch(`/api/strategies/${oldId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject', reason: 'Too old' });
    // Backdate rejectedAt to 4 days ago
    await prisma.strategy.update({
      where: { id: oldId },
      data: { rejectedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    });

    // Fetch triggers lazy cleanup
    await request(app).get(`/api/monsters/${monsterId}/strategies`);

    const still = await prisma.strategy.findUnique({ where: { id: oldId } });
    expect(still).toBeNull();
  });
});

describe('PATCH /api/strategies/:id/review', () => {
  let stratId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY });
    stratId = res.body.data.id;
  });

  afterEach(async () => {
    await prisma.strategy.deleteMany({ where: { id: stratId } });
  });

  it('HELPER can approve a PENDING strategy', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('HELPER can reject a PENDING strategy with reason', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject', reason: 'Content is inaccurate' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toBe('Content is inaccurate');
    expect(res.body.data.rejectedAt).not.toBeNull();
  });

  it('returns 400 when rejecting without a reason', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when strategy is not PENDING', async () => {
    await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(409);
  });

  it('returns 403 for USER role', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/strategies/pending', () => {
  let pendingId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Queue test strategy' });
    pendingId = res.body.data.id;
  });

  afterAll(async () => {
    await prisma.strategy.deleteMany({ where: { id: pendingId } });
  });

  it('HELPER can fetch the pending queue', async () => {
    const res = await request(app)
      .get('/api/strategies/pending')
      .set('Authorization', `Bearer ${helperToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(pendingId);
  });

  it('returns 403 for USER role', async () => {
    const res = await request(app)
      .get('/api/strategies/pending')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern=strategies
```

Expected: Multiple test failures (endpoints don't exist yet).

- [ ] **Step 3: Update `getStrategies` in `apps/api/src/services/monster.service.ts`**

Replace the existing `getStrategies` function (lines 80–87):

```typescript
export async function getStrategies(monsterId: string, requesterId?: string) {
  await assertExists(monsterId);

  // Lazy cleanup: delete REJECTED strategies older than 3 days
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.strategy.deleteMany({
    where: { monsterId, status: 'REJECTED', rejectedAt: { lt: cutoff } },
  });

  return prisma.strategy.findMany({
    where: {
      monsterId,
      OR: [
        { status: 'APPROVED' },
        ...(requesterId
          ? [{ authorId: requesterId, status: { in: ['PENDING', 'REJECTED'] as const } }]
          : []),
      ],
    },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
```

- [ ] **Step 4: Update `MONSTER_DETAIL_INCLUDE` in `apps/api/src/services/monster.service.ts`**

The full monster detail endpoint is public (no auth). Update `MONSTER_DETAIL_INCLUDE` (lines 6–19) to only include APPROVED strategies:

```typescript
const MONSTER_DETAIL_INCLUDE = {
  weaknesses: true,
  hitzones: true,
  strategies: {
    where: { status: 'APPROVED' as const },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  ailments: true,
  drops: { orderBy: [{ game: 'asc' as const }, { rank: 'asc' as const }, { method: 'asc' as const }] },
  subspecies: {
    select: { id: true, name: true, type: true, iconUrl: true, imageUrl: true, title: true },
  },
  parent: { select: { id: true, name: true } },
};
```

- [ ] **Step 5: Update `GET /:id/strategies` route with optional auth in `apps/api/src/routes/monsters.router.ts`**

Add `jwt` and `env` imports at the top of the file (after the existing imports):

```typescript
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
```

Replace the existing `GET /:id/strategies` handler (lines 62–64):

```typescript
router.get('/:id/strategies', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  let requesterId: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), env.JWT_SECRET) as { sub: string };
      requesterId = payload.sub;
    } catch { /* ignore invalid/expired token — treat as anonymous */ }
  }
  res.json({ data: await monsterService.getStrategies(req.params.id, requesterId) });
}));
```

- [ ] **Step 6: Add `reviewStrategy` and `getPendingStrategies` to `apps/api/src/services/strategy.service.ts`**

Append to the end of the file (after `deleteStrategy`):

```typescript
export async function reviewStrategy(
  id: string,
  action: 'approve' | 'reject',
  reason?: string,
) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (strategy.status !== 'PENDING') {
    throw new AppError(409, 'Strategy is not pending review', 'CONFLICT');
  }

  const data =
    action === 'approve'
      ? { status: 'APPROVED' as const, rejectionReason: null, rejectedAt: null }
      : { status: 'REJECTED' as const, rejectionReason: reason!, rejectedAt: new Date() };

  return prisma.strategy.update({
    where: { id },
    data,
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function getPendingStrategies() {
  return prisma.strategy.findMany({
    where: { status: 'PENDING' },
    include: {
      author: { select: { id: true, username: true } },
      monster: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}
```

- [ ] **Step 7: Add new routes to `apps/api/src/routes/strategies.router.ts`**

Add the `ReviewStrategySchema` import and `authorize` import at the top:

```typescript
import { authorize } from '../middleware/authorize';
import { CreateStrategySchema, UpdateStrategySchema, ReviewStrategySchema } from '@mh-datapedia/shared';
```

Add these two new routes after the existing `router.delete` block:

```typescript
router.get('/pending', authenticate, authorize('HELPER'), wrap(async (req, res) => {
  res.json({ data: await strategyService.getPendingStrategies() });
}));

router.patch(
  '/:id/review',
  authenticate,
  authorize('HELPER'),
  validate(IdParamSchema, 'params'),
  validate(ReviewStrategySchema),
  wrap(async (req, res) => {
    const strategy = await strategyService.reviewStrategy(
      req.params.id,
      req.body.action,
      req.body.reason,
    );
    res.json({ data: strategy });
  }),
);
```

Also add `IdParamSchema` (it's already in `strategies.router.ts`? Let's check — if not, add):

```typescript
const IdParamSchema = z.object({ id: z.string() });
```

(Only add this line if it doesn't already exist in the file.)

- [ ] **Step 8: Run tests — verify they pass**

```bash
pnpm --filter @mh-datapedia/api test -- --testPathPattern=strategies
```

Expected: All strategy tests pass.

- [ ] **Step 9: Run full test suite**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: All tests pass (no regressions).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/ apps/api/tests/strategies.test.ts
git commit -m "feat(api): strategy review endpoint, pending queue, and optional-auth strategies fetch"
```

---

### Task 3: Web — StrategiesTab updates (crown icon + status badges)

**Files:**
- Modify: `apps/web/src/lib/types.ts` (Strategy interface)
- Modify: `apps/web/src/components/monsters/detail/tabs/StrategiesTab.tsx`

**Interfaces:**
- Consumes from Task 2: `GET /monsters/:id/strategies` now returns `status`, `rejectionReason`, `rejectedAt` fields; also returns the requester's own PENDING/REJECTED strategies when an auth header is present (the web's `apiGet` already sends the auth header automatically when logged in)
- Produces: Updated `StrategiesTab` with crown icon on own strategies, status badges on pending/rejected

- [ ] **Step 1: Update `Strategy` type in `apps/web/src/lib/types.ts`**

Replace the `Strategy` interface (lines 33–43):

```typescript
export interface Strategy {
  id: string;
  monsterId: string;
  title: string;
  content: string;
  difficulty: string;
  game: string;
  authorId: string;
  author: { id: string; username: string };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Update `StrategiesTab.tsx`**

Replace the entire file with:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateStrategySchema } from '@mh-datapedia/shared';
import type { CreateStrategy } from '@mh-datapedia/shared';
import { Crown } from 'lucide-react';
import { useStrategies } from '../../../../hooks/useStrategies';
import { useCreateStrategy } from '../../../../hooks/useCreateStrategy';
import { useUpdateStrategy } from '../../../../hooks/useUpdateStrategy';
import { useDeleteStrategy } from '../../../../hooks/useDeleteStrategy';
import { Spinner } from '../../../ui/Spinner';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Modal } from '../../../ui/Modal';
import { Input } from '../../../ui/Input';
import { GAME_NAMES, DIFFICULTY_CLASSES } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';
import { useAuth } from '../../../../context/AuthContext';
import type { Strategy } from '../../../../lib/types';
import { Pencil, Trash2 } from 'lucide-react';

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
const GAME_IDS = ['MONSTER_HUNTER_WILDS'] as const;

function StrategyForm({
  monsterId,
  initial,
  onSave,
  onCancel,
}: {
  monsterId: string;
  initial?: Strategy;
  onSave: (data: CreateStrategy) => Promise<void>;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateStrategy>({
    resolver: zodResolver(CreateStrategySchema),
    defaultValues: initial
      ? {
          monsterId,
          title: initial.title,
          content: initial.content,
          difficulty: initial.difficulty as CreateStrategy['difficulty'],
          game: initial.game as CreateStrategy['game'],
        }
      : { monsterId },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-3 bg-stone-900 border border-stone-800 rounded p-4">
      <input type="hidden" value={monsterId} {...register('monsterId')} />
      <Input label="Title" error={errors.title?.message} {...register('title')} />
      <div>
        <label className="block text-stone-300 text-sm mb-1">Content</label>
        <textarea
          className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          {...register('content')}
        />
        {errors.content && <p className="mt-1 text-red-400 text-xs">{errors.content.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-stone-300 text-sm mb-1">Difficulty</label>
          <select className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent" {...register('difficulty')}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-stone-300 text-sm mb-1">Game</label>
          <select className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent" {...register('game')}>
            {GAME_IDS.map((g) => <option key={g} value={g}>{GAME_NAMES[g]}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : initial ? 'Save changes' : 'Post strategy'}
        </Button>
      </div>
    </form>
  );
}

export function StrategiesTab({ monsterId }: { monsterId: string }) {
  const { data: strategies, isLoading } = useStrategies(monsterId);
  const { user } = useAuth();
  const createStrategy = useCreateStrategy(monsterId);
  const updateStrategy = useUpdateStrategy(monsterId);
  const deleteStrategy = useDeleteStrategy(monsterId);

  const [writing, setWriting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const isOwn = (s: Strategy) => !!user && user.id === s.authorId;
  const canEdit = (s: Strategy) =>
    s.status === 'APPROVED' &&
    user &&
    (['ADMIN', 'MASTER'].includes(user.role) || user.id === s.authorId);
  const canDelete = (s: Strategy) =>
    user && (['ADMIN', 'MASTER'].includes(user.role) || user.id === s.authorId);

  const approvedCount = strategies?.filter((s) => s.status === 'APPROVED').length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-stone-400 text-sm">{approvedCount} strategies</h3>
        {user && !writing && (
          <button
            onClick={() => setWriting(true)}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            + Write strategy
          </button>
        )}
      </div>

      {writing && (
        <StrategyForm
          monsterId={monsterId}
          onSave={async (data) => {
            await createStrategy.mutateAsync(data);
            setWriting(false);
          }}
          onCancel={() => setWriting(false)}
        />
      )}

      {!strategies?.length && !writing && (
        <p className="text-stone-500 text-sm py-4">No strategies yet. Be the first to contribute!</p>
      )}

      {strategies?.map((s) =>
        editingId === s.id ? (
          <StrategyForm
            key={s.id}
            monsterId={monsterId}
            initial={s}
            onSave={async (data) => {
              const { monsterId: _mid, ...rest } = data;
              await updateStrategy.mutateAsync({ id: s.id, data: rest });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            key={s.id}
            className={cn(
              'bg-stone-900 border rounded p-4 space-y-2',
              s.status === 'PENDING' ? 'border-amber-800/50' : s.status === 'REJECTED' ? 'border-red-900/50' : 'border-stone-800',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isOwn(s) && (
                  <Crown size={13} className="text-yellow-500 shrink-0" />
                )}
                <h4 className="font-medium text-stone-50 truncate">{s.title}</h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === 'PENDING' && (
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-800/50 text-[10px]">
                    Pending review
                  </Badge>
                )}
                {s.status === 'REJECTED' && (
                  <Badge className="bg-red-500/10 text-red-400 border border-red-900/50 text-[10px]">
                    Rejected
                  </Badge>
                )}
                {s.status === 'APPROVED' && (
                  <Badge className={cn(DIFFICULTY_CLASSES[s.difficulty] ?? 'bg-stone-700 text-stone-400')}>
                    {s.difficulty}
                  </Badge>
                )}
                {canEdit(s) && (
                  <button
                    onClick={() => setEditingId(s.id)}
                    className="text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                {canDelete(s) && (
                  <button
                    onClick={() => setDeletingId(s.id)}
                    className="text-stone-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {s.status === 'REJECTED' && s.rejectionReason && (
              <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded px-3 py-2">
                {s.rejectionReason}
              </p>
            )}

            {s.status !== 'REJECTED' && (
              <p className="text-stone-400 text-sm leading-relaxed">{s.content}</p>
            )}

            <div className="flex items-center gap-2 text-xs text-stone-600">
              <span>by {s.author.username}</span>
              <span>·</span>
              <span>{GAME_NAMES[s.game] ?? s.game}</span>
            </div>
          </div>
        )
      )}

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete Strategy">
        <div className="space-y-4">
          <p className="text-stone-300 text-sm">Delete this strategy? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={deleteStrategy.isPending}
              onClick={async () => {
                if (deletingId) {
                  await deleteStrategy.mutateAsync(deletingId);
                  setDeletingId(null);
                }
              }}
            >
              {deleteStrategy.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/components/monsters/detail/tabs/StrategiesTab.tsx
git commit -m "feat(web): crown icon and status badges on StrategiesTab"
```

---

### Task 4: Web — Review page + navbar link

**Files:**
- Create: `apps/web/src/hooks/useReviewQueue.ts`
- Create: `apps/web/src/hooks/useReviewStrategy.ts`
- Create: `apps/web/src/routes/review.tsx`
- Modify: `apps/web/src/components/layout/Navbar.tsx` (add Review link, lines 71–79)

**Interfaces:**
- Consumes from Task 2:
  - `GET /api/strategies/pending` → `{ data: PendingStrategy[] }` where `PendingStrategy` is `Strategy & { monster: { id: string; name: string } }`
  - `PATCH /api/strategies/:id/review` → `{ data: Strategy }`
- Consumes from Task 3: `Strategy` type (already has `status`, `rejectionReason`)

- [ ] **Step 1: Create `apps/web/src/hooks/useReviewQueue.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { Strategy } from '../lib/types';

export interface PendingStrategy extends Strategy {
  monster: { id: string; name: string };
}

export function useReviewQueue() {
  return useQuery({
    queryKey: ['strategies', 'pending'],
    queryFn: () =>
      apiGet<{ data: PendingStrategy[] }>('/api/strategies/pending').then((r) => r.data),
  });
}
```

- [ ] **Step 2: Create `apps/web/src/hooks/useReviewStrategy.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '../lib/api';
import type { Strategy } from '../lib/types';

interface ReviewPayload {
  id: string;
  action: 'approve' | 'reject';
  reason?: string;
}

export function useReviewStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: ReviewPayload) =>
      apiPatch<{ data: Strategy }>(`/api/strategies/${id}/review`, { action, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies', 'pending'] });
    },
  });
}
```

- [ ] **Step 3: Create `apps/web/src/routes/review.tsx`**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useReviewStrategy } from '../hooks/useReviewStrategy';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { GAME_NAMES, DIFFICULTY_CLASSES } from '../lib/constants';
import { cn } from '../lib/utils';
import type { Role } from '@mh-datapedia/shared';

const ROLE_RANK: Record<Role, number> = { USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3 };

export const Route = createFileRoute('/review')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/' });
    if (ROLE_RANK[context.auth.user.role as Role] < ROLE_RANK['HELPER']) throw redirect({ to: '/' });
  },
  component: ReviewPage,
});

function ReviewPage() {
  const { data: queue, isLoading } = useReviewQueue();
  const reviewStrategy = useReviewStrategy();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const handleApprove = (id: string) => {
    reviewStrategy.mutate({ id, action: 'approve' });
  };

  const handleRejectSubmit = (id: string) => {
    if (!reason.trim()) {
      setReasonError('Reason is required');
      return;
    }
    reviewStrategy.mutate(
      { id, action: 'reject', reason: reason.trim() },
      {
        onSuccess: () => {
          setRejectingId(null);
          setReason('');
          setReasonError('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-display font-bold text-stone-50 mb-6">
        Strategy Review Queue
        {!!queue?.length && (
          <span className="ml-3 text-sm font-normal text-stone-400">{queue.length} pending</span>
        )}
      </h1>

      {!queue?.length && (
        <p className="text-stone-500 text-sm">No strategies pending review.</p>
      )}

      <div className="space-y-4">
        {queue?.map((s) => (
          <div key={s.id} className="bg-stone-900 border border-stone-800 rounded p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-xs text-stone-500">
                  {s.monster.name} · by {s.author.username}
                </p>
                <h3 className="font-medium text-stone-50">{s.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn(DIFFICULTY_CLASSES[s.difficulty] ?? 'bg-stone-700 text-stone-400')}>
                  {s.difficulty}
                </Badge>
                <Badge className="bg-stone-800 text-stone-400 border border-stone-700">
                  {GAME_NAMES[s.game] ?? s.game}
                </Badge>
              </div>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{s.content}</p>

            {rejectingId === s.id ? (
              <div className="space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
                  placeholder="Rejection reason (required)"
                  className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {reasonError && <p className="text-red-400 text-xs">{reasonError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setRejectingId(null); setReason(''); setReasonError(''); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={reviewStrategy.isPending}
                    onClick={() => handleRejectSubmit(s.id)}
                  >
                    {reviewStrategy.isPending ? 'Rejecting…' : 'Confirm rejection'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={reviewStrategy.isPending}
                  onClick={() => handleApprove(s.id)}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={reviewStrategy.isPending}
                  onClick={() => { setRejectingId(s.id); setReason(''); setReasonError(''); }}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `Navbar.tsx` — add Review link**

In `apps/web/src/components/layout/Navbar.tsx`, add the Review link after the Admin link block (after line 79):

```tsx
{user && ['HELPER', 'ADMIN', 'MASTER'].includes(user.role) && (
  <Link
    to="/review"
    className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
    activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
  >
    Review
  </Link>
)}
```

- [ ] **Step 5: Register the route in the router**

Check `apps/web/src/routes/__root.tsx` — TanStack Router auto-discovers file-based routes, so `review.tsx` will be registered automatically. Confirm by running the dev server and navigating to `/review` as a HELPER user.

- [ ] **Step 6: Verify TypeScript**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: No errors.

- [ ] **Step 7: Run full API test suite one final time**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/useReviewQueue.ts apps/web/src/hooks/useReviewStrategy.ts apps/web/src/routes/review.tsx apps/web/src/components/layout/Navbar.tsx
git commit -m "feat(web): strategy review queue page and navbar link for helpers"
```
