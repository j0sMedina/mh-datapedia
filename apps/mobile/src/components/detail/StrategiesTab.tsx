import { useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Badge } from '../ui/Badge';
import StrategyFormSheet from './StrategyFormSheet';
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

export function StrategiesTab({
  strategies,
  monsterId,
}: {
  strategies: StrategyWithAuthor[];
  monsterId: string;
}) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  if (strategies.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 64, paddingBottom: 100, alignItems: 'center' }}>
          <Text style={{ color: '#57534e' }}>No strategies yet.</Text>
        </View>

        {/* FAB */}
        <Pressable
          onPress={() => bottomSheetRef.current?.present()}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#2f9e8f',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 56, textAlign: 'center' }}>+</Text>
        </Pressable>

        {/* Strategy submission sheet */}
        <StrategyFormSheet ref={bottomSheetRef} monsterId={monsterId} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}>
        {strategies.map((s) => (
          <View
            key={s.id}
            className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-4"
          >
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
      </View>

      {/* FAB */}
      <Pressable
        onPress={() => bottomSheetRef.current?.present()}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#2f9e8f',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 56, textAlign: 'center' }}>+</Text>
      </Pressable>

      {/* Strategy submission sheet */}
      <StrategyFormSheet ref={bottomSheetRef} monsterId={monsterId} />
    </View>
  );
}
