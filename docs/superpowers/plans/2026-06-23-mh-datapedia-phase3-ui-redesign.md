# Phase 3 Sub-Spec A: UI Redesign + Auth Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the visual foundation — dynamic tab titles, panel monster cards, two-row filter chips, header-less detail screen, and glassmorphism login/register bottom sheets replacing the navigation screens.

**Architecture:** Six sequential tasks. Tasks 1–4 are isolated visual changes. Task 5 creates the auth sheet components and context. Task 6 wires everything up and deletes the old auth screens.

**Tech Stack:** Expo SDK 56, Expo Router v4, NativeWind v4.2.6, TanStack Query v5, @gorhom/bottom-sheet v5, react-native-gesture-handler v2, react-native-reanimated v4.

## Global Constraints

- Expo SDK 56, managed workflow, Expo Router v4, NativeWind v4.2.6
- `jsxImportSource: 'nativewind'` — use explicit `style={{}}` for all layout-critical containers; `className` is safe only on leaf text/badge nodes
- Horizontal chip `ScrollView`: always `style={{ height: 44 }}` + `contentContainerStyle={{ height: 44, alignItems: 'center', ... }}`
- Color tokens: accent `#2f9e8f`, bg `#0c0a09`, panel `#1c1917`, border `#292524`, inactive `#57534e`, text-secondary `#a8a29e`, red `#ef4444`
- `Ionicons` from `@expo/vector-icons` for all icons
- `@gorhom/bottom-sheet` v5 already installed; `BottomSheetModalProvider` already wraps the app in `app/_layout.tsx`
- No new packages to install — `expo-blur` is available in SDK 56 managed workflow without install
- Verification command: `pnpm --filter mobile typecheck` — must return 0 errors after each task
- Android only

---

### Task 1: Dynamic AppTitle

**Files:**
- Modify: `apps/mobile/src/components/ui/AppHeader.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- Produces: `AppTitle({ label: string })` — used by tabs layout and (in Task 6) the admin tab

- [ ] **Step 1: Update AppTitle to accept a label prop**

Replace the entire `AppTitle` function in `apps/mobile/src/components/ui/AppHeader.tsx`:

```tsx
export function AppTitle({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: '#2f9e8f', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>
        MH{' '}
      </Text>
      <Text style={{ color: '#fafaf9', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Pass labels in the tabs layout**

In `apps/mobile/app/(tabs)/_layout.tsx`, update both `headerTitle` callbacks:

```tsx
// index screen
headerTitle: () => <AppTitle label="Monsters" />,

// favorites screen
headerTitle: () => <AppTitle label="Favorites" />,
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```
git add apps/mobile/src/components/ui/AppHeader.tsx apps/mobile/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): dynamic AppTitle per tab"
```

---

### Task 2: Panel MonsterCard

**Files:**
- Modify: `apps/mobile/src/components/monsters/MonsterCard.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx` (update Pick to include `title` + `isBoss`)
- Modify: `apps/mobile/app/(tabs)/favorites.tsx` (same Pick update)

**Interfaces:**
- Consumes: `Monster` from `@mh-datapedia/shared` — uses `id`, `name`, `title`, `type`, `isBoss`
- `isBoss: boolean` and `title: string` are already returned by `GET /api/monsters` (no API change)
- Produces: `MonsterCard` with panel style used in `index.tsx` and `favorites.tsx`

- [ ] **Step 1: Rewrite MonsterCard**

Replace `apps/mobile/src/components/monsters/MonsterCard.tsx` entirely:

```tsx
import { useRef } from 'react';
import { Pressable, View, Text } from 'react-native';
import { router } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'title' | 'type' | 'isBoss'>;
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
          borderRadius: 12,
          marginVertical: 6,
          marginRight: 12,
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
      style={{
        backgroundColor: '#1c1917',
        borderRadius: 12,
        marginHorizontal: 12,
        marginVertical: 6,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: '#fafaf9', fontSize: 16, fontWeight: 'bold' }}>
          {monster.name}
        </Text>
        <Text style={{ color: '#a8a29e', fontSize: 13 }}>{monster.title}</Text>
        <View style={{ marginTop: 4 }}>
          <Badge variant="accent">{monster.type}</Badge>
        </View>
      </View>
      {monster.isBoss && (
        <Ionicons name="shield" size={16} color="#2f9e8f" style={{ marginTop: 2 }} />
      )}
    </Pressable>
  );

  if (!onFavoriteToggle) return card;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
    >
      {card}
    </Swipeable>
  );
}
```

- [ ] **Step 2: Update Pick in index.tsx**

In `apps/mobile/app/(tabs)/index.tsx`, change the `renderItem` in FlatList:

```tsx
renderItem={({ item }) => (
  <MonsterCard
    monster={item}  // item already has title + isBoss from the API response
    isFavorited={user ? isFavorited(item.id) : undefined}
    onFavoriteToggle={
      user
        ? () => toggle(item.id)
        : () => router.push('/auth/login')
    }
  />
)}
```

No change needed to the query — `GET /api/monsters` already returns all fields including `title` and `isBoss`.

- [ ] **Step 3: Update Pick in favorites.tsx**

In `apps/mobile/app/(tabs)/favorites.tsx`, the `MonsterCard` usage already receives the full `Monster` object from `useFavorites` — no change needed. But if TypeScript complains, confirm that `useFavorites` returns `Monster[]` (which includes `title` and `isBoss`).

- [ ] **Step 4: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```
git add apps/mobile/src/components/monsters/MonsterCard.tsx apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/favorites.tsx
git commit -m "feat(mobile): panel MonsterCard with name/title/badge, remove image placeholder"
```

---

### Task 3: Two-Row Filter Chips

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `TypeFilterChip` already imported; `activeType` state already exists
- No interface changes — purely a layout change

- [ ] **Step 1: Replace single-row chips with two rows**

In `apps/mobile/app/(tabs)/index.tsx`, replace the existing `MONSTER_TYPES` constant and single `ScrollView` chip bar.

First, replace the `MONSTER_TYPES` constant at the top of the file:

```tsx
const ROW1_TYPES: MonsterType[] = [
  'Large', 'Small', 'Apex', 'Afflicted', 'Tempered', 'ElderDragon', 'DemiElderDragon',
];
const ROW2_TYPES: MonsterType[] = [
  'FlyingWyvern', 'BruteWyvern', 'FangedBeast', 'Temnoceran', 'BirdWyvern',
  'Construct', 'Leviathan', 'Amphibian', 'Cephalopod', 'Machine',
];
```

Then replace the single chip `ScrollView` block with this two-row block:

```tsx
<View style={{ borderBottomWidth: 1, borderBottomColor: '#292524' }}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ height: 44 }}
    contentContainerStyle={{ height: 44, alignItems: 'center', paddingHorizontal: 16, gap: 8 }}
  >
    <TypeFilterChip
      label="All"
      active={activeType === null}
      onPress={() => setActiveType(null)}
    />
    {ROW1_TYPES.map((type) => (
      <TypeFilterChip
        key={type}
        label={type}
        active={activeType === type}
        onPress={() => handleTypePress(type)}
      />
    ))}
  </ScrollView>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ height: 44 }}
    contentContainerStyle={{ height: 44, alignItems: 'center', paddingHorizontal: 16, gap: 8 }}
  >
    {ROW2_TYPES.map((type) => (
      <TypeFilterChip
        key={type}
        label={type}
        active={activeType === type}
        onPress={() => handleTypePress(type)}
      />
    ))}
  </ScrollView>
</View>
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add apps/mobile/app/(tabs)/index.tsx
git commit -m "feat(mobile): two-row filter chip bar on monsters tab"
```

---

### Task 4: Header-less Detail Screen

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/monsters/[id].tsx`

**Interfaces:**
- No interface changes — purely visual restructuring of the detail screen

- [ ] **Step 1: Disable the navigation header for the detail screen**

In `apps/mobile/app/_layout.tsx`, change the `monsters/[id]` Stack.Screen from:

```tsx
<Stack.Screen name="monsters/[id]" options={{ title: '' }} />
```

to:

```tsx
<Stack.Screen name="monsters/[id]" options={{ headerShown: false }} />
```

- [ ] **Step 2: Remove hero image and navigation header wiring from detail screen**

In `apps/mobile/app/monsters/[id].tsx`:

**2a. Remove these imports:**
```tsx
import { useState, useEffect, useRef } from 'react';   // remove useEffect
import { View, Text, Image, ScrollView, Pressable } from 'react-native';  // remove Image
import { useLocalSearchParams, useNavigation, router } from 'expo-router';  // remove useNavigation
```

**2b. Updated imports:**
```tsx
import { useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
```

**2c. Remove `useNavigation` and the `useEffect`:**

Delete these lines from inside `MonsterDetailScreen`:
```tsx
const navigation = useNavigation();
// ...
useEffect(() => {
  if (data?.name) {
    navigation.setOptions({ headerTitle: data.name });
  }
}, [data?.name, navigation]);
```

**2d. Remove the hero image block:**

Delete the entire `{/* Hero image */}` comment and the block it precedes:
```tsx
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
```

**2e. Add inline back navigation** immediately before the name/title row (inside the `ScrollView`, as the first child):

```tsx
{/* Back navigation */}
<Pressable
  onPress={() => router.back()}
  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}
>
  <Ionicons name="arrow-back" size={16} color="#a8a29e" />
  <Text style={{ color: '#a8a29e', fontSize: 14, marginLeft: 6 }}>Monsters</Text>
</Pressable>
```

The result: the `ScrollView` children are now: back link → name/title row → TabStrip → tab content.

- [ ] **Step 3: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```
git add apps/mobile/app/_layout.tsx apps/mobile/app/monsters/[id].tsx
git commit -m "feat(mobile): remove hero image, inline back nav on detail screen"
```

---

### Task 5: AuthSheetContext + LoginSheet + RegisterSheet

**Files:**
- Create: `apps/mobile/src/context/AuthSheetContext.tsx`
- Create: `apps/mobile/src/components/auth/LoginSheet.tsx`
- Create: `apps/mobile/src/components/auth/RegisterSheet.tsx`

**Interfaces:**
- Produces:
  - `AuthSheetProvider` — wraps children, mounts both sheets
  - `useAuthSheet()` — returns `{ openLoginSheet: () => void, openRegisterSheet: () => void }`
  - `LoginSheet` — `forwardRef<BottomSheetModal, { onSwitchToRegister: () => void }>`
  - `RegisterSheet` — `forwardRef<BottomSheetModal, { onSwitchToLogin: () => void }>`

- [ ] **Step 1: Create AuthSheetContext**

Create `apps/mobile/src/context/AuthSheetContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useRef } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { LoginSheet } from '../components/auth/LoginSheet';
import { RegisterSheet } from '../components/auth/RegisterSheet';

interface AuthSheetContextValue {
  openLoginSheet: () => void;
  openRegisterSheet: () => void;
}

const AuthSheetContext = createContext<AuthSheetContextValue>({
  openLoginSheet: () => {},
  openRegisterSheet: () => {},
});

export function AuthSheetProvider({ children }: { children: React.ReactNode }) {
  const loginRef = useRef<BottomSheetModal>(null);
  const registerRef = useRef<BottomSheetModal>(null);

  const openLoginSheet = useCallback(() => {
    registerRef.current?.dismiss();
    loginRef.current?.present();
  }, []);

  const openRegisterSheet = useCallback(() => {
    loginRef.current?.dismiss();
    registerRef.current?.present();
  }, []);

  return (
    <AuthSheetContext.Provider value={{ openLoginSheet, openRegisterSheet }}>
      {children}
      <LoginSheet ref={loginRef} onSwitchToRegister={openRegisterSheet} />
      <RegisterSheet ref={registerRef} onSwitchToLogin={openLoginSheet} />
    </AuthSheetContext.Provider>
  );
}

export function useAuthSheet() {
  return useContext(AuthSheetContext);
}
```

- [ ] **Step 2: Create LoginSheet**

Create `apps/mobile/src/components/auth/LoginSheet.tsx`:

```tsx
import { forwardRef, useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

interface LoginSheetProps {
  onSwitchToRegister: () => void;
}

export const LoginSheet = forwardRef<BottomSheetModal, LoginSheetProps>(
  ({ onSwitchToRegister }, ref) => {
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
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
        setEmail('');
        setPassword('');
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

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.7}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['62%']}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDiamond}>◆</Text>
            <Text style={styles.headerTitle}>Hunter Login</Text>
            <View style={styles.headerLine} />
          </View>

          <Text style={styles.subtitle}>
            Sign in to save favorites and manage data.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BottomSheetTextInput
            placeholder="Email"
            placeholderTextColor="#57534e"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            style={styles.input}
          />

          <BottomSheetTextInput
            placeholder="Password"
            placeholderTextColor="#57534e"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            style={styles.input}
          />

          <Pressable onPress={onSwitchToRegister} style={styles.switchLink}>
            <Text style={styles.switchText}>
              No account?{' '}
              <Text style={styles.switchAccent}>Register</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.button, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDiamond: { color: '#2f9e8f', fontSize: 14 },
  headerTitle: { color: '#fafaf9', fontSize: 15, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
  headerLine: { flex: 1, height: 1, backgroundColor: '#292524', marginLeft: 8 },
  subtitle: { color: '#a8a29e', fontSize: 13 },
  errorText: { color: '#ef4444', fontSize: 13 },
  input: {
    backgroundColor: '#0c0a09',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fafaf9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#292524',
  },
  switchLink: { alignItems: 'center' },
  switchText: { color: '#57534e', fontSize: 13 },
  switchAccent: { color: '#2f9e8f' },
  button: {
    backgroundColor: '#2f9e8f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
```

- [ ] **Step 3: Create RegisterSheet**

Create `apps/mobile/src/components/auth/RegisterSheet.tsx`:

```tsx
import { forwardRef, useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

interface RegisterSheetProps {
  onSwitchToLogin: () => void;
}

export const RegisterSheet = forwardRef<BottomSheetModal, RegisterSheetProps>(
  ({ onSwitchToLogin }, ref) => {
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
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
        setUsername(''); setEmail(''); setPassword(''); setConfirm('');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setError('Email or username already taken.');
        } else if (e instanceof ApiError && (e.body as { message?: string })?.message) {
          setError((e.body as { message: string }).message);
        } else {
          setError('Something went wrong. Try again.');
        }
      } finally {
        setLoading(false);
      }
    }

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.7}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['80%']}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDiamond}>◆</Text>
            <Text style={styles.headerTitle}>Hunter Register</Text>
            <View style={styles.headerLine} />
          </View>

          <Text style={styles.subtitle}>
            Create an account to save favorites and submit strategies.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BottomSheetTextInput
            placeholder="Username"
            placeholderTextColor="#57534e"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Email"
            placeholderTextColor="#57534e"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Password"
            placeholderTextColor="#57534e"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Confirm Password"
            placeholderTextColor="#57534e"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            style={styles.input}
          />

          <Pressable onPress={onSwitchToLogin} style={styles.switchLink}>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchAccent}>Sign in</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.button, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDiamond: { color: '#2f9e8f', fontSize: 14 },
  headerTitle: { color: '#fafaf9', fontSize: 15, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
  headerLine: { flex: 1, height: 1, backgroundColor: '#292524', marginLeft: 8 },
  subtitle: { color: '#a8a29e', fontSize: 13 },
  errorText: { color: '#ef4444', fontSize: 13 },
  input: {
    backgroundColor: '#0c0a09',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fafaf9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#292524',
  },
  switchLink: { alignItems: 'center' },
  switchText: { color: '#57534e', fontSize: 13 },
  switchAccent: { color: '#2f9e8f' },
  button: {
    backgroundColor: '#2f9e8f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
```

- [ ] **Step 4: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```
git add apps/mobile/src/context/AuthSheetContext.tsx apps/mobile/src/components/auth/LoginSheet.tsx apps/mobile/src/components/auth/RegisterSheet.tsx
git commit -m "feat(mobile): AuthSheetContext, LoginSheet, RegisterSheet bottom sheets"
```

---

### Task 6: Wire Auth Sheets + Delete Old Screens

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/src/components/ui/AppHeader.tsx`
- Modify: `apps/mobile/app/(tabs)/favorites.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/monsters/[id].tsx`
- Delete: `apps/mobile/app/auth/login.tsx`
- Delete: `apps/mobile/app/auth/register.tsx`

**Interfaces:**
- Consumes: `useAuthSheet()` → `{ openLoginSheet, openRegisterSheet }` from Task 5
- All existing `router.push('/auth/login')` calls replaced with `openLoginSheet()`

- [ ] **Step 1: Add AuthSheetProvider to _layout.tsx and remove auth Stack.Screens**

Replace the full `_layout.tsx` with:

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
import { AuthSheetProvider } from '../src/context/AuthSheetContext';

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
      <Stack.Screen name="monsters/[id]" options={{ headerShown: false }} />
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
            <AuthSheetProvider>
              <StatusBar style="light" />
              <RootStack />
            </AuthSheetProvider>
          </BottomSheetModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Update AppHeader — Login button opens sheet**

In `apps/mobile/src/components/ui/AppHeader.tsx`:

Add import at the top:
```tsx
import { useAuthSheet } from '../../context/AuthSheetContext';
```

In `HeaderRight`, replace `router.push('/auth/login')` with `openLoginSheet()`:

```tsx
export function HeaderRight() {
  const { user, logout } = useAuth();
  const { openLoginSheet } = useAuthSheet();

  if (user) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
        <Text style={{ color: '#a8a29e', fontSize: 14 }}>{user.username}</Text>
        <Pressable
          onPress={logout}
          style={{ borderWidth: 1, borderColor: '#57534e', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 4 }}
        >
          <Text style={{ color: '#a8a29e', fontSize: 14 }}>Logout</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
      <Pressable
        onPress={openLoginSheet}
        style={{ borderWidth: 1, borderColor: '#57534e', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 4 }}
      >
        <Text style={{ color: '#a8a29e', fontSize: 14 }}>Login</Text>
      </Pressable>
    </View>
  );
}
```

Also remove the `router` import from `AppHeader.tsx` if it is no longer used.

- [ ] **Step 3: Update favorites.tsx — Sign In button opens sheet**

In `apps/mobile/app/(tabs)/favorites.tsx`:

Add import:
```tsx
import { useAuthSheet } from '../../src/context/AuthSheetContext';
```

In the component body:
```tsx
const { openLoginSheet } = useAuthSheet();
```

Replace `() => router.push('/auth/login')` with `openLoginSheet`:
```tsx
<Button onPress={openLoginSheet}>Sign In</Button>
```

Remove the `router` import if no longer used.

- [ ] **Step 4: Update index.tsx — logged-out card toggle opens sheet**

In `apps/mobile/app/(tabs)/index.tsx`:

Add import:
```tsx
import { useAuthSheet } from '../../src/context/AuthSheetContext';
```

In the component body:
```tsx
const { openLoginSheet } = useAuthSheet();
```

Replace the `onFavoriteToggle` for logged-out state:
```tsx
onFavoriteToggle={
  user
    ? () => toggle(item.id)
    : openLoginSheet
}
```

Remove the `router` import if no longer used (check if `router.push` is still called anywhere else in the file — it's not, since card navigation uses `router.push` inside `MonsterCard` itself).

- [ ] **Step 5: Update [id].tsx — heart toggle when logged out opens sheet**

In `apps/mobile/app/monsters/[id].tsx`:

Add import:
```tsx
import { useAuthSheet } from '../../src/context/AuthSheetContext';
```

In the component body:
```tsx
const { openLoginSheet } = useAuthSheet();
```

Replace the heart `Pressable` onPress:
```tsx
onPress={() => {
  if (!user) {
    openLoginSheet();
    return;
  }
  toggle(id);
}}
```

Remove `router` import if no longer used.

- [ ] **Step 6: Delete old auth screens**

```
git rm apps/mobile/app/auth/login.tsx
git rm apps/mobile/app/auth/register.tsx
```

Also delete the `apps/mobile/app/auth/` directory if empty:
```
git rm -r apps/mobile/app/auth
```

- [ ] **Step 7: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```
git add -A
git commit -m "feat(mobile): wire auth sheets, remove navigation auth screens"
```
