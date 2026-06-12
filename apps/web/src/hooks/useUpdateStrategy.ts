import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../lib/api';
import type { UpdateStrategy } from '@mh-datapedia/shared';
import type { Strategy } from '../lib/types';

export function useUpdateStrategy(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStrategy }) =>
      apiPut<{ data: Strategy }>(`/api/strategies/${id}`, data).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'strategies'] }),
  });
}
