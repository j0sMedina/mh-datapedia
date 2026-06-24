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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <RootStack />
          </BottomSheetModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
