import { View, Text } from 'react-native';

interface BadgeProps {
  children: string;
  variant?: 'accent' | 'stone' | 'red';
}

const variantClasses = {
  accent: 'bg-accent/20 border border-accent/40',
  stone: 'bg-stone-700',
  red: 'bg-red-900/40 border border-red-800/50',
};
const textClasses = {
  accent: 'text-accent',
  stone: 'text-stone-300',
  red: 'text-red-400',
};

export function Badge({ children, variant = 'stone' }: BadgeProps) {
  return (
    <View className={`rounded px-2 py-0.5 ${variantClasses[variant]}`}>
      <Text className={`text-xs font-semibold ${textClasses[variant]}`}>{children}</Text>
    </View>
  );
}
