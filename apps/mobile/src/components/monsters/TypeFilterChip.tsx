import { Pressable, Text } from 'react-native';

interface TypeFilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function TypeFilterChip({ label, active, onPress }: TypeFilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 px-3 py-1.5 rounded-full border ${
        active
          ? 'bg-accent/20 border-accent'
          : 'border-stone-700 bg-transparent'
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? 'text-accent' : 'text-stone-400'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
