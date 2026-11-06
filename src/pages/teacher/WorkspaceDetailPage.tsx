import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, Check, Copy, Link2, LogOut, MoreHorizontal, Pencil, Trash2, UserMinus } from 'lucide-react';
import { m } from 'motion/react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/SectionHead';
import { Ledger, LedgerRow } from '@/components/ui/Ledger';
import { Monogram } from '@/components/ui/Monogram';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { dur, ease } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { Skeleton } from '@/components/ui/FormControls';
import {
  createInvite,
  deleteWorkspace,
  getWorkspace,
  leaveWorkspace,
  removeWorkspaceMember,
  renameWorkspace,
  revokeInvite,
} from '@/services/workspaces';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { relativeTime } from '@/utils/time';
import { copyText } from '@/utils/clipboard';
import { getEnv } from '@/lib/env';
import { inviteUrl, validateWorkspaceName, WORKSPACE_LIMITS } from '@/lib/workspace-rules';
import type { WorkspaceDetails, WorkspaceMember } from '@/types/workspace';

type Pending = { kind: 'delete' } | { kind: 'leave' } | { kind: 'remove'; member: WorkspaceMember } | null;

export default function WorkspaceDetailPage() {
  const { workspaceId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useSignedInTeacher();
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    getWorkspace(workspaceId)
      .then((w) => {
        if (cancelled) return;
        setWorkspace(w);
        setState('ready');
      })
      .catch((error: { code?: string }) => !cancelled && setState(error?.code === 'P0002' ? 'notfound' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, nonce]);

  if (state === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading workspace">
        <Skeleton className="size-16" />
        <Skeleton className="h-10 w-1/2" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }
  if (state !== 'ready' || !workspace) {
    return (
      <div className="py-10">
        <StatusBlock
          tone={state === 'notfound' ? 'neutral' : 'error'}
          icon={<AlertTriangle />}
          title={state === 'notfound' ? 'Workspace not found' : 'Could not load this workspace'}
          actions={
            <>
              {state === 'error' && <Button onClick={reload}>Retry</Button>}
              <ButtonLink to="/teacher/workspaces" variant="secondary">
                All workspaces
              </ButtonLink>
            </>
          }
        >
          {state === 'notfound' ? 'It may have been deleted, or you are no longer a member.' : 'Check your connection and try again.'}
        </StatusBlock>
      </div>
    );
  }

  const isOwner = workspace.role === 'owner';

  const makeLink = async () => {
    setCreatingLink(true);
    try {
      const invite = await createInvite(workspace.id);
      setNewLink(inviteUrl(getEnv().siteUrl, invite.token));
      setCopied(false);
      reload();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not create a link', description: friendlyError(error) });
    } finally {
      setCreatingLink(false);
    }
  };

  const copyLink = async () => {
    if (!newLink) return;
    if (await copyText(newLink)) {
      setCopied(true);
      toast({ tone: 'success', title: 'Invite link copied' });
    } else {
      toast({ tone: 'error', title: 'Could not copy', description: 'Select the link and copy it manually.' });
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await revokeInvite(id);
      toast({ tone: 'success', title: 'Invite link revoked', description: 'It can no longer be used to join.' });
      setConfirmRevoke(null);
      reload();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not revoke', description: friendlyError(error) });
    } finally {
      setRevoking(null);
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'remove') {
        await removeWorkspaceMember(workspace.id, pending.member.teacherId);
        toast({ tone: 'success', title: `${pending.member.displayName} was removed` });
        setPending(null);
        reload();
      } else if (pending.kind === 'leave') {
        await leaveWorkspace(workspace.id);
        toast({ tone: 'success', title: `You left ${workspace.name}` });
        navigate('/teacher/workspaces', { replace: true });
      } else {
        await deleteWorkspace(workspace.id);
        toast({ tone: 'success', title: 'Workspace deleted' });
        navigate('/teacher/workspaces', { replace: true });
      }
    } catch (error) {
      toast({ tone: 'error', title: 'Something went wrong', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateWorkspaceName(name);
    if (problem) {
      setNameError(problem);
      return;
    }
    setBusy(true);
    try {
      await renameWorkspace(workspace.id, name);
      setRenameOpen(false);
      toast({ tone: 'success', title: 'Workspace renamed' });
      reload();
    } catch (error) {
      setNameError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/teacher/workspaces"
            className="-ml-3 grid size-11 shrink-0 place-items-center rounded-sm text-ink-700 hover:bg-paper-sunk hover:text-ink-900"
            aria-label="All workspaces"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <Menu
            label="Workspace actions"
            trigger={<MoreHorizontal className="size-5" />}
            items={
              isOwner
                ? [
                    {
                      label: 'Rename',
                      icon: <Pencil />,
                      onSelect: () => {
                        setName(workspace.name);
                        setNameError(null);
                        setRenameOpen(true);
                      },
                    },
                    'separator',
                    { label: 'Delete workspace', icon: <Trash2 />, tone: 'danger', onSelect: () => setPending({ kind: 'delete' }) },
                  ]
                : [{ label: 'Leave workspace', icon: <LogOut />, tone: 'danger', onSelect: () => setPending({ kind: 'leave' }) }]
            }
          />
        </div>
        <div className="mt-3 flex items-start gap-4">
          <Monogram name={workspace.name} seed={workspace.id} size={64} />
          <div className="min-w-0">
            <h1 className="type-display text-display-lg break-words">{workspace.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-ink-500">
              <span>
                <span className="type-score text-score-sm text-ink-900">{workspace.members.length}</span>{' '}
                {workspace.members.length === 1 ? 'member' : 'members'} · created {relativeTime(workspace.createdAt)}
              </span>
              <Badge tone={isOwner ? 'signal' : 'neutral'}>{isOwner ? 'Owner' : 'Member'}</Badge>
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="members-heading" className="min-w-0">
          <SectionHead id="members-heading" kicker="Members" action={<span className="text-caption text-ink-500">Everyone here sees each other’s names</span>} />
          <Ledger>
            {workspace.members.map((member) => (
              <LedgerRow
                key={member.teacherId}
                interactive={false}
                className="min-h-16 pl-1"
                actions={
                  isOwner && member.role !== 'owner' ? (
                    <Button
                      size="sm"
                      variant="danger-outline"
                      aria-label={`Remove ${member.displayName}`}
                      leftIcon={<UserMinus className="size-4" />}
                      onClick={() => setPending({ kind: 'remove', member })}
                    >
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  ) : undefined
                }
              >
                <div className="flex items-center gap-3">
                  <Monogram name={member.displayName} seed={member.teacherId} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-ink-900">
                      {member.displayName}
                      {member.teacherId === user.id && <span className="font-normal text-ink-500"> (you)</span>}
                    </p>
                    <p className="text-caption text-ink-500">Joined {relativeTime(member.joinedAt)}</p>
                  </div>
                  {member.role === 'owner' && <Badge tone="signal">Owner</Badge>}
                </div>
              </LedgerRow>
            ))}
          </Ledger>
        </section>

        {isOwner ? (
          <section aria-labelledby="invites-heading" className="min-w-0 space-y-4">
            <SectionHead id="invites-heading" kicker="Invites" />
            <p className="text-body-sm text-ink-700">Anyone with a link can join for {WORKSPACE_LIMITS.inviteDays} days, after signing in.</p>
            <Button variant="secondary" leftIcon={<Link2 className="size-4" />} loading={creatingLink} onClick={() => void makeLink()}>
              Create invite link
            </Button>

            {newLink && (
              <m.div
                key={newLink}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: dur.base, ease: [...ease.out] }}
                className="origin-top"
              >
                <ScoreBug tab="bg-signal-400" className="flex w-full flex-col items-stretch gap-3 py-3">
                  <p className="type-kicker">New invite link · shown once</p>
                  <input
                    readOnly
                    value={newLink}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Invite link"
                    className="h-11 w-full rounded-sm border border-night-line bg-night-950 px-3 font-mono text-caption text-night-text outline-none"
                  />
                  <Button
                    size="sm"
                    variant="night"
                    leftIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    onClick={() => void copyLink()}
                    className="self-start"
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </ScoreBug>
              </m.div>
            )}

            <div>
              <p className="type-kicker mt-4">Active links</p>
              {workspace.invites.length === 0 ? (
                <p className="mt-2 text-body-sm text-ink-500">No active links.</p>
              ) : (
                <Ledger className="mt-1">
                  {workspace.invites.map((invite) => (
                    <LedgerRow
                      key={invite.id}
                      interactive={false}
                      className="min-h-14 pl-0"
                      actions={
                        confirmRevoke === invite.id ? (
                          <span className="flex items-center gap-1">
                            <span className="text-caption text-ink-700">Revoke?</span>
                            <Button size="sm" variant="danger-outline" loading={revoking === invite.id} onClick={() => void revoke(invite.id)}>
                              Yes
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)} disabled={revoking === invite.id}>
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(invite.id)}>
                            Revoke
                          </Button>
                        )
                      }
                    >
                      <p className="text-body-sm font-semibold text-ink-900">
                        Created {relativeTime(invite.createdAt)} · used <span className="type-score">{invite.useCount}</span>{' '}
                        {invite.useCount === 1 ? 'time' : 'times'}
                      </p>
                      <p className="text-caption text-ink-500">Expires {relativeTime(invite.expiresAt)}</p>
                    </LedgerRow>
                  ))}
                </Ledger>
              )}
            </div>
          </section>
        ) : (
          <section aria-labelledby="shared-heading" className="min-w-0 space-y-3">
            <SectionHead id="shared-heading" kicker="Shared quizzes" />
            <p className="text-body-sm text-ink-700">
              Quizzes that members share with you appear in{' '}
              <Link to="/teacher/shared" className="font-semibold text-signal-600 underline underline-offset-2">
                Shared with Me
              </Link>
              . To share one of your quizzes here, open its menu in My Quizzes and choose Share.
            </p>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        tone="danger"
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmPending()}
        title={
          pending?.kind === 'delete'
            ? 'Delete this workspace?'
            : pending?.kind === 'leave'
              ? 'Leave this workspace?'
              : `Remove ${pending?.kind === 'remove' ? pending.member.displayName : ''}?`
        }
        description={
          pending?.kind === 'delete'
            ? 'All members lose access to every quiz shared here. Quizzes themselves are not deleted, and copies people made stay theirs.'
            : pending?.kind === 'leave'
              ? 'You lose access to quizzes shared here, and your quizzes are no longer shared here. Copies you made stay in your library.'
              : 'They lose access to every quiz shared in this workspace, and their quizzes stop being shared here.'
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete workspace' : pending?.kind === 'leave' ? 'Leave' : 'Remove'}
      />

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} dismissible={!busy} title="Rename workspace">
        <form onSubmit={(e) => void submitRename(e)} className="space-y-5" noValidate>
          <TextField
            label="Workspace name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            error={nameError ?? undefined}
            autoComplete="off"
            data-autofocus
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setRenameOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
