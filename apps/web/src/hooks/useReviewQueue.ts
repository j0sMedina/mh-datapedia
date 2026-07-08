import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { Strategy } from '../lib/types';

export interface PendingStrategy extends Strategy {
  monster: { id: string; name: string };
}

export function useReviewQueue() {
  return useQuery({
    queryKey: ['strategies', 'pending'],
    queryFn: () =>
      apiGet<{ data: PendingStrategy[] }>('/api/strategies/pending').then((r) => r.data),
  });
}
