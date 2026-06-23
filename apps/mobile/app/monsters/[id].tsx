import { useState, useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/lib/api';
import { TabStrip } from '../../src/components/ui/TabStrip';
import { Spinner } from '../../src/components/ui/Spinner';
import { Badge } from '../../src/components/ui/Badge';
import { OverviewTab } from '../../src/components/detail/OverviewTab';
import { HitzonesTab } from '../../src/components/detail/HitzonesTab';
import { WeaknessesTab } from '../../src/components/detail/WeaknessesTab';
import { DropsTab } from '../../src/components/detail/DropsTab';
import { StrategiesTab } from '../../src/components/detail/StrategiesTab';

const TABS = ['Overview', 'Hitzones', 'Weaknesses', 'Drops', 'Strategies'];

export default function MonsterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['monster', id],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiGet<{ data: any }>(`/api/monsters/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  // Set header title once we have the monster name
  useEffect(() => {
    if (data?.name) {
      navigation.setOptions({ headerTitle: data.name });
    }
  }, [data?.name, navigation]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-stone-950 justify-center">
        <Spinner size="lg" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-950">
        <Text className="text-stone-400 text-base">Failed to load monster.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-stone-950">
      {/* Hero image */}
      {data.imageUrl ? (
        <Image
          source={{ uri: data.imageUrl }}
          className="w-full"
          style={{ aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />
      ) : (
        <View className="w-full bg-stone-900 items-center justify-center" style={{ aspectRatio: 16 / 9 }}>
          <Text className="text-stone-600 text-lg">{data.name}</Text>
        </View>
      )}

      {/* Name + title + boss badge */}
      <View className="px-4 pt-3 pb-2 flex-row items-start">
        <View className="flex-1">
          <Text className="text-stone-50 text-xl font-bold">{data.name}</Text>
          <Text className="text-stone-400 text-sm">{data.title}</Text>
        </View>
        {data.isBoss && <Badge variant="red">Boss</Badge>}
      </View>

      {/* Tab strip */}
      <TabStrip tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 0 && (
          <OverviewTab
            monster={{
              description: data.description,
              habitats: data.habitats,
              ailments: data.ailments,
              isBoss: data.isBoss,
              subspecies: data.subspecies,
              parent: data.parent,
            }}
          />
        )}
        {activeTab === 1 && <HitzonesTab hitzones={data.hitzones} />}
        {activeTab === 2 && <WeaknessesTab weaknesses={data.weaknesses} />}
        {activeTab === 3 && <DropsTab drops={data.drops} />}
        {activeTab === 4 && <StrategiesTab strategies={data.strategies} />}
      </View>
    </View>
  );
}
