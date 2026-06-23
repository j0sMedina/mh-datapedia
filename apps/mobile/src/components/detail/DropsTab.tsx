import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { TypeFilterChip } from '../monsters/TypeFilterChip';
import type { MHGame, Rank } from '@mh-datapedia/shared';

interface Drop {
  id: string;
  game: MHGame;
  rank: Rank;
  method: string;
  part: string | null;
  itemName: string;
  quantity: number;
  rate: number;
}

const GAME_LABELS: Record<MHGame, string> = {
  MONSTER_HUNTER_WORLD: 'World',
  MONSTER_HUNTER_WORLD_ICEBORNE: 'Iceborne',
  MONSTER_HUNTER_RISE: 'Rise',
  MONSTER_HUNTER_RISE_SUNBREAK: 'Sunbreak',
  MONSTER_HUNTER_WILDS: 'Wilds',
};

const RANK_LABELS: Record<Rank, string> = {
  LowRank: 'LR',
  HighRank: 'HR',
  MasterRank: 'MR',
};

export function DropsTab({ drops }: { drops: Drop[] }) {
  const games = [...new Set(drops.map((d) => d.game))] as MHGame[];
  const [activeGame, setActiveGame] = useState<MHGame | null>(games[0] ?? null);
  const [activeRank, setActiveRank] = useState<Rank | null>(null);

  const filtered = drops.filter(
    (d) =>
      (!activeGame || d.game === activeGame) &&
      (!activeRank || d.rank === activeRank),
  );

  const ranks = [...new Set(drops.filter((d) => !activeGame || d.game === activeGame).map((d) => d.rank))] as Rank[];

  if (drops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-stone-500">No drop data.</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingBottom: 24 }}>
      {/* Game filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: '#292524', height: 44 }}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', height: 44 }}
      >
        {games.map((g) => (
          <TypeFilterChip
            key={g}
            label={GAME_LABELS[g]}
            active={activeGame === g}
            onPress={() => { setActiveGame(g); setActiveRank(null); }}
          />
        ))}
      </ScrollView>

      {/* Rank filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: '#292524', height: 44 }}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', height: 44 }}
      >
        <TypeFilterChip
          label="All Ranks"
          active={activeRank === null}
          onPress={() => setActiveRank(null)}
        />
        {ranks.map((r) => (
          <TypeFilterChip
            key={r}
            label={RANK_LABELS[r]}
            active={activeRank === r}
            onPress={() => setActiveRank(r)}
          />
        ))}
      </ScrollView>

      {/* Drop rows */}
      {[...filtered].sort((a, b) => b.rate - a.rate).map((d) => (
        <View key={d.id} className="flex-row items-center px-4 py-3 border-b border-stone-800">
          <View className="flex-1">
            <Text className="text-stone-100 text-sm font-medium">{d.itemName}</Text>
            <Text className="text-stone-500 text-xs mt-0.5">
              {d.method}{d.part ? ` · ${d.part}` : ''} · {RANK_LABELS[d.rank]}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-accent text-sm font-semibold">{d.rate}%</Text>
            {d.quantity > 1 && (
              <Text className="text-stone-500 text-xs">×{d.quantity}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
