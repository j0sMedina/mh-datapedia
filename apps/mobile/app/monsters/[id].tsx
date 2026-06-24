import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/hooks/useFavorites';
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
  const { user } = useAuth();
  const { isFavorited, toggle } = useFavorites();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['monster', id],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiGet<{ data: any }>(`/api/monsters/${id}`).then((r) => r.data),
    enabled: !!id,
  });

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
    <View style={{ flex: 1, backgroundColor: '#0c0a09' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={activeTab !== 1}
      >
        {/* Hero image */}
        {data.imageUrl ? (
          <Image
            source={{ uri: data.imageUrl }}
            style={{ width: '100%', aspectRatio: 16 / 9 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1c1917', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#57534e', fontSize: 18 }}>{data.name}</Text>
          </View>
        )}

        {/* Name + title + boss badge + heart */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fafaf9', fontSize: 20, fontWeight: 'bold' }}>{data.name}</Text>
            <Text style={{ color: '#a8a29e', fontSize: 13 }}>{data.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {data.isBoss && <Badge variant="red">Boss</Badge>}
            <Pressable
              onPress={() => {
                if (!user) {
                  router.push('/auth/login');
                  return;
                }
                toggle(id);
              }}
              hitSlop={8}
            >
              <Ionicons
                name={user && isFavorited(id) ? 'heart' : 'heart-outline'}
                size={24}
                color={user && isFavorited(id) ? '#ef4444' : '#57534e'}
              />
            </Pressable>
          </View>
        </View>

        {/* Tab strip */}
        <TabStrip tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        {activeTab === 0 && (
          <OverviewTab
            monster={{
              description: data.description,
              habitats: data.habitats ?? [],
              ailments: data.ailments ?? [],
              isBoss: data.isBoss,
              subspecies: data.subspecies ?? [],
              parent: data.parent,
            }}
          />
        )}
        {activeTab === 1 && <HitzonesTab hitzones={data.hitzones ?? []} />}
        {activeTab === 2 && <WeaknessesTab weaknesses={data.weaknesses ?? []} />}
        {activeTab === 3 && <DropsTab drops={data.drops ?? []} />}
        {activeTab === 4 && (
          <StrategiesTab strategies={data.strategies ?? []} monsterId={id} />
        )}
      </ScrollView>
    </View>
  );
}
