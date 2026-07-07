import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { User } from '@mh-datapedia/shared';

export function useTotpVerify() {
  return useMutation({
    mutationFn: (data: { mfaPendingToken: string; code: string }) =>
      apiPost<{ user: User; accessToken: string; expiresIn: number }>(
        '/api/auth/totp/verify',
        data,
      ),
  });
}
