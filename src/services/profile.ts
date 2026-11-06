import { getTeacherClient } from '@/lib/supabase';
import type { TeacherProfile } from '@/types/database';

const PROFILE_COLUMNS = 'id, display_name, school_name, created_at, updated_at';

export async function fetchMyProfile(userId: string): Promise<TeacherProfile | null> {
  const { data, error } = await getTeacherClient()
    .from('teacher_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates the caller's profile if it is missing (idempotent, server-validated). */
export async function ensureMyProfile(): Promise<TeacherProfile> {
  const { data, error } = await getTeacherClient().rpc('ensure_teacher_profile');
  if (error) throw error;
  return data;
}

export async function updateMyProfile(
  userId: string,
  values: { displayName: string; schoolName: string },
): Promise<TeacherProfile> {
  const { data, error } = await getTeacherClient()
    .from('teacher_profiles')
    .update({
      display_name: values.displayName.trim(),
      school_name: values.schoolName.trim() || null,
    })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}
