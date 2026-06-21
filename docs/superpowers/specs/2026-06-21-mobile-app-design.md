# MH Datapedia — React Native Mobile App Design Spec

## Goal

Add `apps/mobile/` to the existing Turborepo monorepo. Build an Android app using React Native (Expo managed workflow) that reads from the same live API already deployed on Fly.io. Any change made on the web — adding a strategy, an admin editing weaknesses — shows up in the mobile app immediately because both consume the identical endpoints.

The mobile app is **read-only** for regular users: browse monsters, view all detail tabs, login/register, save and view favourites. Admin editing stays on the web.

---

## Global Constraints

- Expo SDK 52 (latest stable as of June 2026)
- React Navigation v6 for routing (not Expo Router)
- TanStack Query v5 — same version as web
- TypeScript strict mode
- `@mh-datapedia/shared` imported directly from the workspace — no duplication of types
- API base URL for local dev: `http://10.0.2.2:3001` (Android emulator loopback to host)
- API base URL for production: `https://mh-datapedia-web.fly.dev` (same as web, nginx proxies `/api/`)
- Refresh token stored in Expo SecureStore — never in AsyncStorage or plain memory
- Access token stored in a module-level variable in `src/api/client.ts` (same pattern as web)
- Requires one small addition to the existing API auth router — detailed below
- Never commit `.env` files

---

## Why Expo managed workflow

Expo managed workflow means you do not touch `android/` or `ios/` folders manually. Expo handles the native build. You write only TypeScript. For a university learning project on Android, this is the correct choice — you can run the app on a real phone via Expo Go without installing Android Studio.

---

## Monorepo integration

`apps/mobile/` is already covered by the root `pnpm-workspace.yaml` (`apps/*`). No changes needed there.

`turbo.json` — add mobile tasks:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "mobile#start": { "dependsOn": ["^build"], "persistent": true },
    "mobile#typecheck": { "dependsOn": ["^build"] }
  }
}
```

---

## The one API change required

### Why the API needs to change

The web uses an `httpOnly` cookie for the refresh token. The browser sends it automatically on every request. React Native is not a browser — its `fetch` does not maintain a cookie jar. If mobile called `POST /api/auth/refresh`, it would have no cookie to send and would get 401 every time.

### Solution: return refresh token in response body for mobile clients

When a request carries the header `X-Client-Type: mobile`, the auth endpoints also include `refreshToken` in the JSON body. The web is completely unaffected — it never sends that header, so it never receives the token in the body (it still uses cookies).

**File: `apps/api/src/routes/auth.router.ts`**

In the register and login handlers, after setting the cookie, check the header:

```typescript
// existing code — sets the httpOnly cookie
res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);

// NEW — if mobile client, also return token in body
const isMobile = req.headers['x-client-type'] === 'mobile';

res.json({
  user,
  accessToken,
  expiresIn: ACCESS_TOKEN_TTL_S,
  ...(isMobile && { refreshToken }),   // only included when X-Client-Type: mobile
});
```

In the refresh handler, accept the refresh token from **either** the cookie or the request body:

```typescript
// BEFORE — only reads from cookie
const token = req.cookies.refresh_token;

// AFTER — reads from cookie first, falls back to body (for mobile)
const token = req.cookies.refresh_token ?? req.body?.refreshToken;
if (!token) throw new AppError(401, 'Missing refresh token', 'UNAUTHORIZED');
```

In the logout handler, same fallback:

```typescript
const token = req.cookies.refresh_token ?? req.body?.refreshToken;
```

These are the only API changes. No new routes. No new middleware. The existing web tests continue to pass unchanged.

---

## File structure

```
apps/mobile/
├── src/
│   ├── api/
│   │   └── client.ts          ← fetchWithAuth for mobile (SecureStore, no cookies)
│   ├── context/
│   │   └── AuthContext.tsx    ← ported from web, ~10 lines different
│   ├── hooks/                 ← all hooks ported 1:1 from apps/web/src/hooks/
│   │   ├── useMonsters.ts
│   │   ├── useMonster.ts
│   │   ├── useWeaknesses.ts
│   │   ├── useHitzones.ts
│   │   ├── useStrategies.ts
│   │   ├── useDrops.ts
│   │   ├── useFavorites.ts
│   │   ├── useAddFavorite.ts
│   │   └── useRemoveFavorite.ts
│   ├── navigation/
│   │   ├── RootNavigator.tsx  ← switches between AuthStack and AppTabs
│   │   ├── AuthStack.tsx      ← Login → Register screens
│   │   └── AppTabs.tsx        ← Bottom tabs: Monsters | Favorites
│   ├── screens/
│   │   ├── MonsterListScreen.tsx
│   │   ├── MonsterDetailScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── FavoritesScreen.tsx
│   └── components/
│       ├── WeaknessRow.tsx    ← single weakness item (element icon + star rating)
│       ├── HitzoneRow.tsx     ← single hitzone row (part name + 9 damage numbers)
│       ├── DropRow.tsx        ← single drop item (name + method + chance%)
│       ├── StrategyCard.tsx   ← strategy title + difficulty + content
│       └── Spinner.tsx        ← loading indicator
├── app.json                   ← Expo config (name, slug, Android package ID)
├── babel.config.js            ← Expo default
├── tsconfig.json              ← extends ../../tsconfig.json, adds React Native lib
└── package.json
```

---

## `package.json` for `apps/mobile`

```json
{
  "name": "@mh-datapedia/mobile",
  "version": "0.1.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mh-datapedia/shared": "workspace:*",
    "@react-navigation/native": "^6.1.18",
    "@react-navigation/native-stack": "^6.11.0",
    "@react-navigation/bottom-tabs": "^6.6.1",
    "@tanstack/react-query": "^5.51.0",
    "expo": "~52.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.2",
    "react-native": "0.76.3",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.3.12",
    "typescript": "^5.4.0"
  }
}
```

---

## `src/api/client.ts`

This is the mobile equivalent of `apps/web/src/lib/api.ts`. The logic is identical except:
- No `import.meta.env` — uses a plain constant for the base URL
- No `credentials: 'include'` — mobile has no browser cookie jar
- Refresh token is read from Expo SecureStore, sent in the request body

```typescript
import * as SecureStore from 'expo-secure-store';

// The key used to store the refresh token on the device
const REFRESH_TOKEN_KEY = 'mh_refresh_token';

// Base URL of the API. In development (Android emulator), 10.0.2.2 maps to localhost on the host machine.
// In production, the web app's nginx proxies /api/ to the API server.
const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3001'           // local dev
  : 'https://mh-datapedia-web.fly.dev'; // production

// Access token lives in memory — lost on app restart, re-acquired via refresh on startup
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshCallback: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function setRefreshCallback(cb: () => Promise<string | null>) {
  _refreshCallback = cb;
}

// Save refresh token to the device's encrypted storage
export async function saveRefreshToken(token: string) {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

// Read refresh token from device
export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

// Delete refresh token from device (called on logout)
export async function deleteRefreshToken() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Client-Type', 'mobile'); // tells API to return refreshToken in body

  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && _refreshCallback && !_isRefreshing) {
    _isRefreshing = true;
    try {
      const newToken = await _refreshCallback();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(`${BASE_URL}${path}`, { ...init, headers });
      }
    } finally {
      _isRefreshing = false;
    }
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetchWithAuth(path, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
}
```

---

## `src/context/AuthContext.tsx`

Nearly identical to the web version. The two differences:

1. `silentRefresh` reads the stored refresh token from SecureStore and sends it in the body (not a cookie)
2. After login/register, the response body includes `refreshToken` — mobile saves it to SecureStore

```typescript
async function silentRefresh(): Promise<string | null> {
  const storedToken = await loadRefreshToken();
  if (!storedToken) return null;

  try {
    // send the refresh token in the body — API reads req.body.refreshToken on mobile
    const data = await apiPost<{ user: User; accessToken: string; refreshToken: string }>(
      '/api/auth/refresh',
      { refreshToken: storedToken },
    );
    setAccessToken(data.accessToken);
    await saveRefreshToken(data.refreshToken); // rotate: save the new one
    setUser(data.user);
    return data.accessToken;
  } catch {
    await deleteRefreshToken();
    return null;
  }
}

async function login(email: string, password: string) {
  const data = await apiPost<{ user: User; accessToken: string; refreshToken: string }>(
    '/api/auth/login',
    { email, password },
  );
  setAccessToken(data.accessToken);
  await saveRefreshToken(data.refreshToken); // store on device
  setUser(data.user);
}

async function logout() {
  const storedToken = await loadRefreshToken();
  await apiPost('/api/auth/logout', { refreshToken: storedToken }).catch(() => {});
  setAccessToken(null);
  await deleteRefreshToken();
  setUser(null);
}
```

---

## Navigation structure

```
RootNavigator
├── (if not logged in)  AuthStack
│   ├── LoginScreen
│   └── RegisterScreen
└── (if logged in or guest)  AppTabs  ← bottom tab bar
    ├── Tab: Monsters
    │   └── MonsterStack
    │       ├── MonsterListScreen
    │       └── MonsterDetailScreen
    └── Tab: Favorites
        └── FavoritesScreen
```

The app works without logging in — monsters are public. The Favorites tab shows a "Log in to save favourites" prompt if the user is not authenticated.

`RootNavigator.tsx` reads `user` from `AuthContext`. If the user is null AND tries to access Favorites, it redirects to the Auth stack.

---

## Screen designs

### `MonsterListScreen`

- `FlatList` of monster cards
- Each card: monster name, type badge, first game label
- Search bar at the top (`TextInput` → updates `search` filter)
- Filter pills for `MonsterType`
- Uses `useMonsters(filters)` hook (ported from web — no changes needed to the hook itself)
- Pull-to-refresh: `FlatList` `onRefresh` calls `refetch()` from the hook

### `MonsterDetailScreen`

- Receives `monsterId` from navigation params (typed with React Navigation's `ParamList`)
- Uses `useMonster(monsterId)` hook
- Scrollable with a sticky tab bar at the top: **Overview | Weaknesses | Hitzones | Drops | Strategies**
- Active tab stored in `useState<string>` (no URL search params on mobile — just local state)
- Each tab renders a different section below the tab bar

**Overview tab:** name, title, description, type badge, first game, habitats list

**Weaknesses tab:** `FlatList` of `WeaknessRow` — element name + coloured star rating (★★☆ style)

**Hitzones tab:** Horizontal `ScrollView` wrapping a table. Columns: Part | Cut | Blunt | Bullet | Fire | Water | Thunder | Ice | Dragon | Stun. Numbers colour-coded: 0-30 green, 31-60 amber, 61+ red.

**Drops tab:** Grouped by rank (Low Rank / High Rank). Each row: item name, method label, drop chance as percentage (e.g. "35%"). Sorted by chance descending within each group.

**Strategies tab:** `FlatList` of `StrategyCard` — title, difficulty badge, author, content text.

### `LoginScreen` and `RegisterScreen`

Standard forms using React Native `TextInput` and a `Button` component. Calls `login()` or `register()` from `AuthContext`. On success, navigation automatically switches to `AppTabs` because `RootNavigator` reacts to `user` becoming non-null.

### `FavoritesScreen`

- If not logged in: centred text "Log in to see your favourites" with a Login button
- If logged in: `FlatList` of favourite monster cards (same card component as `MonsterListScreen`)
- Uses `useFavorites()` hook (ported from web)
- Swipe-to-remove: each card has a `TouchableOpacity` delete icon

---

## Hooks — port strategy

All hooks in `apps/web/src/hooks/` are ported to `apps/mobile/src/hooks/`. The only changes:

1. Replace `import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'` with `import { apiGet, apiPost, apiDelete } from '../api/client'`
2. `apiPut` is not ported — mobile has no write operations
3. Everything else is identical: `useQuery`, `useMutation`, `queryKey`, `onSuccess` with `invalidateQueries`

TanStack Query works the same in React Native as in React DOM. The `QueryClientProvider` wraps the whole app in `App.tsx` exactly as in the web's `main.tsx`.

---

## `app.json` (Expo config)

```json
{
  "expo": {
    "name": "MH Datapedia",
    "slug": "mh-datapedia",
    "version": "0.1.0",
    "orientation": "portrait",
    "android": {
      "package": "com.mhdatapedia.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1612"
      }
    },
    "plugins": ["expo-secure-store"]
  }
}
```

`backgroundColor: "#1a1612"` matches the Wilds dark stone colour from the web redesign.

---

## Non-goals (out of scope for this spec)

- iOS support (Android only for now)
- Admin editing on mobile
- Push notifications
- Offline mode / local caching beyond TanStack Query's in-memory cache
- Publishing to the Play Store
