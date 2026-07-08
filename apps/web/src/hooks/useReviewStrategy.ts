import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '../lib/api';
import type { Strategy } from '../lib/types';

interface ReviewPayload {
  id: string;
  action: 'approve' | 'reject';
  reason?: string;
}

export function useReviewStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: ReviewPayload) =>
      apiPatch<{ data: Strategy }>(`/api/strategies/${id}/review`, { action, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies', 'pending'] });
    },
  });
}
