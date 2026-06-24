import { forwardRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, ApiError } from '../../lib/api';
import { CreateStrategySchema } from '@mh-datapedia/shared';
import type { MHGame, Difficulty } from '@mh-datapedia/shared';

const GAMES: { value: MHGame; label: string }[] = [
  { value: 'MONSTER_HUNTER_WORLD', label: 'World' },
  { value: 'MONSTER_HUNTER_WORLD_ICEBORNE', label: 'Iceborne' },
  { value: 'MONSTER_HUNTER_RISE', label: 'Rise' },
  { value: 'MONSTER_HUNTER_RISE_SUNBREAK', label: 'Sunbreak' },
  { value: 'MONSTER_HUNTER_WILDS', label: 'Wilds' },
];

const DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

interface StrategyFormSheetProps {
  monsterId: string;
}

export const StrategyFormSheet = forwardRef<BottomSheetModal, StrategyFormSheetProps>(
  ({ monsterId }, ref) => {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [game, setGame] = useState<MHGame>('MONSTER_HUNTER_WILDS');
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [content, setContent] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const { mutate, isPending, error, reset } = useMutation({
      mutationFn: (payload: {
        monsterId: string;
        title: string;
        content: string;
        difficulty: Difficulty;
        game: MHGame;
      }) => apiPost('/api/strategies', payload),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['monster', monsterId] });
        setTitle('');
        setContent('');
        setGame('MONSTER_HUNTER_WILDS');
        setDifficulty('Beginner');
        setFieldErrors({});
        reset();
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
      },
    });

    const handleSubmit = useCallback(() => {
      const result = CreateStrategySchema.safeParse({
        monsterId,
        title,
        content,
        difficulty,
        game,
      });
      if (!result.success) {
        const errors: Record<string, string> = {};
        result.error.errors.forEach((e) => {
          if (e.path[0]) errors[String(e.path[0])] = e.message;
        });
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      mutate(result.data);
    }, [monsterId, title, content, difficulty, game, mutate]);

    const errorMessage =
      error instanceof ApiError
        ? ((error.body as { message?: string })?.message ?? 'Something went wrong')
        : error
          ? 'Something went wrong'
          : null;

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['85%']}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <BottomSheetView style={{ flex: 1, padding: 16 }}>
          <Text style={{ color: '#fafaf9', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            New Strategy
          </Text>

          {/* Title */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Title</Text>
          <BottomSheetTextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Strategy title"
            placeholderTextColor="#57534e"
            maxLength={200}
            style={{
              backgroundColor: '#0c0a09',
              borderWidth: 1,
              borderColor: fieldErrors.title ? '#ef4444' : '#292524',
              borderRadius: 6,
              padding: 10,
              color: '#fafaf9',
              fontSize: 14,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: 2 }}>
            {fieldErrors.title ? (
              <Text style={{ color: '#ef4444', fontSize: 12 }}>{fieldErrors.title}</Text>
            ) : (
              <View />
            )}
            <Text style={{ color: '#57534e', fontSize: 12 }}>{title.length}/200</Text>
          </View>

          {/* Game */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Game</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ height: 44 }}
            contentContainerStyle={{ height: 44, alignItems: 'center', marginBottom: 12 }}
          >
            {GAMES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setGame(value)}
                style={{
                  marginRight: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: game === value ? '#2f9e8f' : '#44403c',
                  backgroundColor: game === value ? 'rgba(47,158,143,0.2)' : 'transparent',
                }}
              >
                <Text style={{ color: game === value ? '#2f9e8f' : '#a8a29e', fontSize: 13 }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Difficulty */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Difficulty</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: difficulty === d ? '#2f9e8f' : '#44403c',
                  backgroundColor: difficulty === d ? 'rgba(47,158,143,0.2)' : 'transparent',
                }}
              >
                <Text style={{ color: difficulty === d ? '#2f9e8f' : '#a8a29e', fontSize: 13 }}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
          <Text style={{ color: '#a8a29e', fontSize: 12, marginBottom: 4 }}>Description</Text>
          <BottomSheetTextInput
            value={content}
            onChangeText={setContent}
            placeholder="Describe your strategy…"
            placeholderTextColor="#57534e"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={{
              backgroundColor: '#0c0a09',
              borderWidth: 1,
              borderColor: fieldErrors.content ? '#ef4444' : '#292524',
              borderRadius: 6,
              padding: 10,
              color: '#fafaf9',
              fontSize: 14,
              minHeight: 120,
              marginBottom: fieldErrors.content ? 2 : 16,
            }}
          />
          {fieldErrors.content && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
              {fieldErrors.content}
            </Text>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={isPending}
            style={{
              backgroundColor: isPending ? '#1c7a6e' : '#2f9e8f',
              borderRadius: 6,
              paddingVertical: 12,
              alignItems: 'center',
              marginBottom: 8,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#0c0a09" />
            ) : (
              <Text style={{ color: '#0c0a09', fontWeight: '600', fontSize: 15 }}>
                Submit Strategy
              </Text>
            )}
          </Pressable>

          {errorMessage && (
            <Text style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
              {errorMessage}
            </Text>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
