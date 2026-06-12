import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '../lib/api';
import { useNavigate } from '@tanstack/react-router';

export function useDeleteMonster() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/monsters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monsters'] });
      navigate({ to: '/monsters' });
    },
  });
}
