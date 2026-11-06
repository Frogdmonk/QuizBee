import type { Session, User } from '@supabase/supabase-js';
import { getTeacherClient } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export type SignUpOutcome =
  | { kind: 'signed_in'; session: Session }
  | { kind: 'confirmation_required'; email: string };

export async function signUpTeacher(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<SignUpOutcome> {
  const { siteUrl } = getEnv();
  const { data, error } = await getTeacherClient().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName },
      emailRedirectTo: `${siteUrl}/teacher/dashboard`,
    },
  });
  if (error) throw error;
  if (data.session) return { kind: 'signed_in', session: data.session };
  // With email confirmation enabled Supabase returns a user but no session.
  // (For an already-registered email it returns the same shape to prevent
  // account enumeration, so we show one neutral "check your inbox" message.)
  return { kind: 'confirmation_required', email: input.email };
}

export async function signInTeacher(email: string, password: string): Promise<User> {
  const client = getTeacherClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.user.is_anonymous) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('Anonymous sessions cannot access the teacher dashboard.');
  }
  return data.user;
}

export async function signOutTeacher(): Promise<void> {
  const { error } = await getTeacherClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { siteUrl } = getEnv();
  const { error } = await getTeacherClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getTeacherClient().auth.updateUser({ password });
  if (error) throw error;
}
