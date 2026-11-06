import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validation/auth';
import { requestPasswordReset } from '@/services/auth';
import { friendlyError } from '@/utils/errors';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (error) {
      setFormError(friendlyError(error, 'Could not send the reset email. Please try again.'));
    }
  });

  if (sentTo) {
    return (
      <StatusBlock
        tone="info"
        icon={<Mail />}
        title="Check your email"
        actions={
          <ButtonLink to="/login" variant="secondary" size="lg">
            Back to sign in
          </ButtonLink>
        }
      >
        If an account exists for <strong className="text-ink-900">{sentTo}</strong>, a password reset link is on its way.
        The link expires after one hour.
      </StatusBlock>
    );
  }

  return (
    <div>
      <Link to="/login" className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 text-body-sm font-semibold text-ink-700 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <h1 className="type-display mt-4 text-display-lg">Reset your password</h1>
      <p className="mt-3 text-body text-ink-700">Enter the email you registered with and we will send you a reset link.</p>
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
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </div>
  );
}
