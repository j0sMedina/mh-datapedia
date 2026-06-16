# Admin Weaknesses & Hitzones Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins edit a monster's element weaknesses and hitzone values directly from the Weaknesses and Hitzones tabs on the monster detail page.

**Architecture:** Two new `PUT` endpoints (`/api/monsters/:id/weaknesses` and `/api/monsters/:id/hitzones`) use a replace-all pattern (delete + createMany in a transaction). The frontend tabs gain an inline edit mode toggled by an admin-only button; no separate modals.

**Tech Stack:** Express + Prisma + Zod (API); React + TanStack Query + Tailwind (web); `@mh-datapedia/shared` for shared Zod schemas.

---

## File Map

| File | Action |
|------|--------|
| `packages/shared/src/schemas/weakness.schema.ts` | Add `UpsertWeaknessItemSchema`, `UpsertWeaknessesSchema`, `UpsertWeaknesses` |
| `packages/shared/src/schemas/hitzone.schema.ts` | Add `UpsertHitzoneItemSchema`, `UpsertHitzonesSchema`, `UpsertHitzones` |
| `apps/api/src/services/monster.service.ts` | Add `upsertWeaknesses`, `upsertHitzones` |
| `apps/api/src/routes/monsters.router.ts` | Add two `PUT` route handlers + import new schemas |
| `apps/api/tests/monsters.test.ts` | Add describe blocks for the two new endpoints |
| `apps/web/src/hooks/useUpdateWeaknesses.ts` | New file — TanStack mutation |
| `apps/web/src/hooks/useUpdateHitzones.ts` | New file — TanStack mutation |
| `apps/web/src/components/monsters/detail/tabs/WeaknessesTab.tsx` | Replace with edit-mode-aware version |
| `apps/web/src/components/monsters/detail/tabs/HitzonesTab.tsx` | Replace with edit-mode-aware version |

---

## Task 1: Add shared Zod schemas

**Files:**
- Modify: `packages/shared/src/schemas/weakness.schema.ts`
- Modify: `packages/shared/src/schemas/hitzone.schema.ts`

- [ ] **Step 1: Add upsert schemas to weakness.schema.ts**

Replace the full file content with:

```ts
import { z } from 'zod';
import { ElementSchema, WeaknessRatingSchema } from './enums.schema';

export const ElementWeaknessSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  element: ElementSchema,
  rating: WeaknessRatingSchema,
  isImmune: z.boolean(),
});
export type ElementWeakness = z.infer<typeof ElementWeaknessSchema>;

export const UpsertWeaknessItemSchema = z.object({
  element: ElementSchema,
  rating: WeaknessRatingSchema,
  isImmune: z.boolean(),
});
export const UpsertWeaknessesSchema = z.array(UpsertWeaknessItemSchema);
export type UpsertWeaknesses = z.infer<typeof UpsertWeaknessesSchema>;
```

- [ ] **Step 2: Add upsert schemas to hitzone.schema.ts**

Replace the full file content with:

```ts
import { z } from 'zod';

const hitzoneValue = z.number().int().min(0).max(100);

export const HitzoneSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  part: z.string(),
  cut: hitzoneValue,
  blunt: hitzoneValue,
  bullet: hitzoneValue,
  fire: hitzoneValue,
  water: hitzoneValue,
  thunder: hitzoneValue,
  ice: hitzoneValue,
  dragon: hitzoneValue,
});
export type Hitzone = z.infer<typeof HitzoneSchema>;

export const UpsertHitzoneItemSchema = z.object({
  part: z.string().min(1),
  cut: hitzoneValue,
  blunt: hitzoneValue,
  bullet: hitzoneValue,
  fire: hitzoneValue,
  water: hitzoneValue,
  thunder: hitzoneValue,
  ice: hitzoneValue,
  dragon: hitzoneValue,
});
export const UpsertHitzonesSchema = z.array(UpsertHitzoneItemSchema);
export type UpsertHitzones = z.infer<typeof UpsertHitzonesSchema>;
```

- [ ] **Step 3: Build the shared package**

Run from the repo root:
```bash
pnpm --filter @mh-datapedia/shared build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/weakness.schema.ts packages/shared/src/schemas/hitzone.schema.ts packages/shared/dist
git commit -m "feat(shared): add UpsertWeaknessesSchema and UpsertHitzonesSchema"
```

---

## Task 2: Write failing API tests

**Files:**
- Modify: `apps/api/tests/monsters.test.ts`

The existing file already has `adminToken` and `testMonsterId` set up in `beforeAll`. Append two new `describe` blocks after the existing `POST /api/monsters` block (after line 99).

- [ ] **Step 1: Append test blocks to monsters.test.ts**

Append to the bottom of `apps/api/tests/monsters.test.ts`:

```ts
describe('PUT /api/monsters/:id/weaknesses', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .send([]);
    expect(res.status).toBe(401);
  });

  it('returns 200 with stored weaknesses for admin', async () => {
    const payload = [
      { element: 'Fire', rating: 3, isImmune: false },
      { element: 'Water', rating: 0, isImmune: true },
    ];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    const fire = res.body.data.find((w: any) => w.element === 'Fire');
    expect(fire.rating).toBe(3);
    expect(fire.isImmune).toBe(false);
    const water = res.body.data.find((w: any) => w.element === 'Water');
    expect(water.isImmune).toBe(true);
  });

  it('replaces all on second call', async () => {
    const payload = [{ element: 'Dragon', rating: 2, isImmune: false }];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].element).toBe('Dragon');
  });
});

describe('PUT /api/monsters/:id/hitzones', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .send([]);
    expect(res.status).toBe(401);
  });

  it('returns 200 with stored hitzones for admin', async () => {
    const payload = [
      { part: 'Head', cut: 70, blunt: 70, bullet: 60, fire: 0, water: 5, thunder: 15, ice: 5, dragon: 25 },
      { part: 'Body', cut: 45, blunt: 45, bullet: 40, fire: 0, water: 5, thunder: 10, ice: 0, dragon: 15 },
    ];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    const head = res.body.data.find((h: any) => h.part === 'Head');
    expect(head.cut).toBe(70);
    expect(head.dragon).toBe(25);
  });

  it('replaces all on second call', async () => {
    const payload = [
      { part: 'Tail', cut: 80, blunt: 60, bullet: 55, fire: 0, water: 0, thunder: 5, ice: 5, dragon: 10 },
    ];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].part).toBe('Tail');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: the 6 new tests fail with 404 (route not found). All previously passing tests still pass.

- [ ] **Step 3: Commit failing tests**

```bash
git add apps/api/tests/monsters.test.ts
git commit -m "test(api): add failing tests for PUT weaknesses and hitzones endpoints"
```

---

## Task 3: Implement service functions and route handlers

**Files:**
- Modify: `apps/api/src/services/monster.service.ts`
- Modify: `apps/api/src/routes/monsters.router.ts`

- [ ] **Step 1: Add service functions to monster.service.ts**

In `apps/api/src/services/monster.service.ts`, replace the existing `@mh-datapedia/shared` import line:

```ts
// Before:
import type { MonsterFilters, CreateMonster, UpdateMonster } from '@mh-datapedia/shared';

// After:
import type { MonsterFilters, CreateMonster, UpdateMonster, UpsertWeaknesses, UpsertHitzones } from '@mh-datapedia/shared';
```

Then append these two functions at the bottom of the file (before the closing, after `deleteMonster`):

```ts
export async function upsertWeaknesses(monsterId: string, items: UpsertWeaknesses) {
  await assertExists(monsterId);
  await prisma.$transaction([
    prisma.elementWeakness.deleteMany({ where: { monsterId } }),
    prisma.elementWeakness.createMany({
      data: items.map((w) => ({ ...w, monsterId })),
    }),
  ]);
  return prisma.elementWeakness.findMany({ where: { monsterId } });
}

export async function upsertHitzones(monsterId: string, items: UpsertHitzones) {
  await assertExists(monsterId);
  await prisma.$transaction([
    prisma.hitzone.deleteMany({ where: { monsterId } }),
    prisma.hitzone.createMany({
      data: items.map((h) => ({ ...h, monsterId })),
    }),
  ]);
  return prisma.hitzone.findMany({ where: { monsterId }, orderBy: { part: 'asc' } });
}
```

- [ ] **Step 2: Add route handlers to monsters.router.ts**

In `apps/api/src/routes/monsters.router.ts`, update the import from `@mh-datapedia/shared` to include the new schemas:

```ts
import {
  MonsterFiltersSchema,
  CreateMonsterSchema,
  UpdateMonsterSchema,
  MHGameSchema,
  RankSchema,
  UpsertWeaknessesSchema,
  UpsertHitzonesSchema,
} from '@mh-datapedia/shared';
```

Then append these two route handlers after the existing `router.delete` block (before `export default router`):

```ts
router.put(
  '/:id/weaknesses',
  authenticate,
  authorize('ADMIN'),
  validate(IdParamSchema, 'params'),
  validate(UpsertWeaknessesSchema),
  wrap(async (req, res) => {
    res.json({ data: await monsterService.upsertWeaknesses(req.params.id, req.body) });
  }),
);

router.put(
  '/:id/hitzones',
  authenticate,
  authorize('ADMIN'),
  validate(IdParamSchema, 'params'),
  validate(UpsertHitzonesSchema),
  wrap(async (req, res) => {
    res.json({ data: await monsterService.upsertHitzones(req.params.id, req.body) });
  }),
);
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
pnpm --filter @mh-datapedia/api test
```

Expected: all tests pass including the 6 new ones.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/monster.service.ts apps/api/src/routes/monsters.router.ts
git commit -m "feat(api): add PUT weaknesses and hitzones endpoints"
```

---

## Task 4: Add useUpdateWeaknesses hook

**Files:**
- Create: `apps/web/src/hooks/useUpdateWeaknesses.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/useUpdateWeaknesses.ts` with this content:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../lib/api';
import type { UpsertWeaknesses } from '@mh-datapedia/shared';
import type { ElementWeakness } from '../lib/types';

export function useUpdateWeaknesses(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertWeaknesses) =>
      apiPut<{ data: ElementWeakness[] }>(`/api/monsters/${monsterId}/weaknesses`, data).then(
        (r) => r.data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'weaknesses'] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useUpdateWeaknesses.ts
git commit -m "feat(web): add useUpdateWeaknesses hook"
```

---

## Task 5: Add useUpdateHitzones hook

**Files:**
- Create: `apps/web/src/hooks/useUpdateHitzones.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/useUpdateHitzones.ts` with this content:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../lib/api';
import type { UpsertHitzones } from '@mh-datapedia/shared';
import type { Hitzone } from '../lib/types';

export function useUpdateHitzones(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertHitzones) =>
      apiPut<{ data: Hitzone[] }>(`/api/monsters/${monsterId}/hitzones`, data).then(
        (r) => r.data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'hitzones'] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useUpdateHitzones.ts
git commit -m "feat(web): add useUpdateHitzones hook"
```

---

## Task 6: Update WeaknessesTab with inline edit mode

**Files:**
- Modify: `apps/web/src/components/monsters/detail/tabs/WeaknessesTab.tsx`

This replaces the entire file. The component gains admin-only "Edit weaknesses" button, a `draft` state (map of element → `{ rating, isImmune }`), and a `ClickableStars` subcomponent.

- [ ] **Step 1: Replace WeaknessesTab.tsx**

Replace the full content of `apps/web/src/components/monsters/detail/tabs/WeaknessesTab.tsx`:

```tsx
import { useState } from 'react';
import { useWeaknesses } from '../../../../hooks/useWeaknesses';
import { useUpdateWeaknesses } from '../../../../hooks/useUpdateWeaknesses';
import { useAuth } from '../../../../context/AuthContext';
import { Spinner } from '../../../ui/Spinner';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { ELEMENT_COLORS } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';
import type { UpsertWeaknesses, Element } from '@mh-datapedia/shared';

const ALL_ELEMENTS = [
  'Fire', 'Water', 'Thunder', 'Ice', 'Dragon',
  'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun',
] as const;

type WeaknessDraft = { rating: 0 | 1 | 2 | 3; isImmune: boolean };

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('text-base', i <= rating ? 'text-amber-400' : 'text-stone-700')}>
          ★
        </span>
      ))}
    </div>
  );
}

function ClickableStars({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (r: 0 | 1 | 2 | 3) => void;
}) {
  return (
    <div className="flex gap-0.5 justify-center">
      {([1, 2, 3] as const).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i === rating ? ((i - 1) as 0 | 1 | 2) : i)}
          className={cn(
            'text-base leading-none hover:scale-110 transition-transform',
            i <= rating ? 'text-amber-400' : 'text-stone-700 hover:text-stone-500',
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function WeaknessesTab({ monsterId }: { monsterId: string }) {
  const { data: weaknesses, isLoading } = useWeaknesses(monsterId);
  const { user } = useAuth();
  const updateWeaknesses = useUpdateWeaknesses(monsterId);
  const isAdmin = user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, WeaknessDraft>>({});

  const enterEdit = () => {
    const initial: Record<string, WeaknessDraft> = {};
    for (const el of ALL_ELEMENTS) {
      const existing = weaknesses?.find((w) => w.element === el);
      initial[el] = existing
        ? { rating: existing.rating as 0 | 1 | 2 | 3, isImmune: existing.isImmune }
        : { rating: 0, isImmune: false };
    }
    setDraft(initial);
    setEditing(true);
  };

  const handleSave = async () => {
    const payload: UpsertWeaknesses = ALL_ELEMENTS.map((el) => ({
      element: el as Element,
      rating: draft[el].rating,
      isImmune: draft[el].isImmune,
    }));
    await updateWeaknesses.mutateAsync(payload);
    setEditing(false);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ALL_ELEMENTS.map((element) => {
            const d = draft[element];
            return (
              <div
                key={element}
                className="bg-stone-900 border border-stone-700 rounded p-3 text-center space-y-2"
              >
                <div className={cn('font-medium text-sm', ELEMENT_COLORS[element] ?? 'text-stone-400')}>
                  {element}
                </div>
                <ClickableStars
                  rating={d.isImmune ? 0 : d.rating}
                  onChange={(r) =>
                    setDraft((prev) => ({ ...prev, [element]: { rating: r, isImmune: false } }))
                  }
                />
                <label className="flex items-center justify-center gap-1 text-xs text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.isImmune}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [element]: {
                          rating: e.target.checked ? 0 : prev[element].rating,
                          isImmune: e.target.checked,
                        },
                      }))
                    }
                    className="accent-red-500"
                  />
                  Immune
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateWeaknesses.isPending}>
            {updateWeaknesses.isPending ? 'Saving…' : 'Save weaknesses'}
          </Button>
        </div>
      </div>
    );
  }

  const weaknessMap = Object.fromEntries((weaknesses ?? []).map((w) => [w.element, w]));

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={enterEdit}
            className="text-sm text-amber-500 hover:text-amber-400 transition-colors duration-150"
          >
            Edit weaknesses
          </button>
        </div>
      )}
      {!weaknesses?.length ? (
        <p className="text-stone-400 text-sm">No weakness data available.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ALL_ELEMENTS.map((element) => {
            const w = weaknessMap[element];
            return (
              <div key={element} className="bg-stone-900 border border-stone-800 rounded p-3 text-center">
                <div className={cn('font-medium text-sm mb-2', ELEMENT_COLORS[element] ?? 'text-stone-400')}>
                  {element}
                </div>
                {!w ? (
                  <Stars rating={0} />
                ) : w.isImmune ? (
                  <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">Immune</Badge>
                ) : (
                  <Stars rating={w.rating} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/monsters/detail/tabs/WeaknessesTab.tsx
git commit -m "feat(web): add inline edit mode to WeaknessesTab"
```

---

## Task 7: Update HitzonesTab with inline edit mode

**Files:**
- Modify: `apps/web/src/components/monsters/detail/tabs/HitzonesTab.tsx`

This replaces the entire file. The component gains an admin-only "Edit hitzones" button, a `rows` state (local copy of hitzones without `id`), an editable table, a "+ Add part" button, and trash icons per row.

- [ ] **Step 1: Replace HitzonesTab.tsx**

Replace the full content of `apps/web/src/components/monsters/detail/tabs/HitzonesTab.tsx`:

```tsx
import { useState } from 'react';
import { useHitzones } from '../../../../hooks/useHitzones';
import { useUpdateHitzones } from '../../../../hooks/useUpdateHitzones';
import { useAuth } from '../../../../context/AuthContext';
import { Spinner } from '../../../ui/Spinner';
import { Button } from '../../../ui/Button';
import { cn } from '../../../../lib/utils';
import type { Hitzone } from '../../../../lib/types';
import type { UpsertHitzones } from '@mh-datapedia/shared';
import { Trash2 } from 'lucide-react';

const COLS: (keyof Omit<Hitzone, 'id' | 'part'>)[] = [
  'cut', 'blunt', 'bullet', 'fire', 'water', 'thunder', 'ice', 'dragon',
];

const COL_LABELS: Record<string, string> = {
  cut: 'Cut', blunt: 'Blunt', bullet: 'Bullet',
  fire: 'Fire', water: 'Water', thunder: 'Thunder', ice: 'Ice', dragon: 'Dragon',
};

function valueColor(v: number): string {
  if (v >= 45) return 'text-green-400';
  if (v >= 25) return 'text-amber-400';
  return 'text-stone-500';
}

type HitzoneRow = Omit<Hitzone, 'id'>;

function blankRow(): HitzoneRow {
  return { part: '', cut: 50, blunt: 50, bullet: 50, fire: 50, water: 50, thunder: 50, ice: 50, dragon: 50 };
}

export function HitzonesTab({ monsterId }: { monsterId: string }) {
  const { data: hitzones, isLoading } = useHitzones(monsterId);
  const { user } = useAuth();
  const updateHitzones = useUpdateHitzones(monsterId);
  const isAdmin = user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<HitzoneRow[]>([]);

  const enterEdit = () => {
    setRows(
      (hitzones ?? []).map(({ part, cut, blunt, bullet, fire, water, thunder, ice, dragon }) => ({
        part, cut, blunt, bullet, fire, water, thunder, ice, dragon,
      })),
    );
    setEditing(true);
  };

  const updateRow = (index: number, field: keyof HitzoneRow, value: string | number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    const payload: UpsertHitzones = rows.filter((r) => r.part.trim() !== '');
    await updateHitzones.mutateAsync(payload);
    setEditing(false);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-stone-700 rounded">
            <thead>
              <tr className="bg-stone-900">
                <th className="text-left px-3 py-2 text-stone-400 font-normal border-b border-stone-700 whitespace-nowrap">
                  Part
                </th>
                {COLS.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-stone-400 font-normal border-b border-stone-700 text-center whitespace-nowrap"
                  >
                    {COL_LABELS[col]}
                  </th>
                ))}
                <th className="px-2 py-2 border-b border-stone-700" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-stone-800/50 last:border-0">
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.part}
                      onChange={(e) => updateRow(i, 'part', e.target.value)}
                      placeholder="Part name"
                      className="w-24 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-50 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </td>
                  {COLS.map((col) => (
                    <td key={col} className="px-1 py-1 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row[col] as number}
                        onChange={(e) => updateRow(i, col, Number(e.target.value))}
                        className="w-14 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-stone-50 text-xs text-center font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                      className="text-stone-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, blankRow()])}
          className="text-sm text-amber-500 hover:text-amber-400 transition-colors duration-150"
        >
          + Add part
        </button>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateHitzones.isPending}>
            {updateHitzones.isPending ? 'Saving…' : 'Save hitzones'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={enterEdit}
            className="text-sm text-amber-500 hover:text-amber-400 transition-colors duration-150"
          >
            Edit hitzones
          </button>
        </div>
      )}
      {!hitzones?.length ? (
        <p className="text-stone-400 text-sm">No hitzone data available.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-stone-800 rounded">
              <thead>
                <tr className="bg-stone-900">
                  <th className="text-left px-3 py-2 text-stone-400 font-normal border-b border-stone-800 whitespace-nowrap">
                    Part
                  </th>
                  {COLS.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-stone-400 font-normal border-b border-stone-800 text-center whitespace-nowrap"
                    >
                      {COL_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hitzones.map((hz) => (
                  <tr key={hz.id} className="border-b border-stone-800/50 last:border-0 hover:bg-stone-900/50">
                    <td className="px-3 py-2 text-stone-50 font-medium">{hz.part}</td>
                    {COLS.map((col) => (
                      <td key={col} className="px-3 py-2 text-center">
                        <span className={cn('font-mono', valueColor(hz[col] as number))}>
                          {hz[col]}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-stone-600 text-xs mt-2">
            Values ≥ 45 are effective. All values are placeholder until updated.
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @mh-datapedia/web typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/monsters/detail/tabs/HitzonesTab.tsx
git commit -m "feat(web): add inline edit mode to HitzonesTab"
```

---

## Task 8: Deploy to production

- [ ] **Step 1: Deploy API**

From the repo root:

```bash
flyctl deploy --config fly.api.toml
```

Expected: build succeeds, release command runs migrations (no new migrations needed), machine restarts.

- [ ] **Step 2: Deploy web**

```bash
flyctl deploy --config fly.web.toml
```

Expected: build succeeds, nginx restarts.

- [ ] **Step 3: Smoke test**

Log in as Silverkx at https://mh-datapedia-web.fly.dev, navigate to any monster → Weaknesses tab → confirm "Edit weaknesses" button is visible. Click it, set a few stars, save. Confirm values update. Repeat on Hitzones tab.

- [ ] **Step 4: Commit**

No code changes in this task — this step is complete when smoke test passes.
