import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RegisterSchema } from '@mh-datapedia/shared';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ApiError } from '../../lib/api';

const FormSchema = RegisterSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof FormSchema>;

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
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) });

  const onSubmit = async (data: FormValues) => {
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
      <Input
        id="reg-confirm-password"
        label="Confirm Password"
        type="password"
        placeholder="Repeat your password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      {errors.root && <p className="text-red-400 text-sm">{errors.root.message}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
