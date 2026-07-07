import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useSessions } from '../../hooks/useSessions';
import { useRevokeSession } from '../../hooks/useRevokeSession';
import { useRevokeOtherSessions } from '../../hooks/useRevokeOtherSessions';
import type { Session } from '@mh-datapedia/shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SessionsModal({ open, onClose }: Props) {
  const { logout } = useAuth();
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const otherSessions = sessions?.filter((s) => !s.isCurrent) ?? [];

  async function handleRevoke(session: Session) {
    if (session.isCurrent) {
      await revokeSession.mutateAsync(session.id);
      onClose();
      await logout();
    } else {
      revokeSession.mutate(session.id);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Active Sessions">
      <div className="flex flex-col gap-4">
        <p className="text-stone-400 text-sm">Devices currently logged into your account.</p>

        <div className="rounded-lg border border-white/10 divide-y divide-white/10">
          {isLoading && (
            <div className="p-4 text-stone-500 text-sm">Loading sessions…</div>
          )}
          {!isLoading && !sessions?.length && (
            <div className="p-4 text-stone-500 text-sm">No active sessions found.</div>
          )}
          {sessions?.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-3 gap-4">
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
                <div className="text-stone-500 text-xs mt-0.5">
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
          <button
            onClick={() => revokeOthers.mutate()}
            disabled={revokeOthers.isPending}
            className="w-full border border-white/10 text-stone-300 hover:text-stone-100 hover:border-white/20 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
          >
            {revokeOthers.isPending ? 'Logging out…' : 'Log out all other devices'}
          </button>
        )}
      </div>
    </Modal>
  );
}
