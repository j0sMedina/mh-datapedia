import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { apiPost } from '../lib/api';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost('/api/auth/forgot-password', { email });
    } catch {
      // always show success — don't reveal whether email is registered
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-2">Forgot password</h1>

        {submitted ? (
          <div className="text-center mt-4">
            <p className="text-stone-400 mb-6">
              If that email is registered, you'll receive a reset link shortly. Check your inbox.
            </p>
            <Link to="/" className="text-teal-500 hover:text-teal-400 text-sm">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <p className="text-stone-400 text-sm">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="fp-email" className="block text-sm font-medium text-stone-300 mb-1">
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-stone-50 px-4 py-2 rounded font-medium transition-colors"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <div className="text-center">
              <Link to="/" className="text-stone-500 hover:text-stone-400 text-sm">
                Back to home
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
