import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema } from '@mh-datapedia/shared';
import type { Register } from '@mh-datapedia/shared';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ApiError } from '../../lib/api';

interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register: registerUser } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Register>({ resolver: zodResolver(RegisterSchema) });

  const onSubmit = async (data: Register) => {
    try {
      await registerUser(data.email, data.username, data.password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('email', { message: 'Email already in use.' });
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="reg-email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        id="reg-username"
        label="Username"
        placeholder="hunter123"
        error={errors.username?.message}
        {...register('username')}
      />
      <Input
        id="reg-password"
        label="Password"
        type="password"
        placeholder="Minimum 8 characters"
        error={errors.password?.message}
        {...register('password')}
      />
      {errors.root && <p className="text-red-400 text-sm">{errors.root.message}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
