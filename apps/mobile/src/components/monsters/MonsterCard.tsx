import { useRef } from 'react';
import { Pressable, View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'type' | 'iconUrl'>;
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
      className="flex-row items-center px-4 py-3 border-b border-stone-800 active:bg-stone-800/50"
    >
      {monster.iconUrl ? (
        <Image
          source={{ uri: monster.iconUrl }}
          className="w-10 h-10 rounded mr-3"
          resizeMode="contain"
        />
      ) : (
        <View className="w-10 h-10 rounded mr-3 bg-stone-800 items-center justify-center">
          <Text className="text-stone-500 text-xs">?</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-stone-50 font-medium text-base">{monster.name}</Text>
      </View>
      <Badge variant="accent">{monster.type}</Badge>
    </Pressable>
  );

  if (!onFavoriteToggle) return card;

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} rightThreshold={40}>
      {card}
    </Swipeable>
  );
}
