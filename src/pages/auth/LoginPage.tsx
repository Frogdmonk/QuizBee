import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { LowerThird } from '@/components/ui/LowerThird';
import { ArrowRight } from 'lucide-react';
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

  const studentLink = (
    <LowerThird surface="night" tab="bg-signal-400" to="/join" className="w-full justify-between">
      <span>
        Student? <span className="text-night-muted">Join with a PIN</span>
      </span>
      <ArrowRight className="size-4" />
    </LowerThird>
  );

  return (
    <div>
      <p className="type-kicker">Teacher sign in</p>
      <h1 className="type-display mt-2 text-display-lg">Welcome back</h1>
      <p className="mt-3 text-body text-ink-700">Manage your quizzes and host live games.</p>
      <div className="mt-6 lg:hidden">{studentLink}</div>

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
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAside={
            <Link to="/forgot-password" className="-my-3 inline-flex min-h-11 items-center font-semibold text-signal-600 hover:text-signal-700">
              Forgot password?
            </Link>
          }
          {...register('password')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-body-sm text-ink-700">
        New here?{' '}
        <Link
          to={params.get('next') ? `/register?next=${encodeURIComponent(safeNextPath(params.get('next')))}` : '/register'}
          className="font-semibold text-signal-600 underline-offset-4 hover:underline">
          Create a teacher account
        </Link>
      </p>
      <div className="mt-6 hidden lg:block">{studentLink}</div>
    </div>
  );
}
