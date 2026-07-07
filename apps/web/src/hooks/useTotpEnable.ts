import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';

export function useTotpEnable() {
  return useMutation({
    mutationFn: (data: { code: string }) =>
      apiPost<{ backupCodes: string[] }>('/api/auth/totp/enable', data),
  });
}
