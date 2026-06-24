# Fix Report: StrategyFormSheet Import & FAB Float

**Date:** 2026-06-23
**Status:** Complete — TypeScript clean (0 errors)

---

## Fix 1: Named Import for StrategyFormSheet

**File:** `apps/mobile/src/components/detail/StrategiesTab.tsx`

**Problem:** `StrategyFormSheet` uses `export const StrategyFormSheet = forwardRef(...)` — a named export only, no default export. The previous `import StrategyFormSheet from './StrategyFormSheet'` was a default import, causing a TypeScript compile error and runtime crash (the import resolves to `undefined`).

**Change:** Removed the incorrect default import entirely. `StrategyFormSheet` is no longer used in `StrategiesTab.tsx` after Fix 2 — it was moved to `[id].tsx` where it is imported correctly as `import { StrategyFormSheet } from '../../src/components/detail/StrategyFormSheet'`.

---

## Fix 2: FAB Moved Outside ScrollView

**Files changed:**
- `apps/mobile/src/components/detail/StrategiesTab.tsx` (removed FAB + sheet)
- `apps/mobile/app/monsters/[id].tsx` (added FAB + sheet outside ScrollView)

**Problem:** The FAB `Pressable` was rendered inside `StrategiesTab`, which itself was rendered as a child of `[id].tsx`'s `ScrollView`. A `position: absolute` element inside `ScrollView` content does not float above the screen — it scrolls with the content. The FAB was therefore not fixed/floating as intended.

**Root cause:** `ScrollView` in React Native establishes its own layout context; absolute children are positioned relative to the scroll content, not the viewport.

**Fix:**
1. Removed from `StrategiesTab.tsx`: FAB `Pressable`, `StrategyFormSheet` render, `useRef`, `BottomSheetModal`, `StrategyFormSheet` import, `useAuth` import, `Pressable` from react-native imports, and `monsterId` from the component's prop interface (it was only passed to `StrategyFormSheet`).
2. Added to `[id].tsx` (outside `</ScrollView>`, inside the outer `<View style={{ flex: 1 }}`):
   - `useRef` added to React import
   - `BottomSheetModal` imported from `@gorhom/bottom-sheet`
   - `StrategyFormSheet` imported as named export
   - `const sheetRef = useRef<BottomSheetModal>(null)` declared in component
   - FAB rendered after `</ScrollView>`, conditionally on `activeTab === 4 && user`
   - `<StrategyFormSheet ref={sheetRef} monsterId={id} />` rendered unconditionally after FAB (so the ref persists across tab switches)

The outer container in `[id].tsx` was already `<View style={{ flex: 1, backgroundColor: '#0c0a09' }}>`, so absolute positioning works correctly relative to the full screen.

---

## TypeScript Result

```
npx tsc --noEmit  →  0 errors (no output)
```

---

## Files Changed

- `apps/mobile/src/components/detail/StrategiesTab.tsx`
- `apps/mobile/app/monsters/[id].tsx`
