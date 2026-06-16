# Admin Weaknesses & Hitzones Editing — Design Spec

## Goal

Allow admins to edit a monster's element weaknesses and hitzone values directly from the monster detail page, within the existing Weaknesses and Hitzones tabs.

## Architecture

### Replace-all pattern

Both weaknesses and hitzones use a replace-all approach: on save, the API deletes all existing rows for the monster and inserts the new set in a single Prisma transaction. No per-row CRUD. The client always submits the full authoritative state.

### New API endpoints

Both protected by `authenticate` + `authorize('ADMIN')` middleware.

```
PUT /api/monsters/:id/weaknesses
PUT /api/monsters/:id/hitzones
```

### New shared schemas (`packages/shared`)

**`weakness.schema.ts`** — add alongside existing `ElementWeaknessSchema`:

```ts
export const UpsertWeaknessItemSchema = z.object({
  element: ElementSchema,
  rating: WeaknessRatingSchema,
  isImmune: z.boolean(),
});
export const UpsertWeaknessesSchema = z.array(UpsertWeaknessItemSchema);
export type UpsertWeaknesses = z.infer<typeof UpsertWeaknessesSchema>;
```

**`hitzone.schema.ts`** — add alongside existing `HitzoneSchema`:

```ts
const hitzoneValue = z.number().int().min(0).max(100);
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

### New service functions (`apps/api/src/services/monster.service.ts`)

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

### New router handlers (`apps/api/src/routes/monsters.router.ts`)

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

---

## Frontend

### New hooks

**`apps/web/src/hooks/useUpdateWeaknesses.ts`**

```ts
export function useUpdateWeaknesses(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertWeaknesses) =>
      api.put(`/monsters/${monsterId}/weaknesses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weaknesses', monsterId] });
    },
  });
}
```

**`apps/web/src/hooks/useUpdateHitzones.ts`**

```ts
export function useUpdateHitzones(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertHitzones) =>
      api.put(`/monsters/${monsterId}/hitzones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hitzones', monsterId] });
    },
  });
}
```

### WeaknessesTab changes

`apps/web/src/components/monsters/detail/tabs/WeaknessesTab.tsx` gains:

- A local `editing` boolean state (default `false`)
- A local `draft` state: a map of `element → { rating, isImmune }`, initialized from fetched data when entering edit mode
- An "Edit Weaknesses" button (admin-only, top-right), visible only when `!editing`
- When `editing`:
  - Each element card renders 3 clickable ★ icons and an "Immune" checkbox instead of the read-only display
  - Star click logic: clicking star `i` sets `rating = i`; clicking the already-active star (where `i === rating`) sets `rating = i - 1` (minimum 0)
  - Checking "Immune" sets `isImmune = true` and `rating = 0`; unchecking resets `isImmune = false`
  - Save button at the bottom: calls `useUpdateWeaknesses`, on success sets `editing = false`
  - Cancel button: sets `editing = false`, discarding draft
- Elements with no existing weakness record default to `{ rating: 0, isImmune: false }` in the draft

### HitzonesTab changes

`apps/web/src/components/monsters/detail/tabs/HitzonesTab.tsx` gains:

- A local `editing` boolean state (default `false`)
- A local `rows` state: array of `{ part, cut, blunt, bullet, fire, water, thunder, ice, dragon }`, initialized from fetched data when entering edit mode
- An "Edit Hitzones" button (admin-only, top-right), visible only when `!editing`
- When `editing`:
  - Part name column renders a `<input type="text">` per row
  - Each of the 8 value columns renders a `<input type="number" min="0" max="100">` per row
  - Each row has a 🗑 delete button on the right that removes the row from `rows`
  - A "+ Add Part" button below the last row appends a blank row: `{ part: '', cut: 50, blunt: 50, bullet: 50, fire: 50, water: 50, thunder: 50, ice: 50, dragon: 50 }`
  - Save button: calls `useUpdateHitzones` with current `rows`, on success sets `editing = false`
  - Cancel button: sets `editing = false`, discarding all in-progress row changes
- The "Values ≥ 45 are effective" note is hidden during edit mode

---

## Data flow summary

```
Admin clicks "Edit" button (tab)
  → local draft/rows state initialized from existing query data
  → user edits inline
Admin clicks "Save"
  → PUT /api/monsters/:id/weaknesses (or /hitzones) with full array
  → service: deleteMany + createMany in transaction
  → 200 response with updated rows
  → frontend invalidates query → tab refetches and exits edit mode

Admin clicks "Cancel"
  → draft/rows discarded, editing = false, no API call
```

---

## Files changed

| File | Action |
|------|--------|
| `packages/shared/src/schemas/weakness.schema.ts` | Add `UpsertWeaknessItemSchema`, `UpsertWeaknessesSchema`, `UpsertWeaknesses` type |
| `packages/shared/src/schemas/hitzone.schema.ts` | Add `UpsertHitzoneItemSchema`, `UpsertHitzonesSchema`, `UpsertHitzones` type |
| `packages/shared/src/index.ts` | Already exports all schemas — no change needed |
| `apps/api/src/services/monster.service.ts` | Add `upsertWeaknesses`, `upsertHitzones` |
| `apps/api/src/routes/monsters.router.ts` | Add two PUT route handlers |
| `apps/web/src/hooks/useUpdateWeaknesses.ts` | New file |
| `apps/web/src/hooks/useUpdateHitzones.ts` | New file |
| `apps/web/src/components/monsters/detail/tabs/WeaknessesTab.tsx` | Add edit mode |
| `apps/web/src/components/monsters/detail/tabs/HitzonesTab.tsx` | Add edit mode |
