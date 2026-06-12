import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { CreateMonster } from '@mh-datapedia/shared';
import type { MonsterDetail } from '../lib/types';

export function useCreateMonster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMonster) =>
      apiPost<{ data: MonsterDetail }>('/api/monsters', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monsters'] }),
  });
}
