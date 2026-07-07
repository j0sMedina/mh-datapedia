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
    <div className="relative overflow-hidden flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: "url('/frontpage.jpg')", filter: 'blur(24px)' }} />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 max-w-md w-full bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20 shadow-xl">
        <h1 className="text-2xl font-bold text-stone-50 mb-6">Log in</h1>
        <LoginForm onSuccess={() => navigate({ to: '/' })} />
      </div>
    </div>
  );
}
