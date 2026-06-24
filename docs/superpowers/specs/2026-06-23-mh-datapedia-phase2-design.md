# MH Datapedia Mobile — Phase 2 Design Spec

## Goal

Extend the Phase 1 mobile app with interactive features: silent token refresh, bottom tab navigation, favorites (list + toggle), and strategy submission — all building on the existing Expo SDK 56 / Expo Router v4 / TanStack Query v5 foundation.

## Scope

Three independently specced and planned units, delivered in order:

- **Spec A** — Foundation: silent JWT refresh + bottom tab navigation
- **Spec B** — Favorites: add/remove monsters, favorites tab
- **Spec C** — Strategy submission: bottom sheet form on the Strategies tab

Auth UI polish (glassmorphism) is deferred to Phase 3.

## Global Constraints

- Expo SDK 56, managed workflow, Expo Router v4, NativeWind v4.2.6
- `jsxImportSource: 'nativewind'` in `babel-preset-expo` options — do NOT use `nativewind/babel` plugin
- NativeWind v4 applies `className` to `contentContainerStyle` on `ScrollView`, not the container itself — always use explicit `style={{}}` props for layout-critical containers (flex, height)
- Horizontal filter/chip ScrollViews must have explicit `style={{ height: 44 }}` and `contentContainerStyle={{ height: 44, alignItems: 'center' }}`
- Color tokens: accent `#2f9e8f`, background `#0c0a09` (stone-950), panel `#1c1917` (stone-900)
- API base URL: `https://mh-datapedia-web.fly.dev`
- pnpm@9 workspaces — install packages with `pnpm --filter mobile add <pkg>`
- No iOS-specific code — Android only for Phase 2

---

## Spec A: Silent Token Refresh + Bottom Tab Navigation

### Architecture

Two independent concerns bundled as one foundational task:

1. **Silent refresh** upgrades `api.ts` so a 401 transparently triggers a token refresh and retries before surfacing an error or logging out.
2. **Bottom tabs** restructures the Expo Router file tree to introduce a `(tabs)` route group containing the Monsters and Favorites tabs.

### Silent Token Refresh

**Mechanism:** Reactive. On any 401 response, call `POST /api/auth/refresh` (the HTTP-only refresh token cookie travels automatically via `credentials: 'include'`). If refresh succeeds, store the new access token in SecureStore and retry the original request exactly once. If refresh returns 401, clear the stored token and redirect to `/auth/login`.

**Concurrency guard:** A module-level `isRefreshing: boolean` flag and a `refreshSubscribers: Array<(token: string) => void>` queue prevent multiple concurrent 401s from firing multiple refresh calls. While `isRefreshing` is true, subsequent 401 handlers push a callback onto the queue. When the single in-flight refresh resolves, it drains the queue, calling each subscriber with the new token so their original requests retry.

**Files changed:**
- `apps/mobile/src/lib/api.ts` — add refresh gate in the 401 branch of `request()`

**API endpoint:** `POST /api/auth/refresh` — no body required; returns `{ accessToken, expiresIn }`. The refresh token cookie is sent automatically.

### Bottom Tab Navigation

**Route group structure:**

```
app/
  _layout.tsx             ← root Stack; add (tabs) as Stack.Screen
  index.tsx               ← DELETE (conflicts with (tabs)/index.tsx at route /)
  (tabs)/
    _layout.tsx           ← NEW: Tabs navigator
    index.tsx             ← monsters list (content moved from app/monsters/index.tsx)
    favorites.tsx         ← NEW: favorites screen (placeholder for Spec B)
  monsters/
    index.tsx             ← DELETE (content moved to (tabs)/index.tsx)
    [id].tsx              ← unchanged; pushed on root Stack so tab bar hides
  auth/
    login.tsx             ← unchanged
    register.tsx          ← unchanged
```

**`app/(tabs)/_layout.tsx`** — `Tabs` navigator with two screens:

| Screen | Tab label | Icon (`Ionicons` from `@expo/vector-icons`) |
|---|---|---|
| `index` | Monsters | `list` |
| `favorites` | Favorites | `heart` / `heart-outline` (filled when active) |

Tab bar style:
- `tabBarStyle.backgroundColor`: `#1c1917`
- `tabBarActiveTintColor`: `#2f9e8f`
- `tabBarInactiveTintColor`: `#57534e`
- `tabBarStyle.borderTopColor`: `#292524`

**`app/_layout.tsx`** — add `(tabs)` Stack screen:

```tsx
<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
```

The `monsters/[id]` screen remains in the root Stack so navigating to detail hides the tab bar (standard mobile UX).

**`(tabs)/index.tsx`** — identical content to the current `app/monsters/index.tsx` (search bar, type filter chips, FlatList of MonsterCard). Header title: `AppTitle` component + `HeaderRight` login/logout buttons, same as Phase 1.

**`(tabs)/favorites.tsx`** — placeholder `<View>` with "Coming soon" text until Spec B is implemented.

---

## Spec B: Favorites

### Architecture

A `useFavorites` hook centralises all favorites data and mutations. The Favorites tab reads from it. The monster detail screen reads from the same cached query to determine `isFavorited`. `MonsterCard` gets swipe-to-toggle via `Swipeable`.

### Data Layer

**`apps/mobile/src/hooks/useFavorites.ts`** — new file.

```ts
// Returns the favorites list, a toggle function, and a helper to check membership
export function useFavorites(): {
  favorites: Monster[];
  isFavorited: (monsterId: string) => boolean;
  toggle: (monsterId: string) => void;
  isLoading: boolean;
}
```

Internals:
- `useQuery({ queryKey: ['favorites'], queryFn: () => apiGet<{ data: Monster[] }>('/api/users/me/favorites').then(r => r.data), enabled: !!user })` — skips when logged out
- `useMutation` for add: `POST /api/users/me/favorites/:monsterId` — optimistic update reads the full monster from `['monster', monsterId]` cache and prepends it to the favorites list
- `useMutation` for remove: `DELETE /api/users/me/favorites/:monsterId` — optimistic update filters the monster out of the cached list by id
- `toggle(monsterId)` calls add or remove based on `isFavorited(monsterId)`
- `isFavorited(monsterId)` returns `favorites.some(m => m.id === monsterId)`

Optimistic update pattern (remove mutation — straightforward):
```ts
onMutate: async (monsterId) => {
  await queryClient.cancelQueries({ queryKey: ['favorites'] });
  const previous = queryClient.getQueryData<Monster[]>(['favorites']);
  queryClient.setQueryData<Monster[]>(['favorites'], (old = []) =>
    old.filter(m => m.id !== monsterId)
  );
  return { previous };
},
onError: (_err, _vars, ctx) => {
  queryClient.setQueryData(['favorites'], ctx?.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['favorites'] });
},
```

Add mutation optimistic update: read `queryClient.getQueryData<{ data: Monster }>(['monster', monsterId])?.data` to get the monster object. If not in cache (e.g., user added from detail screen before list cached), skip the optimistic insert and rely on `invalidateQueries` in `onSettled`.

### Favorites Tab (`app/(tabs)/favorites.tsx`)

- **Logged out:** centered `Text` "Sign in to save favorites" + `Button` that opens `/auth/login` modal
- **Logged in, loading:** `Spinner` centered
- **Logged in, empty:** centered `Text` "No favorites yet"
- **Logged in, data:** `FlatList` of `MonsterCard` rows (same card as the monsters list, no swipe action here). Tapping navigates to `/monsters/[id]`. Pull-to-refresh calls `refetch()`.

### Swipe-to-Favorite on MonsterCard

Wrap the existing `MonsterCard` content in `Swipeable` from `react-native-gesture-handler`.

Swipe left reveals a single action panel:
- If not favorited: teal (`#2f9e8f`) background, `Ionicons` `heart-outline` icon (white, size 24), label "Save"
- If favorited: red (`#ef4444`) background, `Ionicons` `heart` icon (white, size 24), label "Remove"

`Ionicons` is from `@expo/vector-icons`, which ships with Expo SDK 56 — no install needed.

Tapping the action calls `toggle(monster.id)`. If user is not logged in, opens `/auth/login` modal instead.

`renderRightActions` returns a `Pressable` with fixed width 72, full height, centered icon + label.

**Files changed:**
- `apps/mobile/src/components/monsters/MonsterCard.tsx` — wrap with `Swipeable`, accept `onFavoriteToggle?: () => void` and `isFavorited?: boolean` props
- `apps/mobile/app/(tabs)/index.tsx` — pass favorite props to each card
- `apps/mobile/app/(tabs)/favorites.tsx` — full favorites screen

### Heart Toggle on Detail Screen

In `app/monsters/[id].tsx`, in the name/title/Boss-badge row:

- Add a `Pressable` with a heart icon on the right side of the row
- Icon: `Ionicons` `heart` in `#ef4444` when favorited; `Ionicons` `heart-outline` in `#57534e` when not (size 24)
- Calls `toggle(id)` from `useFavorites()`
- If user is not logged in, tap opens `/auth/login` modal

**Files changed:**
- `apps/mobile/app/monsters/[id].tsx` — add heart Pressable in header row

---

## Spec C: Strategy Submission

### Architecture

A new `StrategyFormSheet` component (bottom sheet wrapping a form) is triggered by a FAB on the Strategies tab. The form submits to `POST /api/strategies` using the shared `CreateStrategySchema`.

### Dependencies

Install `@gorhom/bottom-sheet` v5 (peer deps `react-native-gesture-handler` and `react-native-reanimated` v3 already present in SDK 56):

```bash
pnpm --filter mobile add @gorhom/bottom-sheet@^5
```

`BottomSheetModalProvider` must wrap the app — add it inside `AuthProvider` in `app/_layout.tsx`.

### FAB

In `apps/mobile/src/components/detail/StrategiesTab.tsx`:

- A `Pressable` positioned `absolute`, `bottom: 16`, `right: 16`
- Circle, 56×56, background `#2f9e8f` (accent), `+` text in white, font size 28
- Visible only when `user` is non-null (from `useAuth()`)
- On press: calls `bottomSheetRef.current?.present()`

### `StrategyFormSheet` Component

**File:** `apps/mobile/src/components/detail/StrategyFormSheet.tsx`

The component is wrapped in `forwardRef<BottomSheetModal, StrategyFormSheetProps>` so the parent (`StrategiesTab`) can call `sheetRef.current?.present()` and `sheetRef.current?.dismiss()`.

Props:
```ts
interface StrategyFormSheetProps {
  monsterId: string;
}
// Usage in parent:
const sheetRef = useRef<BottomSheetModal>(null);
<StrategyFormSheet ref={sheetRef} monsterId={monster.id} />
```

Sheet height: `snapPoints={['85%']}`. Background `#1c1917`, handle indicator `#57534e`.

**Form fields (top to bottom):**

1. **Title** — `BottomSheetTextInput`, placeholder "Strategy title", max 200 chars. Char counter `{length}/200` shown below input in `#57534e`.

2. **Game** — label "Game", horizontal `ScrollView` of pill chips (same visual style as `TypeFilterChip`): World / Iceborne / Rise / Sunbreak / Wilds. Display name mapping:
   - `MONSTER_HUNTER_WORLD` → "World"
   - `MONSTER_HUNTER_WORLD_ICEBORNE` → "Iceborne"
   - `MONSTER_HUNTER_RISE` → "Rise"
   - `MONSTER_HUNTER_RISE_SUNBREAK` → "Sunbreak"
   - `MONSTER_HUNTER_WILDS` → "Wilds"

3. **Difficulty** — label "Difficulty", three `Pressable` segments in a row: Beginner / Intermediate / Advanced. Active segment: `bg-accent/20 border-accent`. Inactive: `border-stone-700`.

4. **Content** — label "Description", `BottomSheetTextInput` multiline, min height 120, placeholder "Describe your strategy…"

5. **Submit button** — full-width `Button` primary variant, label "Submit Strategy". Disabled + shows `ActivityIndicator` while `isPending`.

6. **Error message** — if mutation errors: `Text` in `#ef4444` below the button showing the API error message or "Something went wrong".

**Submission:**

```ts
const mutation = useMutation({
  mutationFn: (data: CreateStrategy) => apiPost('/api/strategies', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['monster', monsterId] });
    bottomSheetRef.current?.dismiss();
    onSuccess();
  },
});
```

Client-side validation with `CreateStrategySchema.safeParse()` before calling `mutation.mutate()`. If validation fails, show field-level errors inline (no submit attempt).

**Files changed:**
- `apps/mobile/src/components/detail/StrategyFormSheet.tsx` — new file
- `apps/mobile/src/components/detail/StrategiesTab.tsx` — add FAB + sheet ref + `StrategyFormSheet`
- `apps/mobile/app/_layout.tsx` — add `BottomSheetModalProvider`

---

## Phase 3 Preview (out of scope here)

- Admin panel: give/revoke admin role, ban/unban users
- Auth UI polish: glassmorphism login/register modals matching web design
