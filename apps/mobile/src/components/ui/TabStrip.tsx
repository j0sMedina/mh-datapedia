import { ScrollView, Pressable, Text, View } from 'react-native';

interface TabStripProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export function TabStrip({ tabs, active, onChange }: TabStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-b border-stone-800"
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {tabs.map((tab, i) => (
        <Pressable
          key={i}
          onPress={() => onChange(i)}
          className="mr-6 pt-3 pb-0"
        >
          <Text className={`text-sm font-medium pb-2 ${active === i ? 'text-stone-50' : 'text-stone-400'}`}>
            {tab}
          </Text>
          {active === i && (
            <View className="h-0.5 bg-accent rounded-full" />
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}
