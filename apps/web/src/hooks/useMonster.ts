import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { MonsterDetail } from '../lib/types';

export function useMonster(id: string) {
  return useQuery({
    queryKey: ['monsters', id],
    queryFn: () =>
      apiGet<{ data: MonsterDetail }>(`/api/monsters/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}
