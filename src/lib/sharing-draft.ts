import type { GrantSetting, MemberGrant, QuizAccess, WorkspaceSharing } from '@/types/workspace';
import { accessRank } from './workspace-rules';

/** Editable state of a quiz's sharing inside one workspace (used by the share dialog). */
export type SharingDraft = {
  everyoneOn: boolean;
  everyone: GrantSetting;
  members: Record<string, { on: boolean; access: QuizAccess; canPublish: boolean }>;
};

export function toSharingDraft(sharing: WorkspaceSharing): SharingDraft {
  const members: SharingDraft['members'] = {};
  for (const m of sharing.members) members[m.teacherId] = { on: false, access: 'view', canPublish: false };
  for (const g of sharing.grants) members[g.teacherId] = { on: true, access: g.access, canPublish: g.canPublish };
  return {
    everyoneOn: sharing.everyone !== null,
    everyone: sharing.everyone ?? { access: 'view', canPublish: false },
    members,
  };
}

/** The payload for set_quiz_sharing. Publishing is only kept for edit access. */
export function toSharingSettings(draft: SharingDraft): { everyone: GrantSetting | null; members: MemberGrant[] } {
  return {
    everyone: draft.everyoneOn
      ? { access: draft.everyone.access, canPublish: draft.everyone.access === 'edit' && draft.everyone.canPublish }
      : null,
    members: Object.entries(draft.members)
      .filter(([, m]) => m.on)
      .map(([teacherId, m]) => ({ teacherId, access: m.access, canPublish: m.access === 'edit' && m.canPublish }))
      .sort((a, b) => a.teacherId.localeCompare(b.teacherId)),
  };
}

export function sharingFingerprint(draft: SharingDraft): string {
  return JSON.stringify(toSharingSettings(draft));
}

/** Plain-language summary, e.g. "Everyone can view · 2 chosen members". */
export function sharingSummary(draft: SharingDraft): string {
  const settings = toSharingSettings(draft);
  const parts: string[] = [];
  if (settings.everyone) parts.push(`Everyone can ${settings.everyone.access}`);
  if (settings.members.length) {
    parts.push(`${settings.members.length} chosen ${settings.members.length === 1 ? 'member' : 'members'}`);
  }
  return parts.length ? parts.join(' · ') : 'Private';
}

/** Access levels a chosen member can be given on top of the workspace-wide level. */
export function memberAccessChoices(everyone: GrantSetting | null): QuizAccess[] {
  const all: QuizAccess[] = ['view', 'copy', 'edit'];
  if (!everyone) return all;
  return all.filter((a) => accessRank(a) >= accessRank(everyone.access));
}
