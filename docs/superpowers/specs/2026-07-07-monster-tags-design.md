# Monster Classification Redesign — Design Spec

## Overview

Split `MonsterType` into two concerns: a single biological type and an optional set of modifier tags. This reflects how Monster Hunter Wilds actually classifies monsters — every monster has one biological classification and zero or more combat-tier modifiers.

Scope: all monsters that appear in Monster Hunter Wilds, regardless of which game they originally came from.

---

## Data Model

### New enum: `MonsterTag`

```prisma
enum MonsterTag {
  Tempered
  ArchTempered
  Apex
  Afflicted
}
```

### Updated enum: `MonsterType`

Remove `Large`, `Apex`, and `Afflicted` (they were never biological types). Keep all genuine biological classifications:

```prisma
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

`Small` remains a valid type — small monsters are a distinct biological category.
`Large` is removed — all non-Small biological types are implicitly large.

### Monster model change

```prisma
model Monster {
  // existing fields unchanged
  type MonsterType
  tags MonsterTag[] @default([])
}
```

`name` always stores the base monster name only (`"Uth Duna"`, not `"Tempered Apex Uth Duna"`). Display labels are composed at render time.

### Tag combination rules

These rules are enforced in API validation (Zod) and reflected in the admin UI (reactive checkbox disabling).

| Tag selected | May also have | Cannot have |
|---|---|---|
| `Tempered` | `Apex` | `ArchTempered`, `Afflicted` |
| `ArchTempered` | `Apex` (required) | `Tempered`, `Afflicted` |
| `Apex` | `Tempered` or `ArchTempered` | `Afflicted` |
| `Afflicted` | — (always solo) | `Tempered`, `ArchTempered`, `Apex` |

Valid tag combinations: `[]`, `[Tempered]`, `[Apex]`, `[Afflicted]`, `[Tempered, Apex]`, `[Apex, ArchTempered]`.

Tags are orthogonal to biological type — an Afflicted monster is still a Flying Wyvern, a Leviathan, etc.

### Examples

| Monster | type | tags |
|---|---|---|
| Doshaguma | `FangedBeast` | `[]` |
| Uth Duna | `Leviathan` | `[Apex]` |
| Tempered Apex Uth Duna | `Leviathan` | `[Tempered, Apex]` |
| Arch-Tempered Arkveld | `ElderDragon` | `[Apex, ArchTempered]` |
| Afflicted Yian Kut-Ku | `FlyingWyvern` | `[Afflicted]` |

### Data migration

A Prisma migration adds `tags MonsterTag[] @default([])` and removes the three type values. A seed/fix script must:

1. Reassign any monsters with `type = Apex` → correct biological type + `tags: [Apex]`
2. Reassign any monsters with `type = Afflicted` → correct biological type + `tags: [Afflicted]`
3. Reassign any monsters with `type = Large` → correct biological type, no tags

---

## API

### Shared types (`packages/shared`)

- Export `MonsterTag` enum (matching Prisma)
- Update `MonsterType` enum to remove `Large`, `Apex`, `Afflicted`
- Monster DTO includes `tags: MonsterTag[]`

### Create / Update monster

- `type`: required, one of the valid biological `MonsterType` values
- `tags`: optional array of `MonsterTag`, defaults to `[]`
- Zod schema validates tag combination rules before saving — invalid combinations return `400`

### Monster list endpoint

- Supports optional `?tags=Apex,Tempered` query param to filter by tags (AND logic — monster must have all specified tags)
- Existing `?type=` filter continues to work unchanged

### Response shape

All monster responses include `tags` field. No breaking change to existing shape — `tags` is additive.

---

## Admin UI

### Monster create/edit form

Replace the current single "Type" dropdown with two fields:

1. **Biological Type** — single-select dropdown, lists all valid `MonsterType` values
2. **Tags** — multi-select checkboxes: `Tempered`, `Arch-Tempered`, `Apex`, `Afflicted`
   - Reactive disabling enforces combination rules as the user selects:
     - Selecting `Afflicted` → disables all others
     - Selecting `Arch-Tempered` → disables `Tempered`; `Apex` becomes required (auto-checked or highlighted)
     - Selecting `Tempered` → disables `Arch-Tempered`
   - Form uses existing glassmorphism style

### Monster cards and detail page

Tags displayed as small colour-coded badges alongside the monster name/type:

| Tag | Badge colour |
|---|---|
| Apex | amber |
| Tempered | purple |
| Arch-Tempered | red |
| Afflicted | dark purple |

Display name is composed at render time: `[tags joined] [name]` (e.g., "Arch-Tempered Arkveld") — never stored in the `name` field.

### Monsters list page

Filter UI gains a tag filter (checkbox group) alongside the existing type filter.
