import { getTeacherClient } from '@/lib/supabase';
import { toWorkspaceSharing } from '@/services/sharing';
import type { Json } from '@/types/database';
import type { GrantSetting, MemberGrant, WorkspaceSharing } from '@/types/workspace';

/*
 * Subjects: a teacher's folders of quizzes (supabase/migrations/20261120090000_subjects.sql).
 * Sharing a subject shares every quiz in it, including quizzes added later.
 */

export type Subject = { id: string; name: string; quizCount: number; shared: boolean; updatedAt: string };

type RawSubject = { id: string; name: string; quiz_count: number; shared: boolean; updated_at: string };

export const SUBJECT_NAME_MAX = 60;

export async function listMySubjects(): Promise<Subject[]> {
  const { data, error } = await getTeacherClient().rpc('list_my_subjects');
  if (error) throw error;
  return ((data ?? []) as unknown as RawSubject[]).map((s) => ({ id: s.id, name: s.name, quizCount: s.quiz_count, shared: s.shared, updatedAt: s.updated_at }));
}

export async function createSubject(name: string): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('create_subject', { p_name: name });
  if (error) throw error;
  return data as string;
}

export async function renameSubject(id: string, name: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('rename_subject', { p_subject_id: id, p_name: name });
  if (error) throw error;
}

/** Deletes the subject; its quizzes stay in the library (unfiled) and its sharing ends. */
export async function deleteSubject(id: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('delete_subject', { p_subject_id: id });
  if (error) throw error;
}

/** Puts quizzes in a subject, or takes them out with null. Returns how many moved. */
export async function setQuizzesSubject(quizIds: string[], subjectId: string | null): Promise<number> {
  const { data, error } = await getTeacherClient().rpc('set_quizzes_subject', { p_quiz_ids: quizIds, p_subject_id: subjectId });
  if (error) throw error;
  return data as number;
}

export async function getSubjectSharing(subjectId: string): Promise<WorkspaceSharing[]> {
  const { data, error } = await getTeacherClient().rpc('get_subject_sharing', { p_subject_id: subjectId });
  if (error) throw error;
  return toWorkspaceSharing(data as never);
}

export async function setSubjectSharing(
  subjectId: string,
  workspaceId: string,
  settings: { everyone: GrantSetting | null; members: MemberGrant[] },
): Promise<void> {
  const payload = {
    everyone: settings.everyone ? { access: settings.everyone.access, can_publish: settings.everyone.canPublish } : null,
    members: settings.members.map((m) => ({ teacher_id: m.teacherId, access: m.access, can_publish: m.canPublish })),
  };
  const { error } = await getTeacherClient().rpc('set_subject_sharing', { p_subject_id: subjectId, p_workspace_id: workspaceId, p_settings: payload as unknown as Json });
  if (error) throw error;
}
