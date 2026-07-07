import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { MonsterListItem, PaginatedResponse } from '../lib/types';

export interface MonsterFiltersInput {
  type?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export function useMonsters(filters: MonsterFiltersInput = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));

  return useQuery({
    queryKey: ['monsters', filters],
    queryFn: () =>
      apiGet<PaginatedResponse<MonsterListItem>>(`/api/monsters?${params.toString()}`),
  });
}
