import { getTeacherClient } from '@/lib/supabase';
import type {
  GrantSetting,
  MemberGrant,
  QuizAccess,
  QuizActivityEntry,
  QuizPermissions,
  SharedQuiz,
  WorkspaceRole,
  WorkspaceSharing,
} from '@/types/workspace';

type RawGrant = { access: QuizAccess; can_publish: boolean };

type RawSharing = {
  quiz_id: string;
  workspaces: {
    id: string;
    name: string;
    members: { teacher_id: string; display_name: string; role: WorkspaceRole }[];
    everyone: RawGrant | null;
    grants: (RawGrant & { teacher_id: string })[];
  }[];
};

/** Owner only: the quiz's sharing in every workspace the owner belongs to. */
export async function getQuizSharing(quizId: string): Promise<WorkspaceSharing[]> {
  const { data, error } = await getTeacherClient().rpc('get_quiz_sharing', { p_quiz_id: quizId });
  if (error) throw error;
  const raw = data as unknown as RawSharing;
  return raw.workspaces.map((w) => ({
    workspaceId: w.id,
    workspaceName: w.name,
    members: w.members.map((m) => ({ teacherId: m.teacher_id, displayName: m.display_name, role: m.role })),
    everyone: w.everyone ? { access: w.everyone.access, canPublish: w.everyone.can_publish } : null,
    grants: w.grants.map((g) => ({ teacherId: g.teacher_id, access: g.access, canPublish: g.can_publish })),
  }));
}

/** Owner only: atomically replaces the quiz's sharing in one workspace. */
export async function setQuizSharing(
  quizId: string,
  workspaceId: string,
  settings: { everyone: GrantSetting | null; members: MemberGrant[] },
): Promise<void> {
  const { error } = await getTeacherClient().rpc('set_quiz_sharing', {
    p_quiz_id: quizId,
    p_workspace_id: workspaceId,
    p_settings: {
      everyone: settings.everyone
        ? { access: settings.everyone.access, can_publish: settings.everyone.canPublish }
        : null,
      members: settings.members.map((m) => ({ teacher_id: m.teacherId, access: m.access, can_publish: m.canPublish })),
    },
  });
  if (error) throw error;
}

type RawShared = {
  id: string;
  title: string;
  description: string;
  subject: string;
  cover_image_path: string | null;
  status: SharedQuiz['status'];
  question_count: number;
  updated_at: string;
  owner_name: string;
  access: QuizAccess;
  can_publish: boolean;
  workspaces: string[];
};

export async function listSharedWithMe(): Promise<SharedQuiz[]> {
  const { data, error } = await getTeacherClient().rpc('list_shared_with_me');
  if (error) throw error;
  return ((data ?? []) as unknown as RawShared[]).map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    subject: q.subject,
    coverImagePath: q.cover_image_path,
    status: q.status,
    questionCount: q.question_count,
    updatedAt: q.updated_at,
    ownerName: q.owner_name,
    access: q.access,
    canPublish: q.can_publish,
    workspaces: q.workspaces,
  }));
}

type RawPermissions = {
  role: QuizPermissions['role'];
  can_publish: boolean;
  can_archive: boolean;
  owner_name: string;
  revision: number;
  updated_by_name: string | null;
  updated_at: string;
};

export async function getQuizPermissions(quizId: string): Promise<QuizPermissions> {
  const { data, error } = await getTeacherClient().rpc('get_quiz_permissions', { p_quiz_id: quizId });
  if (error) throw error;
  const raw = data as unknown as RawPermissions;
  return {
    role: raw.role,
    canPublish: raw.can_publish,
    canArchive: raw.can_archive,
    ownerName: raw.owner_name,
    revision: raw.revision,
    updatedByName: raw.updated_by_name,
    updatedAt: raw.updated_at,
  };
}

type RawActivity = { action: QuizActivityEntry['action']; actor_name: string; is_me: boolean; created_at: string };

/** Latest activity on a quiz (owner and editors only). */
export async function getQuizActivity(quizId: string): Promise<QuizActivityEntry[]> {
  const { data, error } = await getTeacherClient().rpc('get_quiz_activity', { p_quiz_id: quizId });
  if (error) throw error;
  return ((data ?? []) as unknown as RawActivity[]).map((a) => ({
    action: a.action,
    actorName: a.actor_name,
    isMe: a.is_me,
    createdAt: a.created_at,
  }));
}

/** Copies a shared quiz into the caller's own library. Returns the new quiz id. */
export async function copySharedQuiz(quizId: string): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('copy_shared_quiz', { p_quiz_id: quizId });
  if (error) throw error;
  return data;
}
