# MH Datapedia Mobile — Phase 3 Sub-Spec A: UI Redesign + Auth Polish

## Goal

Overhaul the visual foundation of the mobile app: dynamic tab titles, panel-style monster cards, two-row filter chips, a header-less detail screen, and glassmorphism login/register bottom sheets.

## Scope

Five independent units delivered in one plan, in this order:

1. Dynamic `AppTitle` per tab
2. Panel `MonsterCard` (name + title + badge + boss crown, no image)
3. Two-row filter chip bar on the Monsters tab
4. Header-less detail screen with inline back navigation
5. Login/Register as `BottomSheetModal` sheets with blur backdrop

---

## Global Constraints

- Expo SDK 56, managed workflow, Expo Router v4, NativeWind v4.2.6
- NativeWind v4: `className` applies to `contentContainerStyle` on `ScrollView` — use explicit `style={{}}` for layout-critical containers
- Horizontal chip `ScrollView`: always `style={{ height: 44 }}` + `contentContainerStyle={{ height: 44, alignItems: 'center' }}`
- Color tokens: accent `#2f9e8f`, background `#0c0a09`, panel `#1c1917`, border `#292524`, inactive `#57534e`, red `#ef4444`
- `@expo/vector-icons` `Ionicons` for all icons; `expo-blur` `BlurView` for the auth sheet backdrop (both available in SDK 56, no install needed)
- `@gorhom/bottom-sheet` v5 already installed; `BottomSheetModalProvider` already at root
- pnpm@9 workspaces — install new packages with `pnpm --filter mobile add <pkg>`
- Android only

---

## Unit 1: Dynamic `AppTitle`

**File modified:** `apps/mobile/src/components/ui/AppHeader.tsx`

`AppTitle` currently renders "MH Datapedia" unconditionally. Change it to accept a `label` prop and render "MH {LABEL}":

```tsx
export function AppTitle({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: '#2f9e8f', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>MH </Text>
      <Text style={{ color: '#fafaf9', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}
```

**File modified:** `apps/mobile/app/(tabs)/_layout.tsx`

Each `Tabs.Screen` passes its own label:
- `index` → `headerTitle: () => <AppTitle label="Monsters" />`
- `favorites` → `headerTitle: () => <AppTitle label="Favorites" />`
- `admin` (Phase 3 Sub-spec B) → `headerTitle: () => <AppTitle label="Admin" />`

---

## Unit 2: Panel MonsterCard

**File modified:** `apps/mobile/src/components/monsters/MonsterCard.tsx`

Remove the image/icon placeholder. Add `title` and `isBoss` to the Pick. Render a panel card.

**New prop type:**
```tsx
interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'title' | 'type' | 'isBoss'>;
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
}
```

**Card layout** (the inner content, wrapped in the existing `Swipeable`):
```
┌──────────────────────────────────────────────┐
│  Name (bold, white, 16px)          [👑 crown] │
│  Title/epithet (stone-400, 13px)              │
│  [Type Badge]                                 │
└──────────────────────────────────────────────┘
```

The crown (`Ionicons name="shield" size={16} color="#2f9e8f"`) appears only when `isBoss` is true.

**Exact card JSX:**
```tsx
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
      <Text style={{ color: '#fafaf9', fontSize: 16, fontWeight: 'bold' }}>{monster.name}</Text>
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
```

The `Swipeable` wrapper and `onFavoriteToggle` logic remain unchanged from Phase 2.

**File modified:** `apps/mobile/app/(tabs)/index.tsx`

Update the `MonsterCard` usage to include `title` and `isBoss` in the data passed to the card. The query already returns these fields (no API change needed).

---

## Unit 3: Two-Row Filter Chips

**File modified:** `apps/mobile/app/(tabs)/index.tsx`

Replace the single-row `ScrollView` of filter chips with two rows. Each row is its own horizontal `ScrollView` with the fixed-height constraint.

**Row split (hardcoded constants):**
```tsx
const ROW1_TYPES = ['All', 'Large', 'Small', 'Apex', 'Afflicted', 'Tempered', 'ElderDragon', 'DemiElderDragon'];
const ROW2_TYPES = ['FlyingWyvern', 'BruteWyvern', 'FangedBeast', 'Temnoceran', 'BirdWyvern', 'Construct', 'Leviathan', 'Amphibian', 'Cephalopod', 'Machine'];
```

**Layout:**
```tsx
<View>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ height: 44 }}
    contentContainerStyle={{ height: 44, alignItems: 'center', paddingHorizontal: 12, gap: 8 }}
  >
    {ROW1_TYPES.map(type => <TypeFilterChip key={type} ... />)}
  </ScrollView>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ height: 44 }}
    contentContainerStyle={{ height: 44, alignItems: 'center', paddingHorizontal: 12, gap: 8 }}
  >
    {ROW2_TYPES.map(type => <TypeFilterChip key={type} ... />)}
  </ScrollView>
</View>
```

The active chip is whichever matches the current `selectedType` filter. The `TypeFilterChip` component is unchanged.

---

## Unit 4: Header-less Detail Screen

**File modified:** `apps/mobile/app/_layout.tsx`

Set `headerShown: false` on the `monsters/[id]` Stack.Screen:
```tsx
<Stack.Screen name="monsters/[id]" options={{ headerShown: false }} />
```

**File modified:** `apps/mobile/app/monsters/[id].tsx`

1. Remove the `useNavigation` import and the `useEffect` that calls `navigation.setOptions`.
2. Remove the hero image block entirely (the `if (data.imageUrl)` / `else` block that renders `Image` or the placeholder `View`).
3. Add an inline back link at the very top of the scroll content, before the name row:

```tsx
{/* Back navigation */}
<Pressable
  onPress={() => router.back()}
  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
>
  <Ionicons name="arrow-back" size={16} color="#a8a29e" />
  <Text style={{ color: '#a8a29e', fontSize: 14, marginLeft: 6 }}>Monsters</Text>
</Pressable>
```

Removing the hero image (16:9 aspect ratio placeholder) makes the overview content appear directly below the tab bar — no layout fix required.

---

## Unit 5: Login/Register Bottom Sheets

### Architecture

Replace the `app/auth/login.tsx` and `app/auth/register.tsx` navigation screens with `BottomSheetModal` components managed through a new `AuthSheetContext`. All callers that previously called `router.push('/auth/login')` call `openLoginSheet()` from context instead.

### Files

**Create:** `apps/mobile/src/context/AuthSheetContext.tsx`

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

**Modify:** `apps/mobile/app/_layout.tsx`

Add `AuthSheetProvider` wrapping inside `BottomSheetModalProvider` (and inside `AuthProvider` so `useAuth` works inside the sheets):

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BottomSheetModalProvider>
        <AuthSheetProvider>        {/* ← new */}
          <StatusBar ... />
          <Stack ... />
        </AuthSheetProvider>       {/* ← new */}
      </BottomSheetModalProvider>
    </AuthProvider>
  </QueryClientProvider>
</GestureHandlerRootView>
```

**Create:** `apps/mobile/src/components/auth/LoginSheet.tsx`

```tsx
import { forwardRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
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
      if (!email || !password) { setError('Email and password are required.'); return; }
      setLoading(true);
      try {
        await login(email, password);
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
        setEmail(''); setPassword('');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setError('Invalid email or password.');
        else setError('Something went wrong. Try again.');
      } finally {
        setLoading(false);
      }
    }

    const renderBackdrop = (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </BottomSheetBackdrop>
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['60%']}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#2f9e8f', fontSize: 16 }}>◆</Text>
            <Text style={{ color: '#fafaf9', fontSize: 16, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' }}>Hunter Login</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#292524', marginLeft: 8 }} />
          </View>
          <Text style={{ color: '#a8a29e', fontSize: 14 }}>Sign in to save favorites and manage data.</Text>

          {error ? <Text style={{ color: '#ef4444', fontSize: 13 }}>{error}</Text> : null}

          <BottomSheetTextInput
            placeholder="Email"
            placeholderTextColor="#57534e"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ backgroundColor: '#0c0a09', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#fafaf9', fontSize: 14, borderWidth: 1, borderColor: '#292524' }}
          />
          <BottomSheetTextInput
            placeholder="Password"
            placeholderTextColor="#57534e"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{ backgroundColor: '#0c0a09', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#fafaf9', fontSize: 14, borderWidth: 1, borderColor: '#292524' }}
          />

          {/* Switch to register */}
          <Pressable onPress={onSwitchToRegister}>
            <Text style={{ color: '#57534e', fontSize: 13, textAlign: 'center' }}>
              No account?{' '}
              <Text style={{ color: '#2f9e8f' }}>Register</Text>
            </Text>
          </Pressable>

          {/* Sign In button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={{ backgroundColor: '#2f9e8f', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>Sign In</Text>
            }
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  }
);
```

**Create:** `apps/mobile/src/components/auth/RegisterSheet.tsx`

Same structure as `LoginSheet` with:
- Header: `◆ HUNTER REGISTER`
- Subtitle: "Create an account to save favorites and submit strategies."
- Fields: Username, Email, Password (all `BottomSheetTextInput`)
- Link: "Already have an account? <Sign in>" → `onSwitchToLogin()`
- Button: "Create Account" → calls `register(username, email, password)` from `useAuth()`
- On success: dismiss sheet, clear fields

**Delete:** `apps/mobile/app/auth/login.tsx` and `apps/mobile/app/auth/register.tsx`

**Remove:** the `auth/login` and `auth/register` `Stack.Screen` entries from `apps/mobile/app/_layout.tsx`.

**Update all call sites** — replace `router.push('/auth/login')` with `openLoginSheet()` from `useAuthSheet()`:

| File | Change |
|---|---|
| `apps/mobile/src/components/ui/AppHeader.tsx` | Login button: `router.push('/auth/login')` → `openLoginSheet()` |
| `apps/mobile/app/(tabs)/favorites.tsx` | "Sign In" button: `router.push('/auth/login')` → `openLoginSheet()` |
| `apps/mobile/app/(tabs)/index.tsx` | Logged-out card toggle: `router.push('/auth/login')` → `openLoginSheet()` |
| `apps/mobile/app/monsters/[id].tsx` | Heart toggle (logged out): `router.push('/auth/login')` → `openLoginSheet()` |

---

## Phase 3 Preview — Sub-Spec B (Admin Panel)

Separate spec. Covered in `2026-06-23-mh-datapedia-phase3-admin-panel.md`.
