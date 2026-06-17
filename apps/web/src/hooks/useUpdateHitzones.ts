import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpsertHitzones } from '@mh-datapedia/shared';
import { apiPut } from '../lib/api';
import type { Hitzone } from '../lib/types';

export function useUpdateHitzones(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertHitzones) =>
      apiPut<{ data: Hitzone[] }>(`/api/monsters/${monsterId}/hitzones`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'hitzones'] });
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId] });
    },
  });
}
