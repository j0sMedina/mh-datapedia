import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { Session } from '@mh-datapedia/shared';

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiGet<Session[]>('/api/auth/sessions'),
  });
}
