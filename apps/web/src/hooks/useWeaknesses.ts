import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { ElementWeakness } from '../lib/types';

export function useWeaknesses(monsterId: string) {
  return useQuery({
    queryKey: ['monsters', monsterId, 'weaknesses'],
    queryFn: () =>
      apiGet<{ data: ElementWeakness[] }>(`/api/monsters/${monsterId}/weaknesses`).then(
        (r) => r.data,
      ),
    enabled: !!monsterId,
  });
}
