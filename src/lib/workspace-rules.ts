import type { GrantSetting, QuizAccess, QuizActivityAction } from '@/types/workspace';

/* Limits shared with supabase/migrations/*_phase2c_workspaces.sql — keep in sync. */
export const WORKSPACE_LIMITS = {
  nameMax: 60,
  ownedWorkspaces: 20,
  memberships: 50,
  membersPerWorkspace: 50,
  activeInvites: 10,
  inviteDays: 7,
} as const;

export const ACCESS_ORDER: QuizAccess[] = ['view', 'copy', 'edit'];

export const ACCESS_LABELS: Record<QuizAccess, string> = {
  view: 'Can view',
  copy: 'Can copy',
  edit: 'Can edit',
};

export const ACCESS_DESCRIPTIONS: Record<QuizAccess, string> = {
  view: 'Open and preview the quiz.',
  copy: 'View, and add their own copy to their library to change as they like.',
  edit: 'Change this quiz for everyone. You see who edited it.',
};

export function accessRank(access: QuizAccess | null | undefined): number {
  return access ? ACCESS_ORDER.indexOf(access) : -1;
}

/** The effective access a member gets: the higher of the workspace-wide and personal grants. */
export function effectiveAccess(everyone: GrantSetting | null, personal: GrantSetting | null): GrantSetting | null {
  if (!everyone) return personal;
  if (!personal) return everyone;
  const access = accessRank(personal.access) >= accessRank(everyone.access) ? personal.access : everyone.access;
  const canPublish =
    access === 'edit' &&
    ((personal.access === 'edit' && personal.canPublish) || (everyone.access === 'edit' && everyone.canPublish));
  return { access, canPublish };
}

export const ACTIVITY_LABELS: Record<QuizActivityAction, string> = {
  edited: 'edited the quiz',
  published: 'published the quiz',
  unpublished: 'moved the quiz back to drafts',
  archived: 'archived the quiz',
  restored: 'restored the quiz',
  copied: 'copied the quiz to their library',
};

/** Full invite URL for a raw token. */
export function inviteUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/invite/${encodeURIComponent(token)}`;
}

export function validateWorkspaceName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the workspace a name.';
  if (trimmed.length > WORKSPACE_LIMITS.nameMax) return `Use at most ${WORKSPACE_LIMITS.nameMax} characters.`;
  return null;
}
