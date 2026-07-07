import { useMutation } from '@tanstack/react-query';
import { apiGet } from '../lib/api';

export function useTotpSetup() {
  return useMutation({
    mutationFn: () =>
      apiGet<{ qrCodeDataUrl: string; secret: string }>('/api/auth/totp/setup'),
  });
}
