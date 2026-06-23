import { Pressable, View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

interface MonsterCardProps {
  monster: Pick<Monster, 'id' | 'name' | 'type' | 'iconUrl'>;
}

export function MonsterCard({ monster }: MonsterCardProps) {
  return (
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
}
