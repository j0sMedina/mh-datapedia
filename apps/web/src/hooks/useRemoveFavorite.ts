import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '../lib/api';

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (monsterId: string) => apiDelete(`/api/users/me/favorites/${monsterId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
