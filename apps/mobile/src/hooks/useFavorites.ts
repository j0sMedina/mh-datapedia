import { Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiDelete, ApiError } from '../lib/api';
import type { Monster } from '@mh-datapedia/shared';

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['favorites'],
    queryFn: () =>
      apiGet<{ data: Monster[] }>('/api/users/me/favorites').then((r) => r.data),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (monsterId: string) =>
      apiPost(`/api/users/me/favorites/${monsterId}`),
    onMutate: async (monsterId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<Monster[]>(['favorites']);
      // Try to read full monster data from the detail cache (populated when user viewed the detail screen).
      // If not cached, skip optimistic insert and rely on invalidation in onSettled.
      const cached = queryClient.getQueryData<Monster>(['monster', monsterId]);
      if (cached) {
        queryClient.setQueryData<Monster[]>(['favorites'], (old = []) => [
          ...old,
          cached,
        ]);
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      queryClient.setQueryData(['favorites'], ctx?.previous);
      const code = err instanceof ApiError
        ? (err.body as { code?: string } | null)?.code
        : undefined;
      if (code === 'EMAIL_NOT_VERIFIED') {
        Alert.alert('Email not verified', 'Check your inbox and verify your email to save favorites.');
        return;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (monsterId: string) =>
      apiDelete(`/api/users/me/favorites/${monsterId}`),
    onMutate: async (monsterId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<Monster[]>(['favorites']);
      queryClient.setQueryData<Monster[]>(['favorites'], (old = []) =>
        old.filter((m) => m.id !== monsterId),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      queryClient.setQueryData(['favorites'], ctx?.previous);
      const code = err instanceof ApiError
        ? (err.body as { code?: string } | null)?.code
        : undefined;
      if (code === 'EMAIL_NOT_VERIFIED') {
        Alert.alert('Email not verified', 'Check your inbox and verify your email to save favorites.');
        return;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  function isFavorited(monsterId: string): boolean {
    return favorites.some((m) => m.id === monsterId);
  }

  function toggle(monsterId: string): void {
    if (isFavorited(monsterId)) {
      removeMutation.mutate(monsterId);
    } else {
      addMutation.mutate(monsterId);
    }
  }

  return { favorites, isFavorited, toggle, isLoading, isRefetching, refetch };
}
