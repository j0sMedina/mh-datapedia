import { ScrollView, View, Text } from 'react-native';

interface Hitzone {
  id: string;
  part: string;
  cut: number;
  blunt: number;
  bullet: number;
  fire: number;
  water: number;
  thunder: number;
  ice: number;
  dragon: number;
  stun: number;
}

const COLS = ['Cut', 'Blunt', 'Blt', 'Fire', 'Wtr', 'Thd', 'Ice', 'Drg', 'Stun'] as const;
const KEYS: (keyof Omit<Hitzone, 'id' | 'part'>)[] = [
  'cut', 'blunt', 'bullet', 'fire', 'water', 'thunder', 'ice', 'dragon', 'stun',
];

function valueColor(v: number): string {
  if (v >= 60) return 'text-red-400';
  if (v >= 40) return 'text-yellow-500';
  return 'text-stone-400';
}

export function HitzonesTab({ hitzones }: { hitzones: Hitzone[] }) {
  if (hitzones.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-stone-500">No hitzone data.</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled style={{ flex: 1 }}>
        {/* Header row */}
        <View className="flex-row border-b border-stone-700 px-2 py-2">
          <Text className="text-stone-400 text-xs w-28 font-medium">Part</Text>
          {COLS.map((col) => (
            <Text key={col} className="text-stone-400 text-xs w-10 text-center font-medium">
              {col}
            </Text>
          ))}
        </View>
        {/* Data rows */}
        {hitzones.map((hz) => (
          <View key={hz.id} className="flex-row border-b border-stone-800 px-2 py-2">
            <Text className="text-stone-200 text-xs w-28">{hz.part}</Text>
            {KEYS.map((key) => (
              <Text key={key} className={`text-xs w-10 text-center ${valueColor(hz[key] as number)}`}>
                {hz[key]}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}
