import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { Hitzone } from '../lib/types';

export function useHitzones(monsterId: string) {
  return useQuery({
    queryKey: ['monsters', monsterId, 'hitzones'],
    queryFn: () =>
      apiGet<{ data: Hitzone[] }>(`/api/monsters/${monsterId}/hitzones`).then((r) => r.data),
    enabled: !!monsterId,
  });
}
