import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '../lib/api';

export function useDeleteStrategy(monsterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/strategies/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'strategies'] }),
  });
}
