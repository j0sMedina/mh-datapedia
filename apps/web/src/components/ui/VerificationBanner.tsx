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
    <div className="bg-amber-900/60 border-b border-amber-700 px-4 py-2 flex items-center justify-between gap-4 text-sm">
      <span className="text-amber-200">
        {sent
          ? 'Verification email sent — check your inbox.'
          : 'Please verify your email to unlock all features. Check your inbox for a link from onboarding@resend.dev.'}
      </span>
      {!sent && (
        <button
          onClick={handleResend}
          disabled={sending}
          className="shrink-0 text-amber-100 underline hover:text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Resend email'}
        </button>
      )}
      {error && <span className="text-red-400 shrink-0">{error}</span>}
    </div>
  );
}
