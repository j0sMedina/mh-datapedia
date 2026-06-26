import { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  const isMaster = currentUser?.email === 'silverkx@mh.com';

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MASTER')) {
      router.replace('/');
    }
  }, [currentUser]);

  function handleRoleChange(userId: string, role: 'USER' | 'ADMIN') {
    roleMutation.mutate({ userId, role }, { onSuccess: () => actionSheetRef.current?.dismiss() });
  }

  function handleBanChange(userId: string, banned: boolean) {
    banMutation.mutate({ userId, banned }, { onSuccess: () => actionSheetRef.current?.dismiss() });
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
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 10 }}>
        <MaterialCommunityIcons name="rhombus" size={13} color="#2f9e8f" />
        <Text style={{ color: '#fafaf9', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          User Administration
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: '#2f9e8f', opacity: 0.35 }} />
      </View>

      {/* Stats cards */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
        {([
          { label: 'USERS', count: totalCount, f: 'All' as Filter },
          { label: 'ADMINS', count: adminCount, f: 'Admins' as Filter },
          { label: 'HUNTERS', count: hunterCount, f: 'Hunters' as Filter },
        ] as const).map(({ label, count, f }) => (
          <Pressable
            key={label}
            onPress={() => setFilter(f)}
            style={{
              flex: 1,
              backgroundColor: '#1c1917',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: filter === f ? '#2f9e8f' : '#292524',
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: filter === f ? '#2f9e8f' : '#fafaf9', fontSize: 22, fontWeight: 'bold' }}>
              {count}
            </Text>
            <Text style={{ color: '#57534e', fontSize: 11, letterSpacing: 1, marginTop: 2 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <TextInput
        placeholder="Search users…"
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
          marginHorizontal: 16,
          marginBottom: 10,
          fontSize: 14,
        }}
      />

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: filter === f ? '#2f9e8f' : '#44403c',
              backgroundColor: filter === f ? 'rgba(47,158,143,0.15)' : 'transparent',
            }}
          >
            <Text style={{ color: filter === f ? '#2f9e8f' : '#a8a29e', fontSize: 13, fontWeight: '500' }}>
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
            canAct={item.role === 'USER' || isMaster}
            onActionPress={() => {
              setSelectedUser(item);
              actionSheetRef.current?.present();
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#57534e', fontSize: 14 }}>No users found.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
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
