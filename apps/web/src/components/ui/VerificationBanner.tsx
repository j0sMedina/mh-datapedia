import { useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';

interface Props {
  onResent: () => void;
}

export function VerificationBanner({ onResent }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleResend() {
    setSending(true);
    setError('');
    try {
      await apiPost('/api/auth/resend-verification');
      setSent(true);
      onResent();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setError('Already verified — try refreshing the page.');
      } else if (e instanceof ApiError && e.status === 429) {
        setError('Too many requests. Wait an hour before trying again.');
      } else {
        setError('Failed to send. Try again later.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-amber-500 px-4 py-2 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-3">
        <span className="bg-amber-900 text-amber-100 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
          Unverified
        </span>
        <span className="text-amber-950 font-medium">
          {sent
            ? 'Verification email sent — check your inbox.'
            : 'Verify your email to unlock all features.'}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {error && <span className="text-red-800 text-xs">{error}</span>}
        {!sent && (
          <button
            onClick={handleResend}
            disabled={sending}
            className="bg-amber-900 text-amber-100 hover:bg-amber-800 px-3 py-1 rounded text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending…' : 'Resend email'}
          </button>
        )}
      </div>
    </div>
  );
}
