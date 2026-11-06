import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { loginSchema, type LoginValues } from '@/lib/validation/auth';
import { safeNextPath } from '@/lib/redirect';
import { signInTeacher } from '@/services/auth';
import { friendlyError } from '@/utils/errors';

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signInTeacher(values.email, values.password);
      navigate(safeNextPath(params.get('next')), { replace: true });
    } catch (error) {
      setFormError(friendlyError(error, 'Could not sign you in. Please try again.'));
    }
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-2 text-ink-600">Sign in to manage quizzes and host live games.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="space-y-2">
          <PasswordField
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm font-semibold text-flame-600 hover:text-flame-700">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-600">
        New here?{' '}
        <Link
          to={params.get('next') ? `/register?next=${encodeURIComponent(safeNextPath(params.get('next')))}` : '/register'}
          className="font-semibold text-ink-900 underline-offset-4 hover:underline">
          Create a teacher account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-ink-500">
        Student?{' '}
        <Link to="/join" className="font-semibold text-ink-700 underline-offset-4 hover:underline">
          Join a game with a PIN
        </Link>
      </p>
    </div>
  );
}
