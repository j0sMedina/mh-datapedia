import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '../lib/api';

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete('/api/auth/sessions'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
