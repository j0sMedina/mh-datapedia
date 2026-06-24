import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Badge } from '../ui/Badge';
import type { Monster } from '@mh-datapedia/shared';

type SubspeciesRef = { id: string; name: string };
type ParentRef = { id: string; name: string } | null;

interface Props {
  monster: Pick<Monster, 'description' | 'habitats' | 'ailments'> & {
    subspecies: SubspeciesRef[];
    parent: ParentRef;
  };
}

export function OverviewTab({ monster }: Props) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}>
      <Text className="text-stone-50 text-base leading-6 mb-4">{monster.description}</Text>

      {monster.habitats.length > 0 && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Habitats</Text>
          <View className="flex-row flex-wrap gap-2">
            {monster.habitats.map((h) => (
              <Badge key={h} variant="stone">{h}</Badge>
            ))}
          </View>
        </View>
      )}

      {monster.ailments.length > 0 && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Ailments</Text>
          <View className="flex-row flex-wrap gap-2">
            {monster.ailments.map((a) => (
              <Badge key={a.id} variant="stone">{a.ailment}</Badge>
            ))}
          </View>
        </View>
      )}

      {monster.parent && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Base Species</Text>
          <Text
            className="text-accent text-sm"
            onPress={() => router.push(`/monsters/${monster.parent!.id}`)}
          >
            {monster.parent.name}
          </Text>
        </View>
      )}

      {monster.subspecies.length > 0 && (
        <View className="mb-4">
          <Text className="text-stone-400 text-xs uppercase tracking-wider mb-2">Subspecies</Text>
          <View className="flex-row flex-wrap gap-2">
            {monster.subspecies.map((s) => (
              <Text
                key={s.id}
                className="text-accent text-sm"
                onPress={() => router.push(`/monsters/${s.id}`)}
              >
                {s.name}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
