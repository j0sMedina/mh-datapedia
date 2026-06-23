# MH Datapedia Mobile — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/mobile` to the monorepo as an Expo React Native app that delivers monster browsing + auth on Android, consuming `https://mh-datapedia-web.fly.dev` with zero backend changes.

**Architecture:** Expo managed workflow with Expo Router (file-based navigation), NativeWind v4 (Tailwind classes on React Native), TanStack Query v5, and expo-secure-store for token storage. `packages/shared` provides types and Zod schemas. No shared UI components with the web — each app owns its own UI.

**Tech Stack:** Expo SDK (managed), Expo Router, NativeWind v4, TanStack Query v5, expo-secure-store, @expo-google-fonts/oswald, @mh-datapedia/shared (workspace)

## Global Constraints

- API base URL: `https://mh-datapedia-web.fly.dev` — hardcoded constant `API_BASE` in `src/lib/api.ts`
- Background: `bg-stone-950` (`#0c0a09`) on every screen
- Accent: `#2f9e8f` (DEFAULT), `#45bcab` (hover), `#237a6e` (strong)
- Display font: Oswald (loaded via `@expo-google-fonts/oswald`)
- Auth token key: `"access_token"` in expo-secure-store
- No silent refresh in Phase 1 — 401 response clears token and navigates to `/auth/login`
- Package name: `@mh-datapedia/mobile`
- Monster list API response: `{ data: Monster[], meta: { page, limit, total, totalPages } }`
- Monster detail API response: `{ data: Monster }` — Monster includes `weaknesses`, `hitzones`, `strategies` (each with `author: { id, username }`), `ailments`, `drops`, `subspecies`, `parent`
- Auth login/register API response: `{ user: User, accessToken: string, expiresIn: number }`
- `packages/shared` must be built before running or typechecking mobile: `pnpm --filter @mh-datapedia/shared build`

---

### Task 1: Project scaffold, Expo Router, NativeWind

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`
- Modify: `turbo.json`

**Interfaces:**
- Produces: a running Expo app (QR code) that renders `bg-stone-950` background with `text-accent` "MH" and `text-stone-50` "Datapedia" — confirming Expo Router + NativeWind are wired correctly.

- [ ] **Step 1: Scaffold with create-expo-app**

Run from the repo root:

```bash
cd apps && npx create-expo-app@latest mobile --template blank-typescript
```

This generates `apps/mobile/` with `package.json`, `app.json`, `App.tsx`, `assets/`, and a pre-configured Babel setup.

- [ ] **Step 2: Add Expo-managed packages**

Run inside `apps/mobile/` (use `npx expo install` so it picks versions compatible with the SDK create-expo-app chose):

```bash
cd mobile
npx expo install expo-router expo-secure-store expo-font expo-constants expo-status-bar @expo-google-fonts/oswald
```

- [ ] **Step 3: Add non-Expo packages and build shared**

Run from the **repo root**:

```bash
cd ../..
pnpm --filter @mh-datapedia/mobile add nativewind tailwindcss @tanstack/react-query
pnpm --filter @mh-datapedia/shared build
```

- [ ] **Step 4: Patch `apps/mobile/package.json`**

Make these four edits to the generated `package.json` (keep everything else as-is):

```json
{
  "name": "@mh-datapedia/mobile",
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "start": "expo start",
    "android": "expo start --android",
    "build": "expo export",
    "typecheck": "tsc --noEmit"
  }
}
```

Then add to `"dependencies"`:
```json
"@mh-datapedia/shared": "workspace:*"
```

Run `pnpm install` from the repo root to link the workspace package.

- [ ] **Step 5: Replace `apps/mobile/app.json`**

Delete the generated `app.json` and write:

```json
{
  "expo": {
    "name": "MH Datapedia",
    "slug": "mh-datapedia",
    "version": "1.0.0",
    "scheme": "mhdatapedia",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0c0a09"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0c0a09"
      }
    },
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 6: Write `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

- [ ] **Step 7: Write `apps/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
```

- [ ] **Step 8: Write `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 9: Write `apps/mobile/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{tsx,ts}',
    './src/**/*.{tsx,ts}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2f9e8f',
          hover: '#45bcab',
          strong: '#237a6e',
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 10: Write `apps/mobile/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 11: Delete `apps/mobile/App.tsx`** (Expo Router replaces it)

- [ ] **Step 12: Write `apps/mobile/app/_layout.tsx`** (minimal stub — expanded in Task 2)

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0c0a09' },
          headerTintColor: '#fafaf9',
          contentStyle: { backgroundColor: '#0c0a09' },
        }}
      />
    </>
  );
}
```

- [ ] **Step 13: Write `apps/mobile/app/index.tsx`** (verification screen)

```tsx
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 bg-stone-950 items-center justify-center">
      <Text className="text-accent text-3xl font-bold">MH</Text>
      <Text className="text-stone-50 text-2xl">Datapedia</Text>
      <Text className="text-stone-400 text-sm mt-4">Phase 1 scaffold ✓</Text>
    </View>
  );
}
```

- [ ] **Step 14: Add mobile tasks to `turbo.json`**

Add to the `"tasks"` object in `turbo.json`:

```json
"start:mobile": {
  "cache": false,
  "persistent": true
}
```

The existing `"dev"` and `"build"` tasks already cover mobile since they match by script name.

- [ ] **Step 15: Verify startup**

From the repo root:

```bash
pnpm --filter @mh-datapedia/mobile dev
```

Expected output: Expo CLI starts, prints a QR code, and the URL `http://localhost:8081`. Open Expo Go on your Android phone (same Wi-Fi), scan the QR. You should see a black screen with teal "MH", white "Datapedia", and grey "Phase 1 scaffold ✓". If NativeWind is broken, the text will be the default white-on-white — the dark background is the key check.

- [ ] **Step 16: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): scaffold Expo app with NativeWind and Expo Router"
```

---

### Task 2: API client, token storage, AuthContext, root layout

**Files:**
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/lib/storage.ts`
- Create: `apps/mobile/src/context/AuthContext.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (add QueryClientProvider, AuthProvider, Oswald font, header components)
- Replace: `apps/mobile/app/index.tsx` (redirect to /monsters)

**Interfaces:**
- Produces:
  - `apiGet<T>(path: string): Promise<T>`
  - `apiPost<T>(path: string, body?: unknown): Promise<T>`
  - `apiPatch<T>(path: string, body?: unknown): Promise<T>`
  - `apiDelete(path: string): Promise<void>`
  - `useAuth(): AuthState` — `{ user, accessToken, isLoading, login, register, logout }`
  - `storage.getToken()`, `storage.setToken(v)`, `storage.clearToken()`

- [ ] **Step 1: Write `apps/mobile/src/lib/storage.ts`**

```ts
import * as SecureStore from 'expo-secure-store';

const KEY = 'access_token';

export const storage = {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY);
  },
  async setToken(value: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, value);
  },
  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};
```

- [ ] **Step 2: Write `apps/mobile/src/lib/api.ts`**

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
    await storage.clearToken();
    router.replace('/auth/login');
    throw new ApiError(401, null);
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

- [ ] **Step 3: Write `apps/mobile/src/context/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { storage } from '../lib/storage';
import type { User } from '@mh-datapedia/shared';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore token from secure store and validate it
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getToken();
        if (!token) return;
        setAccessToken(token);
        const { user: me } = await apiGet<{ user: User }>('/api/auth/me');
        setUser(me);
      } catch {
        await storage.clearToken();
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/login',
      { email, password },
    );
    await storage.setToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function register(email: string, username: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/register',
      { email, username, password },
    );
    await storage.setToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    await apiPost('/api/auth/logout').catch(() => {});
    await storage.clearToken();
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Replace `apps/mobile/app/_layout.tsx`** with full root layout

```tsx
import '../global.css';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Oswald_400Regular,
  Oswald_700Bold,
} from '@expo-google-fonts/oswald';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const queryClient = new QueryClient();

function AppTitle() {
  return (
    <View className="flex-row items-center">
      <Text className="text-accent text-lg font-bold tracking-widest uppercase">MH </Text>
      <Text className="text-stone-50 text-lg font-bold tracking-widest uppercase">Datapedia</Text>
    </View>
  );
}

function HeaderRight() {
  const { user, logout } = useAuth();
  if (user) {
    return (
      <View className="flex-row items-center gap-3 mr-1">
        <Text className="text-stone-400 text-sm hidden">{user.username}</Text>
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

function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0a09' },
        headerTintColor: '#fafaf9',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0c0a09' },
        headerTitle: () => <AppTitle />,
        headerRight: () => <HeaderRight />,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="monsters/index" options={{ title: '' }} />
      <Stack.Screen name="monsters/[id]" options={{ title: '' }} />
      <Stack.Screen
        name="auth/login"
        options={{
          presentation: 'modal',
          headerTitle: 'Sign In',
          headerRight: undefined,
        }}
      />
      <Stack.Screen
        name="auth/register"
        options={{
          presentation: 'modal',
          headerTitle: 'Create Account',
          headerRight: undefined,
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

- [ ] **Step 5: Replace `apps/mobile/app/index.tsx`** with redirect

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/monsters" />;
}
```

- [ ] **Step 6: Verify**

Run `pnpm --filter @mh-datapedia/mobile dev`, scan QR. You should see the MH Datapedia header bar at the top with a "Login" button on the right. The app immediately redirects to `/monsters` which shows a blank stone-950 screen (monsters screen not built yet — that's Task 4).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx
git commit -m "feat(mobile): add API client, auth context, and root layout"
```

---

### Task 3: Base UI components

**Files:**
- Create: `apps/mobile/src/components/ui/Button.tsx`
- Create: `apps/mobile/src/components/ui/Badge.tsx`
- Create: `apps/mobile/src/components/ui/Spinner.tsx`
- Create: `apps/mobile/src/components/ui/TabStrip.tsx`

**Interfaces:**
- Produces:
  - `<Button variant="primary"|"ghost" onPress={fn} disabled? loading?>{label}</Button>`
  - `<Badge variant="accent"|"stone"|"red">{label}</Badge>`
  - `<Spinner size="sm"|"md"|"lg" />`
  - `<TabStrip tabs={string[]} active={number} onChange={fn} />`

- [ ] **Step 1: Write `apps/mobile/src/components/ui/Button.tsx`**

```tsx
import { Pressable, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  children: string;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const base = 'rounded px-4 py-2 flex-row items-center justify-center';
  const styles =
    variant === 'primary'
      ? `${base} bg-accent`
      : `${base} border border-stone-700`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${styles} ${disabled || loading ? 'opacity-40' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#0c0a09' : '#a8a29e'} />
      ) : (
        <Text
          className={`text-sm font-semibold ${
            variant === 'primary' ? 'text-stone-950' : 'text-stone-400'
          }`}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/src/components/ui/Badge.tsx`**

```tsx
import { View, Text } from 'react-native';

interface BadgeProps {
  children: string;
  variant?: 'accent' | 'stone' | 'red';
}

const variantClasses = {
  accent: 'bg-accent/20 border border-accent/40',
  stone: 'bg-stone-700',
  red: 'bg-red-900/40 border border-red-800/50',
};
const textClasses = {
  accent: 'text-accent',
  stone: 'text-stone-300',
  red: 'text-red-400',
};

export function Badge({ children, variant = 'stone' }: BadgeProps) {
  return (
    <View className={`rounded px-2 py-0.5 ${variantClasses[variant]}`}>
      <Text className={`text-xs font-semibold ${textClasses[variant]}`}>{children}</Text>
    </View>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/src/components/ui/Spinner.tsx`**

```tsx
import { ActivityIndicator, View } from 'react-native';

const sizes = { sm: 'small', md: 'large', lg: 'large' } as const;

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <View className="items-center justify-center py-8">
      <ActivityIndicator size={sizes[size]} color="#2f9e8f" />
    </View>
  );
}
```

- [ ] **Step 4: Write `apps/mobile/src/components/ui/TabStrip.tsx`**

```tsx
import { ScrollView, Pressable, Text } from 'react-native';

interface TabStripProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export function TabStrip({ tabs, active, onChange }: TabStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-b border-stone-800"
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {tabs.map((tab, i) => (
        <Pressable
          key={tab}
          onPress={() => onChange(i)}
          className="mr-6 py-3"
        >
          <Text
            className={`text-sm font-medium ${
              active === i
                ? 'text-stone-50 border-b-2 border-accent pb-2'
                : 'text-stone-400'
            }`}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 5: Verify**

No screen to test yet. Run `pnpm --filter @mh-datapedia/mobile typecheck` — should pass with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ui
git commit -m "feat(mobile): add base UI components (Button, Badge, Spinner, TabStrip)"
```

---

### Task 4: Monster list screen

**Files:**
- Create: `apps/mobile/src/components/monsters/MonsterCard.tsx`
- Create: `apps/mobile/src/components/monsters/TypeFilterChip.tsx`
- Create: `apps/mobile/app/monsters/index.tsx`

**Interfaces:**
- Consumes: `apiGet`, `Spinner`, `Badge`, `MonsterType` from shared
- Produces: tappable monster list that navigates to `/monsters/[id]`

- [ ] **Step 1: Write `apps/mobile/src/components/monsters/MonsterCard.tsx`**

```tsx
import { Pressable, View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'type' | 'iconUrl' | 'isBoss'>;
}

export function MonsterCard({ monster }: MonsterCardProps) {
  return (
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
}
```

- [ ] **Step 2: Write `apps/mobile/src/components/monsters/TypeFilterChip.tsx`**

```tsx
import { Pressable, Text } from 'react-native';

interface TypeFilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function TypeFilterChip({ label, active, onPress }: TypeFilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 px-3 py-1.5 rounded-full border ${
        active
          ? 'bg-accent/20 border-accent'
          : 'border-stone-700 bg-transparent'
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? 'text-accent' : 'text-stone-400'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/app/monsters/index.tsx`**

```tsx
import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  Text,
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

  const { data, isLoading, refetch, isRefetching } = useQuery({
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
    <View className="flex-1 bg-stone-950">
      {/* Search bar */}
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

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-stone-800 py-2"
        contentContainerStyle={{ paddingHorizontal: 16 }}
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

      {/* List */}
      {isLoading ? (
        <Spinner size="lg" />
      ) : monsters.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-500">No monsters found.</Text>
        </View>
      ) : (
        <FlatList
          data={monsters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MonsterCard monster={item} />}
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

- [ ] **Step 4: Verify**

Run `pnpm --filter @mh-datapedia/mobile dev`, scan QR. You should see:
- A search bar at the top
- A horizontal scroll row of type filter chips ("All", "Large", "ElderDragon", etc.)
- A list of monsters with icon, name, and type badge
- Tapping a monster navigates to a blank screen (detail not built yet)
- Pulling down triggers a refresh spinner in teal

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/monsters apps/mobile/app/monsters
git commit -m "feat(mobile): add monster list screen with search and type filters"
```

---

### Task 5: Monster detail screen

**Files:**
- Create: `apps/mobile/src/components/detail/OverviewTab.tsx`
- Create: `apps/mobile/src/components/detail/HitzonesTab.tsx`
- Create: `apps/mobile/src/components/detail/WeaknessesTab.tsx`
- Create: `apps/mobile/src/components/detail/DropsTab.tsx`
- Create: `apps/mobile/src/components/detail/StrategiesTab.tsx`
- Create: `apps/mobile/app/monsters/[id].tsx`

**Interfaces:**
- Consumes: `apiGet`, `TabStrip`, `Badge`, `Spinner`
- Consumes from API: `GET /api/monsters/:id` → `{ data: Monster }` where Monster has `weaknesses`, `hitzones`, `strategies` (with `author: { id, username }`), `ailments`, `drops`, `subspecies`, `parent`
- Produces: fully browsable monster detail with 5 tabs

Note on types: The `Strategy` from shared doesn't include `author`. Define a local `StrategyWithAuthor` type in the detail screen file.

- [ ] **Step 1: Write `apps/mobile/src/components/detail/OverviewTab.tsx`**

```tsx
import { ScrollView, View, Text } from 'react-native';
import { router } from 'expo-router';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

type SubspeciesRef = { id: string; name: string };
type ParentRef = { id: string; name: string } | null;

interface Props {
  monster: Pick<Monster, 'description' | 'habitats' | 'ailments' | 'isBoss'> & {
    subspecies: SubspeciesRef[];
    parent: ParentRef;
  };
}

export function OverviewTab({ monster }: Props) {
  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      {monster.isBoss && (
        <View className="mb-3">
          <Badge variant="red">Boss</Badge>
        </View>
      )}

      <Text className="text-stone-50 text-base leading-6 mb-4">{monster.description}</Text>

      {monster.habitats.length > 0 && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Habitats</Text>
          <View className="flex-row flex-wrap gap-2">
            {monster.habitats.map((h) => (
              <Badge key={h} variant="stone">{h}</Badge>
            ))}
          </View>
        </View>
      )}

      {monster.ailments.length > 0 && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Ailments</Text>
          <View className="flex-row flex-wrap gap-2">
            {monster.ailments.map((a) => (
              <Badge key={a.id} variant="stone">{a.ailment}</Badge>
            ))}
          </View>
        </View>
      )}

      {monster.parent && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Base Species</Text>
          <Text
            className="text-accent text-sm"
            onPress={() => router.push(`/monsters/${monster.parent!.id}`)}
          >
            {monster.parent.name}
          </Text>
        </View>
      )}

      {monster.subspecies.length > 0 && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Subspecies</Text>
          <View className="flex-row flex-wrap gap-2">
            {monster.subspecies.map((s) => (
              <Text
                key={s.id}
                className="text-accent text-sm"
                onPress={() => router.push(`/monsters/${s.id}`)}
              >
                {s.name}
              </Text>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/src/components/detail/HitzonesTab.tsx`**

```tsx
import { ScrollView, View, Text } from 'react-native';

interface Hitzone {
  id: string;
  part: string;
  cut: number;
  blunt: number;
  bullet: number;
  fire: number;
  water: number;
  thunder: number;
  ice: number;
  dragon: number;
  stun: number;
}

const COLS = ['Cut', 'Blunt', 'Blt', 'Fire', 'Wtr', 'Thd', 'Ice', 'Drg', 'Stun'] as const;
const KEYS: (keyof Omit<Hitzone, 'id' | 'part'>)[] = [
  'cut', 'blunt', 'bullet', 'fire', 'water', 'thunder', 'ice', 'dragon', 'stun',
];

function valueColor(v: number): string {
  if (v >= 60) return 'text-red-400';
  if (v >= 40) return 'text-yellow-500';
  return 'text-stone-400';
}

export function HitzonesTab({ hitzones }: { hitzones: Hitzone[] }) {
  if (hitzones.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-stone-500">No hitzone data.</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header row */}
        <View className="flex-row border-b border-stone-700 px-2 py-2">
          <Text className="text-stone-400 text-xs w-28 font-medium">Part</Text>
          {COLS.map((col) => (
            <Text key={col} className="text-stone-400 text-xs w-10 text-center font-medium">
              {col}
            </Text>
          ))}
        </View>
        {/* Data rows */}
        {hitzones.map((hz) => (
          <View key={hz.id} className="flex-row border-b border-stone-800 px-2 py-2">
            <Text className="text-stone-200 text-xs w-28">{hz.part}</Text>
            {KEYS.map((key) => (
              <Text key={key} className={`text-xs w-10 text-center ${valueColor(hz[key] as number)}`}>
                {hz[key]}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/src/components/detail/WeaknessesTab.tsx`**

```tsx
import { ScrollView, View, Text } from 'react-native';

interface Weakness {
  id: string;
  element: string;
  rating: number;
  isImmune: boolean;
}

const ELEMENT_EMOJI: Record<string, string> = {
  Fire: '🔥', Water: '💧', Thunder: '⚡', Ice: '❄️', Dragon: '🐉',
  Poison: '☠️', Sleep: '💤', Paralysis: '⚡', Blast: '💥', Stun: '💫',
};

export function WeaknessesTab({ weaknesses }: { weaknesses: Weakness[] }) {
  if (weaknesses.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-stone-500">No weakness data.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      {weaknesses.map((w) => (
        <View
          key={w.id}
          className="flex-row items-center py-3 border-b border-stone-800"
        >
          <Text className="text-lg w-8">{ELEMENT_EMOJI[w.element] ?? '•'}</Text>
          <Text className="text-stone-200 text-sm flex-1 ml-2">{w.element}</Text>
          {w.isImmune ? (
            <Text className="text-stone-500 text-xs">Immune</Text>
          ) : (
            <Text className="text-accent text-sm">{'★'.repeat(w.rating)}{'☆'.repeat(3 - w.rating)}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Write `apps/mobile/src/components/detail/DropsTab.tsx`**

```tsx
import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { TypeFilterChip } from '../monsters/TypeFilterChip';
import type { MHGame, Rank } from '@mh-datapedia/shared';

interface Drop {
  id: string;
  game: MHGame;
  rank: Rank;
  method: string;
  part: string | null;
  itemName: string;
  quantity: number;
  rate: number;
}

const GAME_LABELS: Record<MHGame, string> = {
  MONSTER_HUNTER_WORLD: 'World',
  MONSTER_HUNTER_WORLD_ICEBORNE: 'Iceborne',
  MONSTER_HUNTER_RISE: 'Rise',
  MONSTER_HUNTER_RISE_SUNBREAK: 'Sunbreak',
  MONSTER_HUNTER_WILDS: 'Wilds',
};

const RANK_LABELS: Record<Rank, string> = {
  LowRank: 'LR',
  HighRank: 'HR',
  MasterRank: 'MR',
};

export function DropsTab({ drops }: { drops: Drop[] }) {
  const games = [...new Set(drops.map((d) => d.game))] as MHGame[];
  const [activeGame, setActiveGame] = useState<MHGame | null>(games[0] ?? null);
  const [activeRank, setActiveRank] = useState<Rank | null>(null);

  const filtered = drops.filter(
    (d) =>
      (!activeGame || d.game === activeGame) &&
      (!activeRank || d.rank === activeRank),
  );

  const ranks = [...new Set(drops.filter((d) => !activeGame || d.game === activeGame).map((d) => d.rank))] as Rank[];

  if (drops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-stone-500">No drop data.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Game filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-3 border-b border-stone-800"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {games.map((g) => (
          <TypeFilterChip
            key={g}
            label={GAME_LABELS[g]}
            active={activeGame === g}
            onPress={() => { setActiveGame(g); setActiveRank(null); }}
          />
        ))}
      </ScrollView>

      {/* Rank filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-2 border-b border-stone-800"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <TypeFilterChip
          label="All Ranks"
          active={activeRank === null}
          onPress={() => setActiveRank(null)}
        />
        {ranks.map((r) => (
          <TypeFilterChip
            key={r}
            label={RANK_LABELS[r]}
            active={activeRank === r}
            onPress={() => setActiveRank(r)}
          />
        ))}
      </ScrollView>

      {/* Drop rows */}
      {filtered.map((d) => (
        <View key={d.id} className="flex-row items-center px-4 py-3 border-b border-stone-800">
          <View className="flex-1">
            <Text className="text-stone-100 text-sm font-medium">{d.itemName}</Text>
            <Text className="text-stone-500 text-xs mt-0.5">
              {d.method}{d.part ? ` · ${d.part}` : ''} · {RANK_LABELS[d.rank]}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-accent text-sm font-semibold">{d.rate}%</Text>
            {d.quantity > 1 && (
              <Text className="text-stone-500 text-xs">×{d.quantity}</Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 5: Write `apps/mobile/src/components/detail/StrategiesTab.tsx`**

```tsx
import { ScrollView, View, Text } from 'react-native';
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

export function StrategiesTab({ strategies }: { strategies: StrategyWithAuthor[] }) {
  if (strategies.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-stone-500">No strategies yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      {strategies.map((s) => (
        <View key={s.id} className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-4">
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
    </ScrollView>
  );
}
```

- [ ] **Step 6: Write `apps/mobile/app/monsters/[id].tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiGet } from '../../src/lib/api';
import { TabStrip } from '../../src/components/ui/TabStrip';
import { Spinner } from '../../src/components/ui/Spinner';
import { Badge } from '../../src/components/ui/Badge';
import { OverviewTab } from '../../src/components/detail/OverviewTab';
import { HitzonesTab } from '../../src/components/detail/HitzonesTab';
import { WeaknessesTab } from '../../src/components/detail/WeaknessesTab';
import { DropsTab } from '../../src/components/detail/DropsTab';
import { StrategiesTab } from '../../src/components/detail/StrategiesTab';

const TABS = ['Overview', 'Hitzones', 'Weaknesses', 'Drops', 'Strategies'];

export default function MonsterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['monster', id],
    queryFn: () => apiGet<{ data: any }>(`/api/monsters/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  // Set header title once we have the monster name
  useEffect(() => {
    if (data?.name) {
      navigation.setOptions({ headerTitle: data.name });
    }
  }, [data?.name, navigation]);

  if (isLoading || !data) {
    return (
      <View className="flex-1 bg-stone-950 justify-center">
        <Spinner size="lg" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-stone-950">
      {/* Hero image */}
      {data.imageUrl ? (
        <Image
          source={{ uri: data.imageUrl }}
          className="w-full"
          style={{ aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />
      ) : (
        <View className="w-full bg-stone-900 items-center justify-center" style={{ aspectRatio: 16 / 9 }}>
          <Text className="text-stone-600 text-lg">{data.name}</Text>
        </View>
      )}

      {/* Name + title + boss badge */}
      <View className="px-4 pt-3 pb-2 flex-row items-start">
        <View className="flex-1">
          <Text className="text-stone-50 text-xl font-bold">{data.name}</Text>
          <Text className="text-stone-400 text-sm">{data.title}</Text>
        </View>
        {data.isBoss && <Badge variant="red">Boss</Badge>}
      </View>

      {/* Tab strip */}
      <TabStrip tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 0 && (
          <OverviewTab
            monster={{
              description: data.description,
              habitats: data.habitats,
              ailments: data.ailments,
              isBoss: data.isBoss,
              subspecies: data.subspecies,
              parent: data.parent,
            }}
          />
        )}
        {activeTab === 1 && <HitzonesTab hitzones={data.hitzones} />}
        {activeTab === 2 && <WeaknessesTab weaknesses={data.weaknesses} />}
        {activeTab === 3 && <DropsTab drops={data.drops} />}
        {activeTab === 4 && <StrategiesTab strategies={data.strategies} />}
      </View>
    </View>
  );
}
```

- [ ] **Step 7: Verify**

Run `pnpm --filter @mh-datapedia/mobile dev`, scan QR. Tap any monster in the list. You should see:
- Monster image (or placeholder) in 16:9 ratio
- Name + title + optional Boss badge
- Tab strip with 5 tabs
- Overview: description, habitats chips, ailments, parent/subspecies links
- Hitzones: horizontal-scrollable table with color-coded values
- Weaknesses: element + star rating list
- Drops: game/rank filters, item list with rates
- Strategies: strategy cards or empty state

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/detail apps/mobile/app/monsters/\[id\].tsx
git commit -m "feat(mobile): add monster detail screen with 5-tab layout"
```

---

### Task 6: Auth screens

**Files:**
- Create: `apps/mobile/app/auth/login.tsx`
- Create: `apps/mobile/app/auth/register.tsx`

**Interfaces:**
- Consumes: `useAuth()` — `login(email, password)`, `register(email, username, password)`
- Produces: login and register modal screens that store the access token and update the header on success

- [ ] **Step 1: Write `apps/mobile/app/auth/login.tsx`**

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Button } from '../../src/components/ui/Button';
import { ApiError } from '../../src/lib/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-8 pb-6">
          {error ? (
            <View className="bg-red-900/30 border border-red-800/50 rounded px-4 py-3 mb-4">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          ) : null}

          <Text className="text-stone-400 text-sm mb-1">Email</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="you@example.com"
            placeholderTextColor="#78716c"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text className="text-stone-400 text-sm mb-1">Password</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-6"
            placeholder="••••••••"
            placeholderTextColor="#78716c"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Button onPress={handleLogin} loading={loading}>
            Sign In
          </Button>

          <Pressable
            onPress={() => router.replace('/auth/register')}
            className="mt-4 items-center"
          >
            <Text className="text-stone-400 text-sm">
              Don't have an account?{' '}
              <Text className="text-accent">Register</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/app/auth/register.tsx`**

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Button } from '../../src/components/ui/Button';
import { ApiError } from '../../src/lib/api';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    if (!username || !email || !password || !confirm) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) {
      setError('Username must be 3+ characters: letters, numbers, _ or -');
      return;
    }
    setLoading(true);
    try {
      await register(email, username, password);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Email or username already taken.');
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-8 pb-6">
          {error ? (
            <View className="bg-red-900/30 border border-red-800/50 rounded px-4 py-3 mb-4">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          ) : null}

          <Text className="text-stone-400 text-sm mb-1">Username</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="HunterName123"
            placeholderTextColor="#78716c"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text className="text-stone-400 text-sm mb-1">Email</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="you@example.com"
            placeholderTextColor="#78716c"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text className="text-stone-400 text-sm mb-1">Password</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="••••••••"
            placeholderTextColor="#78716c"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />

          <Text className="text-stone-400 text-sm mb-1">Confirm Password</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-6"
            placeholder="••••••••"
            placeholderTextColor="#78716c"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <Button onPress={handleRegister} loading={loading}>
            Create Account
          </Button>

          <Pressable
            onPress={() => router.replace('/auth/login')}
            className="mt-4 items-center"
          >
            <Text className="text-stone-400 text-sm">
              Already have an account?{' '}
              <Text className="text-accent">Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 3: Verify**

Run `pnpm --filter @mh-datapedia/mobile dev`. Tap "Login" in the header. You should see:
- Login modal slides up from the bottom
- Email + password fields, "Sign In" button, "Register" link
- Enter `testadmin@mhdatapedia.dev` / `Admin1234!` → modal closes, header now shows "Logout" button
- Press Logout → header shows "Login" again
- Tap Login again → tap "Register" link → Register screen slides in with 4 fields + "Create Account"
- Enter mismatched passwords → error "Passwords do not match." appears in red

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/auth
git commit -m "feat(mobile): add login and register modal screens"
```

---

### Task 7: EAS setup and device handoff

**Files:**
- Create: `apps/mobile/eas.json`

**Interfaces:**
- Produces: standalone APK installable on Android without Expo Go

- [ ] **Step 1: Install EAS CLI globally**

```bash
npm install -g eas-cli
eas --version  # should print a version
```

- [ ] **Step 2: Log in to Expo account**

```bash
eas login
```

Enter your Expo account credentials (create one at expo.dev if needed).

- [ ] **Step 3: Initialize EAS for the project**

```bash
cd apps/mobile
eas build:configure
```

When prompted "Which platforms would you like to configure for EAS Build?", select **Android**. This creates `eas.json`.

- [ ] **Step 4: Replace `apps/mobile/eas.json`** with explicit profile configuration

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

- [ ] **Step 5: Build a preview APK**

```bash
cd apps/mobile
eas build --platform android --profile preview
```

This uploads the project to Expo's build servers and compiles a standalone APK (no Expo Go needed). It takes ~5-10 minutes. When done it prints a download URL.

Expected output ends with something like:
```
✓ Build finished
Download the APK at: https://expo.dev/artifacts/eas/...
```

- [ ] **Step 6: Install on your Android phone**

Options (use whichever is convenient):
- **Option A — QR link**: The EAS build page at expo.dev shows a QR code for the download URL. Scan it with your phone camera and install the APK.
- **Option B — USB**: Download the APK to your PC, connect your phone via USB with "File Transfer" mode, copy the APK to the phone, open it with the Files app to install.
- **Option C — Email**: Download the APK and email it to yourself, open on phone.

On the phone, if prompted "Install from unknown sources", go to Settings → Apps → Special app access → Install unknown apps and allow for your browser/Files app.

- [ ] **Step 7: Verify on device without Expo Go**

Open the installed "MH Datapedia" app. Verify:
- App opens to the monster list (no QR code, no Expo Go needed)
- Search and type filters work
- Tap a monster → detail screen with all 5 tabs
- Header Login button opens the login modal
- Login with `testadmin@mhdatapedia.dev` / `Admin1234!` → header updates to show Logout

- [ ] **Step 8: Commit eas.json**

```bash
git add apps/mobile/eas.json
git commit -m "feat(mobile): add EAS build configuration for Android"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Expo managed workflow in Turborepo | Task 1 |
| NativeWind v4 with accent `#2f9e8f` tokens | Task 1 |
| Expo Router file-based navigation | Task 1 |
| `src/lib/api.ts` — fetch + Bearer + 401 handling | Task 2 |
| `src/lib/storage.ts` — SecureStore wrapper | Task 2 |
| `AuthContext` — login/register/logout/restore | Task 2 |
| Root layout with header (title + auth button) | Task 2 |
| `Button`, `Badge`, `Spinner`, `TabStrip` components | Task 3 |
| Monster list with search + type filters + FlatList | Task 4 |
| Pull-to-refresh | Task 4 |
| `MonsterCard` with icon, name, type badge | Task 4 |
| Monster detail — hero image + name/title | Task 5 |
| Overview tab — description, habitats, ailments, parent/subspecies | Task 5 |
| Hitzones tab — scrollable table, color-coded values | Task 5 |
| Weaknesses tab — element + star rating | Task 5 |
| Drops tab — game/rank filter chips + drop list | Task 5 |
| Strategies tab — strategy cards with author + empty state | Task 5 |
| Login modal — email/password, error handling | Task 6 |
| Register modal — 4 fields, password match validation | Task 6 |
| No silent refresh — 401 clears token + redirects | Task 2 (api.ts) |
| EAS preview APK + device testing instructions | Task 7 |

All spec requirements covered. No gaps.

**Placeholder scan:** No TBD, TODO, or "implement later" found. All steps contain working code.

**Type consistency check:** `useAuth()` defined in Task 2 → consumed in Tasks 4, 6. `apiGet/apiPost` defined in Task 2 → consumed in Tasks 4, 5, 6. `Badge`/`Spinner`/`TabStrip`/`Button` defined in Task 3 → consumed in Tasks 4, 5, 6. `StrategyWithAuthor` defined locally in `StrategiesTab.tsx` (Task 5) — not exported, no cross-task type dependency. All consistent.
