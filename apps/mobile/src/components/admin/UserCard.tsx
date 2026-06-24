import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
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
        borderRadius: 10,
        marginHorizontal: 12,
        marginVertical: 4,
        padding: 12,
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
          backgroundColor: user.banned ? '#ef4444' : isAdmin ? '#2f9e8f' : '#292524',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
          {getInitials(user.username)}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text style={{ color: '#fafaf9', fontSize: 14, fontWeight: '500' }}>{user.username}</Text>
          {isSelf && (
            <View
              style={{
                borderRadius: 4,
                backgroundColor: 'rgba(47,158,143,0.15)',
                borderColor: '#2f9e8f',
                borderWidth: 1,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text style={{ color: '#2f9e8f', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>YOU</Text>
            </View>
          )}
          {user.banned && (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>BANNED</Text>
            </View>
          )}
        </View>

        {isAdmin ? (
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

      {/* 3-dot action button — hidden for self */}
      {!isSelf && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color="#57534e" />
        </Pressable>
      )}
    </View>
  );
}
