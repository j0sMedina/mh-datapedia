import '../global.css';
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
          headerRight: () => null,
        }}
      />
      <Stack.Screen
        name="auth/register"
        options={{
          presentation: 'modal',
          headerTitle: 'Create Account',
          headerRight: () => null,
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
