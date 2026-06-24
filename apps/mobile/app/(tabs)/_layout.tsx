import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTitle, HeaderRight } from '../../src/components/ui/AppHeader';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0a09' },
        headerTintColor: '#fafaf9',
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#1c1917',
          borderTopColor: '#292524',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#2f9e8f',
        tabBarInactiveTintColor: '#57534e',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Monsters',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" color={color} size={size} />
          ),
          headerTitle: () => <AppTitle />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              color={color}
              size={size}
            />
          ),
          headerTitle: () => <AppTitle />,
          headerRight: () => <HeaderRight />,
        }}
      />
    </Tabs>
  );
}
