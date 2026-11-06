import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, Link2, LogOut, MoreHorizontal, Pencil, Trash2, UserMinus } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
}

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
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (state !== 'ready' || !workspace) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-2xl font-extrabold">{state === 'notfound' ? 'Workspace not found' : 'Could not load this workspace'}</h1>
        <p className="mt-2 text-ink-600">
          {state === 'notfound' ? 'It may have been deleted, or you are no longer a member.' : 'Check your connection and try again.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {state === 'error' && <Button onClick={reload}>Retry</Button>}
          <ButtonLink to="/teacher/workspaces" variant="secondary">
            All workspaces
          </ButtonLink>
        </div>
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
    try {
      await revokeInvite(id);
      toast({ tone: 'success', title: 'Invite link revoked', description: 'It can no longer be used to join.' });
      reload();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not revoke', description: friendlyError(error) });
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/teacher/workspaces"
          className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          aria-label="All workspaces"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-3xl font-extrabold">{workspace.name}</h1>
            <Badge tone={isOwner ? 'flame' : 'neutral'}>{isOwner ? 'Owner' : 'Member'}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {workspace.members.length} {workspace.members.length === 1 ? 'member' : 'members'} · created{' '}
            {relativeTime(workspace.createdAt)}
          </p>
        </div>
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
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Members" description="Everyone here can see each other's names." />
          <CardBody className="p-2 sm:p-2">
            <ul>
              {workspace.members.map((member) => (
                <li key={member.teacherId} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white">
                    {initials(member.displayName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {member.displayName}
                      {member.teacherId === user.id && <span className="font-normal text-ink-500"> (you)</span>}
                    </p>
                    <p className="text-xs text-ink-500">Joined {relativeTime(member.joinedAt)}</p>
                  </div>
                  {member.role === 'owner' && <Badge tone="flame">Owner</Badge>}
                  {isOwner && member.role !== 'owner' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${member.displayName}`}
                      leftIcon={<UserMinus className="size-4" />}
                      onClick={() => setPending({ kind: 'remove', member })}
                    >
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {isOwner ? (
          <Card>
            <CardHeader
              title="Invite teachers"
              description={`Anyone with a link can join for ${WORKSPACE_LIMITS.inviteDays} days, after signing in.`}
            />
            <CardBody className="space-y-4">
              {newLink && (
                <div className="space-y-2 rounded-xl border border-mint-400/40 bg-mint-50 p-3">
                  <p className="text-sm font-semibold">Your new invite link</p>
                  <input
                    readOnly
                    value={newLink}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Invite link"
                    className="h-10 w-full rounded-lg border border-ink-200 bg-surface px-3 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    fullWidth
                    variant={copied ? 'secondary' : 'primary'}
                    leftIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    onClick={() => void copyLink()}
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <p className="text-xs text-ink-600">For security, this link is shown only once. Copy it now.</p>
                </div>
              )}
              <Button
                variant={newLink ? 'secondary' : 'primary'}
                fullWidth
                leftIcon={<Link2 className="size-4" />}
                loading={creatingLink}
                onClick={() => void makeLink()}
              >
                Create invite link
              </Button>

              <div>
                <h3 className="text-sm font-semibold text-ink-800">Active links</h3>
                {workspace.invites.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-500">No active links.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {workspace.invites.map((invite) => (
                      <li key={invite.id} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2">
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-medium">
                            Created {relativeTime(invite.createdAt)} · used {invite.useCount}{' '}
                            {invite.useCount === 1 ? 'time' : 'times'}
                          </p>
                          <p className="text-xs text-ink-500">Expires {relativeTime(invite.expiresAt)}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => void revoke(invite.id)}>
                          Revoke
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        ) : (
          <Alert tone="info" title="Shared quizzes">
            Quizzes that members share with you appear in{' '}
            <Link to="/teacher/shared" className="font-semibold underline underline-offset-2">
              Shared with Me
            </Link>
            . To share one of your quizzes here, open its menu in My Quizzes and choose Share.
          </Alert>
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
