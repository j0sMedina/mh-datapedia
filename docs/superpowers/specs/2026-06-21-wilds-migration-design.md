# MH Datapedia — Wilds Migration & Web Update Design Spec

## Goal

Transform the existing multi-game Monster Hunter wiki into a **Monster Hunter Wilds-exclusive** encyclopaedia. All non-Wilds monsters are removed. All remaining monsters are populated — or updated — with accurate data (weaknesses, hitzones, drop chances) pulled live from the Wilds community API at `wilds.mhdb.io`. The web app gets a colour overhaul so it looks like a Wilds field guide instead of an adult website.

`firstGame`, `firstYear`, and the `GameAppearance` table are removed entirely. The Wilds API does not carry debut-game data, and filling it manually would introduce errors (Congalala debuted in Monster Hunter 2, not World). Since the wiki covers only Wilds monsters, tracking which game a monster first appeared in adds no value and risks misleading users.

---

## Global Constraints

- API base URL: `https://wilds.mhdb.io/en`
- Language locale for all API calls: `en`
- The seed script must be idempotent: running it twice must produce the same DB state
- Existing `User`, `RefreshToken`, `Strategy` rows must survive the migration untouched
- Never commit `.env` or `.env.test`

---

## What the Wilds API returns (exact field names)

`GET https://wilds.mhdb.io/en/monsters/{id}` returns one object. The fields we use:

```json
{
  "name": "Rey Dau",
  "species": "flying-wyvern",
  "kind": "large",

  "weaknesses": [
    { "element": "ice", "kind": "element", "level": 2 },
    { "element": "paralysis", "kind": "status", "level": 1 }
  ],

  "parts": [
    {
      "part": "head",
      "multipliers": {
        "slash": 65, "blunt": 70, "pierce": 60,
        "fire": 10, "water": 5, "thunder": 0,
        "ice": 20, "dragon": 5, "stun": 100
      }
    }
  ],

  "rewards": [
    {
      "item": { "name": "Rey Dau Scale" },
      "conditions": [
        { "kind": "carve", "rank": "low", "quantity": 1, "chance": 35, "part": null },
        { "kind": "broken-part", "rank": "high", "quantity": 1, "chance": 60, "part": "head" }
      ]
    }
  ]
}
```

No `imageUrl` or `iconUrl` exist in the API. Those fields stay `null` after seeding.

---

## Schema changes (`apps/api/prisma/schema.prisma`)

### Removals

Remove these three things from the schema. Prisma will generate `DROP COLUMN` and `DROP TABLE` statements in the migration. Postgres handles this safely — the data is gone but no other table breaks because all foreign keys are `onDelete: Cascade`.

**Columns to remove from `Monster`:**
- `firstGame  MHGame` — no longer tracked
- `firstYear  Int` — no longer tracked

**Model to remove entirely:**
- `GameAppearance` — the whole model, its relation on `Monster`, and its index

Also remove from `Monster`:
```prisma
// REMOVE this line
gameAppearances GameAppearance[]

// REMOVE this index
@@index([firstGame])
```

### Additions

#### 1. Expand `MonsterType` enum with Wilds species

Current values: `Large Small ElderDragon Apex Afflicted Tempered`

Add these (old values are kept — Postgres cannot drop enum values without recreating the type):

```prisma
enum MonsterType {
  // kept for Postgres compatibility; no new monsters use these
  Large
  Small
  Apex
  Afflicted
  Tempered
  // Wilds species (used by seed script)
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

`ElderDragon` was already present — it is not duplicated.

#### 2. Add `stun` column to `Hitzone`

```prisma
model Hitzone {
  // ... existing columns ...
  stun  Int  @default(0)
}
```

Default 0 so existing rows are unaffected.

### Migration command

```bash
pnpm --filter @mh-datapedia/api exec prisma migrate dev --name wilds_migration
```

This single migration handles the removals and additions together.

---

## `packages/shared` changes

### `enums.schema.ts` — add new `MonsterType` values

```typescript
export const MonsterTypeSchema = z.enum([
  'Large', 'Small', 'ElderDragon', 'Apex', 'Afflicted', 'Tempered',
  'FlyingWyvern', 'BruteWyvern', 'FangedBeast', 'Temnoceran',
  'BirdWyvern', 'Construct', 'DemiElderDragon',
]);
```

### `hitzone.schema.ts` — add `stun` field

```typescript
export const HitzoneSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  part: z.string(),
  cut: z.number().int(),
  blunt: z.number().int(),
  bullet: z.number().int(),
  fire: z.number().int(),
  water: z.number().int(),
  thunder: z.number().int(),
  ice: z.number().int(),
  dragon: z.number().int(),
  stun: z.number().int(),
});
```

### `monster.schema.ts` — remove `firstGame`, `firstYear`, `games`, and `game` filter

**`BaseMonsterSchema`** — remove `firstGame`, `firstYear`, `games`:

```typescript
// REMOVE these lines from BaseMonsterSchema
firstGame: MHGameSchema,
firstYear: z.number().int(),
games: z.array(GameAppearanceSchema),
```

**`CreateMonsterSchema`** — remove `firstGame`, `firstYear`:

```typescript
// REMOVE these lines
firstGame: MHGameSchema,
firstYear: z.number().int().min(1900).max(2100),
```

**`MonsterFiltersSchema`** — remove `game`:

```typescript
// BEFORE
export const MonsterFiltersSchema = z.object({
  game: MHGameSchema.optional(),   // ← remove
  type: MonsterTypeSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// AFTER
export const MonsterFiltersSchema = z.object({
  type: MonsterTypeSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

### `game.schema.ts` — delete this file entirely

`GameAppearanceSchema` is no longer needed. Remove the file and remove its export from `packages/shared/src/index.ts`.

---

## API changes (`apps/api/src/services/monster.service.ts`)

### Remove `gameAppearances` from `MONSTER_DETAIL_INCLUDE`

```typescript
// BEFORE
const MONSTER_DETAIL_INCLUDE = {
  gameAppearances: true,   // ← remove this line
  weaknesses: true,
  ...
};
```

### Remove `gameAppearances` from `listMonsters` include

```typescript
// BEFORE
prisma.monster.findMany({
  where,
  skip: ..., take: ...,
  include: { gameAppearances: true, weaknesses: true },
  orderBy: { name: 'asc' },
})

// AFTER
prisma.monster.findMany({
  where,
  skip: ..., take: ...,
  include: { weaknesses: true },
  orderBy: { name: 'asc' },
})
```

### Remove `game` filter from `listMonsters`

```typescript
// BEFORE
const { game, type, search, page, limit } = filters;
const where = {
  ...(type && { type }),
  ...(game && { gameAppearances: { some: { game } } }),
  ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
};

// AFTER
const { type, search, page, limit } = filters;
const where = {
  ...(type && { type }),
  ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
};
```

---

## Web component changes

### `apps/web/src/components/monsters/MonsterCard.tsx`

Remove the `gameAppearances` badge section:

```typescript
// REMOVE this entire block
{monster.gameAppearances.map((ga) => (
  <Badge key={ga.id} className="bg-stone-800 text-stone-500">
    {shortGameName(ga.game)}
  </Badge>
))}

// ALSO REMOVE the shortGameName helper function — no longer needed
```

Remove `GAME_NAMES` from the imports at the top of the file since `shortGameName` used it.

### `apps/web/src/components/monsters/MonsterFilters.tsx`

Remove any `game` filter UI (dropdown or select for filtering by game). The `MonsterFiltersSchema` no longer accepts `game`, so any UI that sets it would cause a validation error.

---

## Seed script (`apps/api/scripts/seed-wilds.ts`)

A standalone TypeScript script run with `tsx`. It is safe to run multiple times.

### Algorithm

```
1. Fetch GET /monsters from wilds.mhdb.io/en  →  array of all Wilds monsters
2. Collect all API monster names into a Set<string>
3. Delete from DB every monster whose name is NOT in that Set
   (cascades to ElementWeakness, Hitzone, MonsterDrop, Strategy, MonsterAilment)
4. For each API monster:
     a. Map API fields to DB fields (see mappings below)
     b. prisma.$transaction(async tx => {
          upsert monster row (create or update, matched by name)
          deleteMany ElementWeakness where monsterId = monster.id
          createMany ElementWeakness from api.weaknesses
          deleteMany Hitzone where monsterId = monster.id
          createMany Hitzone from api.parts
          deleteMany MonsterDrop where monsterId = monster.id
          createMany MonsterDrop from api.rewards (expanding conditions)
        })
5. Print summary: X monsters upserted, Y deleted
```

### Field mappings

**Monster row:**

| API field | DB field | Notes |
|-----------|----------|-------|
| `name` | `name` | exact string |
| `species` | `type` | mapped via `SPECIES_MAP` |
| — | `title` | `""` — admin fills later via web |
| — | `description` | `""` — admin fills later via web |
| — | `imageUrl` | `null` — API has no images |
| — | `iconUrl` | `null` |
| `kind` | `isBoss` | `kind === "large"` → `true` |
| — | `habitats` | `[]` — admin fills later via web |

**`SPECIES_MAP` constant:**

```typescript
const SPECIES_MAP: Record<string, string> = {
  'flying-wyvern':  'FlyingWyvern',
  'brute-wyvern':   'BruteWyvern',
  'fanged-beast':   'FangedBeast',
  'temnoceran':     'Temnoceran',
  'bird-wyvern':    'BirdWyvern',
  'construct':      'Construct',
  'demi-elder':     'DemiElderDragon',
  'elder-dragon':   'ElderDragon',
};
```

**ElementWeakness rows** (one per item in `api.weaknesses`):

| API field | DB field | Notes |
|-----------|----------|-------|
| `element` | `element` | capitalise first letter: `"ice"` → `"Ice"` |
| `level` | `rating` | direct integer (1, 2, or 3) |
| — | `isImmune` | `false` — API does not list immunities explicitly |

**Hitzone rows** (one per item in `api.parts`):

| API field | DB field | Notes |
|-----------|----------|-------|
| `part` | `part` | exact string |
| `multipliers.slash` | `cut` | integer |
| `multipliers.blunt` | `blunt` | integer |
| `multipliers.pierce` | `bullet` | integer |
| `multipliers.fire` | `fire` | integer |
| `multipliers.water` | `water` | integer |
| `multipliers.thunder` | `thunder` | integer |
| `multipliers.ice` | `ice` | integer |
| `multipliers.dragon` | `dragon` | integer |
| `multipliers.stun` | `stun` | integer |

**MonsterDrop rows** (expand each reward × each condition):

| API field | DB field | Notes |
|-----------|----------|-------|
| `item.name` | `itemName` | exact string |
| `condition.kind` | `method` | mapped via `METHOD_MAP` |
| `condition.rank` | `rank` | `"low"` → `LowRank`, `"high"` → `HighRank` |
| `condition.quantity` | `quantity` | integer |
| `condition.chance` | `rate` | float — e.g. `35` means 35% drop chance |
| `condition.part` | `part` | nullable string |
| — | `game` | always `MONSTER_HUNTER_WILDS` |

**`METHOD_MAP` constant:**

```typescript
const METHOD_MAP: Record<string, string> = {
  'carve':         'BodyCarve',     // if condition.part === 'tail', use 'TailCarve' instead
  'broken-part':   'BreakReward',
  'capture':       'CaptureReward',
  'target-reward': 'QuestReward',
  'shiny-drop':    'ShinyDrop',
  'wound-drop':    'WoundDrop',
};
// Special case: kind === 'carve' && part === 'tail'  →  'TailCarve'
```

Any `condition.kind` not in `METHOD_MAP` is logged to the console and skipped.

---

## Web colour update (`apps/web/src/lib/constants.ts`)

### Changes to `TYPE_BADGE_CLASSES`

```typescript
// BEFORE
ElderDragon: 'bg-violet-400/10 text-violet-400',

// AFTER
ElderDragon:      'bg-amber-400/10 text-amber-400',
FlyingWyvern:     'bg-sky-400/10 text-sky-400',
BruteWyvern:      'bg-red-400/10 text-red-400',
FangedBeast:      'bg-orange-400/10 text-orange-400',
Temnoceran:       'bg-rose-400/10 text-rose-400',
BirdWyvern:       'bg-lime-400/10 text-lime-400',
Construct:        'bg-stone-400/10 text-stone-400',
DemiElderDragon:  'bg-amber-600/10 text-amber-600',
```

### Changes to `ELEMENT_COLORS`

```typescript
// BEFORE
Dragon:  'text-violet-500',
Poison:  'text-purple-500',
Sleep:   'text-indigo-400',

// AFTER
Dragon:  'text-teal-500',
Poison:  'text-fuchsia-500',
Sleep:   'text-blue-500',
```

### Remove non-Wilds entries from `GAME_NAMES`, `GAME_COLORS`, `GAME_ORDER`

Keep only `MONSTER_HUNTER_WILDS`. The other four entries are no longer referenced by any monster.

---

## `docs/changelog.md`

Create at repo root. Newest entry at the top.

```markdown
# Changelog

## [2026-06-21] Wilds-only migration

REMOVED `firstGame MHGame` column from `Monster` model
  (apps/api/prisma/schema.prisma)
  → Wilds API does not carry debut-game data; filling it manually would introduce errors
    (e.g. Congalala debuted in Monster Hunter 2, not World)

REMOVED `firstYear Int` column from `Monster` model
  (apps/api/prisma/schema.prisma)
  → same reason as firstGame removal above

REMOVED `GameAppearance` model entirely
  (apps/api/prisma/schema.prisma)
  → wiki is Wilds-only; tracking per-game appearances adds no value

REMOVED `game.schema.ts` from packages/shared
  → GameAppearanceSchema is unused after model removal

REMOVED `firstGame`, `firstYear`, `games` from shared monster schemas
  (packages/shared/src/schemas/monster.schema.ts)

REMOVED `game` filter from `MonsterFiltersSchema`
  (packages/shared/src/schemas/monster.schema.ts)
  → Wilds-only wiki; filtering by game is meaningless

REMOVED `game` WHERE clause from `listMonsters` and `gameAppearances` from MONSTER_DETAIL_INCLUDE
  (apps/api/src/services/monster.service.ts)

REMOVED `gameAppearances` badge block from MonsterCard
  (apps/web/src/components/monsters/MonsterCard.tsx)

ADDED `stun Int @default(0)` to `Hitzone` model
  (apps/api/prisma/schema.prisma)
  → Wilds API returns stun multiplier; was missing from original schema

ADDED MonsterType enum values: FlyingWyvern, BruteWyvern, FangedBeast,
  Temnoceran, BirdWyvern, Construct, DemiElderDragon
  (apps/api/prisma/schema.prisma, packages/shared/src/schemas/enums.schema.ts)
  → original schema used generic Large/Small instead of actual MH species names

CHANGED Dragon element colour: text-violet-500 → text-teal-500
CHANGED ElderDragon badge colour: bg-violet-400/10 text-violet-400 → bg-amber-400/10 text-amber-400
CHANGED Poison element colour: text-purple-500 → text-fuchsia-500
  (apps/web/src/lib/constants.ts)
  → violet/purple palette caused unintended visual similarity to adult websites
```

---

## Non-goals (out of scope for this spec)

- Monster images (`imageUrl` stays `null` — admin fills via web form)
- React Native mobile app (separate spec: `2026-06-21-mobile-app-design.md`)
- Admin CRUD form changes
- Test updates beyond fixing broken TypeScript types
