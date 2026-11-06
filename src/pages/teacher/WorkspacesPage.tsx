import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
import { Ledger, LedgerLink, LedgerRow } from '@/components/ui/Ledger';
import { Monogram } from '@/components/ui/Monogram';
import { SectionHead } from '@/components/ui/SectionHead';
import { StepStrip } from '@/components/ui/StepStrip';
import { createWorkspace, listMyWorkspaces } from '@/services/workspaces';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { validateWorkspaceName, WORKSPACE_LIMITS } from '@/lib/workspace-rules';
import type { WorkspaceSummary } from '@/types/workspace';

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMyWorkspaces()
      .then((list) => {
        if (cancelled) return;
        setWorkspaces(list);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const openCreate = () => {
    setName('');
    setNameError(null);
    setCreateOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateWorkspaceName(name);
    if (problem) {
      setNameError(problem);
      return;
    }
    setCreating(true);
    try {
      const id = await createWorkspace(name);
      toast({ tone: 'success', title: 'Workspace created', description: 'Create an invite link to add colleagues.' });
      navigate(`/teacher/workspaces/${id}`);
    } catch (error) {
      setNameError(friendlyError(error));
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-kicker">Share</p>
          <h1 className="type-display mt-1 text-display-lg">Workspaces</h1>
        </div>
        <Button variant="secondary" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
          New workspace
        </Button>
      </header>

      {status === 'error' && (
        <Alert tone="error" title="Could not load your workspaces">
          <div className="flex flex-wrap items-center gap-3">
            <span>Check your connection and try again.</span>
            <Button size="sm" variant="secondary" onClick={() => setNonce((n) => n + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {status === 'loading' ? (
        <div className="max-w-[760px] space-y-2" aria-busy="true" aria-label="Loading workspaces">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : status === 'ready' && workspaces.length === 0 ? (
        <section className="space-y-6 border-t-[3px] border-ink-950 pt-6">
          <div>
            <h2 className="type-headline text-headline">Work together on quizzes</h2>
            <p className="mt-2 max-w-md text-body text-ink-700">A workspace is a group of teachers, such as your department.</p>
          </div>
          <StepStrip
            steps={[
              { title: 'Create', body: 'Start a workspace for your department or year team.' },
              { title: 'Invite', body: 'Send colleagues a link. It works for 7 days.' },
              { title: 'Share', body: 'Choose who can view, copy or edit each quiz.' },
            ]}
          />
          <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>
            Create a workspace
          </Button>
        </section>
      ) : (
        status === 'ready' && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <Ledger className="border-t border-line">
              {workspaces.map((w) => (
                <LedgerRow key={w.id} className="min-h-[72px] pl-3" actions={<ChevronRight aria-hidden className="mr-2 size-5 text-ink-500" />}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Monogram name={w.name} seed={w.id} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <LedgerLink to={`/teacher/workspaces/${w.id}`} className="min-w-0">
                          {w.name}
                        </LedgerLink>
                        <Badge tone={w.role === 'owner' ? 'signal' : 'neutral'}>{w.role === 'owner' ? 'Owner' : 'Member'}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-caption text-ink-500">
                        {w.role === 'member' ? `Owner: ${w.ownerName}` : 'You own this workspace'}
                      </p>
                    </div>
                    <p className="hidden shrink-0 text-right sm:block">
                      <span className="type-score block text-score-md text-ink-900">{w.memberCount}</span>
                      <span className="text-caption text-ink-500">{w.memberCount === 1 ? 'member' : 'members'}</span>
                    </p>
                  </div>
                </LedgerRow>
              ))}
            </Ledger>
            <aside>
              <SectionHead kicker="How sharing works" />
              <p className="mt-3 text-body-sm text-ink-700">
                Share a quiz with everyone in a workspace, or with chosen members. Each person can view, copy or edit, and
                only you can delete or archive your quizzes.
              </p>
            </aside>
          </div>
        )
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        dismissible={!creating}
        title="New workspace"
        description="You will be the owner. You can invite colleagues with a link next."
      >
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <TextField
            label="Workspace name"
            placeholder="e.g. Grade 8 Science"
            value={name}
            maxLength={WORKSPACE_LIMITS.nameMax + 10}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            error={nameError ?? undefined}
            autoComplete="off"
            data-autofocus
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create workspace
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
