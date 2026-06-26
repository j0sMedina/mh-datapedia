import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useAuthSheet } from '../../context/AuthSheetContext';

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

export function HeaderRight() {
  const { user, logout } = useAuth();
  const { openLoginSheet } = useAuthSheet();

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  if (user) {
    return (
      <View className="flex-row items-center gap-3">
        <Text style={{ color: user.role === 'MASTER' ? '#fbbf24' : user.role === 'ADMIN' ? '#2f9e8f' : user.role === 'HELPER' ? '#a78bfa' : '#a8a29e', fontSize: 14 }}>{user.username}</Text>
        <Pressable
          onPress={handleLogout}
          className="border border-stone-700 rounded px-3 py-1"
        >
          <Text className="text-stone-400 text-sm">Logout</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={openLoginSheet}
        className="border border-stone-700 rounded px-3 py-1"
      >
        <Text className="text-stone-400 text-sm">Login</Text>
      </Pressable>
    </View>
  );
}
