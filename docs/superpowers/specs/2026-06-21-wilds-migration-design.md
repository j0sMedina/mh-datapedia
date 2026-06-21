# MH Datapedia — Wilds Migration & Web Update Design Spec

## Goal

Transform the existing multi-game Monster Hunter wiki into a **Monster Hunter Wilds-exclusive** encyclopaedia. All non-Wilds monsters are removed. All remaining monsters are populated — or updated — with accurate data (weaknesses, hitzones, drop chances) pulled live from the Wilds community API at `wilds.mhdb.io`. The web app gets a colour overhaul so it looks like a Wilds field guide instead of an adult website.

---

## Global Constraints

- API base URL: `https://wilds.mhdb.io/en`
- Language locale for all API calls: `en`
- All new monsters belong to game `MONSTER_HUNTER_WILDS`
- The `firstGame` field on returning monsters stays accurate (Congalala's `firstGame` remains `MONSTER_HUNTER_WORLD`)
- No Prisma schema column renames — only additive changes (new enum values, new column)
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

## Schema changes

Two additive changes to `apps/api/prisma/schema.prisma`. Both require a migration.

### 1. Expand `MonsterType` enum with Wilds species

Current values: `Large Small ElderDragon Apex Afflicted Tempered`

Add these values (old values are kept so Postgres does not error):

```prisma
enum MonsterType {
  // existing — kept for Postgres compatibility, not used for new monsters
  Large
  Small
  Apex
  Afflicted
  Tempered
  // new Wilds species
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

`ElderDragon` was already in the enum — it is kept as-is.

### 2. Add `stun` column to `Hitzone`

The Wilds API returns a `stun` multiplier in `parts[].multipliers.stun`. Add it to the `Hitzone` model:

```prisma
model Hitzone {
  // ... existing columns ...
  stun      Int     @default(0)   // ← add this line
}
```

Default 0 so existing rows do not break.

### Migration command

```bash
pnpm --filter @mh-datapedia/api exec prisma migrate dev --name wilds_types_and_hitzone_stun
```

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
  stun: z.number().int(),   // ← add this
});
```

### `monster.schema.ts` — remove `game` from `MonsterFiltersSchema`

```typescript
// BEFORE
export const MonsterFiltersSchema = z.object({
  game: MHGameSchema.optional(),   // ← remove this line
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

Reason: the app is Wilds-only, so filtering by game is meaningless.

---

## API changes (`apps/api/src/services/monster.service.ts`)

Remove the `game` filter from `listMonsters`:

```typescript
// BEFORE
const where = {
  ...(type && { type }),
  ...(game && { gameAppearances: { some: { game } } }),   // ← remove this line
  ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
};

// AFTER
const where = {
  ...(type && { type }),
  ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
};
```

Also destructure `filters` without `game`:

```typescript
// BEFORE
const { game, type, search, page, limit } = filters;

// AFTER
const { type, search, page, limit } = filters;
```

---

## Seed script (`apps/api/scripts/seed-wilds.ts`)

A standalone TypeScript script run with `ts-node` or `tsx`. It is safe to run multiple times.

### Algorithm

```
1. Fetch GET /monsters from wilds.mhdb.io/en  →  array of all Wilds monsters
2. Collect all API monster names into a Set<string>
3. Delete from DB every monster whose name is NOT in that Set
   (cascades: removes their weaknesses, hitzones, drops, gameAppearances)
4. For each API monster:
     a. Map API fields to DB fields (see mappings below)
     b. prisma.$transaction(async tx => {
          upsert monster row (create or update by name)
          deleteMany ElementWeakness where monsterId = monster.id
          createMany ElementWeakness from api.weaknesses
          deleteMany Hitzone where monsterId = monster.id
          createMany Hitzone from api.parts
          deleteMany MonsterDrop where monsterId = monster.id
          createMany MonsterDrop from api.rewards (expanding conditions)
          deleteMany GameAppearance where monsterId = monster.id
          create GameAppearance { game: MONSTER_HUNTER_WILDS, isNew: firstGame === MONSTER_HUNTER_WILDS }
        })
5. Print summary: X monsters upserted, Y deleted
```

### Field mappings

**Monster row:**

| API field | DB field | Notes |
|-----------|----------|-------|
| `name` | `name` | exact string |
| `species` | `type` | mapped via `SPECIES_MAP` below |
| — | `title` | set to `""` (API has no title — admin fills later via web) |
| — | `description` | set to `""` (same) |
| — | `firstGame` | `MONSTER_HUNTER_WILDS` for new monsters; kept if monster already exists |
| — | `firstYear` | `2025` for Wilds monsters; kept if monster already exists |
| — | `imageUrl` | `null` (API has no images) |
| — | `iconUrl` | `null` |
| `kind` | `isBoss` | `kind === "large"` → `true` |
| — | `habitats` | `[]` (not in API — admin fills later) |

**`SPECIES_MAP` constant:**

```typescript
const SPECIES_MAP: Record<string, string> = {
  'flying-wyvern':   'FlyingWyvern',
  'brute-wyvern':    'BruteWyvern',
  'fanged-beast':    'FangedBeast',
  'temnoceran':      'Temnoceran',
  'bird-wyvern':     'BirdWyvern',
  'construct':       'Construct',
  'demi-elder':      'DemiElderDragon',
  'elder-dragon':    'ElderDragon',
};
```

**ElementWeakness rows** (one per item in `api.weaknesses`):

| API field | DB field | Notes |
|-----------|----------|-------|
| `element` | `element` | capitalise first letter: "ice" → "Ice" |
| `level` | `rating` | direct (1 or 2; API may also return 3) |
| — | `isImmune` | `false` for all (API does not list immunities explicitly) |

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

**MonsterDrop rows** (expand each `reward` × each `condition`):

| API field | DB field | Notes |
|-----------|----------|-------|
| `item.name` | `itemName` | exact string |
| `condition.kind` | `method` | mapped via `METHOD_MAP` below |
| `condition.rank` | `rank` | "low" → `LowRank`, "high" → `HighRank` |
| `condition.quantity` | `quantity` | integer |
| `condition.chance` | `rate` | float, e.g. 35 means 35% |
| `condition.part` | `part` | nullable string |
| — | `game` | always `MONSTER_HUNTER_WILDS` |

**`METHOD_MAP` constant:**

```typescript
const METHOD_MAP: Record<string, string> = {
  'carve':          'BodyCarve',   // refined by part below
  'broken-part':    'BreakReward',
  'capture':        'CaptureReward',
  'target-reward':  'QuestReward',
  'shiny-drop':     'ShinyDrop',
  'wound-drop':     'WoundDrop',
};
// Special case: if kind === 'carve' and part === 'tail', use 'TailCarve'
```

Any `condition.kind` not in `METHOD_MAP` is logged and skipped.

---

## Web colour update (`apps/web/src/lib/constants.ts`)

The "Pornhub purple" comes from two sources: `violet-400/violet-500` on Elder Dragon badges and Dragon element labels, and `purple-500` on Poison. Replace every non-element-accurate violet/purple with earthy Wilds tones.

### Changes to `TYPE_BADGE_CLASSES`

```typescript
// BEFORE
ElderDragon: 'bg-violet-400/10 text-violet-400',

// AFTER — Wilds elder dragons use deep gold
ElderDragon:      'bg-amber-400/10 text-amber-400',
// Add new species
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

// AFTER — Dragon becomes teal (Wilds game UI uses teal for Dragon), keep others accurate
Dragon:  'text-teal-500',
Poison:  'text-fuchsia-500',   // fuchsia reads as "chemical/toxic" not "adult site"
Sleep:   'text-blue-500',
```

### Remove non-Wilds game entries from `GAME_NAMES`, `GAME_COLORS`, `GAME_ORDER`

Keep only `MONSTER_HUNTER_WILDS` in those records. The other entries are no longer used by any monster in the app.

---

## `docs/changelog.md`

Create this file at the repo root. Format: newest entry at the top, one block per change.

```markdown
# Changelog

## [2026-06-21] Wilds migration

REMOVED `game` filter from `MonsterFiltersSchema` (packages/shared/src/schemas/monster.schema.ts)
  → app is Wilds-only, filtering by game is meaningless

REMOVED `game` destructure and WHERE clause from `listMonsters`
  (apps/api/src/services/monster.service.ts:23-25)
  → consequence of removing the game filter above

ADDED `stun Int @default(0)` to `Hitzone` model
  (apps/api/prisma/schema.prisma:96)
  → Wilds API returns stun multiplier; was missing from original schema

ADDED new MonsterType enum values: FlyingWyvern, BruteWyvern, FangedBeast,
  Temnoceran, BirdWyvern, Construct, DemiElderDragon
  (apps/api/prisma/schema.prisma, packages/shared/src/schemas/enums.schema.ts)
  → original schema used generic Large/Small instead of MH species names

CHANGED Dragon element colour: text-violet-500 → text-teal-500
CHANGED ElderDragon badge colour: bg-violet-400/10 text-violet-400 → bg-amber-400/10 text-amber-400
CHANGED Poison element colour: text-purple-500 → text-fuchsia-500
  (apps/web/src/lib/constants.ts)
  → violet/purple palette caused unintended visual similarity to adult websites
```

Developers append a block here every time a line is removed, renamed, or fixed. The block must say: what changed, which file and approximate line, and why.

---

## Non-goals (out of scope for this spec)

- Monster images (imageUrl stays null — admin fills via web form)
- React Native mobile app (separate spec: `2026-06-21-mobile-app-design.md`)
- Admin CRUD changes
- Test updates beyond fixing broken types
