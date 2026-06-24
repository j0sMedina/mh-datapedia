import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  Text,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/lib/api';
import { MonsterCard } from '../../src/components/monsters/MonsterCard';
import { TypeFilterChip } from '../../src/components/monsters/TypeFilterChip';
import { Spinner } from '../../src/components/ui/Spinner';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthSheet } from '../../src/context/AuthSheetContext';
import type { Monster, MonsterType } from '@mh-datapedia/shared';

const ROW1_TYPES: MonsterType[] = [
  'Large', 'Small', 'Apex', 'Afflicted', 'Tempered', 'ElderDragon', 'DemiElderDragon',
];
const ROW2_TYPES: MonsterType[] = [
  'FlyingWyvern', 'BruteWyvern', 'FangedBeast', 'Temnoceran', 'BirdWyvern',
  'Construct', 'Leviathan', 'Amphibian', 'Cephalopod', 'Machine',
];

interface ListResponse {
  data: Monster[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default function MonstersScreen() {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<MonsterType | null>(null);
  const { user } = useAuth();
  const { openLoginSheet } = useAuthSheet();
  const { isFavorited, toggle } = useFavorites();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['monsters', search, activeType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (activeType) params.set('type', activeType);
      return apiGet<ListResponse>(`/api/monsters?${params}`);
    },
  });

  const handleTypePress = useCallback(
    (type: MonsterType) => setActiveType((prev) => (prev === type ? null : type)),
    [],
  );

  const monsters = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <View className="px-4 pt-3 pb-2">
        <TextInput
          className="bg-stone-900 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm placeholder:text-stone-500"
          placeholder="Search monsters…"
          placeholderTextColor="#78716c"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: '#292524' }}
        contentContainerStyle={{ flexDirection: 'column', paddingHorizontal: 16, paddingVertical: 6 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 36, gap: 6 }}>
          <TypeFilterChip
            label="All"
            active={activeType === null}
            onPress={() => setActiveType(null)}
          />
          {ROW1_TYPES.map((type) => (
            <TypeFilterChip
              key={type}
              label={type}
              active={activeType === type}
              onPress={() => handleTypePress(type)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 36, gap: 6 }}>
          {ROW2_TYPES.map((type) => (
            <TypeFilterChip
              key={type}
              label={type}
              active={activeType === type}
              onPress={() => handleTypePress(type)}
            />
          ))}
        </View>
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 bg-stone-950 items-center justify-center">
          <Spinner size="lg" />
        </View>
      ) : isError ? (
        <View className="flex-1 bg-stone-950 items-center justify-center">
          <Text className="text-stone-400 text-base">Failed to load monsters.</Text>
          <Pressable onPress={() => refetch()} className="mt-3">
            <Text className="text-accent text-sm">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={monsters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MonsterCard
              monster={item}
              isFavorited={user ? isFavorited(item.id) : undefined}
              onFavoriteToggle={
                user
                  ? () => toggle(item.id)
                  : openLoginSheet
              }
            />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-stone-500">No monsters found.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2f9e8f"
            />
          }
        />
      )}
    </View>
  );
}
