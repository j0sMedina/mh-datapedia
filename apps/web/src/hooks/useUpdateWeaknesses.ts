import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpsertWeaknesses } from '@mh-datapedia/shared';
import { apiPut } from '../lib/api';

export function useUpdateWeaknesses(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertWeaknesses) =>
      apiPut<{ data: unknown[] }>(`/api/monsters/${monsterId}/weaknesses`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'weaknesses'] });
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId] });
    },
  });
}
