import { useEffect, useState } from 'react';

interface Props {
  bannedReason: string;
  bannedAt: string | null;
  bannedUntil: string | null;
  onLogout: () => void;
}

const COUNTDOWN_SECONDS = 100;

export function BannedModal({ bannedReason, bannedAt, bannedUntil, onLogout }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          onLogout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onLogout]);

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Permanent';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 backdrop-blur-sm">
      <div
        className="mh-panel w-full max-w-md mx-4 p-8"
        style={{ '--mh-cut': '16px' } as React.CSSProperties}
      >
        <div className="mh-section-head text-red-400 text-xl mb-6">Account Suspended</div>

        <div className="space-y-4 mb-8">
          <div>
            <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Reason</p>
            <p className="text-stone-100 text-sm">{bannedReason}</p>
          </div>

          {bannedAt && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Banned since</p>
              <p className="text-stone-100 text-sm">{formatDate(bannedAt)}</p>
            </div>
          )}

          <div>
            <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Duration</p>
            <p className="text-stone-100 text-sm">
              {bannedUntil ? `Until ${formatDate(bannedUntil)}` : 'Permanent'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-stone-500 text-sm">
            Auto-logout in{' '}
            <span className="text-accent font-semibold font-mono">{seconds}s</span>
          </div>
          <button
            onClick={onLogout}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-stone-950 text-sm font-semibold rounded transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
