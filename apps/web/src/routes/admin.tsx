import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../lib/api';
import type { AdminUser, AuditEntry } from '../lib/types';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import type { Role } from '@mh-datapedia/shared';

const ROLE_RANK: Record<Role, number> = { USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3 };
const MS_PER_DAY = 86_400_000;

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/' });
    const role = context.auth.user.role as Role;
    if (ROLE_RANK[role] < ROLE_RANK['HELPER']) throw redirect({ to: '/' });
  },
  component: AdminPage,
});

// ── Hooks ────────────────────────────────────────────────────────────────────

function useAdminUsers(search: string) {
  const debouncedSearch = useDebounce(search, 400);
  return useQuery({
    queryKey: ['admin', 'users', debouncedSearch],
    queryFn: () =>
      apiGet<{ users: AdminUser[] }>(
        `/api/admin/users${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ).then((r) => r.users),
  });
}

function useAuditLog(page: number, search: string) {
  return useQuery({
    queryKey: ['admin', 'audit', page, search],
    queryFn: () =>
      apiGet<{
        entries: AuditEntry[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/admin/audit?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });
}

// ── Role badge ───────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  USER: 'bg-stone-700 text-stone-300',
  HELPER: 'bg-blue-900/40 text-blue-400 border border-blue-800/50',
  ADMIN: 'bg-accent/20 text-accent border border-accent/40',
  MASTER: 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className={`font-semibold ${ROLE_BADGE[role] ?? ROLE_BADGE.USER}`}>
      {role}
    </Badge>
  );
}

// ── Ban Modal ─────────────────────────────────────────────────────────────────

interface BanTarget { id: string; username: string }

const DURATION_OPTIONS = [
  { label: 'Permanent', value: null },
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
] as const;

function BanModal({
  target,
  onConfirm,
  onCancel,
  isPending,
}: {
  target: BanTarget;
  onConfirm: (reason: string, bannedUntil: string | null) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [durationKey, setDurationKey] = useState<number>(0); // index into DURATION_OPTIONS
  const [customDays, setCustomDays] = useState('');
  const isCustom = durationKey === DURATION_OPTIONS.length; // past the last fixed option

  function computeBannedUntil(): string | null {
    const opt = DURATION_OPTIONS[durationKey];
    const days = isCustom ? parseInt(customDays) : 'days' in (opt ?? {}) ? (opt as { days: number }).days : null;
    if (!days || days < 1) return null;
    return new Date(Date.now() + days * MS_PER_DAY).toISOString();
  }

  const canSubmit = reason.trim().length >= 10 && (!isCustom || parseInt(customDays) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm">
      <div
        className="mh-panel w-full max-w-md mx-4 p-6"
        style={{ '--mh-cut': '14px' } as React.CSSProperties}
      >
        <div className="mh-section-head text-sm mb-4">Ban {target.username}</div>

        <div className="space-y-4">
          <div>
            <label className="block text-stone-400 text-xs mb-1 uppercase tracking-wider">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-accent resize-none"
              rows={3}
              placeholder="Minimum 10 characters…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="text-red-400 text-xs mt-1">At least 10 characters required.</p>
            )}
          </div>

          <div>
            <label className="block text-stone-400 text-xs mb-2 uppercase tracking-wider">Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setDurationKey(i)}
                  className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                    durationKey === i && !isCustom
                      ? 'bg-accent/20 text-accent border-accent/40'
                      : 'border-stone-700 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setDurationKey(DURATION_OPTIONS.length)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                  isCustom
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'border-stone-700 text-stone-400 hover:border-stone-500'
                }`}
              >
                Custom
              </button>
            </div>
            {isCustom && (
              <input
                type="number"
                min={1}
                className="mt-2 w-28 bg-stone-900 border border-stone-700 rounded px-3 py-1.5 text-sm text-stone-100 focus:outline-none focus:border-accent"
                placeholder="Days"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-stone-700 hover:border-stone-500 text-stone-400 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit || isPending}
            onClick={() => onConfirm(reason.trim(), computeBannedUntil())}
            className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-40 text-stone-100 font-semibold rounded transition-colors"
          >
            {isPending ? 'Banning…' : 'Confirm Ban'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audit log helpers ─────────────────────────────────────────────────────────

function formatAction(entry: AuditEntry): string {
  switch (entry.action) {
    case 'ROLE_CHANGE': {
      const m = entry.metadata as { from: string; to: string };
      return `Role changed ${m.from} → ${m.to}`;
    }
    case 'BAN': {
      const m = entry.metadata as { reason: string; bannedUntil: string | null };
      return `Banned${m.bannedUntil ? ` until ${new Date(m.bannedUntil).toLocaleDateString()}` : ' permanently'} — ${m.reason}`;
    }
    case 'UNBAN':
      return 'Unbanned';
    default:
      return entry.action;
  }
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ viewerRole }: { viewerRole: Role }) {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { data: users, isLoading } = useAdminUsers(search);
  const [banTarget, setBanTarget] = useState<BanTarget | null>(null);

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason, bannedUntil }: { id: string; reason: string; bannedUntil: string | null }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/ban`, {
        banned: true,
        reason,
        bannedUntil,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setBanTarget(null);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/ban`, { banned: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const busy = (id: string) =>
    (roleMutation.isPending && (roleMutation.variables as { id: string } | undefined)?.id === id) ||
    (banMutation.isPending && (banMutation.variables as { id: string } | undefined)?.id === id) ||
    (unbanMutation.isPending && (unbanMutation.variables as { id: string } | undefined)?.id === id);

  function canManage(targetRole: Role): boolean {
    return ROLE_RANK[viewerRole] > ROLE_RANK[targetRole];
  }

  function roleControls(u: AdminUser) {
    if (viewerRole === 'HELPER') return null;
    if (!canManage(u.role as Role)) return null;

    if (u.banned) {
      return (
        <div className="flex gap-2 justify-end">
          <button
            key="unban"
            disabled={busy(u.id)}
            onClick={() => unbanMutation.mutate({ id: u.id })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-accent/50 hover:text-accent transition-colors disabled:opacity-40"
          >
            Unban
          </button>
        </div>
      );
    }

    const controls: React.ReactElement[] = [];

    if (viewerRole === 'ADMIN') {
      if (u.role === 'USER') {
        controls.push(
          <button
            key="promote-helper"
            disabled={busy(u.id)}
            onClick={() => roleMutation.mutate({ id: u.id, role: 'HELPER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
          >
            → Helper
          </button>,
        );
      }
      if (u.role === 'HELPER') {
        controls.push(
          <button
            key="demote-user"
            disabled={busy(u.id)}
            onClick={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            Revoke Helper
          </button>,
        );
      }
    }

    if (viewerRole === 'MASTER') {
      if (u.role === 'USER') {
        controls.push(
          <button key="promote-helper" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'HELPER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-blue-800/60 text-blue-400 hover:bg-blue-900/20 transition-colors disabled:opacity-40">
            → Helper
          </button>,
          <button key="promote-admin" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'ADMIN' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40">
            → Admin
          </button>,
        );
      }
      if (u.role === 'HELPER') {
        controls.push(
          <button key="demote-user" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40">
            → User
          </button>,
          <button key="promote-admin" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'ADMIN' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40">
            → Admin
          </button>,
        );
      }
      if (u.role === 'ADMIN') {
        controls.push(
          <button key="demote-user" disabled={busy(u.id)} onClick={() => roleMutation.mutate({ id: u.id, role: 'USER' })}
            className="px-3 py-1 rounded text-xs font-semibold border border-stone-600 text-stone-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40">
            → User
          </button>,
        );
      }
    }

    // Ban (only shown when user is not banned)
    controls.push(
      <button
        key="ban"
        disabled={busy(u.id)}
        onClick={() => setBanTarget({ id: u.id, username: u.username })}
        className="px-3 py-1 rounded text-xs font-semibold border border-red-800/60 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
      >
        Ban
      </button>,
    );

    return <div className="flex gap-2 justify-end">{controls}</div>;
  }

  return (
    <>
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-50 placeholder-stone-500 focus:outline-none focus:border-accent"
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                {viewerRole !== 'HELPER' && <th className="px-4 py-3" />}
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
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      u.banned
                        ? 'bg-red-900/40 text-red-400 border border-red-800/50'
                        : 'bg-stone-700 text-stone-300'
                    }`}>
                      {u.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  {viewerRole !== 'HELPER' && (
                    <td className="px-4 py-3">{roleControls(u)}</td>
                  )}
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={viewerRole !== 'HELPER' ? 6 : 5} className="px-4 py-10 text-center text-stone-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {banTarget && (
        <BanModal
          target={banTarget}
          onConfirm={(reason, bannedUntil) => banMutation.mutate({ id: banTarget.id, reason, bannedUntil })}
          onCancel={() => setBanTarget(null)}
          isPending={banMutation.isPending}
        />
      )}
    </>
  );
}

// ── Audit Log tab ─────────────────────────────────────────────────────────────

type AuditFilter = 'all' | 'role-change' | 'bans' | 'unbans';

const AUDIT_FILTERS: { key: AuditFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'role-change', label: 'Role change' },
  { key: 'bans', label: 'Bans' },
  { key: 'unbans', label: 'Unbans' },
];

const AUDIT_ACTION_MAP: Record<AuditFilter, string | null> = {
  all: null,
  'role-change': 'ROLE_CHANGE',
  bans: 'BAN',
  unbans: 'UNBAN',
};

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const { data, isLoading } = useAuditLog(page, search);

  const entries = (data?.entries ?? []).filter((e) => {
    const action = AUDIT_ACTION_MAP[filter];
    return action === null || e.action === action;
  });

  return (
    <>
      {/* Filter navbar */}
      <div className="flex gap-1 mb-6 border-b border-stone-700">
        {AUDIT_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              filter === f.key
                ? 'text-accent border-b-2 border-accent -mb-px'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <input
          className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-stone-50 placeholder-stone-500 focus:outline-none focus:border-accent"
          placeholder="Search by actor or target username…"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
      <div className="flex justify-center py-16"><Spinner size="lg" /></div>
    ) : (
      <>
      <div className="mh-panel overflow-hidden" style={{ '--mh-cut': '16px' } as React.CSSProperties}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-700 text-stone-400 uppercase text-xs tracking-wider">
              <th className="text-left px-4 py-3">Actor</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Target</th>
              <th className="text-left px-4 py-3">Details</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/40 transition-colors">
                <td className="px-4 py-3 font-medium text-stone-100">{e.actorUsername}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    e.action === 'BAN'
                      ? 'bg-red-900/40 text-red-400 border border-red-800/50'
                      : e.action === 'UNBAN'
                      ? 'bg-stone-700 text-stone-300'
                      : 'bg-blue-900/40 text-blue-400 border border-blue-800/50'
                  }`}>
                    {e.action.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-400">{e.targetUsername ?? '—'}</td>
                <td className="px-4 py-3 text-stone-500 text-xs max-w-xs truncate">
                  {formatAction(e)}
                </td>
                <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-xs">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border border-stone-700 text-stone-400 rounded hover:border-stone-500 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-stone-500">
            {page} / {data.meta.totalPages}
          </span>
          <button
            disabled={page === data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border border-stone-700 text-stone-400 rounded hover:border-stone-500 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
      </>
    )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'users' | 'audit';

function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const viewerRole = (user?.role ?? 'USER') as Role;

  const tabs: { key: Tab; label: string; minRole: Role }[] = [
    { key: 'users', label: 'Users', minRole: 'HELPER' },
    { key: 'audit', label: 'Audit Log', minRole: 'ADMIN' },
  ];

  const visibleTabs = tabs.filter((t) => ROLE_RANK[viewerRole] >= ROLE_RANK[t.minRole]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mh-section-head text-2xl mb-8">Admin Panel</div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-stone-700 mb-8">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab viewerRole={viewerRole} />}
      {tab === 'audit' && <AuditLogTab />}
    </div>
  );
}
