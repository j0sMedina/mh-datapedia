# Monster Classification Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `MonsterType` into a single biological type + an optional `MonsterTag[]` array, reflecting how MH Wilds actually classifies monsters.

**Architecture:** Add a `MonsterTag` Prisma enum (`Tempered`, `ArchTempered`, `Apex`, `Afflicted`), clean up `MonsterType` (remove `Large`, `Apex`, `Afflicted`, `Tempered`), add `tags` field to `Monster`. Validate tag combinations in shared Zod schema (used by both API and frontend). Render tags as colour-coded badges in the UI. Admin form gains reactive checkbox tag selector.

**Tech Stack:** Prisma + PostgreSQL, Zod, Express, React + TanStack Query, Tailwind CSS.

## Global Constraints

- Monorepo at `D:/Programacion/VSCode/mh-datapedia/`; apps at `apps/api` and `apps/web`, shared types at `packages/shared`
- Run API tests with: `cd apps/api && npx jest --testPathPattern=<file> --runInBand`
- Run `npx prisma generate` from `apps/api` after every schema change
- Run `npx prisma migrate dev --name <name>` from `apps/api` to apply migrations
- `MonsterTag` values (exact Prisma enum strings): `Tempered`, `ArchTempered`, `Apex`, `Afflicted`
- `MonsterType` values after cleanup: `Small`, `ElderDragon`, `FlyingWyvern`, `BruteWyvern`, `FangedBeast`, `Temnoceran`, `BirdWyvern`, `Construct`, `DemiElderDragon`, `Leviathan`, `Amphibian`, `Cephalopod`, `Machine`
- Tag combination rules (enforced in Zod + admin UI):
  - `Afflicted` → always solo (no other tags allowed)
  - `ArchTempered` → must also have `Apex`; cannot have `Tempered`
  - `Tempered` → cannot have `ArchTempered`
  - Valid sets: `[]`, `[Tempered]`, `[Apex]`, `[Afflicted]`, `[Tempered, Apex]`, `[Apex, ArchTempered]`
- Badge colours: Apex = amber, Tempered = purple, ArchTempered = red, Afflicted = dark purple
- Monster `name` field always stores base name only (`"Arkveld"`); tags are badges only, never prepended to name
- No new npm packages required

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- New migration: `apps/api/prisma/migrations/<timestamp>_monster_tags/migration.sql` (generated then hand-edited)

**Interfaces:**
- Produces: `MonsterTag` Prisma enum; `Monster.tags MonsterTag[] @default([])`; cleaned `MonsterType` enum (without `Large`, `Apex`, `Afflicted`, `Tempered`)

- [ ] **Step 1: Update `schema.prisma`**

Replace the `MonsterType` enum and add a new `MonsterTag` enum. In `apps/api/prisma/schema.prisma`:

```prisma
enum MonsterTag {
  Tempered
  ArchTempered
  Apex
  Afflicted
}

enum MonsterType {
  Small
  ElderDragon
  FlyingWyvern
  BruteWyvern
  FangedBeast
  Temnoceran
  BirdWyvern
  Construct
  DemiElderDragon
  Leviathan
  Amphibian
  Cephalopod
  Machine
}
```

Add `tags` field to the `Monster` model (after the `type` line):

```prisma
  type        MonsterType
  tags        MonsterTag[]      @default([])
```

- [ ] **Step 2: Create migration with manual SQL**

Run:
```bash
cd apps/api && npx prisma migrate dev --create-only --name monster_tags
```

This creates a migration file without applying it. Open the generated `migration.sql` file and replace its contents entirely with the following SQL:

```sql
-- CreateEnum
CREATE TYPE "MonsterTag" AS ENUM ('Tempered', 'ArchTempered', 'Apex', 'Afflicted');

-- AddColumn tags
ALTER TABLE "Monster" ADD COLUMN "tags" "MonsterTag"[] NOT NULL DEFAULT '{}';

-- Backfill tags from current type values
UPDATE "Monster" SET "tags" = ARRAY['Apex']::"MonsterTag"[] WHERE type = 'Apex'::"MonsterType";
UPDATE "Monster" SET "tags" = ARRAY['Afflicted']::"MonsterTag"[] WHERE type = 'Afflicted'::"MonsterType";
UPDATE "Monster" SET "tags" = ARRAY['Tempered']::"MonsterTag"[] WHERE type = 'Tempered'::"MonsterType";

-- Reassign biological types for rows using non-biological type values
-- Large monsters: default to ElderDragon (admin must re-classify manually if any exist)
UPDATE "Monster" SET type = 'ElderDragon'::"MonsterType" WHERE type = 'Large'::"MonsterType";
UPDATE "Monster" SET type = 'ElderDragon'::"MonsterType" WHERE type = 'Apex'::"MonsterType";
UPDATE "Monster" SET type = 'FlyingWyvern'::"MonsterType" WHERE type = 'Afflicted'::"MonsterType";
UPDATE "Monster" SET type = 'FlyingWyvern'::"MonsterType" WHERE type = 'Tempered'::"MonsterType";

-- Create new MonsterType enum without removed values
CREATE TYPE "MonsterType_new" AS ENUM (
  'Small', 'ElderDragon', 'FlyingWyvern', 'BruteWyvern', 'FangedBeast',
  'Temnoceran', 'BirdWyvern', 'Construct', 'DemiElderDragon', 'Leviathan',
  'Amphibian', 'Cephalopod', 'Machine'
);

-- Migrate column to new enum
ALTER TABLE "Monster" ALTER COLUMN type TYPE "MonsterType_new" USING type::text::"MonsterType_new";

-- Swap enum names
DROP TYPE "MonsterType";
ALTER TYPE "MonsterType_new" RENAME TO "MonsterType";
```

- [ ] **Step 3: Apply migration and regenerate client**

```bash
cd apps/api && npx prisma migrate dev && npx prisma generate
```

Expected: migration applies without errors, Prisma client regenerated.

- [ ] **Step 4: Verify DB schema**

```bash
cd apps/api && npx prisma db pull --print 2>&1 | grep -A5 "MonsterTag\|tags"
```

Expected: output shows `MonsterTag` enum with 4 values and `tags` field on Monster.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add MonsterTag enum and tags field; clean up MonsterType"
```

---

### Task 2: Shared Package — Enums + Monster Schemas

**Files:**
- Modify: `packages/shared/src/schemas/enums.schema.ts`
- Modify: `packages/shared/src/schemas/monster.schema.ts`

**Interfaces:**
- Consumes: Prisma migration from Task 1 (enum names)
- Produces:
  - `MonsterTagSchema` — `z.enum(['Tempered', 'ArchTempered', 'Apex', 'Afflicted'])`
  - `MonsterType` — Zod enum without `Large`, `Apex`, `Afflicted`, `Tempered`
  - `validateTagCombination(tags: string[]): boolean` — exported helper
  - `CreateMonsterSchema` — includes `tags: MonsterTagSchema.array().optional()` + `.superRefine` for combo rules
  - `MonsterFiltersSchema` — includes `tags: z.string().optional()` (comma-separated)
  - `Monster` type — includes `tags: MonsterTag[]`

- [ ] **Step 1: Update `enums.schema.ts`**

In `packages/shared/src/schemas/enums.schema.ts`, add `MonsterTagSchema` after the imports, and replace `MonsterTypeSchema`:

```typescript
export const MonsterTagSchema = z.enum(['Tempered', 'ArchTempered', 'Apex', 'Afflicted']);
export type MonsterTag = z.infer<typeof MonsterTagSchema>;

export const MonsterTypeSchema = z.enum([
  'Small',
  'ElderDragon',
  'FlyingWyvern',
  'BruteWyvern',
  'FangedBeast',
  'Temnoceran',
  'BirdWyvern',
  'Construct',
  'DemiElderDragon',
  'Leviathan',
  'Amphibian',
  'Cephalopod',
  'Machine',
]);
export type MonsterType = z.infer<typeof MonsterTypeSchema>;
```

- [ ] **Step 2: Add tag combination validator**

In `packages/shared/src/schemas/enums.schema.ts`, add after `MonsterTagSchema`:

```typescript
export function validateTagCombination(tags: string[]): boolean {
  if (tags.includes('Afflicted') && tags.length > 1) return false;
  if (tags.includes('Tempered') && tags.includes('ArchTempered')) return false;
  if (tags.includes('ArchTempered') && !tags.includes('Apex')) return false;
  return true;
}
```

- [ ] **Step 3: Update `monster.schema.ts`**

Add `MonsterTagSchema` to imports:

```typescript
import { MonsterTypeSchema, MonsterTagSchema, validateTagCombination } from './enums.schema';
```

Update `BaseMonsterSchema` — add `tags` field after `habitats`:

```typescript
  habitats: z.array(z.string()),
  tags: z.array(MonsterTagSchema),
```

Update `CreateMonsterSchema` — add `tags` field and superRefine for combo validation:

```typescript
export const CreateMonsterSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  type: MonsterTypeSchema,
  imageUrl: z.string().url().nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  isBoss: z.boolean().optional(),
  habitats: z.array(z.string()).optional(),
  parentId: z.string().cuid().nullable().optional(),
  tags: z.array(MonsterTagSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.tags && !validateTagCombination(data.tags)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tags'],
      message: 'Invalid tag combination. Afflicted must be solo; ArchTempered requires Apex and cannot pair with Tempered.',
    });
  }
});
export type CreateMonster = z.infer<typeof CreateMonsterSchema>;

export const UpdateMonsterSchema = CreateMonsterSchema.partial();
export type UpdateMonster = z.infer<typeof UpdateMonsterSchema>;
```

Update `MonsterFiltersSchema` — add `tags` filter:

```typescript
export const MonsterFiltersSchema = z.object({
  type: MonsterTypeSchema.optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MonsterFilters = z.infer<typeof MonsterFiltersSchema>;
```

- [ ] **Step 4: Build shared package to verify**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/enums.schema.ts packages/shared/src/schemas/monster.schema.ts
git commit -m "feat(shared): add MonsterTag enum, tag combo validation, tags field on monster schemas"
```

---

### Task 3: API — Tags Filter + Tests

**Files:**
- Modify: `apps/api/src/services/monster.service.ts`
- Modify: `apps/api/tests/monsters.test.ts`

**Interfaces:**
- Consumes: `MonsterFilters.tags` (string, comma-separated) from Task 2
- Produces: `listMonsters` filters by tags using Prisma `hasEvery`; tests cover tags field, filtering, invalid combo rejection

- [ ] **Step 1: Update `monster.service.ts` — `listMonsters`**

Replace the `listMonsters` function body in `apps/api/src/services/monster.service.ts`:

```typescript
export async function listMonsters(filters: MonsterFilters) {
  const { type, tags, search, page, limit } = filters;
  const parsedTags = tags ? tags.split(',').filter(Boolean) : [];
  const where = {
    ...(type && { type }),
    ...(parsedTags.length > 0 && { tags: { hasEvery: parsedTags } }),
    ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
  };
  const [data, total] = await Promise.all([
    prisma.monster.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { weaknesses: true },
      orderBy: { name: 'asc' },
    }),
    prisma.monster.count({ where }),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

- [ ] **Step 2: Write failing tests**

Add the following test blocks to `apps/api/tests/monsters.test.ts`:

```typescript
describe('Monster tags', () => {
  let apexMonsterId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...TEST_MONSTER, name: 'Test Apex Rathalos', tags: ['Apex', 'Tempered'] });
    apexMonsterId = res.body.data.id;
  });

  afterAll(async () => {
    await prisma.monster.deleteMany({ where: { name: 'Test Apex Rathalos' } });
  });

  it('creates monster with tags', async () => {
    const res = await request(app).get(`/api/monsters/${apexMonsterId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(expect.arrayContaining(['Apex', 'Tempered']));
  });

  it('creates monster without tags defaults to []', async () => {
    const res = await request(app).get(`/api/monsters/${testMonsterId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual([]);
  });

  it('rejects invalid tag combo: Afflicted + Tempered → 400', async () => {
    const res = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...TEST_MONSTER, name: 'Test Invalid Tags', tags: ['Afflicted', 'Tempered'] });
    expect(res.status).toBe(400);
  });

  it('rejects ArchTempered without Apex → 400', async () => {
    const res = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...TEST_MONSTER, name: 'Test No Apex AT', tags: ['ArchTempered'] });
    expect(res.status).toBe(400);
  });

  it('filters by tags=Apex returns only Apex monsters', async () => {
    const res = await request(app).get('/api/monsters?tags=Apex');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((m: any) => expect(m.tags).toContain('Apex'));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=monsters --runInBand
```

Expected: new tag tests fail (tags field missing from DB or schema not wired up yet).

- [ ] **Step 4: Verify existing tests still pass after schema changes**

```bash
cd apps/api && npx jest --runInBand
```

Expected: all pre-existing tests pass; only new tag tests fail.

- [ ] **Step 5: Run full test suite after confirming all wiring is complete**

Once Tasks 1–3 are all applied:

```bash
cd apps/api && npx jest --runInBand
```

Expected: all tests pass including new tag tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/monster.service.ts apps/api/tests/monsters.test.ts
git commit -m "feat(api): filter monsters by tags; add tags tests"
```

---

### Task 4: Frontend Types, Constants, and Utils

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/constants.ts`
- Modify: `apps/web/src/lib/utils.ts`
- Modify: `apps/web/src/hooks/useMonsters.ts`

**Interfaces:**
- Produces:
  - `MonsterListItem.tags: string[]`; `MonsterDetail.tags: string[]`
  - `TAG_BADGE_CLASSES: Record<string, string>` — 4 entries
  - `formatTag(tag: string): string` — `'ArchTempered'` → `'Arch-Tempered'`
  - `useMonsters` accepts `tags?: string[]`

- [ ] **Step 1: Update `lib/types.ts`**

In `MonsterListItem`, add `tags` after `habitats`:

```typescript
export interface MonsterListItem {
  id: string;
  name: string;
  title: string;
  type: string;
  tags: string[];
  imageUrl: string | null;
  iconUrl: string | null;
  isBoss: boolean;
  habitats: string[];
  weaknesses: ElementWeakness[];
}
```

`MonsterDetail` extends `MonsterListItem` so it inherits `tags` automatically — no change needed there.

Also update the subspecies shape (it doesn't need tags). No change needed.

- [ ] **Step 2: Update `lib/constants.ts`**

Remove the `Apex`, `Afflicted`, `Tempered`, and `Large` entries from `TYPE_BADGE_CLASSES` (they are no longer MonsterType values). Add `TAG_BADGE_CLASSES`:

```typescript
export const TYPE_BADGE_CLASSES: Record<string, string> = {
  Small:           'bg-stone-700 text-stone-400',
  ElderDragon:     'bg-amber-400/10 text-amber-400',
  FlyingWyvern:    'bg-sky-400/10 text-sky-400',
  BruteWyvern:     'bg-red-400/10 text-red-400',
  FangedBeast:     'bg-orange-400/10 text-orange-400',
  Temnoceran:      'bg-rose-400/10 text-rose-400',
  BirdWyvern:      'bg-lime-400/10 text-lime-400',
  Construct:       'bg-stone-400/10 text-stone-400',
  DemiElderDragon: 'bg-amber-600/10 text-amber-600',
  Leviathan:       'bg-blue-400/10 text-blue-400',
  Amphibian:       'bg-green-400/10 text-green-400',
  Cephalopod:      'bg-violet-400/10 text-violet-400',
  Machine:         'bg-zinc-400/10 text-zinc-400',
};

export const TAG_BADGE_CLASSES: Record<string, string> = {
  Apex:         'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  Tempered:     'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  ArchTempered: 'bg-red-500/15 text-red-400 border border-red-500/30',
  Afflicted:    'bg-purple-900/40 text-purple-300 border border-purple-800/50',
};
```

- [ ] **Step 3: Add `formatTag` to `lib/utils.ts`**

```typescript
export function formatTag(tag: string): string {
  return tag === 'ArchTempered' ? 'Arch-Tempered' : tag;
}
```

- [ ] **Step 4: Update `useMonsters` hook**

In `apps/web/src/hooks/useMonsters.ts`, add `tags` to `MonsterFiltersInput` and build the query param:

```typescript
export interface MonsterFiltersInput {
  type?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export function useMonsters(filters: MonsterFiltersInput = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));

  return useQuery({
    queryKey: ['monsters', filters],
    queryFn: () =>
      apiGet<PaginatedResponse<MonsterListItem>>(`/api/monsters?${params.toString()}`),
  });
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/constants.ts apps/web/src/lib/utils.ts apps/web/src/hooks/useMonsters.ts
git commit -m "feat(web): add tags to types, constants, utils, and useMonsters hook"
```

---

### Task 5: Tag Badges on Monster Cards and Detail Header

**Files:**
- Modify: `apps/web/src/components/monsters/MonsterCard.tsx`
- Modify: `apps/web/src/components/monsters/detail/MonsterHeader.tsx`

**Interfaces:**
- Consumes: `TAG_BADGE_CLASSES`, `formatTag` from Task 4; `monster.tags: string[]`

- [ ] **Step 1: Update `MonsterCard.tsx`**

Add import for `TAG_BADGE_CLASSES` and `formatTag`. Render tag badges after the type badge:

```typescript
import { Link } from '@tanstack/react-router';
import type { MonsterListItem } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { TYPE_BADGE_CLASSES, TAG_BADGE_CLASSES } from '../../lib/constants';
import { cn, formatType, formatTag } from '../../lib/utils';

interface MonsterCardProps {
  monster: MonsterListItem;
}

export function MonsterCard({ monster }: MonsterCardProps) {
  return (
    <Link
      to="/monsters/$id"
      params={{ id: monster.id }}
      className="block bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-700 hover:bg-stone-800/50 transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-stone-50 group-hover:text-accent-hover transition-colors duration-150 leading-tight">
          {monster.name}
        </h3>
        {monster.isBoss && (
          <span className="text-accent shrink-0 mt-0.5" title="Boss">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M5 16L3 5l5.5 5L12 2l3.5 8L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
            </svg>
          </span>
        )}
      </div>

      <p className="text-stone-500 text-xs mb-3 line-clamp-1">{monster.title}</p>

      <div className="flex flex-wrap gap-1.5">
        <Badge className={cn(TYPE_BADGE_CLASSES[monster.type] ?? 'bg-stone-700 text-stone-400')}>
          {formatType(monster.type)}
        </Badge>
        {monster.tags.map((tag) => (
          <Badge key={tag} className={cn(TAG_BADGE_CLASSES[tag] ?? 'bg-stone-700 text-stone-400')}>
            {formatTag(tag)}
          </Badge>
        ))}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Update `MonsterHeader.tsx`**

Add `TAG_BADGE_CLASSES` and `formatTag` imports. Render tag badges alongside the type badge in the `flex flex-wrap gap-2` row:

```typescript
import { TAG_BADGE_CLASSES } from '../../../lib/constants';
import { cn, formatType, formatTag } from '../../../lib/utils';
```

Replace the badges section (inside the `flex flex-wrap gap-2` div):

```tsx
<div className="flex flex-wrap gap-2">
  <Badge className={cn(TYPE_BADGE_CLASSES[monster.type] ?? 'bg-stone-700 text-stone-400')}>
    {formatType(monster.type)}
  </Badge>
  {monster.tags.map((tag) => (
    <Badge key={tag} className={cn(TAG_BADGE_CLASSES[tag] ?? 'bg-stone-700 text-stone-400')}>
      {formatTag(tag)}
    </Badge>
  ))}
  {monster.habitats.map((h) => (
    <span key={h} className="flex items-center gap-1 text-stone-500 text-xs">
      <MapPin size={10} />
      {h}
    </span>
  ))}
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/monsters/MonsterCard.tsx apps/web/src/components/monsters/detail/MonsterHeader.tsx
git commit -m "feat(web): render tag badges on monster card and detail header"
```

---

### Task 6: Tag Filter on Monsters List

**Files:**
- Modify: `apps/web/src/components/monsters/MonsterFilters.tsx`
- Modify: `apps/web/src/routes/monsters/index.tsx`

**Interfaces:**
- Consumes: `TAG_BADGE_CLASSES`, `formatTag` from Task 4; `useMonsters` `tags` param from Task 4
- Produces: `MonsterFilters` accepts `tags` + `onTagsChange`; `/monsters/` route handles `tags` URL param

- [ ] **Step 1: Update `MonsterFilters.tsx`**

Replace the entire file:

```typescript
import { MonsterTypeSchema } from '@mh-datapedia/shared';
import { TAG_BADGE_CLASSES } from '../../lib/constants';
import { cn, formatType, formatTag } from '../../lib/utils';

const ALL_TAGS = ['Tempered', 'ArchTempered', 'Apex', 'Afflicted'] as const;

interface MonsterFiltersProps {
  type: string | undefined;
  tags: string[];
  search: string | undefined;
  onTypeChange: (type: string | undefined) => void;
  onTagsChange: (tags: string[]) => void;
  onSearchChange: (search: string | undefined) => void;
}

export function MonsterFilters({
  type,
  tags,
  search,
  onTypeChange,
  onTagsChange,
  onSearchChange,
}: MonsterFiltersProps) {
  const toggleTag = (tag: string) => {
    onTagsChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search monsters…"
        value={search ?? ''}
        onChange={(e) => onSearchChange(e.target.value || undefined)}
        className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-150"
      />

      <div className="flex flex-wrap gap-2">
        <Pill active={type === undefined} onClick={() => onTypeChange(undefined)}>
          All Types
        </Pill>
        {MonsterTypeSchema.options.map((t) => (
          <Pill
            key={t}
            active={type === t}
            onClick={() => onTypeChange(type === t ? undefined : t)}
          >
            {formatType(t)}
          </Pill>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-colors duration-150 border',
              tags.includes(tag)
                ? TAG_BADGE_CLASSES[tag]
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700',
            )}
          >
            {formatTag(tag)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs transition-colors duration-150',
        active
          ? 'bg-accent text-stone-950 font-medium'
          : 'bg-stone-800 text-stone-400 hover:bg-stone-700',
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Update `/monsters/` route**

In `apps/web/src/routes/monsters/index.tsx`:

Add `tags` to `monsterSearchSchema`:

```typescript
const monsterSearchSchema = z.object({
  type:   z.string().optional(),
  tags:   z.string().optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().min(1).default(1).catch(1),
});
```

In `MonstersPage`, parse and wire `tags`:

```typescript
function MonstersPage() {
  const { user } = useAuth();
  const navigate = useNavigate({ from: '/monsters/' });
  const { type, tags: tagsParam, search, page } = Route.useSearch();
  const activeTags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];
  const { data, isLoading } = useMonsters({ type, tags: activeTags, search, page });
  const [showAddModal, setShowAddModal] = useState(false);

  const [searchInput, setSearchInput] = useState(search ?? '');
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    navigate({ search: (prev) => ({ ...prev, search: debouncedSearch || undefined, page: 1 }) });
  }, [debouncedSearch, navigate]);

  const setFilter = (key: 'type' | 'search', val: string | undefined) => {
    if (key === 'search') {
      setSearchInput(val ?? '');
    } else {
      navigate({ search: (prev) => ({ ...prev, [key]: val, page: 1 }) });
    }
  };

  const setTags = (tags: string[]) => {
    navigate({ search: (prev) => ({ ...prev, tags: tags.length ? tags.join(',') : undefined, page: 1 }) });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-50">Monsters</h1>
        {(['HELPER', 'ADMIN', 'MASTER'] as const).includes(user?.role as 'HELPER' | 'ADMIN' | 'MASTER') && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            + Add Monster
          </Button>
        )}
      </div>

      <div className="mb-6">
        <MonsterFilters
          type={type}
          tags={activeTags}
          search={searchInput}
          onTypeChange={(t) => setFilter('type', t)}
          onTagsChange={setTags}
          onSearchChange={(s) => setFilter('search', s)}
        />
      </div>

      <MonsterGrid monsters={data?.data ?? []} isLoading={isLoading} />

      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })}
          >
            Previous
          </Button>
          <span className="text-stone-400 text-sm">
            {page} / {data.meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data.meta.totalPages}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
          >
            Next
          </Button>
        </div>
      )}

      <MonsterFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/monsters/MonsterFilters.tsx apps/web/src/routes/monsters/index.tsx
git commit -m "feat(web): add tag filter pills to monsters list page"
```

---

### Task 7: Admin Form — Biological Type + Tags Multi-Select

**Files:**
- Modify: `apps/web/src/components/admin/MonsterFormModal.tsx`

**Interfaces:**
- Consumes: `CreateMonsterSchema` with `tags` from Task 2; `MonsterTypeSchema` (cleaned); `validateTagCombination` from Task 2; `formatType` and `formatTag` from utils; `TAG_BADGE_CLASSES` from constants

- [ ] **Step 1: Replace `MonsterFormModal.tsx`**

Replace the entire file:

```typescript
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonsterSchema, MonsterTypeSchema } from '@mh-datapedia/shared';
import type { CreateMonster, MonsterTag } from '@mh-datapedia/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateMonster } from '../../hooks/useCreateMonster';
import { useUpdateMonster } from '../../hooks/useUpdateMonster';
import { TAG_BADGE_CLASSES } from '../../lib/constants';
import { cn, formatType, formatTag } from '../../lib/utils';
import type { MonsterDetail } from '../../lib/types';

const ALL_TAGS: MonsterTag[] = ['Tempered', 'ArchTempered', 'Apex', 'Afflicted'];

interface MonsterFormModalProps {
  open: boolean;
  onClose: () => void;
  existing?: MonsterDetail;
}

export function MonsterFormModal({ open, onClose, existing }: MonsterFormModalProps) {
  const isEdit = !!existing;
  const createMonster = useCreateMonster();
  const updateMonster = useUpdateMonster(existing?.id ?? '');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateMonster>({
    resolver: zodResolver(CreateMonsterSchema),
    defaultValues: { tags: [] },
  });

  const selectedTags = watch('tags') ?? [];

  useEffect(() => {
    if (open) {
      reset(
        existing
          ? {
              name:        existing.name,
              title:       existing.title,
              description: existing.description,
              type:        existing.type as CreateMonster['type'],
              isBoss:      existing.isBoss,
              habitats:    existing.habitats,
              parentId:    existing.parentId ?? null,
              tags:        (existing.tags ?? []) as MonsterTag[],
            }
          : { tags: [] },
      );
    }
  }, [open, existing, reset]);

  const toggleTag = (tag: MonsterTag) => {
    let next: MonsterTag[];
    if (selectedTags.includes(tag)) {
      next = selectedTags.filter((t) => t !== tag);
    } else {
      next = [...selectedTags, tag];
      // ArchTempered requires Apex — auto-add Apex
      if (tag === 'ArchTempered' && !next.includes('Apex')) {
        next = [...next, 'Apex'];
      }
    }
    setValue('tags', next, { shouldValidate: true });
  };

  const isTagDisabled = (tag: MonsterTag): boolean => {
    if (tag === 'Afflicted') return selectedTags.some((t) => t !== 'Afflicted');
    if (selectedTags.includes('Afflicted') && tag !== 'Afflicted') return true;
    if (tag === 'Tempered' && selectedTags.includes('ArchTempered')) return true;
    if (tag === 'ArchTempered' && selectedTags.includes('Tempered')) return true;
    return false;
  };

  const onSubmit = async (data: CreateMonster) => {
    if (isEdit) {
      await updateMonster.mutateAsync(data);
    } else {
      await createMonster.mutateAsync(data);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${existing?.name}` : 'Add Monster'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Input label="Title" error={errors.title?.message} {...register('title')} />
        <div>
          <label className="block text-stone-300 text-sm mb-1">Description</label>
          <textarea
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-red-400 text-xs">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-stone-300 text-sm mb-1">Biological Type</label>
          <select
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            {...register('type')}
          >
            {MonsterTypeSchema.options.map((t) => (
              <option key={t} value={t}>{formatType(t)}</option>
            ))}
          </select>
          {errors.type && <p className="mt-1 text-red-400 text-xs">{errors.type.message}</p>}
        </div>

        <div>
          <label className="block text-stone-300 text-sm mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              const disabled = !active && isTagDisabled(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => !disabled && toggleTag(tag)}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs border transition-colors duration-150',
                    active
                      ? TAG_BADGE_CLASSES[tag]
                      : disabled
                        ? 'bg-stone-900 text-stone-600 border-stone-800 cursor-not-allowed'
                        : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700',
                  )}
                >
                  {formatTag(tag)}
                </button>
              );
            })}
          </div>
          {errors.tags && (
            <p className="mt-1 text-red-400 text-xs">{errors.tags.message as string}</p>
          )}
        </div>

        <Input
          label="Habitats (comma-separated)"
          placeholder="Windward Plains, Scarlet Forest"
          {...register('habitats', {
            setValueAs: (v: unknown) =>
              typeof v === 'string'
                ? v.split(',').map((h) => h.trim()).filter(Boolean)
                : v,
          })}
        />

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isBoss" {...register('isBoss')} className="accent-accent" />
          <label htmlFor="isBoss" className="text-stone-300 text-sm">Boss monster</label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create monster'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/admin/MonsterFormModal.tsx
git commit -m "feat(web): admin form — biological type dropdown + reactive tag checkboxes"
```

---

## Final Steps

After all tasks complete:

- [ ] Run full API test suite: `cd apps/api && npx jest --runInBand` — all pass
- [ ] Run web typecheck: `cd apps/web && npx tsc --noEmit` — no errors
- [ ] Push to master: `git push origin master`
