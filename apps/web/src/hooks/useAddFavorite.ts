import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../lib/api';

export function useAddFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (monsterId: string) =>
      apiPost<void>(`/api/users/me/favorites/${monsterId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
