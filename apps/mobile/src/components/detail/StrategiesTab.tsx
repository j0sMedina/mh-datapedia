import { ScrollView, View, Text } from 'react-native';
import { Badge } from '../ui/Badge';
import type { Difficulty, MHGame } from '@mh-datapedia/shared';

interface StrategyWithAuthor {
  id: string;
  title: string;
  content: string;
  difficulty: Difficulty;
  game: MHGame;
  authorId: string;
  author: { id: string; username: string };
  createdAt: string;
}

const DIFFICULTY_VARIANT: Record<Difficulty, 'accent' | 'stone' | 'red'> = {
  Beginner: 'accent',
  Intermediate: 'stone',
  Advanced: 'red',
};

const GAME_SHORT: Record<MHGame, string> = {
  MONSTER_HUNTER_WORLD: 'World',
  MONSTER_HUNTER_WORLD_ICEBORNE: 'Iceborne',
  MONSTER_HUNTER_RISE: 'Rise',
  MONSTER_HUNTER_RISE_SUNBREAK: 'Sunbreak',
  MONSTER_HUNTER_WILDS: 'Wilds',
};

export function StrategiesTab({ strategies }: { strategies: StrategyWithAuthor[] }) {
  if (strategies.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-stone-500">No strategies yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      {strategies.map((s) => (
        <View key={s.id} className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-2 flex-wrap">
            <Text className="text-stone-50 font-semibold text-base flex-1">{s.title}</Text>
            <Badge variant={DIFFICULTY_VARIANT[s.difficulty]}>{s.difficulty}</Badge>
          </View>
          <Text className="text-stone-400 text-xs mb-3">
            {GAME_SHORT[s.game]} · by {s.author.username} ·{' '}
            {new Date(s.createdAt).toLocaleDateString()}
          </Text>
          <Text className="text-stone-300 text-sm leading-5">{s.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
