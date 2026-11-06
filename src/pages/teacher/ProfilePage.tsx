import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { SectionHead } from '@/components/ui/SectionHead';
import { Monogram } from '@/components/ui/Monogram';
import { Skeleton } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { newPasswordSchema, profileSchema, type NewPasswordValues, type ProfileValues } from '@/lib/validation/auth';
import { updateMyProfile } from '@/services/profile';
import { updatePassword } from '@/services/auth';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';

function ProfileDetailsCard() {
  const { user, profile, profileStatus, setProfile } = useSignedInTeacher();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', schoolName: '' },
  });

  // Populate the form once the profile has loaded.
  useEffect(() => {
    if (profile) reset({ displayName: profile.display_name, schoolName: profile.school_name ?? '' });
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await updateMyProfile(user.id, values);
      setProfile(updated);
      reset({ displayName: updated.display_name, schoolName: updated.school_name ?? '' });
      toast({ tone: 'success', title: 'Profile saved' });
    } catch (error) {
      setFormError(friendlyError(error, 'Could not save your profile.'));
    }
  });

  return (
    <Section kicker="Details" title="Your details" description="Your name is shown when you share quizzes with other teachers.">
        {profileStatus === 'loading' ? (
          <div className="space-y-5" aria-busy="true" aria-label="Loading your profile">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError && <Alert tone="error">{formError}</Alert>}
            <TextField label="Display name" autoComplete="name" error={errors.displayName?.message} {...register('displayName')} />
            <TextField label="School" autoComplete="organization" optional error={errors.schoolName?.message} {...register('schoolName')} />
            <TextField label="Email" value={user.email ?? ''} disabled readOnly hint="Email changes are not supported yet." />
            <div>
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        )}
    </Section>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
      reset();
      toast({ tone: 'success', title: 'Password changed' });
    } catch (error) {
      setFormError(friendlyError(error, 'Could not change your password.'));
    }
  });

  return (
    <Section kicker="Password" title="Change password" description="Use at least 8 characters with letters and numbers.">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <Alert tone="error">{formError}</Alert>}
          <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <div>
            <Button type="submit" loading={isSubmitting}>
              Change password
            </Button>
          </div>
        </form>
    </Section>
  );
}

/** One settings section on a 4/8 grid: label column left, controls right. */
function Section({ kicker, title, description, children }: { kicker: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-8 first:border-t-0 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <div>
        <p className="type-kicker">{kicker}</p>
        <h2 className="mt-1 text-title">{title}</h2>
        <p className="mt-1 text-body-sm text-ink-500">{description}</p>
      </div>
      <div className="max-w-lg min-w-0">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const { signOut, user, profile } = useSignedInTeacher();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not sign out', description: friendlyError(error) });
      setSigningOut(false);
    }
  };

  const name = profile?.display_name ?? user.email ?? 'Teacher';
  return (
    <div>
      <header className="flex items-center gap-4 border-t-[3px] border-ink-950 pt-6 sm:gap-6">
        <Monogram name={name} size={72} tone="ink" className="hidden sm:grid" />
        <Monogram name={name} size={48} tone="ink" className="sm:hidden" />
        <div className="min-w-0">
          <p className="type-kicker">Profile</p>
          <h1 className="type-display mt-1 text-display-lg break-words">{name}</h1>
          <p className="mt-2 text-caption text-ink-500">
            {[profile?.school_name, user.email].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>
      <p className="mt-4 text-body-sm text-ink-700">This is how colleagues see you in shared quizzes.</p>

      <div className="mt-8 rounded-md border border-line bg-surface px-5 sm:px-8">
        <ProfileDetailsCard />
        <PasswordCard />
      </div>

      <div className="mt-10">
        <SectionHead kicker="Session" />
        <p className="mt-3 text-body-sm text-ink-500">Signs you out on this device.</p>
        <Button variant="secondary" className="mt-3" leftIcon={<LogOut className="size-4" />} onClick={handleSignOut} loading={signingOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
