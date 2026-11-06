import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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
    <Card>
      <CardHeader title="Profile" description="Your name is shown when you share quizzes with other teachers." />
      <CardBody>
        {profileStatus === 'loading' ? (
          <div className="flex items-center gap-2 text-ink-500">
            <Spinner className="size-4" /> Loading…
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError && <Alert tone="error">{formError}</Alert>}
            <TextField label="Display name" autoComplete="name" error={errors.displayName?.message} {...register('displayName')} />
            <TextField
              label="School"
              autoComplete="organization"
              hint="Optional."
              error={errors.schoolName?.message}
              {...register('schoolName')}
            />
            <TextField label="Email" value={user.email ?? ''} disabled readOnly hint="Email changes are not supported yet." />
            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
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
    <Card>
      <CardHeader title="Password" description="Use at least 8 characters with letters and numbers." />
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <Alert tone="error">{formError}</Alert>}
          <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="dark" loading={isSubmitting}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ProfilePage() {
  const { signOut } = useSignedInTeacher();
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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Profile</h1>
          <p className="mt-2 text-ink-600">Manage your account details and password.</p>
        </div>
        <Button variant="secondary" leftIcon={<LogOut className="size-4" />} onClick={handleSignOut} loading={signingOut}>
          Sign out
        </Button>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailsCard />
        <PasswordCard />
      </div>
    </div>
  );
}
