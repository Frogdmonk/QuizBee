import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { registerSchema, type RegisterValues } from '@/lib/validation/auth';
import { signUpTeacher } from '@/services/auth';
import { friendlyError } from '@/utils/errors';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const outcome = await signUpTeacher({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      if (outcome.kind === 'signed_in') navigate('/teacher/dashboard', { replace: true });
      else setPendingEmail(outcome.email);
    } catch (error) {
      setFormError(friendlyError(error, 'Could not create your account. Please try again.'));
    }
  });

  if (pendingEmail) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint-50 text-mint-600">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold">Check your inbox</h1>
        <p className="mt-3 text-ink-600">
          If <strong className="text-ink-900">{pendingEmail}</strong> can be registered, we have sent a confirmation link
          to it. Open the link to activate your account, then sign in.
        </p>
        <p className="mt-3 text-sm text-ink-500">No email after a few minutes? Check your spam folder.</p>
        <ButtonLink to="/login" variant="secondary" size="lg" className="mt-8" fullWidth>
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Create your teacher account</h1>
      <p className="mt-2 text-ink-600">Free for classrooms. Students join with a PIN and never need an account.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Your name"
          autoComplete="name"
          hint="Shown to other teachers when you share a quiz."
          error={errors.displayName?.message}
          {...register('displayName')}
        />
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
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-ink-900 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
