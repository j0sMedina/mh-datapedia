import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { Strategy } from '../lib/types';

export function useStrategies(monsterId: string) {
  return useQuery({
    queryKey: ['monsters', monsterId, 'strategies'],
    queryFn: () =>
      apiGet<{ data: Strategy[] }>(`/api/monsters/${monsterId}/strategies`).then(
        (r) => r.data,
      ),
    enabled: !!monsterId,
  });
}
