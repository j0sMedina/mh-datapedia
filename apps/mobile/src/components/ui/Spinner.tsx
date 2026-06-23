import { ActivityIndicator, View } from 'react-native';

const sizes = { sm: 'small', md: 'large', lg: 'large' } as const;

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <View className="items-center justify-center py-8">
      <ActivityIndicator size={sizes[size]} color="#2f9e8f" />
    </View>
  );
}
