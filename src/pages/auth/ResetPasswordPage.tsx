import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LinkIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { newPasswordSchema, type NewPasswordValues } from '@/lib/validation/auth';
import { updatePassword } from '@/services/auth';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { getInitialAuthHash } from '@/lib/supabase';

/** Reads an auth error that Supabase appends to the URL hash (e.g. an expired link). */
function readHashError(): string | null {
  const hash = getInitialAuthHash() || (typeof window !== 'undefined' ? window.location.hash : '');
  if (!hash.includes('error')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const code = params.get('error_code');
  if (code === 'otp_expired') return 'This reset link has expired or was already used.';
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : 'This reset link is not valid.';
}

export default function ResetPasswordPage() {
  const { state, clearPasswordRecovery } = useTeacherAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [linkError] = useState(readHashError);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const [password, confirmPassword] = useWatch({ control, name: ['password', 'confirmPassword'] });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
      clearPasswordRecovery();
      toast({ tone: 'success', title: 'Password updated', description: 'You are signed in with your new password.' });
      navigate('/teacher/dashboard', { replace: true });
    } catch (error) {
      setFormError(friendlyError(error, 'Could not update your password. Please try again.'));
    }
  });

  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="Verifying your reset link" aria-busy="true" className="space-y-5">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <p className="text-caption text-ink-500">Checking your link…</p>
      </div>
    );
  }

  if (state.status === 'signed_out') {
    return (
      <StatusBlock
        tone="error"
        icon={<LinkIcon />}
        title="Reset link not valid"
        actions={
          <ButtonLink to="/forgot-password" size="lg">
            Request a new link
          </ButtonLink>
        }
      >
        {linkError ?? 'Open the most recent reset link from your email, or request a new one.'}
      </StatusBlock>
    );
  }

  return (
    <div>
      <p className="type-kicker inline-flex items-center gap-2">
        <KeyRound className="size-4" /> Password reset
      </p>
      <h1 className="type-display mt-2 text-display-lg">Choose a new password</h1>
      <p className="mt-3 text-body text-ink-700">
        Signed in as <strong className="text-ink-900">{state.user.email}</strong>.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <PasswordChecklist password={password} confirm={confirmPassword} />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  );
}
