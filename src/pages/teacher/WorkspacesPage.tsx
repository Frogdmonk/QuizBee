import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
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
          <h1 className="text-3xl font-extrabold">Workspaces</h1>
          <p className="mt-2 max-w-xl text-ink-600">
            A workspace is a group of teachers, such as your department. Share quizzes with everyone in it, or with
            chosen members only.
          </p>
        </div>
        <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>
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
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading workspaces">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : status === 'ready' && workspaces.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-surface px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-flame-50 text-flame-600">
            <Users className="size-7" />
          </span>
          <h2 className="mt-5 text-xl font-extrabold">Work together on quizzes</h2>
          <p className="mt-2 max-w-sm text-ink-600">
            Create a workspace, send colleagues an invite link, then choose who can view, copy or edit each quiz.
          </p>
          <Button className="mt-6" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
            Create a workspace
          </Button>
        </div>
      ) : (
        status === 'ready' && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  to={`/teacher/workspaces/${w.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-surface p-5 shadow-card transition-shadow hover:shadow-lift"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
                    <Users className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{w.name}</p>
                      <Badge tone={w.role === 'owner' ? 'flame' : 'neutral'}>{w.role === 'owner' ? 'Owner' : 'Member'}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-500">
                      {w.memberCount} {w.memberCount === 1 ? 'member' : 'members'}
                      {w.role === 'member' ? ` · Owner: ${w.ownerName}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-300" />
                </Link>
              </li>
            ))}
          </ul>
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
