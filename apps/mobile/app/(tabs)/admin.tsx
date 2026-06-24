import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiGet, apiPatch } from '../../src/lib/api';

type AdminUser = {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
  createdAt: string;
};

function initials(username: string): string {
  const parts = username.split(/[\s_-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export default function AdminScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'admin' | 'user'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiGet<{ users: AdminUser[] }>('/api/admin/users').then((r) => r.users),
    enabled: user?.role === 'ADMIN',
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'USER' | 'ADMIN' }) =>
      apiPatch(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  if (!user || user.role !== 'ADMIN') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#57534e', fontSize: 14 }}>Access restricted to admins.</Text>
      </View>
    );
  }

  const users = data ?? [];
  const admins = users.filter((u) => u.role === 'ADMIN');
  const hunters = users.filter((u) => u.role === 'USER');
  const filtered = filter === 'all' ? users : filter === 'admin' ? admins : hunters;

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 10 }}>
          <MaterialCommunityIcons name="rhombus" size={13} color="#2f9e8f" />
          <Text style={{ color: '#fafaf9', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            User Administration
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#2f9e8f', opacity: 0.35 }} />
        </View>

        {/* Stats cards */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 }}>
          {([
            { label: 'USERS', count: users.length, teal: false },
            { label: 'ADMINS', count: admins.length, teal: true },
            { label: 'HUNTERS', count: hunters.length, teal: false },
          ] as const).map(({ label, count, teal }) => (
            <View
              key={label}
              style={{
                flex: 1,
                backgroundColor: '#1c1917',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: teal ? '#2f9e8f' : '#292524',
                paddingVertical: 12,
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: teal ? '#2f9e8f' : '#fafaf9', fontSize: 22, fontWeight: 'bold' }}>
                {count}
              </Text>
              <Text style={{ color: '#57534e', fontSize: 11, letterSpacing: 1, marginTop: 2 }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Filter chips */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 }}>
          {(['all', 'admin', 'user'] as const).map((f) => {
            const label = f === 'all' ? 'All' : f === 'admin' ? 'Admins' : 'Hunters';
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? '#2f9e8f' : '#44403c',
                  backgroundColor: active ? 'rgba(47,158,143,0.15)' : 'transparent',
                }}
              >
                <Text style={{ color: active ? '#2f9e8f' : '#a8a29e', fontSize: 13, fontWeight: '500' }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* User list */}
        {isLoading ? (
          <ActivityIndicator color="#2f9e8f" style={{ marginTop: 40 }} />
        ) : (
          <View style={{ gap: 8, paddingHorizontal: 16 }}>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === user.id}
                onRevoke={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
                onPromote={() => roleMutation.mutate({ id: u.id, role: 'ADMIN' })}
                isPending={roleMutation.isPending && roleMutation.variables?.id === u.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function UserRow({
  user,
  isSelf,
  onRevoke,
  onPromote,
  isPending,
}: {
  user: AdminUser;
  isSelf: boolean;
  onRevoke: () => void;
  onPromote: () => void;
  isPending: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1c1917',
        borderRadius: 10,
        padding: 12,
        gap: 12,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#292524',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#a8a29e', fontSize: 14, fontWeight: '600' }}>{initials(user.username)}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#fafaf9', fontSize: 14, fontWeight: '500' }}>{user.username}</Text>
          {isSelf && (
            <View
              style={{
                backgroundColor: 'rgba(47,158,143,0.2)',
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <Text style={{ color: '#2f9e8f', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>YOU</Text>
            </View>
          )}
        </View>

        {user.role === 'ADMIN' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: '#292524',
              borderRadius: 6,
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <MaterialCommunityIcons name="crown" size={11} color="#2f9e8f" />
            <Text style={{ color: '#a8a29e', fontSize: 11, fontWeight: '500' }}>Admin</Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: '#292524',
              borderRadius: 6,
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: '#78716c', fontSize: 11, fontWeight: '500' }}>Hunter</Text>
          </View>
        )}
      </View>

      {/* Action */}
      {isSelf ? (
        <Text style={{ color: '#44403c', fontSize: 18, paddingHorizontal: 4 }}>—</Text>
      ) : user.role === 'ADMIN' ? (
        <Pressable onPress={onRevoke} disabled={isPending} hitSlop={8}>
          <Text style={{ color: isPending ? '#44403c' : '#a8a29e', fontSize: 13 }}>Revoke</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onPromote}
          disabled={isPending}
          style={{
            backgroundColor: isPending ? '#1c4a44' : '#2f9e8f',
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 7,
          }}
        >
          <Text style={{ color: isPending ? '#4a9e96' : '#fff', fontSize: 13, fontWeight: '600' }}>
            Promote
          </Text>
        </Pressable>
      )}
    </View>
  );
}
