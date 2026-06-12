import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { MonsterDrop } from '../lib/types';

export function useDrops(monsterId: string, game?: string, rank?: string) {
  const params = new URLSearchParams();
  if (game) params.set('game', game);
  if (rank) params.set('rank', rank);

  return useQuery({
    queryKey: ['monsters', monsterId, 'drops', { game, rank }],
    queryFn: () =>
      apiGet<{ data: MonsterDrop[] }>(
        `/api/monsters/${monsterId}/drops?${params.toString()}`,
      ).then((r) => r.data),
    enabled: !!monsterId,
  });
}
