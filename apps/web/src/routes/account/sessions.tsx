import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useSessions } from '../../hooks/useSessions';
import { useRevokeSession } from '../../hooks/useRevokeSession';
import { useRevokeOtherSessions } from '../../hooks/useRevokeOtherSessions';
import type { Session } from '@mh-datapedia/shared';

export const Route = createFileRoute('/account/sessions')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: SessionsPage,
});

function SessionsPage() {
  const { logout } = useAuth();
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const otherSessions = sessions?.filter((s) => !s.isCurrent) ?? [];

  async function handleRevoke(session: Session) {
    if (session.isCurrent) {
      await revokeSession.mutateAsync(session.id);
      await logout();
    } else {
      revokeSession.mutate(session.id);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-stone-500 hover:text-stone-400 text-sm">
            ← Account
          </Link>
          <h1 className="text-2xl font-bold text-stone-50 mt-2">Active Sessions</h1>
          <p className="text-stone-400 text-sm mt-1">
            Devices currently logged into your account.
          </p>
        </div>

        <div className="bg-stone-900 rounded-lg border border-stone-800 divide-y divide-stone-800">
          {isLoading && (
            <div className="p-6 text-stone-500 text-sm">Loading sessions…</div>
          )}

          {!isLoading && !sessions?.length && (
            <div className="p-6 text-stone-500 text-sm">No active sessions found.</div>
          )}

          {sessions?.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-stone-100 text-sm font-medium truncate">
                    {session.deviceLabel}
                  </span>
                  {session.isCurrent && (
                    <span className="bg-teal-700 text-stone-50 text-xs px-1.5 py-0.5 rounded shrink-0">
                      YOU
                    </span>
                  )}
                </div>
                <div className="text-stone-500 text-sm mt-0.5">
                  {session.ipAddress ?? 'Unknown IP'} · Last active{' '}
                  {new Date(session.lastUsedAt).toLocaleDateString()}
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => handleRevoke(session)}
                  disabled={revokeSession.isPending}
                  className="text-red-400 hover:text-red-300 text-sm shrink-0 disabled:opacity-50"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>

        {otherSessions.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => revokeOthers.mutate()}
              disabled={revokeOthers.isPending}
              className="w-full border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-600 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              {revokeOthers.isPending ? 'Logging out…' : 'Log out all other devices'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
