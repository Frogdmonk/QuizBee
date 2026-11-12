import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { Monogram } from '@/components/ui/Monogram';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SegmentedControl, SelectField, Skeleton, Switch } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { getQuizSharing, setQuizSharing } from '@/services/sharing';
import { getSubjectSharing, setSubjectSharing } from '@/services/subjects';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { ACCESS_DESCRIPTIONS, ACCESS_LABELS } from '@/lib/workspace-rules';
import {
  memberAccessChoices,
  sharingFingerprint,
  sharingSummary,
  toSharingDraft,
  toSharingSettings,
  type SharingDraft,
} from '@/lib/sharing-draft';
import type { QuizAccess, WorkspaceSharing } from '@/types/workspace';

type Props = {
  open: boolean;
  quizId: string | null;
  quizTitle: string;
  onClose: () => void;
  /** Share a whole subject instead of one quiz (quizId and quizTitle are then ignored). */
  subject?: { id: string; name: string } | null;
};

const ACCESS_OPTIONS = [
  { value: 'view' as const, label: 'View' },
  { value: 'copy' as const, label: 'Copy' },
  { value: 'edit' as const, label: 'Edit' },
];

/**
 * Owner-only dialog: open a quiz to everyone in a workspace (view by default,
 * or copy / edit), and/or give chosen members their own access level.
 */
export function ShareQuizDialog({ open, quizId: quizIdProp, quizTitle, onClose, subject = null }: Props) {
  // A subject is shared with exactly the same settings as a quiz; only the target differs.
  const quizId = subject ? subject.id : quizIdProp;
  const load = subject ? getSubjectSharing : getQuizSharing;
  const store = subject ? setSubjectSharing : setQuizSharing;
  const { toast } = useToast();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [workspaces, setWorkspaces] = useState<WorkspaceSharing[]>([]);
  const [drafts, setDrafts] = useState<Record<string, SharingDraft>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Show the loading state again whenever the dialog opens for a quiz.
  const openKey = open && quizId ? quizId : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (openKey) setState('loading');
  }

  useEffect(() => {
    if (!open || !quizId) return;
    let cancelled = false;
    load(quizId)
      .then((list) => {
        if (cancelled) return;
        const nextDrafts: Record<string, SharingDraft> = {};
        const prints: Record<string, string> = {};
        for (const w of list) {
          nextDrafts[w.workspaceId] = toSharingDraft(w);
          prints[w.workspaceId] = sharingFingerprint(nextDrafts[w.workspaceId]);
        }
        setWorkspaces(list);
        setDrafts(nextDrafts);
        setOriginal(prints);
        setSelected((current) => (list.some((w) => w.workspaceId === current) ? current : (list[0]?.workspaceId ?? '')));
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` only changes with `subject`, which changes `quizId`
  }, [open, quizId, nonce]);

  const changed = useMemo(
    () => Object.keys(drafts).filter((id) => sharingFingerprint(drafts[id]) !== original[id]),
    [drafts, original],
  );

  const workspace = workspaces.find((w) => w.workspaceId === selected);
  const draft = workspace ? drafts[workspace.workspaceId] : undefined;

  const update = useCallback(
    (fn: (d: SharingDraft) => SharingDraft) => {
      if (!selected) return;
      setDrafts((all) => ({ ...all, [selected]: fn(all[selected]) }));
    },
    [selected],
  );

  const save = async () => {
    if (!quizId || changed.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const id of changed) {
        await store(quizId, id, toSharingSettings(drafts[id]));
        setOriginal((o) => ({ ...o, [id]: sharingFingerprint(drafts[id]) }));
      }
      toast({ tone: 'success', title: 'Sharing updated' });
      onClose();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not update sharing', description: friendlyError(error) });
    } finally {
      setSaving(false);
    }
  };

  const everyoneSetting = draft?.everyoneOn ? draft.everyone : null;
  const memberChoices = memberAccessChoices(everyoneSetting);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={subject ? 'Share subject' : 'Share quiz'}
      description={
        subject ? (
          <span>
            Choose who can use every quiz in <strong className="text-ink-900">{subject.name}</strong>, including quizzes you add to it later.
          </span>
        ) : (
          <span>
            Choose who in your workspaces can use <strong className="text-ink-900">{quizTitle || 'this quiz'}</strong>.
          </span>
        )
      }
      footer={
        state === 'ready' && workspaces.length > 0 ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving} disabled={changed.length === 0}>
              Save sharing
            </Button>
          </>
        ) : undefined
      }
    >
      {state === 'loading' ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading sharing settings">
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
        </div>
      ) : state === 'error' ? (
        <Alert tone="error" title="Could not load sharing settings">
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => {
              setState('loading');
              setNonce((n) => n + 1);
            }}>
            Retry
          </Button>
        </Alert>
      ) : workspaces.length === 0 ? (
        <StatusBlock
          icon={<Users />}
          title="You are not in a workspace yet"
          headingLevel="h2"
          actions={
            <ButtonLink to="/teacher/workspaces" size="sm" onClick={onClose}>
              Go to Workspaces
            </ButtonLink>
          }
        >
          Create a workspace and invite colleagues, then share quizzes with them.
        </StatusBlock>
      ) : (
        workspace &&
        draft && (
          <div className="space-y-6">
            {workspaces.length > 1 ? (
              <SelectField label="Workspace" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {workspaces.map((w) => (
                  <option key={w.workspaceId} value={w.workspaceId}>
                    {w.workspaceName} ({sharingSummary(drafts[w.workspaceId])})
                  </option>
                ))}
              </SelectField>
            ) : (
              <p className="flex items-center gap-2 text-body-sm text-ink-700">
                <Monogram name={workspace.workspaceName} seed={workspace.workspaceId} size={28} />
                <strong className="text-ink-900">{workspace.workspaceName}</strong>
              </p>
            )}

            <section className="space-y-4 rounded-md bg-paper p-4">
              <Switch
                label={`Open to everyone in ${workspace.workspaceName}`}
                description={draft.everyoneOn ? ACCESS_DESCRIPTIONS[draft.everyone.access] : 'Off: only the members you choose below.'}
                checked={draft.everyoneOn}
                onChange={(on) => update((d) => ({ ...d, everyoneOn: on }))}
              />
              {draft.everyoneOn && (
                <>
                  <SegmentedControl
                    label="Access for everyone"
                    layoutId={`share-everyone-${workspace.workspaceId}`}
                    value={draft.everyone.access}
                    options={ACCESS_OPTIONS}
                    onChange={(access) => update((d) => ({ ...d, everyone: { ...d.everyone, access } }))}
                  />
                  {draft.everyone.access === 'edit' && (
                    <Switch
                      label="Editors can publish and unpublish"
                      description="Only you can archive, delete or change sharing."
                      checked={draft.everyone.canPublish}
                      onChange={(canPublish) => update((d) => ({ ...d, everyone: { ...d.everyone, canPublish } }))}
                    />
                  )}
                </>
              )}
            </section>

            <section>
              <h3 className="type-kicker">
                {draft.everyoneOn ? 'Give chosen members more access' : 'Share only with chosen members'}
              </h3>
              {workspace.members.length === 0 ? (
                <p className="mt-2 text-body-sm text-ink-500">Nobody else has joined this workspace yet. Invite colleagues from Workspaces.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {workspace.members.map((member) => {
                    const row = draft.members[member.teacherId];
                    const checkboxId = `share-${workspace.workspaceId}-${member.teacherId}`;
                    const access: QuizAccess = memberChoices.includes(row.access) ? row.access : memberChoices[0];
                    return (
                      <li key={member.teacherId} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="size-5 shrink-0 accent-ink-900"
                          checked={row.on}
                          onChange={(e) =>
                            update((d) => ({
                              ...d,
                              members: { ...d.members, [member.teacherId]: { ...row, on: e.target.checked, access } },
                            }))
                          }
                        />
                        <label htmlFor={checkboxId} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-body-sm font-semibold text-ink-900">
                          <Monogram name={member.displayName} seed={member.teacherId} size={28} />
                          <span className="truncate">{member.displayName}</span>
                        </label>
                        <select
                          aria-label={`Access for ${member.displayName}`}
                          className="h-11 rounded-sm border border-line-strong bg-surface px-2 text-body-sm text-ink-900 disabled:border-line disabled:bg-paper-sunk disabled:text-ink-500"
                          value={access}
                          disabled={!row.on}
                          onChange={(e) =>
                            update((d) => ({
                              ...d,
                              members: {
                                ...d.members,
                                [member.teacherId]: { ...row, access: e.target.value as QuizAccess },
                              },
                            }))
                          }
                        >
                          {memberChoices.map((a) => (
                            <option key={a} value={a}>
                              {ACCESS_LABELS[a]}
                            </option>
                          ))}
                        </select>
                        {row.on && access === 'edit' && (
                          <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 pl-8 text-body-sm text-ink-700">
                            <input
                              type="checkbox"
                              className="size-5 accent-ink-900"
                              checked={row.canPublish}
                              onChange={(e) =>
                                update((d) => ({
                                  ...d,
                                  members: { ...d.members, [member.teacherId]: { ...row, access, canPublish: e.target.checked } },
                                }))
                              }
                            />
                            Can publish and unpublish
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-caption text-ink-500">
                View: open and preview. Copy: add their own copy to change freely. Edit: change {subject ? 'these quizzes' : 'this quiz'} for
                everyone; you can see who edited {subject ? 'them' : 'it'}.
              </p>
            </section>
          </div>
        )
      )}
    </Dialog>
  );
}
