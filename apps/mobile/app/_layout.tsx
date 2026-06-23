import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0c0a09' },
          headerTintColor: '#fafaf9',
          contentStyle: { backgroundColor: '#0c0a09' },
        }}
      />
    </>
  );
}
