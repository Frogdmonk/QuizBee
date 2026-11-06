import { describe, expect, it } from 'vitest';
import {
  ACCESS_ORDER,
  accessRank,
  effectiveAccess,
  inviteUrl,
  validateWorkspaceName,
} from '@/lib/workspace-rules';
import {
  memberAccessChoices,
  sharingFingerprint,
  sharingSummary,
  toSharingDraft,
  toSharingSettings,
} from '@/lib/sharing-draft';
import { editorReducer, initEditor } from '@/lib/quiz-editor-reducer';
import { draftFingerprint, emptyQuiz, toSavePayload } from '@/lib/quiz-rules';
import { isRevisionConflict } from '@/services/quizzes';
import type { WorkspaceSharing } from '@/types/workspace';

const sharing = (overrides: Partial<WorkspaceSharing> = {}): WorkspaceSharing => ({
  workspaceId: 'ws1',
  workspaceName: 'Maths',
  members: [
    { teacherId: 'b', displayName: 'Bob', role: 'member' },
    { teacherId: 'a', displayName: 'Alice', role: 'member' },
  ],
  everyone: null,
  grants: [],
  ...overrides,
});

describe('access levels (mirror of public.quiz_access)', () => {
  it('orders view < copy < edit, with edit highest', () => {
    expect(ACCESS_ORDER).toEqual(['view', 'copy', 'edit']);
    expect(accessRank('edit')).toBeGreaterThan(accessRank('copy'));
    expect(accessRank('copy')).toBeGreaterThan(accessRank('view'));
    expect(accessRank(null)).toBe(-1);
  });

  it('gives a member the higher of the workspace-wide and personal access', () => {
    expect(effectiveAccess({ access: 'view', canPublish: false }, { access: 'edit', canPublish: true })).toEqual({
      access: 'edit',
      canPublish: true,
    });
    expect(effectiveAccess({ access: 'copy', canPublish: false }, { access: 'view', canPublish: false })).toEqual({
      access: 'copy',
      canPublish: false,
    });
    expect(effectiveAccess(null, null)).toBeNull();
    expect(effectiveAccess({ access: 'edit', canPublish: true }, null)).toEqual({ access: 'edit', canPublish: true });
  });

  it('only offers chosen members a level at or above the workspace-wide one', () => {
    expect(memberAccessChoices(null)).toEqual(['view', 'copy', 'edit']);
    expect(memberAccessChoices({ access: 'copy', canPublish: false })).toEqual(['copy', 'edit']);
    expect(memberAccessChoices({ access: 'edit', canPublish: false })).toEqual(['edit']);
  });
});

describe('sharing draft', () => {
  it('starts private, with every member unchecked', () => {
    const draft = toSharingDraft(sharing());
    expect(draft.everyoneOn).toBe(false);
    expect(draft.everyone).toEqual({ access: 'view', canPublish: false });
    expect(toSharingSettings(draft)).toEqual({ everyone: null, members: [] });
    expect(sharingSummary(draft)).toBe('Private');
  });

  it('round-trips existing grants', () => {
    const draft = toSharingDraft(
      sharing({ everyone: { access: 'view', canPublish: false }, grants: [{ teacherId: 'a', access: 'edit', canPublish: true }] }),
    );
    expect(toSharingSettings(draft)).toEqual({
      everyone: { access: 'view', canPublish: false },
      members: [{ teacherId: 'a', access: 'edit', canPublish: true }],
    });
    expect(sharingSummary(draft)).toBe('Everyone can view · 1 chosen member');
  });

  it('drops the publish permission unless the access is edit', () => {
    const draft = toSharingDraft(sharing());
    draft.everyoneOn = true;
    draft.everyone = { access: 'copy', canPublish: true };
    draft.members.b = { on: true, access: 'view', canPublish: true };
    expect(toSharingSettings(draft)).toEqual({
      everyone: { access: 'copy', canPublish: false },
      members: [{ teacherId: 'b', access: 'view', canPublish: false }],
    });
  });

  it('ignores unchecked members and is order-independent for change detection', () => {
    const a = toSharingDraft(sharing());
    a.members.a = { on: true, access: 'copy', canPublish: false };
    a.members.b = { on: false, access: 'edit', canPublish: true };
    const b = toSharingDraft(sharing({ members: [...sharing().members].reverse() }));
    b.members.a = { on: true, access: 'copy', canPublish: false };
    expect(sharingFingerprint(a)).toBe(sharingFingerprint(b));
  });
});

describe('workspace helpers', () => {
  it('builds invite URLs', () => {
    expect(inviteUrl('https://rally.pages.dev/', 'abc_DEF-123')).toBe('https://rally.pages.dev/invite/abc_DEF-123');
  });

  it('validates workspace names like the server', () => {
    expect(validateWorkspaceName('  ')).toMatch(/name/);
    expect(validateWorkspaceName('x'.repeat(61))).toMatch(/60/);
    expect(validateWorkspaceName('  Science  ')).toBeNull();
  });
});

describe('quiz revisions (concurrent editors)', () => {
  it('keeps the revision out of the save payload and the unsaved-changes fingerprint', () => {
    const draft = { ...emptyQuiz(), id: 'q1', title: 'T', revision: 4 };
    expect(toSavePayload(draft)).not.toHaveProperty('revision');
    expect(draftFingerprint(draft)).toBe(draftFingerprint({ ...draft, revision: 5 }));
  });

  it('advances the revision after a save of an existing quiz, and starts new quizzes at 0', () => {
    const existing = initEditor({ ...emptyQuiz(), id: 'q1', title: 'T', revision: 4 }, true);
    const saved = editorReducer(existing, { type: 'saved', id: 'q1', sent: existing.draft });
    expect(saved.draft.revision).toBe(5);
    expect(draftFingerprint(saved.draft)).toBe(saved.savedFingerprint);

    const fresh = initEditor({ ...emptyQuiz(), title: 'New' }, false);
    const created = editorReducer(fresh, { type: 'saved', id: 'q2', sent: fresh.draft });
    expect(created.draft.revision).toBe(0);
  });

  it('recognises the server revision-conflict error', () => {
    expect(isRevisionConflict({ code: 'P0001', hint: 'quiz_revision_conflict' })).toBe(true);
    expect(isRevisionConflict({ code: 'P0001', hint: 'something else' })).toBe(false);
    expect(isRevisionConflict(null)).toBe(false);
  });
});
