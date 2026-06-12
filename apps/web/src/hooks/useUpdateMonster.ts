import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../lib/api';
import type { UpdateMonster } from '@mh-datapedia/shared';
import type { MonsterDetail } from '../lib/types';

export function useUpdateMonster(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMonster) =>
      apiPut<{ data: MonsterDetail }>(`/api/monsters/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monsters'] });
      queryClient.invalidateQueries({ queryKey: ['monsters', id] });
    },
  });
}
