import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
  createdAt: string;
}

export function useAdminUsers() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () =>
      apiGet<{ users: AdminUser[] }>(
        `/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ).then((r) => r.users),
    enabled: user?.role === 'ADMIN' || user?.role === 'MASTER',
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'USER' | 'ADMIN' }) =>
      apiPatch(`/api/admin/users/${userId}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, banned }: { userId: string; banned: boolean }) =>
      apiPatch(`/api/admin/users/${userId}/ban`, { banned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return { users, isLoading, search, setSearch, roleMutation, banMutation };
}
