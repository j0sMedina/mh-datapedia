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
