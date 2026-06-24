# Phase 3 Sub-Spec B: Admin Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ADMIN-only third tab that lists all users, shows role/ban stats, and lets admins promote, revoke, ban, or unban any user via a per-user action bottom sheet.

**Architecture:** Four tasks in sequence: data hook → UserCard component → UserActionSheet → AdminScreen + tab wiring. The screen composes the three preceding units. Sub-Spec A must be implemented first — this plan assumes `AppTitle` already accepts a `label` prop.

**Tech Stack:** Expo SDK 56, Expo Router v4, NativeWind v4.2.6, TanStack Query v5, @gorhom/bottom-sheet v5, @expo/vector-icons Ionicons.

## Global Constraints

- Sub-Spec A must be complete before running this plan (`AppTitle({ label })` is a dependency)
- Expo SDK 56, managed workflow, Expo Router v4, NativeWind v4.2.6
- Use explicit `style={{}}` for all layout-critical containers (NativeWind v4 `className` applies to `contentContainerStyle` on `ScrollView`)
- Color tokens: accent `#2f9e8f`, bg `#0c0a09`, panel `#1c1917`, border `#292524`, inactive `#57534e`, red `#ef4444`, text-primary `#fafaf9`, text-secondary `#a8a29e`
- `Ionicons` from `@expo/vector-icons` for all icons
- `@gorhom/bottom-sheet` v5 already installed; `BottomSheetModalProvider` already at root
- TanStack Query v5 — object syntax `{ queryKey, queryFn, enabled }`
- `apiPatch` already exists in `apps/mobile/src/lib/api.ts`
- API base: `https://mh-datapedia-web.fly.dev`
- Verification command: `pnpm --filter mobile typecheck` — must return 0 errors after each task
- Android only

## AdminUser Type (used across all tasks)

Define this type in the hook file and re-export from there. All tasks import it from the hook:

```ts
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
  createdAt: string;
}
```

---

### Task 1: useAdminUsers Hook

**Files:**
- Create: `apps/mobile/src/hooks/useAdminUsers.ts`

**Interfaces:**
- Produces:
  - `AdminUser` interface (exported, used in Tasks 2–4)
  - `useAdminUsers()` returns `{ users, isLoading, search, setSearch, roleMutation, banMutation }`
  - `roleMutation.mutate({ userId: string, role: 'USER' | 'ADMIN' })`
  - `banMutation.mutate({ userId: string, banned: boolean })`
  - `roleMutation.isPending`, `banMutation.isPending`

- [ ] **Step 1: Create the hook**

Create `apps/mobile/src/hooks/useAdminUsers.ts`:

```ts
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
  createdAt: string;
}

export function useAdminUsers() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () =>
      apiGet<{ users: AdminUser[] }>(
        `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ).then((r) => r.users),
    enabled: user?.role === 'ADMIN',
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'USER' | 'ADMIN' }) =>
      apiPatch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, banned }: { userId: string; banned: boolean }) =>
      apiPatch(`/admin/users/${userId}/ban`, { banned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return { users, isLoading, search, setSearch, roleMutation, banMutation };
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add apps/mobile/src/hooks/useAdminUsers.ts
git commit -m "feat(mobile): useAdminUsers hook with role + ban mutations"
```

---

### Task 2: UserCard Component

**Files:**
- Create: `apps/mobile/src/components/admin/UserCard.tsx`

**Interfaces:**
- Consumes: `AdminUser` from `../../../hooks/useAdminUsers` (import path from component to hook)
- Produces: `UserCard` — pure display component, no mutations
  ```ts
  interface UserCardProps {
    user: AdminUser;
    isSelf: boolean;
    onActionPress: () => void;
  }
  ```

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/components/admin/UserCard.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AdminUser } from '../../hooks/useAdminUsers';

interface UserCardProps {
  user: AdminUser;
  isSelf: boolean;
  onActionPress: () => void;
}

function getInitials(username: string): string {
  const parts = username.split(/[\s_-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function UserCard({ user, isSelf, onActionPress }: UserCardProps) {
  const isAdmin = user.role === 'ADMIN';

  return (
    <View
      style={{
        backgroundColor: '#1c1917',
        borderRadius: 12,
        marginHorizontal: 12,
        marginVertical: 4,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isAdmin ? '#2f9e8f' : '#292524',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
          {getInitials(user.username)}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fafaf9', fontSize: 15, fontWeight: '600' }}>
            {user.username}
          </Text>
          {isSelf && (
            <View
              style={{
                borderRadius: 4,
                backgroundColor: '#2f9e8f22',
                borderColor: '#2f9e8f',
                borderWidth: 1,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text style={{ color: '#2f9e8f', fontSize: 11 }}>YOU</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {isAdmin && (
            <Ionicons name="shield" size={12} color="#2f9e8f" />
          )}
          <Text style={{ color: '#57534e', fontSize: 13 }}>
            {isAdmin ? 'Admin' : 'Hunter'}
          </Text>
          {user.banned && (
            <Text style={{ color: '#ef4444', fontSize: 12 }}> · Banned</Text>
          )}
        </View>
      </View>

      {/* Action button — hidden for self */}
      <Pressable
        onPress={onActionPress}
        hitSlop={8}
        style={{ display: isSelf ? 'none' : 'flex' }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#57534e" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add apps/mobile/src/components/admin/UserCard.tsx
git commit -m "feat(mobile): UserCard component for admin user list"
```

---

### Task 3: UserActionSheet Component

**Files:**
- Create: `apps/mobile/src/components/admin/UserActionSheet.tsx`

**Interfaces:**
- Consumes: `AdminUser` from `../../hooks/useAdminUsers`
- Produces: `UserActionSheet` — `forwardRef<BottomSheetModal, UserActionSheetProps>`
  ```ts
  interface UserActionSheetProps {
    user: AdminUser | null;
    onRoleChange: (userId: string, role: 'USER' | 'ADMIN') => void;
    onBanChange: (userId: string, banned: boolean) => void;
    isPending: boolean;
  }
  ```

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/components/admin/UserActionSheet.tsx`:

```tsx
import { forwardRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { AdminUser } from '../../hooks/useAdminUsers';

interface UserActionSheetProps {
  user: AdminUser | null;
  onRoleChange: (userId: string, role: 'USER' | 'ADMIN') => void;
  onBanChange: (userId: string, banned: boolean) => void;
  isPending: boolean;
}

export const UserActionSheet = forwardRef<BottomSheetModal, UserActionSheetProps>(
  ({ user, onRoleChange, onBanChange, isPending }, ref) => {
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
        snapPoints={['40%']}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDiamond}>◆</Text>
            <Text style={styles.headerTitle}>User Actions</Text>
            <View style={styles.headerLine} />
          </View>

          {user && (
            <>
              <Text style={styles.username}>@{user.username}</Text>

              {/* Role action */}
              <Pressable
                onPress={() =>
                  onRoleChange(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN')
                }
                disabled={isPending}
                style={[
                  styles.button,
                  user.role === 'ADMIN' ? styles.buttonSecondary : styles.buttonPrimary,
                  isPending && { opacity: 0.6 },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      user.role === 'ADMIN' && styles.buttonTextSecondary,
                    ]}
                  >
                    {user.role === 'ADMIN' ? 'Revoke Admin' : 'Promote to Admin'}
                  </Text>
                )}
              </Pressable>

              {/* Ban action */}
              <Pressable
                onPress={() => onBanChange(user.id, !user.banned)}
                disabled={isPending}
                style={[
                  styles.button,
                  styles.buttonDanger,
                  user.banned && styles.buttonDangerInactive,
                  isPending && { opacity: 0.6 },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#ef4444" />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      user.banned ? styles.buttonTextSecondary : styles.buttonTextDanger,
                    ]}
                  >
                    {user.banned ? 'Unban User' : 'Ban User'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDiamond: { color: '#2f9e8f', fontSize: 14 },
  headerTitle: {
    color: '#fafaf9',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerLine: { flex: 1, height: 1, backgroundColor: '#292524', marginLeft: 8 },
  username: { color: '#a8a29e', fontSize: 14 },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: '#2f9e8f' },
  buttonSecondary: { backgroundColor: '#292524', borderWidth: 1, borderColor: '#292524' },
  buttonDanger: { borderWidth: 1, borderColor: '#ef4444', backgroundColor: '#ef444422' },
  buttonDangerInactive: { borderColor: '#292524', backgroundColor: '#292524' },
  buttonText: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  buttonTextSecondary: { color: '#a8a29e' },
  buttonTextDanger: { color: '#ef4444' },
});
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add apps/mobile/src/components/admin/UserActionSheet.tsx
git commit -m "feat(mobile): UserActionSheet bottom sheet for role and ban actions"
```

---

### Task 4: AdminScreen + Tab Registration

**Files:**
- Create: `apps/mobile/app/(tabs)/admin.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes:
  - `useAdminUsers()` from Task 1: `{ users, isLoading, search, setSearch, roleMutation, banMutation }`
  - `AdminUser` from Task 1
  - `UserCard` from Task 2: `({ user, isSelf, onActionPress })`
  - `UserActionSheet` from Task 3: `forwardRef, ({ user, onRoleChange, onBanChange, isPending })`
  - `AppTitle` from Sub-Spec A (already has `label` prop): `<AppTitle label="Admin" />`
  - `HeaderRight` from `apps/mobile/src/components/ui/AppHeader`
  - `useAuth` from `apps/mobile/src/context/AuthContext`

- [ ] **Step 1: Create AdminScreen**

Create `apps/mobile/app/(tabs)/admin.tsx`:

```tsx
import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuth } from '../../src/context/AuthContext';
import { useAdminUsers, type AdminUser } from '../../src/hooks/useAdminUsers';
import { UserCard } from '../../src/components/admin/UserCard';
import { UserActionSheet } from '../../src/components/admin/UserActionSheet';

type Filter = 'All' | 'Admins' | 'Hunters';
const FILTERS: Filter[] = ['All', 'Admins', 'Hunters'];

export default function AdminScreen() {
  const { user: currentUser } = useAuth();
  const { users, isLoading, search, setSearch, roleMutation, banMutation } = useAdminUsers();
  const [filter, setFilter] = useState<Filter>('All');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const actionSheetRef = useRef<BottomSheetModal>(null);

  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const hunterCount = users.filter((u) => u.role === 'USER').length;

  const filteredUsers = users.filter((u) => {
    if (filter === 'Admins') return u.role === 'ADMIN';
    if (filter === 'Hunters') return u.role === 'USER';
    return true;
  });

  const isPending = roleMutation.isPending || banMutation.isPending;

  function handleRoleChange(userId: string, role: 'USER' | 'ADMIN') {
    roleMutation.mutate(
      { userId, role },
      { onSuccess: () => actionSheetRef.current?.dismiss() },
    );
  }

  function handleBanChange(userId: string, banned: boolean) {
    banMutation.mutate(
      { userId, banned },
      { onSuccess: () => actionSheetRef.current?.dismiss() },
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2f9e8f" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      {/* Search bar */}
      <TextInput
        placeholder="Search users..."
        placeholderTextColor="#57534e"
        value={search}
        onChangeText={setSearch}
        style={{
          backgroundColor: '#1c1917',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#292524',
          color: '#fafaf9',
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginHorizontal: 12,
          marginTop: 12,
          marginBottom: 8,
          fontSize: 14,
        }}
      />

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: 8 }}>
        {[
          { label: 'USERS', count: totalCount, filterMatch: 'All' as Filter },
          { label: 'ADMINS', count: adminCount, filterMatch: 'Admins' as Filter },
          { label: 'HUNTERS', count: hunterCount, filterMatch: 'Hunters' as Filter },
        ].map(({ label, count, filterMatch }) => (
          <Pressable
            key={label}
            onPress={() => setFilter(filterMatch)}
            style={{
              flex: 1,
              backgroundColor: '#1c1917',
              borderRadius: 8,
              padding: 12,
              alignItems: 'center',
              borderWidth: filter === filterMatch ? 1 : 0,
              borderColor: '#2f9e8f',
            }}
          >
            <Text style={{ color: '#fafaf9', fontSize: 22, fontWeight: 'bold' }}>{count}</Text>
            <Text style={{ color: '#57534e', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: 8 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              backgroundColor: filter === f ? '#2f9e8f' : '#1c1917',
              borderWidth: filter === f ? 0 : 1,
              borderColor: '#292524',
            }}
          >
            <Text
              style={{
                color: filter === f ? '#fff' : '#57534e',
                fontSize: 13,
                fontWeight: filter === f ? '600' : '400',
              }}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* User list */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            isSelf={item.id === currentUser?.id}
            onActionPress={() => {
              setSelectedUser(item);
              actionSheetRef.current?.present();
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#57534e', fontSize: 15 }}>No users found.</Text>
          </View>
        }
      />

      <UserActionSheet
        ref={actionSheetRef}
        user={selectedUser}
        onRoleChange={handleRoleChange}
        onBanChange={handleBanChange}
        isPending={isPending}
      />
    </View>
  );
}
```

- [ ] **Step 2: Register the Admin tab in the tabs layout**

In `apps/mobile/app/(tabs)/_layout.tsx`:

**2a. Add `useAuth` import:**
```tsx
import { useAuth } from '../../src/context/AuthContext';
```

**2b. Call `useAuth()` inside the `TabLayout` function:**
```tsx
export default function TabLayout() {
  const { user } = useAuth();
  // ...existing return
}
```

**2c. Update Monsters and Favorites tab `headerTitle` to use the label prop (Sub-Spec A prerequisite):**
```tsx
headerTitle: () => <AppTitle label="Monsters" />,
// ...
headerTitle: () => <AppTitle label="Favorites" />,
```

**2d. Add the Admin tab after Favorites:**
```tsx
<Tabs.Screen
  name="admin"
  options={{
    title: 'Admin',
    href: user?.role === 'ADMIN' ? undefined : null,
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="shield-checkmark" color={color} size={size} />
    ),
    headerTitle: () => <AppTitle label="Admin" />,
    headerRight: () => <HeaderRight />,
  }}
/>
```

The complete updated `_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTitle, HeaderRight } from '../../src/components/ui/AppHeader';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();

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
          headerTitle: () => <AppTitle label="Monsters" />,
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
          headerTitle: () => <AppTitle label="Favorites" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: user?.role === 'ADMIN' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" color={color} size={size} />
          ),
          headerTitle: () => <AppTitle label="Admin" />,
          headerRight: () => <HeaderRight />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```
git add apps/mobile/app/(tabs)/admin.tsx apps/mobile/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): admin panel tab with user list, role and ban actions"
```
