import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema } from '@mh-datapedia/shared';
import type { Login } from '@mh-datapedia/shared';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ApiError } from '../../lib/api';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Login>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = async (data: Login) => {
    try {
      await login(data.email, data.password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('root', { message: 'Invalid email or password.' });
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="login-email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        id="login-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      {errors.root && <p className="text-red-400 text-sm">{errors.root.message}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
