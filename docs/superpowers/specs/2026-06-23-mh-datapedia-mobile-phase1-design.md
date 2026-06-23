# MH Datapedia Mobile — Phase 1 Design Spec

## Goal

Add `apps/mobile` to the existing Turborepo monorepo: an Expo React Native app that delivers the full monster-browsing experience (list, detail, auth) on Android, consuming the existing `https://mh-datapedia-web.fly.dev` API with zero backend changes.

## Scope

Phase 1 is read-focused. It covers:
- Project scaffold (Expo managed workflow, NativeWind, Expo Router, TanStack Query)
- Auth: login and register screens, access token stored in SecureStore
- Monster list with search and type filters
- Monster detail with 5-tab strip (Overview, Hitzones, Weaknesses, Drops, Strategies)

Phase 2 (Favorites + Strategy submission) and Phase 3 (Admin panel) build on top of this foundation.

## Architecture

**Option chosen:** Shared logic only (Option A).

`packages/shared` provides types and Zod schemas to both `apps/web` and `apps/mobile`. Each app builds its own UI. No shared component layer. Web and mobile are separate apps with the same API contract.

**Tech stack:**
- Expo SDK (managed workflow) — Expo Go QR-code testing on device, EAS Build for production APK
- Expo Router v3 — file-based routing, same mental model as TanStack Router on web
- NativeWind v4 — Tailwind class names on React Native components
- TanStack Query v5 — same library as web, identical query/mutation patterns
- `expo-secure-store` — stores the JWT access token securely on device
- `@mh-datapedia/shared` — shared types and Zod schemas

## Project Structure

```
apps/mobile/
  app/
    _layout.tsx            ← root layout: QueryClient provider, AuthContext, NativeWind wrapper
    index.tsx              ← redirects to /monsters
    monsters/
      index.tsx            ← monster list
      [id].tsx             ← monster detail
    auth/
      login.tsx            ← login modal
      register.tsx         ← register modal
  src/
    lib/
      api.ts               ← fetch wrapper (Bearer token injection, 401 → logout)
      storage.ts           ← expo-secure-store: get/set/delete access token
    context/
      AuthContext.tsx      ← user state, login(), logout(), same shape as web
    components/
      ui/
        Badge.tsx          ← type badge, difficulty badge, role badge
        Button.tsx         ← primary and ghost variants (Pressable-based)
        Spinner.tsx        ← ActivityIndicator wrapper
        TabStrip.tsx       ← horizontal scrollable tab bar
      monsters/
        MonsterCard.tsx    ← list item: icon + name + type badge
        TypeFilterChip.tsx ← filter pill (active/inactive states)
      detail/
        OverviewTab.tsx
        HitzonesTab.tsx
        WeaknessesTab.tsx
        DropsTab.tsx
        StrategiesTab.tsx
  package.json
  app.json                 ← Expo config: name "MH Datapedia", Android package id
  tailwind.config.js       ← extends root, NativeWind preset, same color tokens
```

## Color Tokens (NativeWind)

`tailwind.config.js` in `apps/mobile` carries over the exact same tokens as `apps/web`:

```js
colors: {
  accent: {
    DEFAULT: '#2f9e8f',
    hover:   '#45bcab',
    strong:  '#237a6e',
  },
}
```

Global styles applied to every screen:
- Background: `bg-stone-950`
- Primary text: `text-stone-50`
- Secondary text: `text-stone-400`
- Metadata text: `text-stone-500`
- Panel/card: `bg-stone-900 border border-stone-800 rounded-lg`
- Status bar: `light-content` (white icons)

## Navigation

Expo Router file-based stack. No bottom tabs in Phase 1 — tabs are added in Phase 2 when Favorites is introduced.

```
Stack:
  /monsters              ← initial route (monster list)
    → /monsters/[id]     ← pushed on card tap (monster detail)
  /auth/login            ← presented as modal (slides up)
  /auth/register         ← presented as modal (slides up)
```

**Header bar** (`bg-stone-950 border-b border-stone-800`):
- Left: **MH** (accent) **Datapedia** (stone-50), font-display / Oswald
- Right: "Login" ghost button when logged out; username text + "Logout" ghost button when logged in

**Monster detail header**: back arrow (left) + monster name (center).

## Screens

### Monster List (`/monsters`)

1. Search bar (`bg-stone-900 border border-stone-700 rounded px-3 py-2`) — filters by name on change (debounced 300ms), calls `GET /api/monsters?search=`
2. Horizontal scroll row of `TypeFilterChip` components — one per `MonsterType` enum value plus an "All" chip. Active chip: `bg-accent/20 border border-accent text-accent`. Inactive: `border border-stone-700 text-stone-400`.
3. `FlatList` of `MonsterCard` rows — `onEndReached` not needed (all monsters fit on one page). Pull-to-refresh refetches.

`MonsterCard`: `bg-stone-900 border-b border-stone-800`, monster icon (40×40, `iconUrl`), monster name (`text-stone-50 font-medium`), type badge (accent-tinted). Taps navigate to `/monsters/[id]`.

Data: `GET /api/monsters` — already supports `?search=` and `?type=` query params.

### Monster Detail (`/monsters/[id]`)

1. Full-width hero image (`imageUrl`, 16:9 aspect ratio, `resizeMode: cover`). Falls back to a placeholder if `imageUrl` is null.
2. Monster name (`text-2xl font-display text-stone-50`) + title (`text-stone-400 text-sm`) + isBoss badge if applicable.
3. `TabStrip` — horizontal scroll, 5 tabs: Overview / Hitzones / Weaknesses / Drops / Strategies. Active tab has `border-b-2 border-accent text-stone-50`; inactive `text-stone-400`.
4. Tab content area below strip (no nested scroll — outer `ScrollView` handles everything).

**Overview tab**: description text, habitats (comma-separated chips), ailments list, parent monster link (if subspecies), subspecies list links.

**Hitzones tab**: table with sticky "Part" column header, rows for each hitzone — cut / blunt / bullet / fire / water / thunder / ice / dragon / stun values. Color-coded: ≥60 red, ≥40 orange, else stone.

**Weaknesses tab**: grid of element cards — element name, star rating (1–3 stars filled), immune badge if `isImmune`.

**Drops tab**: two pickers at top (MHGame, Rank), then a table: item name / method / part / qty / rate%. Sorted by rate descending.

**Strategies tab**: list of strategy cards — title, difficulty badge (Beginner/Intermediate/Advanced), game tag, author username, content text. Empty state: "No strategies yet."

### Login (`/auth/login`)

Modal presentation. Fields: email, password. "Sign In" primary button. "Don't have an account? Register" link navigates to `/auth/register`. On success: stores access token via `storage.ts`, updates AuthContext, closes modal.

### Register (`/auth/register`)

Modal presentation. Fields: username, email, password, confirm password. Client-side Zod validation (passwords must match — same as web). "Create Account" primary button. On success: same token storage flow as login.

## API Client (`src/lib/api.ts`)

Same pattern as `apps/web/src/lib/api.ts`:

```ts
export async function apiGet<T>(path: string): Promise<T>
export async function apiPost<T>(path: string, body?: unknown): Promise<T>
export async function apiPatch<T>(path: string, body?: unknown): Promise<T>
export async function apiDelete(path: string): Promise<void>
```

Injects `Authorization: Bearer <token>` from `storage.ts` on every request. On 401: clears stored token, calls `logout()` from AuthContext, navigation redirects to `/auth/login`.

Base URL: `https://mh-datapedia-web.fly.dev` (hardcoded for Phase 1; can move to `app.json` extra config later).

**No silent token refresh in Phase 1.** Access tokens have a finite lifetime. On expiry the user re-logs in. Refresh token handling is deferred to Phase 2.

## Auth Flow (Phase 1)

```
App launch
  → read token from SecureStore
  → if token present: set in AuthContext (user shown as logged in)
  → if absent: user is anonymous (all monster endpoints are public, no redirect)

Login success
  → API returns { accessToken, user }
  → store accessToken in SecureStore
  → set user in AuthContext
  → close modal

Logout
  → call POST /api/auth/logout (clears refresh token cookie server-side)
  → delete token from SecureStore
  → clear AuthContext user

401 on any request
  → delete token from SecureStore
  → clear AuthContext user
  → redirect to /auth/login
```

## Turbo Pipeline

`turbo.json` additions:
```json
"start:mobile": { "cache": false },
"build:mobile": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
```

`package.json` root scripts:
```
"mobile": "pnpm --filter mobile start"
```

## Testing on Device (Phase 1 Handoff)

1. Install **Expo Go** from the Play Store on your Android phone.
2. Make sure phone and PC are on the same Wi-Fi network.
3. Run `pnpm mobile` in the repo root.
4. Scan the QR code shown in terminal with your camera (or Expo Go app).
5. App loads live on your phone. Code changes hot-reload instantly.

For a standalone APK (no Expo Go needed): `eas build --platform android --profile preview` after EAS is configured (Phase 1 end task).

## Out of Scope for Phase 1

- Favorites (Phase 2)
- Strategy creation / editing (Phase 2)
- Admin panel (Phase 3)
- Silent token refresh (Phase 2)
- Bottom tab navigation (Phase 2)
- iOS support (can be enabled later, Expo supports it)
- Push notifications
- Offline mode
