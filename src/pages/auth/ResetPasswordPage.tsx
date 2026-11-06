import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LinkIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

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
      <div className="flex justify-center py-10 text-ink-500">
        <Spinner label="Verifying your reset link" />
      </div>
    );
  }

  if (state.status === 'signed_out') {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
          <LinkIcon className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold">Reset link not valid</h1>
        <p className="mt-3 text-ink-600">
          {linkError ?? 'Open the most recent reset link from your email, or request a new one.'}
        </p>
        <ButtonLink to="/forgot-password" size="lg" className="mt-8" fullWidth>
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <span className="grid size-12 place-items-center rounded-2xl bg-ink-900 text-white">
        <KeyRound className="size-6" />
      </span>
      <h1 className="mt-6 text-3xl font-extrabold">Choose a new password</h1>
      <p className="mt-2 text-ink-600">
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
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  );
}
