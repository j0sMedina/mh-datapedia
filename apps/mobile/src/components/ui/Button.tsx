import { Pressable, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  children: string;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const base = 'rounded px-4 py-2 flex-row items-center justify-center';
  const styles =
    variant === 'primary'
      ? `${base} bg-accent`
      : `${base} border border-stone-700`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${styles} ${disabled || loading ? 'opacity-40' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#0c0a09' : '#a8a29e'} />
      ) : (
        <Text
          className={`text-sm font-semibold ${
            variant === 'primary' ? 'text-stone-950' : 'text-stone-400'
          }`}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
