import '../global.css';
import { Component, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
import { AuthSheetProvider } from '../src/context/AuthSheetContext';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#0c0a09', padding: 24 }}>
          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Crash Report</Text>
          <Text style={{ color: '#fafaf9', fontSize: 13, marginBottom: 8 }}>{err.message}</Text>
          <Text style={{ color: '#78716c', fontSize: 11 }}>{err.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

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
      <Stack.Screen name="monsters/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Oswald_400Regular, Oswald_700Bold });
  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BottomSheetModalProvider>
            <AuthSheetProvider>
              <StatusBar style="light" />
              <RootStack />
            </AuthSheetProvider>
          </BottomSheetModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
