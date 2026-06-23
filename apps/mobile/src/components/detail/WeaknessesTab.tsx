import { ScrollView, View, Text } from 'react-native';

interface Weakness {
  id: string;
  element: string;
  rating: number;
  isImmune: boolean;
}

const ELEMENT_EMOJI: Record<string, string> = {
  Fire: '🔥', Water: '💧', Thunder: '⚡', Ice: '❄️', Dragon: '🐉',
  Poison: '☠️', Sleep: '💤', Paralysis: '⚡', Blast: '💥', Stun: '💫',
};

export function WeaknessesTab({ weaknesses }: { weaknesses: Weakness[] }) {
  if (weaknesses.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-stone-500">No weakness data.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      {weaknesses.map((w) => (
        <View
          key={w.id}
          className="flex-row items-center py-3 border-b border-stone-800"
        >
          <Text className="text-lg w-8">{ELEMENT_EMOJI[w.element] ?? '•'}</Text>
          <Text className="text-stone-200 text-sm flex-1 ml-2">{w.element}</Text>
          {w.isImmune ? (
            <Text className="text-stone-500 text-xs">Immune</Text>
          ) : (
            <Text className="text-accent text-sm">{'★'.repeat(w.rating)}{'☆'.repeat(3 - w.rating)}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
