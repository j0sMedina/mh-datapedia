import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../lib/api';
import type { AdminUser } from '../lib/types';
import { Spinner } from '../components/ui/Spinner';

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/' });
    if (context.auth.user.role !== 'ADMIN') throw redirect({ to: '/' });
  },
  component: AdminPage,
});

function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () =>
      apiGet<{ users: AdminUser[] }>(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(
        (r) => r.users,
      ),
  });
}

function AdminPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const qc = useQueryClient();
  const { data: users, isLoading } = useAdminUsers(query);

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'USER' | 'ADMIN' }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/ban`, { banned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const busy = (id: string) =>
    (roleMutation.isPending && (roleMutation.variables as { id: string }).id === id) ||
    (banMutation.isPending && (banMutation.variables as { id: string }).id === id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mh-section-head text-2xl mb-8">User Management</div>

      {/* search */}
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-50 placeholder-stone-500 focus:outline-none focus:border-accent"
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setQuery(search)}
        />
        <button
          className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-stone-950 font-semibold rounded transition-colors"
          onClick={() => setQuery(search)}
        >
          Search
        </button>
        {query && (
          <button
            className="px-4 py-2 text-sm border border-stone-700 hover:border-stone-500 text-stone-400 rounded transition-colors"
            onClick={() => { setSearch(''); setQuery(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="mh-panel overflow-hidden" style={{ '--mh-cut': '16px' } as React.CSSProperties}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-700 text-stone-400 uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-center px-4 py-3">Role</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-stone-100">{u.username}</td>
                  <td className="px-4 py-3 text-stone-400">{u.email}</td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        u.role === 'ADMIN'
                          ? 'bg-accent/20 text-accent border border-accent/40'
                          : 'bg-stone-700 text-stone-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        u.banned
                          ? 'bg-red-900/40 text-red-400 border border-red-800/50'
                          : 'bg-stone-700 text-stone-300'
                      }`}
                    >
                      {u.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {/* role toggle */}
                      <button
                        disabled={busy(u.id)}
                        onClick={() =>
                          roleMutation.mutate({ id: u.id, role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })
                        }
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 ${
                          u.role === 'ADMIN'
                            ? 'border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400'
                            : 'border border-accent/50 text-accent hover:bg-accent/10'
                        }`}
                      >
                        {u.role === 'ADMIN' ? 'Revoke Admin' : 'Make Admin'}
                      </button>

                      {/* ban toggle */}
                      <button
                        disabled={busy(u.id)}
                        onClick={() => banMutation.mutate({ id: u.id, banned: !u.banned })}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 ${
                          u.banned
                            ? 'border border-stone-600 text-stone-400 hover:border-accent/50 hover:text-accent'
                            : 'border border-red-800/60 text-red-400 hover:bg-red-900/20'
                        }`}
                      >
                        {u.banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
