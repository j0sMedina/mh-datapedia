# MH Datapedia Mobile — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add silent JWT refresh, bottom tab navigation, favorites (list + swipe-to-toggle + detail heart), and strategy submission (bottom sheet form) to the Phase 1 Android app.

**Architecture:** A shared `useFavorites` hook centralises favorites state and mutations. The Expo Router `(tabs)` route group replaces the current stack-only navigation. Strategy submission uses `@gorhom/bottom-sheet` v5 with a `forwardRef` sheet component rendered in the detail screen. Silent refresh intercepts 401s in `api.ts`, tries `POST /api/auth/refresh` once, then retries the original request.

**Tech Stack:** Expo SDK 56, Expo Router v4, NativeWind v4.2.6, TanStack Query v5, `react-native-gesture-handler` (already installed), `@expo/vector-icons` Ionicons (already in SDK 56), `@gorhom/bottom-sheet@^5`.

## Global Constraints

- NativeWind `className` on `ScrollView` applies to `contentContainerStyle`, NOT the container — always use `style={{}}` for flex/height on ScrollView and outer containers.
- Horizontal chip ScrollViews must have `style={{ height: 44 }}` and `contentContainerStyle={{ height: 44, alignItems: 'center' }}`.
- `jsxImportSource: 'nativewind'` in `babel-preset-expo` — never add `nativewind/babel` plugin.
- Color tokens: accent `#2f9e8f`, background `#0c0a09`, panel `#1c1917`, border `#292524`, stone-600 `#57534e`, stone-400 `#a8a29e`.
- API base: `https://mh-datapedia-web.fly.dev`.
- Install packages: `pnpm --filter mobile add <pkg>` from the repo root.
- Android only — no iOS-specific code.
- No automated test suite exists — verify each task by running `pnpm mobile` from repo root and testing on device via Expo Go.

---

## Spec A: Silent Token Refresh + Bottom Tab Navigation

---

### Task 1: Silent token refresh in `api.ts`

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`

**Interfaces:**
- Produces: `request()` now silently retries after a 401 by calling `POST /api/auth/refresh` and storing the new token. All callers (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`) inherit this transparently.

- [ ] **Step 1: Read the current file**

Open `apps/mobile/src/lib/api.ts` and note the existing 401 handler (lines 28–33). The new version replaces that block with a refresh gate.

- [ ] **Step 2: Replace `api.ts` entirely**

Write the full file to `apps/mobile/src/lib/api.ts`:

```ts
import { router } from 'expo-router';
import { storage } from './storage';

export const API_BASE = 'https://mh-datapedia-web.fly.dev';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

// Single in-flight refresh promise shared across all concurrent 401s.
// All callers that 401 concurrently await the same promise, so we only
// call /api/auth/refresh once.
let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('refresh failed');
    const { accessToken } = (await res.json()) as { accessToken: string };
    await storage.setToken(accessToken);
    return accessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await storage.getToken();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    // Never attempt refresh on auth endpoints — would loop.
    if (path.startsWith('/api/auth/')) {
      await storage.clearToken();
      throw new ApiError(401, null);
    }

    try {
      const newToken = await refreshToken();

      // Retry the original request once with the new token.
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('Content-Type', 'application/json');
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: retryHeaders,
        credentials: 'include',
      });
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => null);
        throw new ApiError(retryRes.status, body);
      }
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json() as Promise<T>;
    } catch {
      // Refresh failed — clear token and send user to login.
      await storage.clearToken();
      router.replace('/auth/login');
      throw new ApiError(401, null);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}
```

- [ ] **Step 3: Verify on device**

Run `pnpm mobile` from the repo root. Log in, use the app normally. The app should behave identically to before (refresh only fires on 401, which won't happen with a fresh token). No visible change — that's the correct outcome.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/api.ts
git commit -m "feat(mobile): silent JWT refresh with concurrent-request gate"
```

---

### Task 2: Bottom tab navigation restructure

**Files:**
- Create: `apps/mobile/src/components/ui/AppHeader.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/app/(tabs)/favorites.tsx` (placeholder)
- Modify: `apps/mobile/app/_layout.tsx`
- Delete: `apps/mobile/app/index.tsx`
- Delete: `apps/mobile/app/monsters/index.tsx`

**Interfaces:**
- Produces: `/` route shows monsters list inside a tab bar. `/favorites` route shows a placeholder. `/monsters/[id]` still works (pushed on root Stack, tab bar hides). `AppTitle` and `HeaderRight` exported from `AppHeader.tsx` for reuse in both `_layout.tsx` and `(tabs)/_layout.tsx`.

- [ ] **Step 1: Extract `AppTitle` and `HeaderRight` to a shared file**

Create `apps/mobile/src/components/ui/AppHeader.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export function AppTitle() {
  return (
    <View className="flex-row items-center">
      <Text className="text-accent text-lg font-bold tracking-widest uppercase">MH </Text>
      <Text className="text-stone-50 text-lg font-bold tracking-widest uppercase">Datapedia</Text>
    </View>
  );
}

export function HeaderRight() {
  const { user, logout } = useAuth();
  if (user) {
    return (
      <View className="flex-row items-center gap-3 mr-1">
        <Text className="text-stone-400 text-sm">{user.username}</Text>
        <Pressable
          onPress={logout}
          className="border border-stone-700 rounded px-3 py-1"
        >
          <Text className="text-stone-400 text-sm">Logout</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-2 mr-1">
      <Pressable
        onPress={() => router.push('/auth/login')}
        className="border border-stone-700 rounded px-3 py-1"
      >
        <Text className="text-stone-400 text-sm">Login</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Update root `_layout.tsx`**

Replace `apps/mobile/app/_layout.tsx` entirely:

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Oswald_400Regular,
  Oswald_700Bold,
} from '@expo-google-fonts/oswald';
import { AuthProvider } from '../src/context/AuthContext';

const queryClient = new QueryClient();

function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0a09' },
        headerTintColor: '#fafaf9',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0c0a09' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="monsters/[id]" options={{ title: '' }} />
      <Stack.Screen
        name="auth/login"
        options={{
          presentation: 'modal',
          headerTitle: 'Sign In',
          headerRight: () => null,
        }}
      />
      <Stack.Screen
        name="auth/register"
        options={{
          presentation: 'modal',
          headerTitle: 'Create Account',
          headerRight: () => null,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Oswald_400Regular, Oswald_700Bold });
  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Create `app/(tabs)/_layout.tsx`**

Create the directory `apps/mobile/app/(tabs)/` and the file `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTitle, HeaderRight } from '../../src/components/ui/AppHeader';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0a09' },
        headerTintColor: '#fafaf9',
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#1c1917',
          borderTopColor: '#292524',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#2f9e8f',
        tabBarInactiveTintColor: '#57534e',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Monsters',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" color={color} size={size} />
          ),
          headerTitle: () => <AppTitle />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              color={color}
              size={size}
            />
          ),
          headerTitle: () => <AppTitle />,
          headerRight: () => <HeaderRight />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Create `app/(tabs)/index.tsx`**

Create `apps/mobile/app/(tabs)/index.tsx` with the monsters list (same content as `app/monsters/index.tsx`, import paths are identical since `(tabs)/` is at the same depth as `monsters/`):

```tsx
import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  Text,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/lib/api';
import { MonsterCard } from '../../src/components/monsters/MonsterCard';
import { TypeFilterChip } from '../../src/components/monsters/TypeFilterChip';
import { Spinner } from '../../src/components/ui/Spinner';
import type { Monster, MonsterType } from '@mh-datapedia/shared';

const MONSTER_TYPES: MonsterType[] = [
  'Large', 'Small', 'ElderDragon', 'FlyingWyvern', 'BruteWyvern',
  'FangedBeast', 'BirdWyvern', 'Leviathan', 'Amphibian', 'Temnoceran',
  'Apex', 'Afflicted', 'Tempered', 'Construct', 'DemiElderDragon',
  'Cephalopod', 'Machine',
];

interface ListResponse {
  data: Monster[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default function MonstersScreen() {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<MonsterType | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['monsters', search, activeType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (activeType) params.set('type', activeType);
      return apiGet<ListResponse>(`/api/monsters?${params}`);
    },
  });

  const handleTypePress = useCallback(
    (type: MonsterType) => setActiveType((prev) => (prev === type ? null : type)),
    [],
  );

  const monsters = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <View className="px-4 pt-3 pb-2">
        <TextInput
          className="bg-stone-900 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm placeholder:text-stone-500"
          placeholder="Search monsters…"
          placeholderTextColor="#78716c"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: '#292524', height: 44 }}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', height: 44 }}
      >
        <TypeFilterChip
          label="All"
          active={activeType === null}
          onPress={() => setActiveType(null)}
        />
        {MONSTER_TYPES.map((type) => (
          <TypeFilterChip
            key={type}
            label={type}
            active={activeType === type}
            onPress={() => handleTypePress(type)}
          />
        ))}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 bg-stone-950 items-center justify-center">
          <Spinner size="lg" />
        </View>
      ) : isError ? (
        <View className="flex-1 bg-stone-950 items-center justify-center">
          <Text className="text-stone-400 text-base">Failed to load monsters.</Text>
          <Pressable onPress={() => refetch()} className="mt-3">
            <Text className="text-accent text-sm">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={monsters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MonsterCard monster={item} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-stone-500">No monsters found.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2f9e8f"
            />
          }
        />
      )}
    </View>
  );
}
```

- [ ] **Step 5: Create placeholder favorites screen**

Create `apps/mobile/app/(tabs)/favorites.tsx`:

```tsx
import { View, Text } from 'react-native';

export default function FavoritesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#57534e', fontSize: 16 }}>Favorites coming soon</Text>
    </View>
  );
}
```

- [ ] **Step 6: Delete old files**

```bash
# From repo root
rm apps/mobile/app/index.tsx
rm apps/mobile/app/monsters/index.tsx
```

- [ ] **Step 7: Verify on device**

Run `pnpm mobile`. The app should open to the monsters list with a tab bar at the bottom showing "Monsters" and "Favorites". Tap a monster — detail screen opens (tab bar disappears). Tap "Favorites" tab — placeholder text appears. Login/logout still works from the header.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/ui/AppHeader.tsx \
        apps/mobile/app/_layout.tsx \
        "apps/mobile/app/(tabs)/_layout.tsx" \
        "apps/mobile/app/(tabs)/index.tsx" \
        "apps/mobile/app/(tabs)/favorites.tsx"
git rm apps/mobile/app/index.tsx apps/mobile/app/monsters/index.tsx
git commit -m "feat(mobile): bottom tab navigation with Monsters and Favorites tabs"
```

---

## Spec B: Favorites

---

### Task 3: `useFavorites` hook

**Files:**
- Create: `apps/mobile/src/hooks/useFavorites.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useFavorites(): {
    favorites: Monster[];
    isFavorited: (monsterId: string) => boolean;
    toggle: (monsterId: string) => void;
    isLoading: boolean;
  }
  ```
  Query key: `['favorites']`. Only runs when `user` is non-null.

- [ ] **Step 1: Create the hooks directory and file**

Create `apps/mobile/src/hooks/useFavorites.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import type { Monster } from '@mh-datapedia/shared';

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () =>
      apiGet<{ data: Monster[] }>('/api/users/me/favorites').then((r) => r.data),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (monsterId: string) =>
      apiPost(`/api/users/me/favorites/${monsterId}`),
    onMutate: async (monsterId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<Monster[]>(['favorites']);
      // Try to read full monster data from the detail cache (populated when user viewed the detail screen).
      // If not cached, skip optimistic insert and rely on invalidation in onSettled.
      const cached = queryClient.getQueryData<Monster>(['monster', monsterId]);
      if (cached) {
        queryClient.setQueryData<Monster[]>(['favorites'], (old = []) => [
          ...old,
          cached,
        ]);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['favorites'], ctx?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (monsterId: string) =>
      apiDelete(`/api/users/me/favorites/${monsterId}`),
    onMutate: async (monsterId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<Monster[]>(['favorites']);
      queryClient.setQueryData<Monster[]>(['favorites'], (old = []) =>
        old.filter((m) => m.id !== monsterId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['favorites'], ctx?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  function isFavorited(monsterId: string): boolean {
    return favorites.some((m) => m.id === monsterId);
  }

  function toggle(monsterId: string): void {
    if (isFavorited(monsterId)) {
      removeMutation.mutate(monsterId);
    } else {
      addMutation.mutate(monsterId);
    }
  }

  return { favorites, isFavorited, toggle, isLoading };
}
```

- [ ] **Step 2: Verify the file has no TypeScript errors**

Run from repo root:
```bash
pnpm --filter mobile tsc --noEmit
```
Expected: no errors related to `useFavorites.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useFavorites.ts
git commit -m "feat(mobile): useFavorites hook with optimistic add/remove mutations"
```

---

### Task 4: Swipeable MonsterCard + full favorites screen

**Files:**
- Modify: `apps/mobile/src/components/monsters/MonsterCard.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Replace: `apps/mobile/app/(tabs)/favorites.tsx`

**Interfaces:**
- Consumes: `useFavorites()` from `../hooks/useFavorites` (Task 3)
- Produces: `MonsterCard` accepts optional `isFavorited?: boolean` and `onFavoriteToggle?: () => void`. When both are provided, the card is wrapped in `Swipeable` with a left-swipe action.

- [ ] **Step 1: Update `MonsterCard.tsx` with swipe-to-favorite**

Replace `apps/mobile/src/components/monsters/MonsterCard.tsx` entirely:

```tsx
import { useRef } from 'react';
import { Pressable, View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'type' | 'iconUrl'>;
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
}

export function MonsterCard({ monster, isFavorited, onFavoriteToggle }: MonsterCardProps) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions() {
    if (!onFavoriteToggle) return null;
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onFavoriteToggle();
        }}
        style={{
          width: 72,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isFavorited ? '#ef4444' : '#2f9e8f',
        }}
      >
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={24}
          color="#fff"
        />
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 2 }}>
          {isFavorited ? 'Remove' : 'Save'}
        </Text>
      </Pressable>
    );
  }

  const card = (
    <Pressable
      onPress={() => router.push(`/monsters/${monster.id}`)}
      className="flex-row items-center px-4 py-3 border-b border-stone-800 active:bg-stone-800/50"
    >
      {monster.iconUrl ? (
        <Image
          source={{ uri: monster.iconUrl }}
          className="w-10 h-10 rounded mr-3"
          resizeMode="contain"
        />
      ) : (
        <View className="w-10 h-10 rounded mr-3 bg-stone-800 items-center justify-center">
          <Text className="text-stone-500 text-xs">?</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-stone-50 font-medium text-base">{monster.name}</Text>
      </View>
      <Badge variant="accent">{monster.type}</Badge>
    </Pressable>
  );

  if (!onFavoriteToggle) return card;

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} rightThreshold={40}>
      {card}
    </Swipeable>
  );
}
```

- [ ] **Step 2: Wire up favorites in the monsters list**

Replace `apps/mobile/app/(tabs)/index.tsx` — add `useFavorites` and pass props to `MonsterCard`. Only the `renderItem` and the import section change; everything else stays identical:

```tsx
import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  Text,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/lib/api';
import { MonsterCard } from '../../src/components/monsters/MonsterCard';
import { TypeFilterChip } from '../../src/components/monsters/TypeFilterChip';
import { Spinner } from '../../src/components/ui/Spinner';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';
import type { Monster, MonsterType } from '@mh-datapedia/shared';

const MONSTER_TYPES: MonsterType[] = [
  'Large', 'Small', 'ElderDragon', 'FlyingWyvern', 'BruteWyvern',
  'FangedBeast', 'BirdWyvern', 'Leviathan', 'Amphibian', 'Temnoceran',
  'Apex', 'Afflicted', 'Tempered', 'Construct', 'DemiElderDragon',
  'Cephalopod', 'Machine',
];

interface ListResponse {
  data: Monster[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default function MonstersScreen() {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<MonsterType | null>(null);
  const { user } = useAuth();
  const { isFavorited, toggle } = useFavorites();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['monsters', search, activeType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (activeType) params.set('type', activeType);
      return apiGet<ListResponse>(`/api/monsters?${params}`);
    },
  });

  const handleTypePress = useCallback(
    (type: MonsterType) => setActiveType((prev) => (prev === type ? null : type)),
    [],
  );

  const monsters = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <View className="px-4 pt-3 pb-2">
        <TextInput
          className="bg-stone-900 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm placeholder:text-stone-500"
          placeholder="Search monsters…"
          placeholderTextColor="#78716c"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: '#292524', height: 44 }}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', height: 44 }}
      >
        <TypeFilterChip
          label="All"
          active={activeType === null}
          onPress={() => setActiveType(null)}
        />
        {MONSTER_TYPES.map((type) => (
          <TypeFilterChip
            key={type}
            label={type}
            active={activeType === type}
            onPress={() => handleTypePress(type)}
          />
        ))}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 bg-stone-950 items-center justify-center">
          <Spinner size="lg" />
        </View>
      ) : isError ? (
        <View className="flex-1 bg-stone-950 items-center justify-center">
          <Text className="text-stone-400 text-base">Failed to load monsters.</Text>
          <Pressable onPress={() => refetch()} className="mt-3">
            <Text className="text-accent text-sm">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={monsters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MonsterCard
              monster={item}
              isFavorited={user ? isFavorited(item.id) : undefined}
              onFavoriteToggle={
                user
                  ? () => toggle(item.id)
                  : () => router.push('/auth/login')
              }
            />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-stone-500">No monsters found.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2f9e8f"
            />
          }
        />
      )}
    </View>
  );
}
```

- [ ] **Step 3: Implement full favorites screen**

Replace `apps/mobile/app/(tabs)/favorites.tsx` entirely:

```tsx
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/hooks/useFavorites';
import { MonsterCard } from '../../src/components/monsters/MonsterCard';
import { Spinner } from '../../src/components/ui/Spinner';
import { Button } from '../../src/components/ui/Button';

export default function FavoritesScreen() {
  const { user } = useAuth();
  const { favorites, isFavorited, toggle, isLoading } = useFavorites();

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: '#a8a29e', fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
          Sign in to save your favorite monsters
        </Text>
        <Button onPress={() => router.push('/auth/login')}>Sign In</Button>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MonsterCard
            monster={item}
            isFavorited={isFavorited(item.id)}
            onFavoriteToggle={() => toggle(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <Text style={{ color: '#57534e', fontSize: 16 }}>No favorites yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} tintColor="#2f9e8f" />
        }
      />
    </View>
  );
}
```

- [ ] **Step 4: Verify on device**

Run `pnpm mobile`. Log in. On the Monsters tab, swipe a card left — teal action panel should appear with "Save". Tap it — card closes, monster is favorited. Switch to Favorites tab — the monster appears. Swipe it left — red panel with "Remove". Tap — gone from favorites. Log out and open app — Favorites tab shows "Sign in" prompt, swiping cards on Monsters tab prompts login.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/monsters/MonsterCard.tsx \
        "apps/mobile/app/(tabs)/index.tsx" \
        "apps/mobile/app/(tabs)/favorites.tsx"
git commit -m "feat(mobile): swipeable favorites toggle on monster cards and favorites screen"
```

---

### Task 5: Heart toggle on monster detail screen

**Files:**
- Modify: `apps/mobile/app/monsters/[id].tsx`

**Interfaces:**
- Consumes: `useFavorites()` from `../../src/hooks/useFavorites` (Task 3), `useAuth()` from `../../src/context/AuthContext`, `Ionicons` from `@expo/vector-icons`.

- [ ] **Step 1: Add imports to `[id].tsx`**

At the top of `apps/mobile/app/monsters/[id].tsx`, add these imports (keep all existing imports, just add):

```tsx
import { Pressable } from 'react-native'; // already imported — just note it's needed
import { router } from 'expo-router';     // already imported — just note it's needed
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/hooks/useFavorites';
```

The full import block at the top of the file becomes:

```tsx
import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/hooks/useFavorites';
import { TabStrip } from '../../src/components/ui/TabStrip';
import { Spinner } from '../../src/components/ui/Spinner';
import { Badge } from '../../src/components/ui/Badge';
import { OverviewTab } from '../../src/components/detail/OverviewTab';
import { HitzonesTab } from '../../src/components/detail/HitzonesTab';
import { WeaknessesTab } from '../../src/components/detail/WeaknessesTab';
import { DropsTab } from '../../src/components/detail/DropsTab';
import { StrategiesTab } from '../../src/components/detail/StrategiesTab';
```

- [ ] **Step 2: Add hooks inside the component**

After `const [activeTab, setActiveTab] = useState(0);`, add:

```tsx
const { user } = useAuth();
const { isFavorited, toggle } = useFavorites();
```

- [ ] **Step 3: Update the name/title/boss row**

Find the name/title/boss badge block in the JSX (currently at `apps/mobile/app/monsters/[id].tsx` around line 76) and replace it:

Current block:
```tsx
<View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
  <View style={{ flex: 1 }}>
    <Text style={{ color: '#fafaf9', fontSize: 20, fontWeight: 'bold' }}>{data.name}</Text>
    <Text style={{ color: '#a8a29e', fontSize: 13 }}>{data.title}</Text>
  </View>
  {data.isBoss && <Badge variant="red">Boss</Badge>}
</View>
```

Replace with:
```tsx
<View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
  <View style={{ flex: 1 }}>
    <Text style={{ color: '#fafaf9', fontSize: 20, fontWeight: 'bold' }}>{data.name}</Text>
    <Text style={{ color: '#a8a29e', fontSize: 13 }}>{data.title}</Text>
  </View>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {data.isBoss && <Badge variant="red">Boss</Badge>}
    <Pressable
      onPress={() => {
        if (!user) {
          router.push('/auth/login');
          return;
        }
        toggle(id);
      }}
      hitSlop={8}
    >
      <Ionicons
        name={user && isFavorited(id) ? 'heart' : 'heart-outline'}
        size={24}
        color={user && isFavorited(id) ? '#ef4444' : '#57534e'}
      />
    </Pressable>
  </View>
</View>
```

- [ ] **Step 4: Verify on device**

Run `pnpm mobile`. Open any monster detail. A heart icon (outline, grey) should appear to the right of the name row. While logged out: tap it — login modal opens. Log in and return — heart is still outline (not yet favorited). Tap heart — turns red (filled). Navigate back to monsters list — swipe that card left and it shows "Remove" (already favorited). Tap heart on detail again — turns outline, removed from favorites.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/monsters/[id].tsx
git commit -m "feat(mobile): heart toggle on monster detail screen"
```

---

## Spec C: Strategy Submission

---

### Task 6: Install `@gorhom/bottom-sheet` and `StrategyFormSheet` component

**Files:**
- Modify: `apps/mobile/package.json` (via pnpm install)
- Modify: `apps/mobile/app/_layout.tsx` (add `BottomSheetModalProvider`)
- Create: `apps/mobile/src/components/detail/StrategyFormSheet.tsx`

**Interfaces:**
- Produces:
  ```tsx
  // forwardRef component; parent holds the ref and calls ref.current?.present()
  export const StrategyFormSheet: React.ForwardRefExoticComponent<
    StrategyFormSheetProps & React.RefAttributes<BottomSheetModal>
  >
  // where StrategyFormSheetProps = { monsterId: string }
  ```

- [ ] **Step 1: Install `@gorhom/bottom-sheet@^5`**

```bash
pnpm --filter mobile add @gorhom/bottom-sheet@^5
```

Expected: package added to `apps/mobile/package.json` with no peer dep warnings (gesture-handler and reanimated already installed).

- [ ] **Step 2: Add `BottomSheetModalProvider` to root layout**

In `apps/mobile/app/_layout.tsx`, add the import and wrap the component:

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Oswald_400Regular,
  Oswald_700Bold,
} from '@expo-google-fonts/oswald';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from '../src/context/AuthContext';

const queryClient = new QueryClient();

function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0a09' },
        headerTintColor: '#fafaf9',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0c0a09' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="monsters/[id]" options={{ title: '' }} />
      <Stack.Screen
        name="auth/login"
        options={{
          presentation: 'modal',
          headerTitle: 'Sign In',
          headerRight: () => null,
        }}
      />
      <Stack.Screen
        name="auth/register"
        options={{
          presentation: 'modal',
          headerTitle: 'Create Account',
          headerRight: () => null,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Oswald_400Regular, Oswald_700Bold });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <RootStack />
          </BottomSheetModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

Note: `GestureHandlerRootView` is required by `@gorhom/bottom-sheet` v5 at the app root. It was previously implicit via Expo Router — wrapping it explicitly here ensures correct behavior.

- [ ] **Step 3: Create `StrategyFormSheet.tsx`**

Create `apps/mobile/src/components/detail/StrategyFormSheet.tsx`:

```tsx
import { forwardRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, ApiError } from '../../lib/api';
import { CreateStrategySchema } from '@mh-datapedia/shared';
import type { MHGame, Difficulty } from '@mh-datapedia/shared';

const GAMES: { value: MHGame; label: string }[] = [
  { value: 'MONSTER_HUNTER_WORLD', label: 'World' },
  { value: 'MONSTER_HUNTER_WORLD_ICEBORNE', label: 'Iceborne' },
  { value: 'MONSTER_HUNTER_RISE', label: 'Rise' },
  { value: 'MONSTER_HUNTER_RISE_SUNBREAK', label: 'Sunbreak' },
  { value: 'MONSTER_HUNTER_WILDS', label: 'Wilds' },
];

const DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

interface StrategyFormSheetProps {
  monsterId: string;
}

export const StrategyFormSheet = forwardRef<BottomSheetModal, StrategyFormSheetProps>(
  ({ monsterId }, ref) => {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [game, setGame] = useState<MHGame>('MONSTER_HUNTER_WILDS');
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [content, setContent] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const { mutate, isPending, error, reset } = useMutation({
      mutationFn: (payload: {
        monsterId: string;
        title: string;
        content: string;
        difficulty: Difficulty;
        game: MHGame;
      }) => apiPost('/api/strategies', payload),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['monster', monsterId] });
        setTitle('');
        setContent('');
        setGame('MONSTER_HUNTER_WILDS');
        setDifficulty('Beginner');
        setFieldErrors({});
        reset();
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
      },
    });

    const handleSubmit = useCallback(() => {
      const result = CreateStrategySchema.safeParse({
        monsterId,
        title,
        content,
        difficulty,
        game,
      });
      if (!result.success) {
        const errors: Record<string, string> = {};
        result.error.errors.forEach((e) => {
          if (e.path[0]) errors[String(e.path[0])] = e.message;
        });
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      mutate(result.data);
    }, [monsterId, title, content, difficulty, game, mutate]);

    const errorMessage =
      error instanceof ApiError
        ? ((error.body as { message?: string })?.message ?? 'Something went wrong')
        : error
          ? 'Something went wrong'
          : null;

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['85%']}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <BottomSheetView style={{ flex: 1, padding: 16 }}>
          <Text style={{ color: '#fafaf9', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            New Strategy
          </Text>

          {/* Title */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Title</Text>
          <BottomSheetTextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Strategy title"
            placeholderTextColor="#57534e"
            maxLength={200}
            style={{
              backgroundColor: '#0c0a09',
              borderWidth: 1,
              borderColor: fieldErrors.title ? '#ef4444' : '#292524',
              borderRadius: 6,
              padding: 10,
              color: '#fafaf9',
              fontSize: 14,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: 2 }}>
            {fieldErrors.title ? (
              <Text style={{ color: '#ef4444', fontSize: 12 }}>{fieldErrors.title}</Text>
            ) : (
              <View />
            )}
            <Text style={{ color: '#57534e', fontSize: 12 }}>{title.length}/200</Text>
          </View>

          {/* Game */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Game</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ height: 44 }}
            contentContainerStyle={{ height: 44, alignItems: 'center', marginBottom: 12 }}
          >
            {GAMES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setGame(value)}
                style={{
                  marginRight: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: game === value ? '#2f9e8f' : '#44403c',
                  backgroundColor: game === value ? 'rgba(47,158,143,0.2)' : 'transparent',
                }}
              >
                <Text style={{ color: game === value ? '#2f9e8f' : '#a8a29e', fontSize: 13 }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Difficulty */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Difficulty</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: difficulty === d ? '#2f9e8f' : '#44403c',
                  backgroundColor: difficulty === d ? 'rgba(47,158,143,0.2)' : 'transparent',
                }}
              >
                <Text style={{ color: difficulty === d ? '#2f9e8f' : '#a8a29e', fontSize: 13 }}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Description</Text>
          <BottomSheetTextInput
            value={content}
            onChangeText={setContent}
            placeholder="Describe your strategy…"
            placeholderTextColor="#57534e"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={{
              backgroundColor: '#0c0a09',
              borderWidth: 1,
              borderColor: fieldErrors.content ? '#ef4444' : '#292524',
              borderRadius: 6,
              padding: 10,
              color: '#fafaf9',
              fontSize: 14,
              minHeight: 120,
              marginBottom: fieldErrors.content ? 2 : 16,
            }}
          />
          {fieldErrors.content && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
              {fieldErrors.content}
            </Text>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={isPending}
            style={{
              backgroundColor: isPending ? '#1c7a6e' : '#2f9e8f',
              borderRadius: 6,
              paddingVertical: 12,
              alignItems: 'center',
              marginBottom: 8,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#0c0a09" />
            ) : (
              <Text style={{ color: '#0c0a09', fontWeight: '600', fontSize: 15 }}>
                Submit Strategy
              </Text>
            )}
          </Pressable>

          {errorMessage && (
            <Text style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
              {errorMessage}
            </Text>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
```

- [ ] **Step 4: Verify on device**

Run `pnpm mobile`. The app should open and behave identically to before. No visible change yet — the sheet component exists but isn't wired up until Task 7.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json \
        apps/mobile/app/_layout.tsx \
        apps/mobile/src/components/detail/StrategyFormSheet.tsx
git commit -m "feat(mobile): add StrategyFormSheet component and BottomSheetModalProvider"
```

---

### Task 7: FAB + strategy form wired up in detail screen

**Files:**
- Modify: `apps/mobile/app/monsters/[id].tsx`
- Modify: `apps/mobile/src/components/detail/StrategiesTab.tsx`

**Interfaces:**
- Consumes: `StrategyFormSheet` (forwardRef, `BottomSheetModal` ref) from Task 6. `StrategiesTab` gains a required `monsterId: string` prop.

- [ ] **Step 1: Add `monsterId` prop to `StrategiesTab` and add bottom padding**

Replace `apps/mobile/src/components/detail/StrategiesTab.tsx` entirely:

```tsx
import { View, Text } from 'react-native';
import { Badge } from '../ui/Badge';
import type { Difficulty, MHGame } from '@mh-datapedia/shared';

interface StrategyWithAuthor {
  id: string;
  title: string;
  content: string;
  difficulty: Difficulty;
  game: MHGame;
  authorId: string;
  author: { id: string; username: string };
  createdAt: string;
}

const DIFFICULTY_VARIANT: Record<Difficulty, 'accent' | 'stone' | 'red'> = {
  Beginner: 'accent',
  Intermediate: 'stone',
  Advanced: 'red',
};

const GAME_SHORT: Record<MHGame, string> = {
  MONSTER_HUNTER_WORLD: 'World',
  MONSTER_HUNTER_WORLD_ICEBORNE: 'Iceborne',
  MONSTER_HUNTER_RISE: 'Rise',
  MONSTER_HUNTER_RISE_SUNBREAK: 'Sunbreak',
  MONSTER_HUNTER_WILDS: 'Wilds',
};

export function StrategiesTab({
  strategies,
  monsterId: _monsterId,
}: {
  strategies: StrategyWithAuthor[];
  monsterId: string;
}) {
  if (strategies.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 64, paddingBottom: 100, alignItems: 'center' }}>
        <Text style={{ color: '#57534e' }}>No strategies yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}>
      {strategies.map((s) => (
        <View
          key={s.id}
          className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-4"
        >
          <View className="flex-row items-center gap-2 mb-2 flex-wrap">
            <Text className="text-stone-50 font-semibold text-base flex-1">{s.title}</Text>
            <Badge variant={DIFFICULTY_VARIANT[s.difficulty]}>{s.difficulty}</Badge>
          </View>
          <Text className="text-stone-400 text-xs mb-3">
            {GAME_SHORT[s.game]} · by {s.author.username} ·{' '}
            {new Date(s.createdAt).toLocaleDateString()}
          </Text>
          <Text className="text-stone-300 text-sm leading-5">{s.content}</Text>
        </View>
      ))}
    </View>
  );
}
```

The `paddingBottom: 100` ensures content isn't hidden behind the FAB. `monsterId` is accepted (the `_` prefix suppresses "unused variable" lint warnings since the prop is needed for the interface but the FAB and sheet live in `[id].tsx`).

- [ ] **Step 2: Wire up FAB and `StrategyFormSheet` in `[id].tsx`**

Replace `apps/mobile/app/monsters/[id].tsx` entirely:

```tsx
import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { apiGet } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/hooks/useFavorites';
import { TabStrip } from '../../src/components/ui/TabStrip';
import { Spinner } from '../../src/components/ui/Spinner';
import { Badge } from '../../src/components/ui/Badge';
import { OverviewTab } from '../../src/components/detail/OverviewTab';
import { HitzonesTab } from '../../src/components/detail/HitzonesTab';
import { WeaknessesTab } from '../../src/components/detail/WeaknessesTab';
import { DropsTab } from '../../src/components/detail/DropsTab';
import { StrategiesTab } from '../../src/components/detail/StrategiesTab';
import { StrategyFormSheet } from '../../src/components/detail/StrategyFormSheet';

const TABS = ['Overview', 'Hitzones', 'Weaknesses', 'Drops', 'Strategies'];

export default function MonsterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const { user } = useAuth();
  const { isFavorited, toggle } = useFavorites();
  const sheetRef = useRef<BottomSheetModal>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['monster', id],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiGet<{ data: any }>(`/api/monsters/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.name) {
      navigation.setOptions({ headerTitle: data.name });
    }
  }, [data?.name, navigation]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-stone-950 justify-center">
        <Spinner size="lg" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-950">
        <Text className="text-stone-400 text-base">Failed to load monster.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={activeTab !== 1}
      >
        {/* Hero image */}
        {data.imageUrl ? (
          <Image
            source={{ uri: data.imageUrl }}
            style={{ width: '100%', aspectRatio: 16 / 9 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1c1917', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#57534e', fontSize: 18 }}>{data.name}</Text>
          </View>
        )}

        {/* Name + title + boss badge + heart */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fafaf9', fontSize: 20, fontWeight: 'bold' }}>{data.name}</Text>
            <Text style={{ color: '#a8a29e', fontSize: 13 }}>{data.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {data.isBoss && <Badge variant="red">Boss</Badge>}
            <Pressable
              onPress={() => {
                if (!user) {
                  router.push('/auth/login');
                  return;
                }
                toggle(id);
              }}
              hitSlop={8}
            >
              <Ionicons
                name={user && isFavorited(id) ? 'heart' : 'heart-outline'}
                size={24}
                color={user && isFavorited(id) ? '#ef4444' : '#57534e'}
              />
            </Pressable>
          </View>
        </View>

        {/* Tab strip */}
        <TabStrip tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        {activeTab === 0 && (
          <OverviewTab
            monster={{
              description: data.description,
              habitats: data.habitats ?? [],
              ailments: data.ailments ?? [],
              isBoss: data.isBoss,
              subspecies: data.subspecies ?? [],
              parent: data.parent,
            }}
          />
        )}
        {activeTab === 1 && <HitzonesTab hitzones={data.hitzones ?? []} />}
        {activeTab === 2 && <WeaknessesTab weaknesses={data.weaknesses ?? []} />}
        {activeTab === 3 && <DropsTab drops={data.drops ?? []} />}
        {activeTab === 4 && (
          <StrategiesTab strategies={data.strategies ?? []} monsterId={id} />
        )}
      </ScrollView>

      {/* FAB — floats above scroll content, visible only on Strategies tab when logged in */}
      {activeTab === 4 && user && (
        <Pressable
          onPress={() => sheetRef.current?.present()}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#2f9e8f',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      )}

      {/* Strategy submission sheet */}
      <StrategyFormSheet ref={sheetRef} monsterId={id} />
    </View>
  );
}
```

- [ ] **Step 3: Verify on device**

Run `pnpm mobile`. Open a monster detail. Switch to the Strategies tab. While logged in: a teal `+` FAB should appear at the bottom right. Tap it — bottom sheet slides up to ~85% of the screen with the "New Strategy" form. Fill in title, pick a game chip, select difficulty, type content. Tap "Submit Strategy" — sheet closes, Strategies tab refreshes and the new strategy appears. Try submitting empty — field validation errors should show inline without submitting.

While logged out: no FAB visible on the Strategies tab.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/detail/StrategiesTab.tsx \
        apps/mobile/app/monsters/[id].tsx
git commit -m "feat(mobile): strategy submission FAB and bottom sheet form on detail screen"
```

---

## Done

All three specs are implemented. Verify the full flow end-to-end:

1. Fresh launch → monsters list with tab bar
2. Log in via header → heart icons activate, swipe actions activate
3. Swipe a card left → save to favorites
4. Favorites tab → saved monster appears
5. Open monster detail → heart shows filled; tap to unfavorite
6. Strategies tab → `+` FAB visible; tap → form opens; submit → strategy appears
7. Background the app and reopen → still logged in (refresh token keeps session alive)
