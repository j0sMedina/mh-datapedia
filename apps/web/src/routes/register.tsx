import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router';
import { RegisterForm } from '../components/auth/RegisterForm';

export const Route = createFileRoute('/register')({
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: '/monsters' });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-stone-50 mb-2 text-center">Create account</h1>
        <p className="text-stone-400 text-sm text-center mb-8">
          Join to save favorites and contribute strategies.
        </p>
        <div className="bg-stone-900 border border-stone-800 rounded-lg p-6">
          <RegisterForm onSuccess={() => navigate({ to: '/monsters' })} />
          <p className="mt-4 text-center text-stone-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
