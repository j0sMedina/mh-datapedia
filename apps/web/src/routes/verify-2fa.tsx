import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTotpVerify } from '../hooks/useTotpVerify';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ApiError } from '../lib/api';

export const Route = createFileRoute('/verify-2fa')({
  component: VerifyTwoFactorPage,
});

function VerifyTwoFactorPage() {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const totpVerify = useTotpVerify();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const mfaPendingToken = sessionStorage.getItem('mfaPendingToken');

  useEffect(() => {
    if (!mfaPendingToken) {
      navigate({ to: '/login' });
    }
  }, [mfaPendingToken, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaPendingToken) return;
    setError('');
    try {
      const result = await totpVerify.mutateAsync({ mfaPendingToken, code });
      sessionStorage.removeItem('mfaPendingToken');
      loginWithTokens(result.user, result.accessToken);
      navigate({ to: '/' });
    } catch (err) {
      if (err instanceof ApiError) {
        if ((err.body as { code?: string })?.code === 'UNAUTHORIZED') {
          sessionStorage.removeItem('mfaPendingToken');
          setError('Session expired. Please log in again.');
          setTimeout(() => navigate({ to: '/login' }), 2000);
        } else if ((err.body as { code?: string })?.code === 'INVALID_CODE') {
          setError('Invalid code. Please try again.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  if (!mfaPendingToken) return null;

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-2">Two-Factor Authentication</h1>
        <p className="text-stone-400 text-sm mb-6">
          Enter your 6-digit authenticator code, or a 10-character backup code.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="totp-verify-code"
            label="Code"
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="000000"
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={totpVerify.isPending || !code}>
            {totpVerify.isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      </div>
    </div>
  );
}
