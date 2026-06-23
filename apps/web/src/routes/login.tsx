import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginForm } from '../components/auth/LoginForm';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: '/monsters' });
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-stone-50 mb-2 text-center">Welcome back</h1>
        <p className="text-stone-400 text-sm text-center mb-8">
          Sign in to save favorites and write strategies.
        </p>
        <div className="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <LoginForm onSuccess={() => navigate({ to: redirectTo ?? '/monsters' })} />
          <p className="mt-4 text-center text-stone-500 text-sm">
            No account?{' '}
            <Link to="/register" className="text-accent hover:text-accent-hover">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
