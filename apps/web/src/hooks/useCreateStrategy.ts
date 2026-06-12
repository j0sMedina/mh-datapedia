import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { CreateStrategy } from '@mh-datapedia/shared';
import type { Strategy } from '../lib/types';

export function useCreateStrategy(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStrategy) =>
      apiPost<{ data: Strategy }>('/api/strategies', data).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'strategies'] }),
  });
}
