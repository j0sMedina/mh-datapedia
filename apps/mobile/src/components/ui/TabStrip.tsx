import { ScrollView, Pressable, Text } from 'react-native';

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
          key={tab}
          onPress={() => onChange(i)}
          className="mr-6 py-3"
        >
          <Text
            className={`text-sm font-medium ${
              active === i
                ? 'text-stone-50 border-b-2 border-accent pb-2'
                : 'text-stone-400'
            }`}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
