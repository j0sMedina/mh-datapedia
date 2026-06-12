import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { MonsterListItem } from '../lib/types';

export function useFavorites(enabled: boolean) {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: () =>
      apiGet<{ data: MonsterListItem[] }>('/api/users/me/favorites').then((r) => r.data),
    enabled,
  });
}
