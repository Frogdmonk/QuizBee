import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { registerSchema, type RegisterValues } from '@/lib/validation/auth';
import { signUpTeacher } from '@/services/auth';
import { friendlyError } from '@/utils/errors';
import { safeNextPath } from '@/lib/redirect';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Keeps e.g. an invite link (/invite/…) across sign-up and sign-in.
  const next = safeNextPath(params.get('next'));
  const loginPath = params.get('next') ? `/login?next=${encodeURIComponent(next)}` : '/login';
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });
  const [password, confirmPassword] = useWatch({ control, name: ['password', 'confirmPassword'] });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const outcome = await signUpTeacher({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      if (outcome.kind === 'signed_in') navigate(next, { replace: true });
      else setPendingEmail(outcome.email);
    } catch (error) {
      setFormError(friendlyError(error, 'Could not create your account. Please try again.'));
    }
  });

  if (pendingEmail) {
    return (
      <StatusBlock
        tone="success"
        icon={<MailCheck />}
        title="Check your inbox"
        actions={
          <ButtonLink to={loginPath} variant="secondary" size="lg">
            Back to sign in
          </ButtonLink>
        }
      >
        <p>
          If <strong className="text-ink-900">{pendingEmail}</strong> can be registered, we have sent a confirmation link to
          it. Open the link to activate your account, then sign in.
        </p>
        <p className="mt-2 text-body-sm text-ink-500">No email after a few minutes? Check your spam folder.</p>
      </StatusBlock>
    );
  }

  return (
    <div>
      <p className="type-kicker">New teacher</p>
      <h1 className="type-display mt-2 text-display-lg">Create your account</h1>
      <p className="mt-3 text-body text-ink-700">Students join with a PIN and never need an account.</p>

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
        <PasswordChecklist password={password} confirm={confirmPassword} />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-body-sm text-ink-700">
        Already have an account?{' '}
        <Link to={loginPath} className="font-semibold text-signal-600 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
