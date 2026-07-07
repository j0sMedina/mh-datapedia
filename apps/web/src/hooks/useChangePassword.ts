import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { ChangePassword } from '@mh-datapedia/shared';

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePassword) =>
      apiPost<{ message: string }>('/api/auth/change-password', data),
  });
}
