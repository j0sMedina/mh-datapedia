import { View, Text, FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/hooks/useFavorites';
import { MonsterCard } from '../../src/components/monsters/MonsterCard';
import { Spinner } from '../../src/components/ui/Spinner';
import { Button } from '../../src/components/ui/Button';

export default function FavoritesScreen() {
  const { user } = useAuth();
  const { favorites, isFavorited, toggle, isLoading } = useFavorites();

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: '#a8a29e', fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
          Sign in to save your favorite monsters
        </Text>
        <Button onPress={() => router.push('/auth/login')}>Sign In</Button>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MonsterCard
            monster={item}
            isFavorited={isFavorited(item.id)}
            onFavoriteToggle={() => toggle(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <Text style={{ color: '#57534e', fontSize: 16 }}>No favorites yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} tintColor="#2f9e8f" />
        }
      />
    </View>
  );
}
