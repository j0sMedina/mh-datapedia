import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: '/' });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 rounded-lg p-8 border border-stone-800">
        <h1 className="text-2xl font-bold text-stone-50 mb-6">Log in</h1>
        <LoginForm onSuccess={() => navigate({ to: '/' })} />
      </div>
    </div>
  );
}
