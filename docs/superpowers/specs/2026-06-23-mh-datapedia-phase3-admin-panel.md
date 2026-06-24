# MH Datapedia Mobile — Phase 3 Sub-Spec B: Admin Panel

## Goal

Add a third tab visible only to ADMIN users that lists all registered users, shows stats, and lets admins promote/revoke admin role and ban/unban users via a per-user action bottom sheet.

## Scope

One self-contained plan: new tab, new hook, new components.

---

## Global Constraints

- Expo SDK 56, managed workflow, Expo Router v4, NativeWind v4.2.6
- NativeWind v4: use explicit `style={{}}` for layout-critical containers
- Horizontal chip ScrollView: `style={{ height: 44 }}` + `contentContainerStyle={{ height: 44, alignItems: 'center' }}`
- Color tokens: accent `#2f9e8f`, bg `#0c0a09`, panel `#1c1917`, border `#292524`, inactive `#57534e`, red `#ef4444`
- `@gorhom/bottom-sheet` v5 already installed; `BottomSheetModalProvider` already at root
- TanStack Query v5 object syntax: `{ queryKey, queryFn, enabled }`
- API base: `https://mh-datapedia-web.fly.dev`
- `AppTitle` now accepts a `label` prop (done in Sub-Spec A) — pass `label="Admin"` for the Admin tab
- Android only
- Sub-Spec A must be complete before this spec is implemented (dynamic `AppTitle` is a dependency)

---

## API Endpoints (all require `ADMIN` role)

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/admin/users?search=` | — | `{ users: AdminUser[] }` |
| `PATCH` | `/admin/users/:id/role` | `{ role: 'USER' \| 'ADMIN' }` | `{ user: AdminUser }` |
| `PATCH` | `/admin/users/:id/ban` | `{ banned: boolean }` | `{ user: AdminUser }` |

**`AdminUser` shape** (inferred from API):
```ts
interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
  createdAt: string;
}
```

---

## File Map

| File | Action |
|---|---|
| `apps/mobile/app/(tabs)/admin.tsx` | CREATE — Admin screen |
| `apps/mobile/src/hooks/useAdminUsers.ts` | CREATE — TanStack Query hook |
| `apps/mobile/src/components/admin/UserCard.tsx` | CREATE — user row card |
| `apps/mobile/src/components/admin/UserActionSheet.tsx` | CREATE — action bottom sheet |
| `apps/mobile/app/(tabs)/_layout.tsx` | MODIFY — add Admin tab |

---

## Data Layer: `useAdminUsers`

**File:** `apps/mobile/src/hooks/useAdminUsers.ts`

```ts
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface AdminUser {
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
      apiGet<{ users: AdminUser[] }>(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`)
        .then((r) => r.users),
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

Note: `apiPatch` may not exist yet in `api.ts` — add it following the same pattern as `apiPost` and `apiDelete`.

---

## Component: `UserCard`

**File:** `apps/mobile/src/components/admin/UserCard.tsx`

Props:
```ts
interface UserCardProps {
  user: AdminUser;
  isSelf: boolean;
  onActionPress: () => void;
}
```

Layout:
```
┌─────────────────────────────────────────────────────┐
│  [Avatar]  Username          [YOU]          [⋮ btn] │
│            role label                               │
└─────────────────────────────────────────────────────┘
```

- **Avatar circle**: 40×40, `borderRadius: 20`, bg `#2f9e8f` for ADMIN / `#292524` for USER. Shows the first two initials of `username` (e.g. "AT" for "Aria Thorne"), white text, `fontSize: 15`, `fontWeight: 'bold'`
- **Username**: `color: '#fafaf9'`, `fontSize: 15`, `fontWeight: '600'`
- **YOU badge**: small chip `borderRadius: 4`, `backgroundColor: '#2f9e8f22'`, `borderColor: '#2f9e8f'`, `borderWidth: 1`, text `#2f9e8f`, `fontSize: 11` — shown only when `isSelf`
- **Role label**: `color: '#57534e'`, `fontSize: 13` — "Admin" (with `Ionicons name="shield" size={12} color="#2f9e8f"` inline) for ADMIN / "Hunter" for USER
- **⋮ button**: `Ionicons name="ellipsis-vertical" size={20} color="#57534e"` — hidden (`display: 'none'`) when `isSelf`; calls `onActionPress` on press

Card container: `backgroundColor: '#1c1917'`, `borderRadius: 12`, `marginHorizontal: 12`, `marginVertical: 4`, `padding: 14`, `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 12`

---

## Component: `UserActionSheet`

**File:** `apps/mobile/src/components/admin/UserActionSheet.tsx`

```ts
interface UserActionSheetProps {
  user: AdminUser | null;
  onRoleChange: (userId: string, role: 'USER' | 'ADMIN') => void;
  onBanChange: (userId: string, banned: boolean) => void;
  isPending: boolean;
}
```

`forwardRef<BottomSheetModal, UserActionSheetProps>`

`snapPoints={['40%']}`, `backgroundStyle={{ backgroundColor: '#1c1917' }}`, `handleIndicatorStyle={{ backgroundColor: '#57534e' }}`

Content (rendered only when `user` is non-null):

```
◆ USER ACTIONS ————
  @username

  [Promote to Admin]   OR   [Revoke Admin]     (role action)
  [Ban User]           OR   [Unban User]        (ban action)
```

- **Header**: same `◆ LABEL ———` pattern as LoginSheet, uppercase
- **Username**: `@{user.username}` in `#a8a29e`, `fontSize: 14`, `marginBottom: 16`
- **Role action button**: full-width `Pressable`, `borderRadius: 8`, `paddingVertical: 14`
  - If USER: `backgroundColor: '#2f9e8f'`, text "Promote to Admin" → calls `onRoleChange(user.id, 'ADMIN')`
  - If ADMIN: `backgroundColor: '#292524'`, `borderWidth: 1`, `borderColor: '#292524'`, text "Revoke Admin" in `#a8a29e` → calls `onRoleChange(user.id, 'USER')`
- **Ban action button**: full-width `Pressable`, `borderRadius: 8`, `paddingVertical: 14`, `marginTop: 8`
  - If not banned: `backgroundColor: '#ef444422'`, `borderWidth: 1`, `borderColor: '#ef4444'`, text "Ban User" in `#ef4444` → calls `onBanChange(user.id, true)`
  - If banned: `backgroundColor: '#292524'`, `borderWidth: 1`, `borderColor: '#292524'`, text "Unban User" in `#a8a29e` → calls `onBanChange(user.id, false)`
- While `isPending`: both buttons show `ActivityIndicator` instead of text, disabled

---

## Screen: `AdminScreen`

**File:** `apps/mobile/app/(tabs)/admin.tsx`

```tsx
import { useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuth } from '../../src/context/AuthContext';
import { useAdminUsers } from '../../src/hooks/useAdminUsers';
import { UserCard } from '../../src/components/admin/UserCard';
import { UserActionSheet } from '../../src/components/admin/UserActionSheet';

type Filter = 'All' | 'Admins' | 'Hunters';
```

**Layout (top to bottom):**

1. **Search bar** — `TextInput` with `placeholder="Search users..."`, debounced 300ms → `setSearch(value)`. Style: `backgroundColor: '#1c1917'`, `borderRadius: 8`, `borderColor: '#292524'`, `color: '#fafaf9'`, `marginHorizontal: 12`, `marginVertical: 8`

2. **Stats row** — 3 equal cards in a `flexDirection: 'row'` with `gap: 8`, `marginHorizontal: 12`:
   - Total USERS (all users count)
   - ADMINS (users where `role === 'ADMIN'` count)
   - HUNTERS (users where `role === 'USER'` count)
   - Each card: `backgroundColor: '#1c1917'`, `borderRadius: 8`, `padding: 12`, `flex: 1`
   - **Active card** (matching current `filter`): add `borderWidth: 1`, `borderColor: '#2f9e8f'`
   - Number: `color: '#fafaf9'`, `fontSize: 22`, `fontWeight: 'bold'`
   - Label: `color: '#57534e'`, `fontSize: 11`, `textTransform: 'uppercase'`, `letterSpacing: 1`

3. **Filter chips** — `flexDirection: 'row'`, `gap: 8`, `marginHorizontal: 12`, `marginVertical: 8`
   - Chips: All | Admins | Hunters
   - Active: `backgroundColor: '#2f9e8f'`, text white
   - Inactive: `backgroundColor: '#1c1917'`, `borderWidth: 1`, `borderColor: '#292524'`, text `#57534e`
   - `borderRadius: 20`, `paddingHorizontal: 14`, `paddingVertical: 6`

4. **FlatList** of `UserCard` — filtered list based on `filter`:
   - All → `users`
   - Admins → `users.filter(u => u.role === 'ADMIN')`
   - Hunters → `users.filter(u => u.role === 'USER')`
   - Each `UserCard` receives `onActionPress={() => { setSelectedUser(user); actionSheetRef.current?.present(); }}`

5. **`UserActionSheet`** — `ref={actionSheetRef}`, `user={selectedUser}`, mutation callbacks that call `roleMutation.mutate(...)` / `banMutation.mutate(...)` then `actionSheetRef.current?.dismiss()` on success

**State:**
- `filter: Filter` — current chip selection (default `'All'`)
- `selectedUser: AdminUser | null` — user whose ⋮ was pressed
- `actionSheetRef: useRef<BottomSheetModal>(null)`

---

## Tab Registration

**File:** `apps/mobile/app/(tabs)/_layout.tsx`

Add after the Favorites tab:
```tsx
<Tabs.Screen
  name="admin"
  options={{
    title: 'Admin',
    href: user?.role === 'ADMIN' ? undefined : null,  // null hides the tab
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="shield-checkmark" color={color} size={size} />
    ),
    headerTitle: () => <AppTitle label="Admin" />,
    headerRight: () => <HeaderRight />,
  }}
/>
```

`href: null` hides the tab entirely for non-admins. The `user` here comes from `useAuth()` called inside the `TabLayout` function.
