import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search) => ({ token: search.token as string | undefined }),
});

type Status = 'loading' | 'success' | 'error';

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const { fetchUser } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    apiGet(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async () => {
        setStatus('success');
        setMessage('Email verified! You can now submit strategies and add favorites.');
        await fetchUser().catch(() => {}); // refresh in-memory auth state; don't fail verification if this errors
      })
      .catch((err: unknown) => {
        setStatus('error');
        const code = (err as { body?: { code?: string } })?.body?.code;
        if (code === 'ALREADY_VERIFIED') {
          setMessage('This email is already verified.');
        } else {
          setMessage('This link has expired or is invalid. Request a new one from the app.');
        }
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 text-center border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-4">
          {status === 'loading' && 'Verifying…'}
          {status === 'success' && 'Email Verified'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        {status === 'loading' && (
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        )}

        {status !== 'loading' && (
          <>
            <p className="text-stone-400 mb-6">{message}</p>
            <Link
              to="/"
              className="inline-block bg-teal-700 hover:bg-teal-600 text-stone-50 px-6 py-2 rounded font-medium transition-colors"
            >
              Go to Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
