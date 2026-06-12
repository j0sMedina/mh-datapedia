import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { MonsterListItem, PaginatedResponse } from '../lib/types';

export interface MonsterFiltersInput {
  game?: string;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useMonsters(filters: MonsterFiltersInput = {}) {
  const params = new URLSearchParams();
  if (filters.game) params.set('game', filters.game);
  if (filters.type) params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));

  return useQuery({
    queryKey: ['monsters', filters],
    queryFn: () =>
      apiGet<PaginatedResponse<MonsterListItem>>(`/api/monsters?${params.toString()}`),
  });
}
