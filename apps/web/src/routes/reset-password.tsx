import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { apiPost, ApiError } from '../lib/api';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search) => ({ token: search.token as string | undefined }),
});

type Status = 'idle' | 'loading' | 'success' | 'error';

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => navigate({ to: '/login' }), 3000);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 text-center border border-stone-800">
          <h1 className="text-2xl font-bold text-stone-50 mb-4">Invalid link</h1>
          <p className="text-stone-400 mb-6">This reset link is missing a token.</p>
          <Link to="/forgot-password" className="text-teal-500 hover:text-teal-400 text-sm">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      await apiPost('/api/auth/reset-password', { token, password });
      setStatus('success');
      setMessage('Password reset successfully. Redirecting to login in 3 seconds.');
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string })?.code === 'INVALID_TOKEN') {
        setMessage('This link has expired or has already been used.');
        setErrorCode('INVALID_TOKEN');
      } else {
        setMessage('Something went wrong. Please try again.');
      }
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-2">Reset password</h1>

        {status === 'success' ? (
          <div className="text-center mt-4">
            <p className="text-stone-400">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label htmlFor="rp-password" className="block text-sm font-medium text-stone-300 mb-1">
                New password
              </label>
              <input
                id="rp-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label htmlFor="rp-confirm" className="block text-sm font-medium text-stone-300 mb-1">
                Confirm password
              </label>
              <input
                id="rp-confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600"
              />
            </div>
            {status === 'error' && (
              <>
                <p className="text-red-400 text-sm">{message}</p>
                {errorCode === 'INVALID_TOKEN' && (
                  <div className="text-center">
                    <Link to="/forgot-password" className="text-teal-500 hover:text-teal-400 text-sm">
                      Request a new link
                    </Link>
                  </div>
                )}
              </>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-stone-50 px-4 py-2 rounded font-medium transition-colors"
            >
              {status === 'loading' ? 'Resetting…' : 'Reset password'}
            </button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-stone-500 hover:text-stone-400 text-sm">
                Request a new link
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
