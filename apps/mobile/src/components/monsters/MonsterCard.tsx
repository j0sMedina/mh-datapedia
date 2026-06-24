import { useRef } from 'react';
import { Pressable, View, Text } from 'react-native';
import { router } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'title' | 'type' | 'isBoss'>;
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
}

export function MonsterCard({ monster, isFavorited, onFavoriteToggle }: MonsterCardProps) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions() {
    if (!onFavoriteToggle) return null;
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onFavoriteToggle();
        }}
        style={{
          width: 72,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isFavorited ? '#ef4444' : '#2f9e8f',
          borderRadius: 12,
          marginVertical: 6,
          marginRight: 12,
        }}
      >
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={24}
          color="#fff"
        />
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 2 }}>
          {isFavorited ? 'Remove' : 'Save'}
        </Text>
      </Pressable>
    );
  }

  const card = (
    <Pressable
      onPress={() => router.push(`/monsters/${monster.id}`)}
      style={{
        backgroundColor: '#1c1917',
        borderRadius: 12,
        marginHorizontal: 12,
        marginVertical: 6,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: '#fafaf9', fontSize: 16, fontWeight: 'bold' }}>
          {monster.name}
        </Text>
        <Text style={{ color: '#a8a29e', fontSize: 13 }}>{monster.title}</Text>
        <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
          <Badge variant="accent">{monster.type}</Badge>
        </View>
      </View>
      {monster.isBoss && (
        <Ionicons name="shield" size={16} color="#2f9e8f" style={{ marginTop: 2 }} />
      )}
    </Pressable>
  );

  if (!onFavoriteToggle) return card;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
    >
      {card}
    </Swipeable>
  );
}
