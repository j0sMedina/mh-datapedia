import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  Text,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/lib/api';
import { MonsterCard } from '../../src/components/monsters/MonsterCard';
import { TypeFilterChip } from '../../src/components/monsters/TypeFilterChip';
import { Spinner } from '../../src/components/ui/Spinner';
import type { Monster, MonsterType } from '@mh-datapedia/shared';

const MONSTER_TYPES: MonsterType[] = [
  'Large', 'Small', 'ElderDragon', 'FlyingWyvern', 'BruteWyvern',
  'FangedBeast', 'BirdWyvern', 'Leviathan', 'Amphibian', 'Temnoceran',
  'Apex', 'Afflicted', 'Tempered', 'Construct', 'DemiElderDragon',
  'Cephalopod', 'Machine',
];

interface ListResponse {
  data: Monster[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default function MonstersScreen() {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<MonsterType | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
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
    <View className="flex-1 bg-stone-950">
      {/* Search bar */}
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

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-stone-800 py-2"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <TypeFilterChip
          label="All"
          active={activeType === null}
          onPress={() => setActiveType(null)}
        />
        {MONSTER_TYPES.map((type) => (
          <TypeFilterChip
            key={type}
            label={type}
            active={activeType === type}
            onPress={() => handleTypePress(type)}
          />
        ))}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <Spinner size="lg" />
      ) : monsters.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-500">No monsters found.</Text>
        </View>
      ) : (
        <FlatList
          data={monsters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MonsterCard monster={item} />}
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
