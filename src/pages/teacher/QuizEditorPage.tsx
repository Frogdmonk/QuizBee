import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, ChevronRight, Copy, Eye, History, Lock, MoreHorizontal, RotateCcw, Rocket, Save, Undo2, Users } from 'lucide-react';
import { m } from 'motion/react';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { SegmentedControl } from '@/components/ui/FormControls';
import { wipeIn } from '@/lib/motion';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/FormControls';
import { QuestionList, type EditorSelection } from '@/components/quiz/QuestionList';
import { QuestionEditor } from '@/components/quiz/QuestionEditor';
import { QuizDetailsEditor } from '@/components/quiz/QuizDetailsEditor';
import { PreviewPanel } from '@/components/quiz/PreviewPanel';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { editorReducer, initEditor } from '@/lib/quiz-editor-reducer';
import { draftFingerprint, emptyQuiz, newKey, quizIssues, saveBlockers } from '@/lib/quiz-rules';
import { getQuizDraft, isRevisionConflict, QuizNotFoundError, saveQuiz, setQuizStatus } from '@/services/quizzes';
import { copySharedQuiz, getQuizPermissions } from '@/services/sharing';
import { ShareQuizDialog } from '@/components/sharing/ShareQuizDialog';
import { QuizActivityDialog } from '@/components/sharing/QuizActivityDialog';
import { AccessBadge } from '@/components/sharing/AccessBadge';
import { relativeTime } from '@/utils/time';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import type { QuestionType, QuizDraft, QuizStatus } from '@/types/quiz';
import type { QuizPermissions } from '@/types/workspace';
import { cn } from '@/lib/cn';

type Handoff = { draft?: QuizDraft; selected?: EditorSelection } | null;
type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export default function QuizEditorPage() {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // A just-created quiz is handed over via navigation state to avoid a refetch.
  const handoff = (location.state as Handoff) ?? null;
  const fromHandoff = Boolean(quizId && handoff?.draft?.id === quizId);
  const isNew = !quizId;

  const [state, dispatch] = useReducer(editorReducer, null, () =>
    fromHandoff && handoff?.draft ? initEditor(handoff.draft, true) : initEditor(emptyQuiz(), false),
  );
  const [loadState, setLoadState] = useState<LoadState>(isNew || fromHandoff ? 'ready' : 'loading');
  const [loadNonce, setLoadNonce] = useState(0);
  const [selected, setSelected] = useState<EditorSelection>(handoff?.selected ?? 'details');
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // null = the signed-in teacher's own new or just-created quiz.
  const [perms, setPerms] = useState<QuizPermissions | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  // Phones show either the form or the student preview.
  const [phoneView, setPhoneView] = useState<'edit' | 'preview'>('edit');
  const allowNavigation = useRef(false);

  const { draft } = state;

  // Load an existing quiz.
  useEffect(() => {
    // A just-created quiz arrives via navigation state; it is only fetched again on an explicit reload.
    if (!quizId || (fromHandoff && loadNonce === 0)) return;
    let cancelled = false;
    Promise.all([getQuizDraft(quizId), getQuizPermissions(quizId)])
      .then(([loaded, permissions]) => {
        if (cancelled) return;
        setPerms(permissions);
        dispatch({ type: 'load', draft: loaded, saved: true });
        setSelected(loaded.questions[0]?.key ?? 'details');
        setLoadState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        const notFound = error instanceof QuizNotFoundError || (error as { code?: string } | null)?.code === 'P0002';
        setLoadState(notFound ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [quizId, fromHandoff, loadNonce]);

  const fingerprint = useMemo(() => draftFingerprint(draft), [draft]);
  const dirty = loadState === 'ready' && fingerprint !== state.savedFingerprint;
  const issues = useMemo(() => quizIssues(draft), [draft]);
  const issueKeys = useMemo(() => new Set(Object.keys(issues.byQuestion)), [issues]);

  // Keep the selection valid after deletes.
  const selectedIndex = draft.questions.findIndex((q) => q.key === selected);
  const activeSelection: EditorSelection = selected === 'details' || selectedIndex >= 0 ? selected : 'details';

  // ── Unsaved-changes protection ─────────────────────────────────────────────
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowNavigation.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = useCallback(
    async (options: { navigateAfterCreate?: boolean; quiet?: boolean } = {}): Promise<string | null> => {
      const { navigateAfterCreate = true, quiet = false } = options;
      const blockers = saveBlockers(draft);
      if (blockers.length) {
        if (!draft.title.trim()) setSelected('details');
        toast({ tone: 'error', title: 'Cannot save yet', description: blockers[0] });
        return null;
      }
      setSaving(true);
      const sent = draft;
      try {
        const id = await saveQuiz(sent);
        dispatch({ type: 'saved', id, sent });
        if (!quiet) toast({ tone: 'success', title: 'Quiz saved' });
        if (!sent.id && navigateAfterCreate) {
          allowNavigation.current = true;
          navigate(`/teacher/quizzes/${id}/edit`, {
            replace: true,
            state: { draft: { ...sent, id }, selected: activeSelection } satisfies Handoff,
          });
        }
        return id;
      } catch (error) {
        if (isRevisionConflict(error)) setConflictOpen(true);
        else toast({ tone: 'error', title: 'Could not save', description: friendlyError(error, 'Please try again.') });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [draft, toast, navigate, activeSelection],
  );

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving && (dirty || !draft.id)) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, saving, dirty, draft.id]);

  // ── Status changes ─────────────────────────────────────────────────────────
  const changeStatus = async (status: QuizStatus) => {
    if (status === 'published' && issues.count > 0) {
      setIssuesOpen(true);
      return;
    }
    setStatusBusy(true);
    try {
      let id = draft.id;
      if (!id || dirty) {
        id = await save({ navigateAfterCreate: false, quiet: true });
        if (!id) return;
      }
      await setQuizStatus(id, status);
      dispatch({ type: 'status', status });
      const titles: Record<QuizStatus, string> = {
        published: 'Quiz published. It is ready to host.',
        draft: 'Moved back to drafts',
        archived: 'Quiz archived',
      };
      toast({ tone: 'success', title: titles[status] });
      if (!draft.id) {
        allowNavigation.current = true;
        navigate(`/teacher/quizzes/${id}/edit`, {
          replace: true,
          state: { draft: { ...draft, id, status }, selected: activeSelection } satisfies Handoff,
        });
      }
    } catch (error) {
      toast({ tone: 'error', title: 'Could not update the quiz', description: friendlyError(error) });
    } finally {
      setStatusBusy(false);
    }
  };

  const openPreview = async () => {
    const id = draft.id && !dirty ? draft.id : await save({ navigateAfterCreate: false, quiet: true });
    if (!id) return;
    allowNavigation.current = true;
    navigate(`/teacher/quizzes/${id}/preview`);
  };

  // ── Question actions ───────────────────────────────────────────────────────
  const addQuestion = (type: QuestionType) => {
    const key = newKey();
    dispatch({ type: 'addQuestion', questionType: type, key, afterKey: selected === 'details' ? undefined : selected });
    setSelected(key);
  };

  const duplicateQuestion = (key: string) => {
    const copyKey = newKey();
    dispatch({ type: 'duplicateQuestion', key, newKey: copyKey });
    setSelected(copyKey);
  };

  const removeQuestion = (key: string) => {
    const index = draft.questions.findIndex((q) => q.key === key);
    const next = draft.questions[index + 1] ?? draft.questions[index - 1];
    dispatch({ type: 'removeQuestion', key });
    setSelected(next?.key ?? 'details');
    setPendingDelete(null);
  };

  const requestRemoveQuestion = (key: string) => {
    const q = draft.questions.find((x) => x.key === key);
    const hasContent = q && (q.prompt.trim() || q.imagePath || q.options.some((o) => (q.type !== 'true_false' && o.label.trim()) || o.imagePath));
    if (hasContent) setPendingDelete(key);
    else removeQuestion(key);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadState === 'loading') return <EditorSkeleton />;
  if (loadState === 'notfound' || loadState === 'error') {
    return (
      <div className="py-10">
        <StatusBlock
          tone={loadState === 'notfound' ? 'neutral' : 'error'}
          icon={<AlertTriangle />}
          title={loadState === 'notfound' ? 'Quiz not found' : 'Could not load this quiz'}
          actions={
            <>
              {loadState === 'error' && (
                <Button
                  onClick={() => {
                    setLoadState('loading');
                    setLoadNonce((n) => n + 1);
                  }}
                >
                  Retry
                </Button>
              )}
              <ButtonLink to="/teacher/quizzes" variant="secondary">
                Back to My Quizzes
              </ButtonLink>
            </>
          }
        >
          {loadState === 'notfound' ? 'It may have been deleted, or it is not shared with you.' : 'Check your connection and try again.'}
        </StatusBlock>
      </div>
    );
  }

  const role = perms?.role ?? 'owner';
  const isOwner = role === 'owner';
  const canPublish = isOwner || Boolean(perms?.canPublish);
  const canArchive = isOwner;
  const backPath = isOwner ? '/teacher/quizzes' : '/teacher/shared';

  if (perms && (perms.role === 'view' || perms.role === 'copy')) {
    return <NoEditAccess quizId={draft.id ?? ''} title={draft.title} perms={perms} />;
  }

  const selectedQuestion = selectedIndex >= 0 ? draft.questions[selectedIndex] : undefined;
  const busy = saving || statusBusy;

  const showUnpublish = canPublish && draft.status === 'published';
  const showArchive = canArchive && draft.status !== 'archived';

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 border-b border-line bg-paper px-4 py-2.5 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-5 lg:pb-3">
        <div className="flex items-center gap-x-3 gap-y-2">
          <Link
            to={backPath}
            className="grid size-11 shrink-0 place-items-center rounded-sm text-ink-700 hover:bg-paper-sunk hover:text-ink-900"
            aria-label={isOwner ? 'Back to My Quizzes' : 'Back to Shared with Me'}
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="type-headline truncate text-[1.25rem] sm:text-headline">{draft.title.trim() || 'Untitled quiz'}</h1>
              <span className="hidden sm:inline-flex">
                <StatusBadge status={draft.status} />
              </span>
            </div>
            <SaveState saving={saving} dirty={dirty} saved={Boolean(draft.id)} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" leftIcon={<Eye className="size-4" />} onClick={() => void openPreview()} disabled={busy}>
                Preview
              </Button>
              {isOwner && draft.id && (
                <Button variant="ghost" leftIcon={<Users className="size-4" />} onClick={() => setShareOpen(true)} disabled={busy}>
                  Share
                </Button>
              )}
              <Button
                variant="secondary"
                leftIcon={<Save className="size-4" />}
                onClick={() => void save()}
                loading={saving}
                disabled={statusBusy || (!dirty && Boolean(draft.id))}
              >
                Save
              </Button>
              {canPublish && draft.status === 'draft' && (
                <span className="relative inline-flex">
                  {issues.count === 0 && draft.questions.length > 0 && (
                    <m.span
                      variants={wipeIn}
                      initial="hidden"
                      animate="show"
                      className="absolute -top-2 left-2 z-10 rounded-xs bg-success-600 px-1.5 text-[0.6875rem] leading-4 font-bold tracking-[0.06em] text-white"
                    >
                      READY
                    </m.span>
                  )}
                  <Button variant="primary" leftIcon={<Rocket className="size-4" />} onClick={() => void changeStatus('published')} loading={statusBusy} disabled={saving}>
                    Publish
                  </Button>
                </span>
              )}
            </div>
            {canArchive && draft.status === 'archived' && (
              <Button variant="dark" className="hidden md:inline-flex" leftIcon={<RotateCcw className="size-4" />} onClick={() => void changeStatus('draft')} loading={statusBusy}>
                Restore
              </Button>
            )}
            {draft.id && (
              <Menu
                label="More quiz actions"
                trigger={<MoreHorizontal className="size-5" />}
                items={[
                  ...(showUnpublish
                    ? [{ label: 'Move back to drafts', icon: <Undo2 />, onSelect: () => void changeStatus('draft') }]
                    : []),
                  ...(showArchive
                    ? [{ label: 'Archive quiz', icon: <Archive />, onSelect: () => void changeStatus('archived') }]
                    : []),
                  ...(showUnpublish || showArchive ? (['separator'] as MenuItem[]) : []),
                  ...(isOwner ? [{ label: 'Share', icon: <Users />, onSelect: () => setShareOpen(true) }] : []),
                  { label: 'Activity', icon: <History />, onSelect: () => setActivityOpen(true) },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {!isOwner && perms && (
        <Alert tone="info" title={`Shared with you by ${perms.ownerName}`}>
          <div className="space-y-1.5">
            <AccessBadge access="edit" />
            <p>
              Changes you save update this quiz for everyone it is shared with, and {perms.ownerName} can see who edited it.
              {perms.canPublish ? ' You can also publish and unpublish it.' : ''}
              {perms.updatedByName ? ` Last edited by ${perms.updatedByName} ${relativeTime(perms.updatedAt)}.` : ''}
            </p>
          </div>
        </Alert>
      )}
      {draft.status === 'archived' && (
        <Alert tone="info" title="This quiz is archived">
          It is hidden from your active library and cannot be hosted. Restore it to use it again.
        </Alert>
      )}
      {draft.status === 'published' && issues.count > 0 && (
        <Alert tone="warning" title="Finish these questions before saving">
          This quiz is published, so every question must stay complete. Questions marked with a dot need attention.
        </Alert>
      )}

      <div className="lg:hidden">
        <SegmentedControl
          label="Editor view"
          layoutId="editor-view"
          value={phoneView}
          onChange={setPhoneView}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Student view' },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_340px]">
        <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto">
          <QuestionList
            questions={draft.questions}
            selected={activeSelection}
            onSelect={setSelected}
            onAdd={addQuestion}
            issueKeys={issueKeys}
            detailsHasIssues={draft.title.trim() === ''}
          />
        </aside>

        <section className={cn('min-w-0', phoneView === 'preview' && 'hidden lg:block')}>
          {selectedQuestion ? (
            <QuestionEditor
              key={selectedQuestion.key}
              question={selectedQuestion}
              index={selectedIndex}
              total={draft.questions.length}
              issues={issues.byQuestion[selectedQuestion.key] ?? []}
              dispatch={dispatch}
              onDuplicate={() => duplicateQuestion(selectedQuestion.key)}
              onDelete={() => requestRemoveQuestion(selectedQuestion.key)}
            />
          ) : (
            <QuizDetailsEditor draft={draft} dispatch={dispatch} />
          )}
          {selected === 'details' && draft.questions.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(draft.questions[0].key)}
              className="mt-4 flex min-h-14 w-full items-center justify-between rounded-md border border-line bg-surface px-5 text-left text-title hover:bg-paper"
            >
              Continue to the questions
              <ChevronRight className="size-5 text-ink-500" />
            </button>
          )}
        </section>

        <PreviewPanel
          draft={draft}
          selectedIndex={selectedIndex}
          className={cn('lg:col-span-2 xl:sticky xl:top-28 xl:col-span-1 xl:self-start', phoneView === 'edit' && 'hidden lg:block')}
        />
      </div>

      {/* Phones: labelled actions at the thumb. */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 pt-2 md:hidden">
        <div className="mb-2 grid grid-cols-3 gap-2">
          <Button variant="ghost" className="h-12" leftIcon={<Eye className="size-4" />} onClick={() => void openPreview()} disabled={busy}>
            Preview
          </Button>
          <Button
            variant="secondary"
            className="h-12"
            leftIcon={<Save className="size-4" />}
            onClick={() => void save()}
            loading={saving}
            disabled={statusBusy || (!dirty && Boolean(draft.id))}
          >
            Save
          </Button>
          {canPublish && draft.status === 'draft' ? (
            <Button variant="primary" className="h-12" leftIcon={<Rocket className="size-4" />} onClick={() => void changeStatus('published')} loading={statusBusy} disabled={saving}>
              Publish
            </Button>
          ) : canArchive && draft.status === 'archived' ? (
            <Button variant="dark" className="h-12" leftIcon={<RotateCcw className="size-4" />} onClick={() => void changeStatus('draft')} loading={statusBusy}>
              Restore
            </Button>
          ) : (
            <span className="grid place-items-center">
              <StatusBadge status={draft.status} />
            </span>
          )}
        </div>
      </div>
      <div aria-hidden className="h-20 md:hidden" />

      <Dialog
        open={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        title="Almost ready to publish"
        description="Fix these first. Students will only ever see complete questions."
        footer={
          <Button variant="secondary" onClick={() => setIssuesOpen(false)}>
            Keep editing
          </Button>
        }
      >
        <ul className="space-y-2">
          {issues.quiz.map((issue) => (
            <li key={issue}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-sm border border-line bg-surface px-3 py-2 text-left text-body-sm hover:bg-paper"
                onClick={() => {
                  setSelected('details');
                  setIssuesOpen(false);
                }}
              >
                {issue}
              </button>
            </li>
          ))}
          {draft.questions.map((q, i) =>
            issues.byQuestion[q.key] ? (
              <li key={q.key}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-start gap-1 rounded-sm border border-line bg-surface px-3 py-2 text-left text-body-sm hover:bg-paper"
                  onClick={() => {
                    setSelected(q.key);
                    setIssuesOpen(false);
                  }}
                >
                  <span className="font-semibold">Question {i + 1}:</span> {issues.byQuestion[q.key].join(' ')}
                </button>
              </li>
            ) : null,
          )}
        </ul>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this question?"
        description="Its text, answers and images will be removed from the quiz when you save."
        confirmLabel="Delete question"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeQuestion(pendingDelete)}
      />

      <ConfirmDialog
        open={conflictOpen}
        title="Someone else saved this quiz"
        description="Another teacher saved changes while you were editing, so your version was not saved. Reload to get the latest version. Your unsaved changes on this screen will be lost, so copy anything you need first."
        confirmLabel="Reload latest version"
        cancelLabel="Not yet"
        onCancel={() => setConflictOpen(false)}
        onConfirm={() => {
          setConflictOpen(false);
          setLoadState('loading');
          setLoadNonce((n) => n + 1);
        }}
      />

      {draft.id && (
        <>
          <ShareQuizDialog open={shareOpen} quizId={draft.id} quizTitle={draft.title} onClose={() => setShareOpen(false)} />
          <QuizActivityDialog open={activityOpen} quizId={draft.id} onClose={() => setActivityOpen(false)} />
        </>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        description="You have unsaved changes to this quiz. They will be lost if you leave."
        confirmLabel="Discard changes"
        cancelLabel="Stay"
        tone="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}

/** Shown when a teacher opens the editor for a quiz they may only view or copy. */
function NoEditAccess({ quizId, title, perms }: { quizId: string; title: string; perms: QuizPermissions }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);

  const copy = async () => {
    setCopying(true);
    try {
      const id = await copySharedQuiz(quizId);
      toast({ tone: 'success', title: 'Added to My Quizzes', description: 'Your copy is a draft you can change freely.' });
      navigate(`/teacher/quizzes/${id}/edit`);
    } catch (error) {
      toast({ tone: 'error', title: 'Could not copy', description: friendlyError(error) });
      setCopying(false);
    }
  };

  return (
    <div className="space-y-4 py-10">
      {perms.role !== 'owner' && <AccessBadge access={perms.role} />}
      <StatusBlock
        icon={<Lock />}
        title={title || 'Shared quiz'}
        actions={
          <>
        <ButtonLink to={`/teacher/quizzes/${quizId}/preview`} leftIcon={<Eye className="size-4" />}>
          Preview
        </ButtonLink>
        {perms.role === 'copy' && (
          <Button variant="secondary" leftIcon={<Copy className="size-4" />} loading={copying} onClick={() => void copy()}>
            Copy to My Quizzes
          </Button>
        )}
        <ButtonLink to="/teacher/shared" variant="ghost">
          Back to Shared with Me
        </ButtonLink>
          </>
        }
      >
        {perms.ownerName} shared this quiz with you to{' '}
        {perms.role === 'copy'
          ? 'view and copy. Copy it to your library to make your own changes.'
          : 'view. Ask them for copy or edit access to change it.'}
      </StatusBlock>
    </div>
  );
}

function SaveState({ saving, dirty, saved }: { saving: boolean; dirty: boolean; saved: boolean }) {
  let content;
  if (saving) content = <span className="text-ink-500">Saving…</span>;
  else if (dirty || !saved)
    content = (
      <span className="flex items-center gap-1.5 text-ink-700">
        <span className="size-2 rounded-full bg-answer-d" /> {saved ? 'Unsaved changes' : 'Not saved yet'}
      </span>
    );
  else
    content = (
      <span className="flex items-center gap-1.5 text-ink-500">
        <CheckCircle2 className="size-3.5 text-success-600" /> All changes saved
      </span>
    );
  return (
    <p className="mt-0.5 text-caption" aria-live="polite">
      {content}
    </p>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading quiz">
      <Skeleton className="h-12 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_340px]">
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-[520px] rounded-md" />
        <Skeleton className="hidden h-[460px] rounded-[1.75rem] xl:block" />
      </div>
    </div>
  );
}

