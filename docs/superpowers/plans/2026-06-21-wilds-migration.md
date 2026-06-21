# Wilds Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the multi-game wiki into a Wilds-only encyclopaedia — remove dead schema fields, seed all monsters from `wilds.mhdb.io`, and update the web UI colours.

**Architecture:** Five sequential tasks: (1) Prisma migration + changelog, (2) shared-package type cleanup, (3) API service + test fixes, (4) seed script, (5) web component + colour cleanup. Each task leaves the codebase in a working state before the next begins.

**Tech Stack:** Prisma 5 / PostgreSQL, Zod 3, Express, React 18 / TanStack Query, Tailwind CSS, pnpm workspaces, Turborepo.

## Global Constraints

- Wilds API base URL: `https://wilds.mhdb.io/en` — locale `en` for all calls
- Seed script must be idempotent — safe to run twice
- `User`, `RefreshToken`, `Strategy` rows must survive untouched
- Never commit `.env` or `.env.test`
- Run `pnpm --filter @mh-datapedia/shared build` after every shared-package change before running API typecheck or tests
- All commands below assume the working directory is the repo root (`mh-datapedia/`)

---

## File map

| Task | Action | Path |
|------|--------|------|
| 1 | CREATE | `docs/changelog.md` |
| 1 | MODIFY | `apps/api/prisma/schema.prisma` |
| 2 | MODIFY | `packages/shared/src/schemas/enums.schema.ts` |
| 2 | MODIFY | `packages/shared/src/schemas/hitzone.schema.ts` |
| 2 | MODIFY | `packages/shared/src/schemas/monster.schema.ts` |
| 2 | DELETE | `packages/shared/src/schemas/game.schema.ts` |
| 2 | MODIFY | `packages/shared/src/index.ts` |
| 3 | MODIFY | `apps/api/src/services/monster.service.ts` |
| 3 | MODIFY | `apps/api/tests/monsters.test.ts` |
| 4 | MODIFY | `apps/api/package.json` |
| 4 | CREATE | `apps/api/scripts/seed-wilds.ts` |
| 5 | MODIFY | `apps/web/src/lib/types.ts` |
| 5 | MODIFY | `apps/web/src/lib/constants.ts` |
| 5 | MODIFY | `apps/web/src/hooks/useMonsters.ts` |
| 5 | MODIFY | `apps/web/src/components/monsters/MonsterCard.tsx` |
| 5 | MODIFY | `apps/web/src/components/monsters/MonsterFilters.tsx` |
| 5 | MODIFY | `apps/web/src/components/admin/MonsterFormModal.tsx` |
| 5 | MODIFY | `apps/web/src/routes/monsters/index.tsx` |

---

## Task 1: Changelog file + Prisma schema migration

**What this does:** Creates the running bug/change log at `docs/changelog.md`, then updates the Prisma schema — removing `firstGame`, `firstYear`, and the entire `GameAppearance` model; adding new `MonsterType` values for Wilds species; adding `stun` to `Hitzone`. Runs the migration to apply changes to the local database.

**Files:**
- Create: `docs/changelog.md`
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: Postgres enum `MonsterType` now includes `FlyingWyvern BruteWyvern FangedBeast Temnoceran BirdWyvern Construct DemiElderDragon`. Table `GameAppearance` is gone. Column `Hitzone.stun Int @default(0)` exists. Columns `Monster.firstGame` and `Monster.firstYear` are gone.

---

- [ ] **Step 1 — Create `docs/changelog.md`**

Create the file at the repo root with this exact content:

```markdown
# Changelog

Format: `[DATE] ACTION file:line — reason`
Newest entry at the top. Append a block every time a line is removed, renamed, or fixed.

---

## [2026-06-21] Wilds-only migration

REMOVED `firstGame MHGame` column from `Monster` model
  (apps/api/prisma/schema.prisma)
  → Wilds API carries no debut-game data; filling manually would be wrong
    (e.g. Congalala debuted in Monster Hunter 2, not World)

REMOVED `firstYear Int` column from `Monster` model
  (apps/api/prisma/schema.prisma)
  → same reason as firstGame removal

REMOVED `GameAppearance` model entirely
  (apps/api/prisma/schema.prisma)
  → wiki is Wilds-only; per-game appearance tracking adds no value

REMOVED `game.schema.ts` from packages/shared
  → GameAppearanceSchema unused after model removal

REMOVED `firstGame`, `firstYear`, `games` from shared monster schemas
  (packages/shared/src/schemas/monster.schema.ts)

REMOVED `game` filter from `MonsterFiltersSchema`
  (packages/shared/src/schemas/monster.schema.ts)
  → Wilds-only wiki; filtering by game is meaningless

REMOVED `game` WHERE clause from `listMonsters` and `gameAppearances`
  from `MONSTER_DETAIL_INCLUDE`
  (apps/api/src/services/monster.service.ts)

REMOVED `gameAppearances` badge block and `shortGameName` helper from MonsterCard
  (apps/web/src/components/monsters/MonsterCard.tsx)

REMOVED game filter row and `onGameChange` prop from MonsterFilters
  (apps/web/src/components/monsters/MonsterFilters.tsx)

REMOVED `firstGame`, `firstYear`, `First Game` field, `First Year` field,
  and `GAME_IDS` constant from MonsterFormModal
  (apps/web/src/components/admin/MonsterFormModal.tsx)

ADDED `stun Int @default(0)` to `Hitzone` model
  (apps/api/prisma/schema.prisma)
  → Wilds API returns stun multiplier; was missing from original schema

ADDED MonsterType enum values: FlyingWyvern, BruteWyvern, FangedBeast,
  Temnoceran, BirdWyvern, Construct, DemiElderDragon
  (apps/api/prisma/schema.prisma, packages/shared/src/schemas/enums.schema.ts)
  → original schema used generic Large/Small instead of MH species names

CHANGED Dragon element colour: text-violet-500 → text-teal-500
CHANGED ElderDragon badge: bg-violet-400/10 text-violet-400 → bg-amber-400/10 text-amber-400
CHANGED Poison element colour: text-purple-500 → text-fuchsia-500
  (apps/web/src/lib/constants.ts)
  → violet/purple caused unintended visual similarity to adult websites
```

- [ ] **Step 2 — Update `apps/api/prisma/schema.prisma`**

Replace the `Monster` model, `GameAppearance` model, `Hitzone` model, and `MonsterType` enum with the versions below. Everything else in the file stays identical.

**`MonsterType` enum** — replace the existing block:

```prisma
enum MonsterType {
  Large
  Small
  Apex
  Afflicted
  Tempered
  ElderDragon
  FlyingWyvern
  BruteWyvern
  FangedBeast
  Temnoceran
  BirdWyvern
  Construct
  DemiElderDragon
}
```

**`Monster` model** — remove `firstGame`, `firstYear`, `gameAppearances`, and the index on `firstGame`. Replace the whole model block:

```prisma
model Monster {
  id          String            @id @default(cuid())
  name        String            @unique
  title       String
  description String            @db.Text
  type        MonsterType
  imageUrl    String?
  iconUrl     String?
  isBoss      Boolean           @default(false)
  habitats    String[]
  parentId    String?
  parent      Monster?          @relation("Subspecies", fields: [parentId], references: [id])
  subspecies  Monster[]         @relation("Subspecies")
  weaknesses  ElementWeakness[]
  hitzones    Hitzone[]
  strategies  Strategy[]
  ailments    MonsterAilment[]
  drops       MonsterDrop[]
  favoritedBy User[]            @relation("UserFavorites")
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([name])
  @@index([type])
}
```

**`Hitzone` model** — add `stun` column:

```prisma
model Hitzone {
  id        String  @id @default(cuid())
  monsterId String
  monster   Monster @relation(fields: [monsterId], references: [id], onDelete: Cascade)
  part      String
  cut       Int     @default(50)
  blunt     Int     @default(50)
  bullet    Int     @default(50)
  fire      Int     @default(50)
  water     Int     @default(50)
  thunder   Int     @default(50)
  ice       Int     @default(50)
  dragon    Int     @default(50)
  stun      Int     @default(0)

  @@unique([monsterId, part])
}
```

**Delete the entire `GameAppearance` model block** — remove these lines completely:

```prisma
// DELETE THIS ENTIRE BLOCK
model GameAppearance {
  id        String  @id @default(cuid())
  monsterId String
  monster   Monster @relation(fields: [monsterId], references: [id], onDelete: Cascade)
  game      MHGame
  isNew     Boolean @default(false)

  @@unique([monsterId, game])
  @@index([game])
}
```

- [ ] **Step 3 — Run the Prisma migration**

```bash
pnpm --filter @mh-datapedia/api exec prisma migrate dev --name wilds_migration
```

Expected output ends with:
```
✔ Generated Prisma Client
The following migration was created: prisma/migrations/.../migration.sql
```

If it asks "Are you sure you want to reset your database?" type `y` — this only affects local dev data, which will be re-populated by the seed script in Task 4.

- [ ] **Step 4 — Verify migration succeeded**

```bash
pnpm --filter @mh-datapedia/api exec prisma studio
```

Opens a browser tab. Confirm:
- `Monster` table has no `firstGame` or `firstYear` columns
- `Hitzone` table has a `stun` column
- No `GameAppearance` table in the left sidebar

Close the Prisma Studio tab when done.

- [ ] **Step 5 — Commit**

```bash
git add docs/changelog.md apps/api/prisma/
git commit -m "chore: wilds migration — drop firstGame/firstYear/GameAppearance, add stun + Wilds species types"
```

---

## Task 2: Shared package type cleanup

**What this does:** Updates the TypeScript/Zod types in `packages/shared` to match the new schema. Deletes `game.schema.ts` (the `GameAppearance` Zod schema). Removes `firstGame`, `firstYear`, `games`, and the `game` filter from the monster schemas. Adds `stun` to `HitzoneSchema`. Adds new `MonsterType` values.

**Files:**
- Modify: `packages/shared/src/schemas/enums.schema.ts`
- Modify: `packages/shared/src/schemas/hitzone.schema.ts`
- Modify: `packages/shared/src/schemas/monster.schema.ts`
- Delete: `packages/shared/src/schemas/game.schema.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: Prisma migration from Task 1
- Produces: `MonsterTypeSchema` includes all Wilds species. `HitzoneSchema` and `UpsertHitzoneItemSchema` include `stun`. `MonsterFiltersSchema` has no `game` field. `CreateMonsterSchema` has no `firstGame` or `firstYear`.

---

- [ ] **Step 1 — Update `packages/shared/src/schemas/enums.schema.ts`**

Replace the `MonsterTypeSchema` line only:

```typescript
// BEFORE
export const MonsterTypeSchema = z.enum([
  'Large',
  'Small',
  'ElderDragon',
  'Apex',
  'Afflicted',
  'Tempered',
]);

// AFTER
export const MonsterTypeSchema = z.enum([
  'Large',
  'Small',
  'ElderDragon',
  'Apex',
  'Afflicted',
  'Tempered',
  'FlyingWyvern',
  'BruteWyvern',
  'FangedBeast',
  'Temnoceran',
  'BirdWyvern',
  'Construct',
  'DemiElderDragon',
]);
export type MonsterType = z.infer<typeof MonsterTypeSchema>;
```

Everything else in the file (`MHGameSchema`, `ElementSchema`, `WeaknessRatingSchema`, `DifficultySchema`, `RankSchema`, `DropMethodSchema`, `RoleSchema`) stays identical.

- [ ] **Step 2 — Update `packages/shared/src/schemas/hitzone.schema.ts`**

Replace the whole file:

```typescript
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
  stun: hitzoneValue,
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
  stun: hitzoneValue.default(0),
});
export const UpsertHitzonesSchema = z.array(UpsertHitzoneItemSchema);
export type UpsertHitzones = z.infer<typeof UpsertHitzonesSchema>;
```

`stun` is `default(0)` in the upsert schema so existing admin-submitted payloads without `stun` still work.

- [ ] **Step 3 — Update `packages/shared/src/schemas/monster.schema.ts`**

Replace the whole file:

```typescript
import { z } from 'zod';
import { MonsterTypeSchema } from './enums.schema';
import { ElementWeaknessSchema } from './weakness.schema';
import { HitzoneSchema } from './hitzone.schema';
import { StrategySchema } from './strategy.schema';
import { AilmentSchema } from './ailment.schema';
import { MonsterDropSchema } from './drop.schema';

const BaseMonsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  type: MonsterTypeSchema,
  imageUrl: z.string().nullable(),
  iconUrl: z.string().nullable(),
  isBoss: z.boolean(),
  habitats: z.array(z.string()),
  weaknesses: z.array(ElementWeaknessSchema),
  hitzones: z.array(HitzoneSchema),
  strategies: z.array(StrategySchema),
  ailments: z.array(AilmentSchema),
  drops: z.array(MonsterDropSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Monster = z.infer<typeof BaseMonsterSchema> & {
  subspecies: Monster[];
  parentMonster: Monster | null;
};

export const MonsterSchema: z.ZodType<Monster> = BaseMonsterSchema.extend({
  subspecies: z.lazy(() => z.array(MonsterSchema)),
  parentMonster: z.lazy(() => MonsterSchema.nullable()),
});

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
});
export type CreateMonster = z.infer<typeof CreateMonsterSchema>;

export const UpdateMonsterSchema = CreateMonsterSchema.partial();
export type UpdateMonster = z.infer<typeof UpdateMonsterSchema>;

export const MonsterFiltersSchema = z.object({
  type: MonsterTypeSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MonsterFilters = z.infer<typeof MonsterFiltersSchema>;
```

Removed: `firstGame`, `firstYear`, `games` from `BaseMonsterSchema`; `firstGame`, `firstYear` from `CreateMonsterSchema`; `game` from `MonsterFiltersSchema`; the import of `GameAppearanceSchema`.

- [ ] **Step 4 — Delete `packages/shared/src/schemas/game.schema.ts`**

Delete the file. On Windows PowerShell:

```powershell
Remove-Item packages/shared/src/schemas/game.schema.ts
```

- [ ] **Step 5 — Update `packages/shared/src/index.ts`**

Remove the `game.schema` export line:

```typescript
// BEFORE
export * from './schemas/enums.schema';
export * from './schemas/game.schema';   // ← delete this line
export * from './schemas/weakness.schema';
// ...rest unchanged

// AFTER
export * from './schemas/enums.schema';
export * from './schemas/weakness.schema';
export * from './schemas/hitzone.schema';
export * from './schemas/drop.schema';
export * from './schemas/ailment.schema';
export * from './schemas/strategy.schema';
export * from './schemas/monster.schema';
export * from './schemas/auth.schema';
```

- [ ] **Step 6 — Build the shared package**

```bash
pnpm --filter @mh-datapedia/shared build
```

Expected: no TypeScript errors. Output in `packages/shared/dist/`.

- [ ] **Step 7 — Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): remove firstGame/firstYear/GameAppearance schemas, add Wilds MonsterType values and Hitzone.stun"
```

---

## Task 3: API service cleanup + test fixes

**What this does:** Updates `monster.service.ts` to remove the `game` filter and `gameAppearances` from all Prisma queries. Updates `monsters.test.ts` to remove `firstGame` and `firstYear` from the test monster, which no longer exist on the model. Runs typecheck and all 33 tests to confirm nothing broke.

**Files:**
- Modify: `apps/api/src/services/monster.service.ts`
- Modify: `apps/api/tests/monsters.test.ts`

**Interfaces:**
- Consumes: Shared package from Task 2 (must be built first)
- Produces: `listMonsters` no longer accepts or uses `game`. `MONSTER_DETAIL_INCLUDE` no longer joins `gameAppearances`. All tests pass.

---

- [ ] **Step 1 — Update `apps/api/src/services/monster.service.ts`**

Replace the whole file:

```typescript
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { MonsterFilters, CreateMonster, UpdateMonster, UpsertWeaknesses, UpsertHitzones } from '@mh-datapedia/shared';
import { MHGame, Rank } from '@prisma/client';

const MONSTER_DETAIL_INCLUDE = {
  weaknesses: true,
  hitzones: true,
  strategies: {
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

export async function listMonsters(filters: MonsterFilters) {
  const { type, search, page, limit } = filters;
  const where = {
    ...(type && { type }),
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

export async function getMonsterById(id: string) {
  const monster = await prisma.monster.findUnique({
    where: { id },
    include: MONSTER_DETAIL_INCLUDE,
  });
  if (!monster) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
  return monster;
}

export async function getHitzones(monsterId: string) {
  await assertExists(monsterId);
  return prisma.hitzone.findMany({ where: { monsterId }, orderBy: { part: 'asc' } });
}

export async function getWeaknesses(monsterId: string) {
  await assertExists(monsterId);
  return prisma.elementWeakness.findMany({ where: { monsterId } });
}

export async function getSubspecies(monsterId: string) {
  await assertExists(monsterId);
  return prisma.monster.findMany({
    where: { parentId: monsterId },
    select: { id: true, name: true, type: true, iconUrl: true, imageUrl: true, title: true },
  });
}

export async function getDrops(monsterId: string, game?: string, rank?: string) {
  await assertExists(monsterId);
  return prisma.monsterDrop.findMany({
    where: {
      monsterId,
      ...(game && { game: game as MHGame }),
      ...(rank && { rank: rank as Rank }),
    },
    orderBy: [{ game: 'asc' }, { rank: 'asc' }, { method: 'asc' }],
  });
}

export async function getStrategies(monsterId: string) {
  await assertExists(monsterId);
  return prisma.strategy.findMany({
    where: { monsterId },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createMonster(data: CreateMonster) {
  return prisma.monster.create({ data, include: MONSTER_DETAIL_INCLUDE });
}

export async function updateMonster(id: string, data: UpdateMonster) {
  await assertExists(id);
  return prisma.monster.update({ where: { id }, data, include: MONSTER_DETAIL_INCLUDE });
}

export async function deleteMonster(id: string) {
  await assertExists(id);
  await prisma.monster.delete({ where: { id } });
}

export async function upsertWeaknesses(monsterId: string, items: UpsertWeaknesses) {
  await assertExists(monsterId);
  return prisma.$transaction(async (tx) => {
    await tx.elementWeakness.deleteMany({ where: { monsterId } });
    await tx.elementWeakness.createMany({ data: items.map(item => ({ ...item, monsterId })) });
    return tx.elementWeakness.findMany({ where: { monsterId } });
  });
}

export async function upsertHitzones(monsterId: string, items: UpsertHitzones) {
  await assertExists(monsterId);
  return prisma.$transaction(async (tx) => {
    await tx.hitzone.deleteMany({ where: { monsterId } });
    await tx.hitzone.createMany({ data: items.map(item => ({ ...item, monsterId })) });
    return tx.hitzone.findMany({ where: { monsterId }, orderBy: { part: 'asc' } });
  });
}

async function assertExists(id: string) {
  const exists = await prisma.monster.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
}
```

- [ ] **Step 2 — Update `apps/api/tests/monsters.test.ts`**

Remove `firstGame` and `firstYear` from `TEST_MONSTER`. The type no longer accepts them:

```typescript
const TEST_MONSTER = {
  name: 'Test Rathalos',
  title: 'King of the Skies',
  description: 'A fearsome flying wyvern that rules the skies.',
  type: 'FlyingWyvern',
  isBoss: true,
  habitats: ['Ancient Forest', 'Elder Recess'],
};
```

Note: `type` is also updated from `'Large'` to `'FlyingWyvern'` to use a real Wilds species name.

- [ ] **Step 3 — Run typecheck**

```bash
pnpm --filter @mh-datapedia/api exec prisma generate && pnpm typecheck
```

Expected: `0 errors`.

If you see errors about `gameAppearances` in any file, that file still references the removed field — fix each one by removing the reference.

- [ ] **Step 4 — Run the test suite**

```bash
pnpm test
```

Expected: all tests pass. The test suite connects to the local test database defined in `apps/api/.env.test`.

- [ ] **Step 5 — Commit**

```bash
git add apps/api/src/services/monster.service.ts apps/api/tests/monsters.test.ts
git commit -m "feat(api): remove game filter and gameAppearances from monster service"
```

---

## Task 4: Wilds seed script

**What this does:** Creates `apps/api/scripts/seed-wilds.ts` — a standalone script that fetches all monsters from `wilds.mhdb.io/en`, deletes any DB monsters not in the API response, then upserts each Wilds monster with its correct weaknesses, hitzones, and drops (including drop chance). Run it once to populate the database.

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/scripts/seed-wilds.ts`

**Interfaces:**
- Consumes: Prisma migration from Task 1 (schema has `stun`, no `firstGame`). Shared package from Task 2 (not imported — script uses Prisma types directly).
- Produces: All Wilds monsters in the DB with populated weaknesses, hitzones, and drops.

---

- [ ] **Step 1 — Add the script command to `apps/api/package.json`**

In the `"scripts"` block, add one line:

```json
"seed:wilds": "ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/seed-wilds.ts"
```

After the change the scripts block looks like:

```json
"scripts": {
  "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "typecheck": "tsc --noEmit",
  "lint": "echo 'lint ok'",
  "test": "jest",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:seed": "ts-node prisma/seed.ts",
  "seed:wilds": "ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/seed-wilds.ts"
},
```

- [ ] **Step 2 — Create `apps/api/scripts/seed-wilds.ts`**

Create the directory first if it does not exist, then create the file:

```typescript
import { PrismaClient } from '@prisma/client';
import type { MonsterType, DropMethod, Rank, MHGame } from '@prisma/client';
import 'dotenv/config';

// PrismaClient is the object that talks to the database.
// We create one instance and reuse it for the whole script.
const prisma = new PrismaClient();

const API_BASE = 'https://wilds.mhdb.io/en';

// Maps the species string from the Wilds API to the MonsterType enum value in our DB.
// Example: the API returns "flying-wyvern", we store "FlyingWyvern".
const SPECIES_MAP: Record<string, MonsterType> = {
  'flying-wyvern': 'FlyingWyvern',
  'brute-wyvern':  'BruteWyvern',
  'fanged-beast':  'FangedBeast',
  'temnoceran':    'Temnoceran',
  'bird-wyvern':   'BirdWyvern',
  'construct':     'Construct',
  'demi-elder':    'DemiElderDragon',
  'elder-dragon':  'ElderDragon',
};

// Maps the weakness/element string from the API to the Element enum in our DB.
// "blastblight" from the API becomes "Blast" in our schema.
const ELEMENT_MAP: Record<string, string> = {
  'fire':        'Fire',
  'water':       'Water',
  'thunder':     'Thunder',
  'ice':         'Ice',
  'dragon':      'Dragon',
  'poison':      'Poison',
  'sleep':       'Sleep',
  'paralysis':   'Paralysis',
  'blastblight': 'Blast',
  'stun':        'Stun',
};

// Maps the reward condition type from the API to our DropMethod enum.
// "carve" with part === "tail" is a special case handled in the drop loop below.
const METHOD_MAP: Record<string, DropMethod> = {
  'carve':         'BodyCarve',
  'broken-part':   'BreakReward',
  'capture':       'CaptureReward',
  'target-reward': 'QuestReward',
  'shiny-drop':    'ShinyDrop',
  'wound-drop':    'WoundDrop',
};

// Maps the rank string from the API to our Rank enum.
const RANK_MAP: Record<string, Rank> = {
  'low':  'LowRank',
  'high': 'HighRank',
};

// Fetches the full list of monsters from the Wilds API.
// Returns an array of objects with at least { id: number, name: string }.
async function fetchMonsterList(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/monsters`);
  if (!res.ok) throw new Error(`Failed to fetch monster list: ${res.status} ${res.statusText}`);
  return res.json();
}

// Fetches one monster's full data including weaknesses, parts (hitzones), and rewards (drops).
async function fetchMonsterDetail(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/monsters/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch monster ${id}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.log('Fetching monster list from wilds.mhdb.io...');
  const list = await fetchMonsterList();
  console.log(`  API returned ${list.length} monsters`);

  // Build a Set of monster names from the API so we can delete DB entries that are not in it.
  // A Set is like an array but with very fast "does this value exist?" lookups.
  const apiNames = new Set<string>(list.map((m: any) => m.name as string));

  // Delete all monsters whose name is NOT in the Wilds API.
  // onDelete: Cascade in the schema means all their weaknesses, hitzones, and drops
  // are also deleted automatically.
  const deleted = await prisma.monster.deleteMany({
    where: { name: { notIn: Array.from(apiNames) } },
  });
  console.log(`  Deleted ${deleted.count} non-Wilds monsters from the DB`);

  let upserted = 0;

  for (const listItem of list) {
    // Fetch the full detail for this monster (includes weaknesses, parts, rewards)
    const m = await fetchMonsterDetail(listItem.id);

    // Map the API's species string to our MonsterType. Default to 'Large' with a warning
    // if the species is unrecognised — this means the API added a new species we haven't mapped.
    const type: MonsterType = SPECIES_MAP[m.species] ?? 'Large';
    if (!SPECIES_MAP[m.species]) {
      console.warn(`  WARN: unknown species "${m.species}" for ${m.name} — stored as Large`);
    }

    // Use a Prisma transaction so all updates for one monster succeed or fail together.
    // If anything throws inside here, Prisma rolls back ALL changes for this monster.
    await prisma.$transaction(async (tx) => {

      // upsert = UPDATE if the name already exists, CREATE if it doesn't.
      // We match by name (the unique constraint on Monster.name).
      const monster = await tx.monster.upsert({
        where: { name: m.name },
        create: {
          name:        m.name,
          title:       '',         // admin fills later via the web form
          description: '',         // admin fills later via the web form
          type,
          isBoss:      m.kind === 'large',
          imageUrl:    null,       // Wilds API has no images
          iconUrl:     null,
          habitats:    [],         // admin fills later via the web form
        },
        update: {
          type,
          isBoss: m.kind === 'large',
          // We don't overwrite title/description/imageUrl/habitats on update
          // so that admin edits made through the web UI are preserved.
        },
        select: { id: true },
      });

      // ── WEAKNESSES ──────────────────────────────────────────────────────────
      // Delete all existing weakness rows for this monster, then insert fresh ones.
      // This is the "replace all" pattern — simpler than trying to diff each row.
      await tx.elementWeakness.deleteMany({ where: { monsterId: monster.id } });

      const weaknesses = (m.weaknesses ?? [])
        .map((w: any) => {
          const element = ELEMENT_MAP[w.element];
          if (!element) {
            console.warn(`  WARN: unknown element "${w.element}" for ${m.name} — skipped`);
            return null;
          }
          return {
            monsterId: monster.id,
            element,
            rating:   w.level,   // 1 = one star, 2 = two stars, 3 = three stars
            isImmune: false,     // Wilds API does not list immunities explicitly
          };
        })
        .filter(Boolean);

      if (weaknesses.length > 0) {
        await tx.elementWeakness.createMany({ data: weaknesses });
      }

      // ── HITZONES ────────────────────────────────────────────────────────────
      // Same replace-all pattern as weaknesses.
      // The API calls them "parts"; we call them "hitzones".
      // Each part has a "multipliers" object with damage % values per attack type.
      await tx.hitzone.deleteMany({ where: { monsterId: monster.id } });

      const hitzones = (m.parts ?? []).map((p: any) => ({
        monsterId: monster.id,
        part:      p.part,
        cut:       p.multipliers.slash   ?? 0,
        blunt:     p.multipliers.blunt   ?? 0,
        bullet:    p.multipliers.pierce  ?? 0,
        fire:      p.multipliers.fire    ?? 0,
        water:     p.multipliers.water   ?? 0,
        thunder:   p.multipliers.thunder ?? 0,
        ice:       p.multipliers.ice     ?? 0,
        dragon:    p.multipliers.dragon  ?? 0,
        stun:      p.multipliers.stun    ?? 0,
      }));

      if (hitzones.length > 0) {
        await tx.hitzone.createMany({ data: hitzones });
      }

      // ── DROPS ───────────────────────────────────────────────────────────────
      // The API returns rewards as: [{ item: { name }, conditions: [{ kind, rank, quantity, chance, part }] }]
      // We expand each reward × each condition into one DB row.
      // "chance" is the drop chance percentage (e.g. 35 means 35%).
      await tx.monsterDrop.deleteMany({ where: { monsterId: monster.id } });

      const drops: any[] = [];

      for (const reward of (m.rewards ?? [])) {
        for (const cond of (reward.conditions ?? [])) {

          // Special case: a "carve" from the tail is a TailCarve, not a BodyCarve
          const method: DropMethod | undefined =
            cond.kind === 'carve' && cond.part === 'tail'
              ? 'TailCarve'
              : METHOD_MAP[cond.kind];

          if (!method) {
            console.warn(`  WARN: unknown drop kind "${cond.kind}" for ${m.name} — skipped`);
            continue;
          }

          const rank: Rank | undefined = RANK_MAP[cond.rank];
          if (!rank) {
            console.warn(`  WARN: unknown rank "${cond.rank}" for ${m.name} — skipped`);
            continue;
          }

          drops.push({
            monsterId: monster.id,
            game:      'MONSTER_HUNTER_WILDS' as MHGame,
            rank,
            method,
            part:      cond.part ?? null,    // the body part this drop comes from (nullable)
            itemName:  reward.item.name,
            quantity:  cond.quantity,
            rate:      cond.chance,           // drop chance as a percentage, e.g. 35.0
          });
        }
      }

      if (drops.length > 0) {
        await tx.monsterDrop.createMany({ data: drops });
      }
    }); // end transaction

    upserted++;
    console.log(`  [${upserted}/${list.length}] ✓ ${m.name}`);
  }

  console.log(`\nDone. ${upserted} monsters upserted, ${deleted.count} non-Wilds monsters deleted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3 — Run the seed script**

Make sure your local `.env` file in `apps/api/` exists with a valid `DATABASE_URL` pointing to your local Postgres. Then:

```bash
pnpm --filter @mh-datapedia/api run seed:wilds
```

Expected output (names and counts will vary as more monsters are added to the API):

```
Fetching monster list from wilds.mhdb.io...
  API returned 28 monsters
  Deleted 0 non-Wilds monsters from the DB
  [1/28] ✓ Zoh Shia
  [2/28] ✓ Guardian Doshaguma
  ...
  [28/28] ✓ Arkveld

Done. 28 monsters upserted, 0 non-Wilds monsters deleted.
```

If you see `WARN: unknown species` messages, add the new species to `SPECIES_MAP` and re-run.

- [ ] **Step 4 — Verify results**

Open Prisma Studio and check the `Monster` table has rows with weaknesses and hitzones, and the `MonsterDrop` table has rows with `rate` values (drop chances):

```bash
pnpm --filter @mh-datapedia/api exec prisma studio
```

Alternatively, start the API and curl it:

```bash
pnpm --filter @mh-datapedia/api run dev
# In another terminal:
curl http://localhost:3001/api/monsters | jq '.data[0].name'
curl http://localhost:3001/api/monsters/PASTE_AN_ID_HERE/weaknesses
```

- [ ] **Step 5 — Commit**

```bash
git add apps/api/package.json apps/api/scripts/
git commit -m "feat(api): add Wilds seed script — upserts all monsters, weaknesses, hitzones, drops"
```

---

## Task 5: Web cleanup — types, colours, components

**What this does:** Updates the web app to match all the removed fields. Removes `firstGame`, `firstYear`, `gameAppearances` from `types.ts`. Removes the game filter from `useMonsters`, `MonsterFilters`, and the monsters list page. Removes the First Game / First Year fields from the admin form. Updates `constants.ts` with Wilds colours and species badge classes.

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/constants.ts`
- Modify: `apps/web/src/hooks/useMonsters.ts`
- Modify: `apps/web/src/components/monsters/MonsterCard.tsx`
- Modify: `apps/web/src/components/monsters/MonsterFilters.tsx`
- Modify: `apps/web/src/components/admin/MonsterFormModal.tsx`
- Modify: `apps/web/src/routes/monsters/index.tsx`

**Interfaces:**
- Consumes: Shared package from Task 2 (no `firstGame`, no `game` filter)
- Produces: Web app typechecks cleanly. Monster list shows no game badges. Game filter row is gone. Admin form has no First Game / First Year fields.

---

- [ ] **Step 1 — Update `apps/web/src/lib/types.ts`**

Remove `firstGame`, `firstYear`, and `gameAppearances` from `MonsterListItem`. Remove the `GameAppearance` interface entirely:

```typescript
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

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

- [ ] **Step 2 — Update `apps/web/src/lib/constants.ts`**

Replace the whole file:

```typescript
export const GAME_NAMES: Record<string, string> = {
  MONSTER_HUNTER_WILDS: 'Monster Hunter Wilds',
};

export const GAME_ORDER = ['MONSTER_HUNTER_WILDS'] as const;

export const TYPE_BADGE_CLASSES: Record<string, string> = {
  Large:           'bg-amber-500/10 text-amber-500',
  Small:           'bg-stone-700 text-stone-400',
  ElderDragon:     'bg-amber-400/10 text-amber-400',
  Apex:            'bg-red-400/10 text-red-400',
  Afflicted:       'bg-red-400/10 text-red-400',
  Tempered:        'bg-red-400/10 text-red-400',
  FlyingWyvern:    'bg-sky-400/10 text-sky-400',
  BruteWyvern:     'bg-red-400/10 text-red-400',
  FangedBeast:     'bg-orange-400/10 text-orange-400',
  Temnoceran:      'bg-rose-400/10 text-rose-400',
  BirdWyvern:      'bg-lime-400/10 text-lime-400',
  Construct:       'bg-stone-400/10 text-stone-400',
  DemiElderDragon: 'bg-amber-600/10 text-amber-600',
};

export const ELEMENT_COLORS: Record<string, string> = {
  Fire:      'text-red-500',
  Water:     'text-blue-500',
  Thunder:   'text-yellow-400',
  Ice:       'text-cyan-400',
  Dragon:    'text-teal-500',
  Poison:    'text-fuchsia-500',
  Sleep:     'text-blue-500',
  Paralysis: 'text-yellow-500',
  Blast:     'text-orange-500',
  Stun:      'text-amber-400',
};

export const DIFFICULTY_CLASSES: Record<string, string> = {
  Beginner:     'bg-green-500/10 text-green-500',
  Intermediate: 'bg-amber-500/10 text-amber-500',
  Advanced:     'bg-red-500/10 text-red-500',
};

export const DROP_METHOD_NAMES: Record<string, string> = {
  BodyCarve:      'Body Carve',
  TailCarve:      'Tail Carve',
  BreakReward:    'Break Reward',
  CaptureReward:  'Capture Reward',
  QuestReward:    'Quest Reward',
  ShinyDrop:      'Shiny Drop',
  WoundDrop:      'Wound Drop',
  PalicoBoomerang: 'Palico Boomerang',
};
```

- [ ] **Step 3 — Update `apps/web/src/hooks/useMonsters.ts`**

Remove the `game` field from `MonsterFiltersInput` and remove the `params.set('game', ...)` line:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { MonsterListItem, PaginatedResponse } from '../lib/types';

export interface MonsterFiltersInput {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useMonsters(filters: MonsterFiltersInput = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
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

- [ ] **Step 4 — Update `apps/web/src/components/monsters/MonsterCard.tsx`**

Remove the `gameAppearances.map(...)` badge block and the `shortGameName` helper function. The card now only shows name, title, and type badge:

```typescript
import { Link } from '@tanstack/react-router';
import { Crown } from 'lucide-react';
import type { MonsterListItem } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { TYPE_BADGE_CLASSES } from '../../lib/constants';
import { cn } from '../../lib/utils';

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
        <h3 className="font-semibold text-stone-50 group-hover:text-amber-400 transition-colors duration-150 leading-tight">
          {monster.name}
        </h3>
        {monster.isBoss && <Crown size={14} className="text-amber-500 shrink-0 mt-0.5" />}
      </div>

      <p className="text-stone-500 text-xs mb-3 line-clamp-1">{monster.title}</p>

      <div className="flex flex-wrap gap-1.5">
        <Badge className={cn(TYPE_BADGE_CLASSES[monster.type] ?? 'bg-stone-700 text-stone-400')}>
          {monster.type}
        </Badge>
      </div>
    </Link>
  );
}
```

- [ ] **Step 5 — Update `apps/web/src/components/monsters/MonsterFilters.tsx`**

Remove the game filter row, the `game` and `onGameChange` props, and all references to `GAME_ORDER`, `GAME_NAMES`, `shortGame`. Update `MONSTER_TYPES` to include the Wilds species:

```typescript
import { cn } from '../../lib/utils';

const MONSTER_TYPES = [
  'FlyingWyvern',
  'BruteWyvern',
  'FangedBeast',
  'Temnoceran',
  'BirdWyvern',
  'Construct',
  'DemiElderDragon',
  'ElderDragon',
];

interface MonsterFiltersProps {
  type: string | undefined;
  search: string | undefined;
  onTypeChange: (type: string | undefined) => void;
  onSearchChange: (search: string | undefined) => void;
}

export function MonsterFilters({
  type,
  search,
  onTypeChange,
  onSearchChange,
}: MonsterFiltersProps) {
  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search monsters…"
        value={search ?? ''}
        onChange={(e) => onSearchChange(e.target.value || undefined)}
        className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors duration-150"
      />

      <div className="flex flex-wrap gap-2">
        <Pill active={type === undefined} onClick={() => onTypeChange(undefined)}>
          All Types
        </Pill>
        {MONSTER_TYPES.map((t) => (
          <Pill
            key={t}
            active={type === t}
            onClick={() => onTypeChange(type === t ? undefined : t)}
          >
            {t}
          </Pill>
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
          ? 'bg-amber-500 text-stone-950 font-medium'
          : 'bg-stone-800 text-stone-400 hover:bg-stone-700',
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 6 — Update `apps/web/src/components/admin/MonsterFormModal.tsx`**

Remove `GAME_IDS`, the `firstGame` select, the `firstYear` input, and their `reset()` values. Update `MONSTER_TYPES` to include Wilds species:

```typescript
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonsterSchema } from '@mh-datapedia/shared';
import type { CreateMonster } from '@mh-datapedia/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateMonster } from '../../hooks/useCreateMonster';
import { useUpdateMonster } from '../../hooks/useUpdateMonster';
import type { MonsterDetail } from '../../lib/types';

const MONSTER_TYPES = [
  'FlyingWyvern', 'BruteWyvern', 'FangedBeast', 'Temnoceran',
  'BirdWyvern', 'Construct', 'DemiElderDragon', 'ElderDragon',
];

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
    formState: { errors, isSubmitting },
  } = useForm<CreateMonster>({ resolver: zodResolver(CreateMonsterSchema) });

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
            }
          : undefined,
      );
    }
  }, [open, existing, reset]);

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
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-red-400 text-xs">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-stone-300 text-sm mb-1">Type</label>
          <select
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            {...register('type')}
          >
            {MONSTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
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
          <input type="checkbox" id="isBoss" {...register('isBoss')} className="accent-amber-500" />
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

- [ ] **Step 7 — Update `apps/web/src/routes/monsters/index.tsx`**

Remove `game` from the search schema, from state, and from the `<MonsterFilters />` props:

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useState } from 'react';
import { useMonsters } from '../../hooks/useMonsters';
import { MonsterFilters } from '../../components/monsters/MonsterFilters';
import { MonsterGrid } from '../../components/monsters/MonsterGrid';
import { Button } from '../../components/ui/Button';
import { MonsterFormModal } from '../../components/admin/MonsterFormModal';
import { useAuth } from '../../context/AuthContext';

const monsterSearchSchema = z.object({
  type:   z.string().optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/monsters/')({
  validateSearch: monsterSearchSchema,
  component: MonstersPage,
});

function MonstersPage() {
  const { user } = useAuth();
  const navigate = useNavigate({ from: '/monsters/' });
  const { type, search, page } = Route.useSearch();
  const { data, isLoading } = useMonsters({ type, search, page });
  const [showAddModal, setShowAddModal] = useState(false);

  const setFilter = (key: 'type' | 'search', val: string | undefined) => {
    navigate({ search: (prev) => ({ ...prev, [key]: val, page: 1 }) });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-50">Monsters</h1>
        {user?.role === 'ADMIN' && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            + Add Monster
          </Button>
        )}
      </div>

      <div className="mb-6">
        <MonsterFilters
          type={type}
          search={search}
          onTypeChange={(t) => setFilter('type', t)}
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

- [ ] **Step 8 — Run typecheck**

```bash
pnpm typecheck
```

Expected: `0 errors`. If any file still references `firstGame`, `firstYear`, or `gameAppearances`, the error message will point to the exact file and line. Fix each one by removing the reference.

- [ ] **Step 9 — Start the dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:5173/monsters` in the browser. Confirm:

- No game filter pills (only type pills and a search bar)
- Monster cards show name, title, and a species badge — no game badges
- The type badges for Wilds monsters use the new colours (amber for Elder Dragon, sky for Flying Wyvern, etc.)
- The page background is still dark stone, not purple/violet anywhere

- [ ] **Step 10 — Commit**

```bash
git add apps/web/
git commit -m "feat(web): remove firstGame/gameAppearances from types/hooks/components, add Wilds colours and species badges"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Create `docs/changelog.md` | Task 1, Step 1 |
| Remove `firstGame`, `firstYear` from Prisma | Task 1, Step 2 |
| Remove `GameAppearance` model | Task 1, Step 2 |
| Add Wilds `MonsterType` values | Task 1, Step 2 |
| Add `Hitzone.stun` | Task 1, Step 2 |
| Run Prisma migration | Task 1, Step 3 |
| Update shared `enums.schema.ts` | Task 2, Step 1 |
| Update shared `hitzone.schema.ts` | Task 2, Step 2 |
| Update shared `monster.schema.ts` | Task 2, Step 3 |
| Delete `game.schema.ts` | Task 2, Step 4 |
| Remove `gameAppearances` from API service | Task 3, Step 1 |
| Remove `game` filter from API service | Task 3, Step 1 |
| Fix `monsters.test.ts` | Task 3, Step 2 |
| Seed script (upsert monsters + weaknesses + hitzones + drops) | Task 4, Step 2 |
| Idempotent seed | Task 4, Step 2 (`upsert`, replace-all pattern) |
| Delete non-Wilds monsters | Task 4, Step 2 (`deleteMany where name notIn`) |
| `rate` = drop chance % | Task 4, Step 2 (`rate: cond.chance`) |
| Update web `types.ts` | Task 5, Step 1 |
| Update colours in `constants.ts` | Task 5, Step 2 |
| Fix `useMonsters.ts` | Task 5, Step 3 |
| Fix `MonsterCard.tsx` | Task 5, Step 4 |
| Fix `MonsterFilters.tsx` | Task 5, Step 5 |
| Fix `MonsterFormModal.tsx` | Task 5, Step 6 |
| Fix `monsters/index.tsx` | Task 5, Step 7 |

All spec requirements are covered. No placeholders found. Types are consistent across tasks.
