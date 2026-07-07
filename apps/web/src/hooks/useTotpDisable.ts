import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';

export function useTotpDisable() {
  return useMutation({
    mutationFn: (data: { password: string }) =>
      apiPost<{ message: string }>('/api/auth/totp/disable', data),
  });
}
