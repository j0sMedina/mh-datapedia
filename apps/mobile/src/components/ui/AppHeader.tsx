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
