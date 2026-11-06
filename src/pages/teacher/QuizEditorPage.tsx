import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router';
import { Archive, ArrowLeft, CheckCircle2, ChevronRight, Eye, MoreHorizontal, RotateCcw, Rocket, Save, Undo2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/FormControls';
import { QuestionList, type EditorSelection } from '@/components/quiz/QuestionList';
import { QuestionEditor } from '@/components/quiz/QuestionEditor';
import { QuizDetailsEditor } from '@/components/quiz/QuizDetailsEditor';
import { PreviewPanel } from '@/components/quiz/PreviewPanel';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { editorReducer, initEditor } from '@/lib/quiz-editor-reducer';
import { draftFingerprint, emptyQuiz, newKey, quizIssues, saveBlockers } from '@/lib/quiz-rules';
import { getQuizDraft, QuizNotFoundError, saveQuiz, setQuizStatus } from '@/services/quizzes';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import type { QuestionType, QuizDraft, QuizStatus } from '@/types/quiz';
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
  const allowNavigation = useRef(false);

  const { draft } = state;

  // Load an existing quiz.
  useEffect(() => {
    if (!quizId || fromHandoff) return;
    let cancelled = false;
    getQuizDraft(quizId)
      .then((loaded) => {
        if (cancelled) return;
        dispatch({ type: 'load', draft: loaded, saved: true });
        setSelected(loaded.questions[0]?.key ?? 'details');
        setLoadState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState(error instanceof QuizNotFoundError ? 'notfound' : 'error');
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
        toast({ tone: 'error', title: 'Could not save', description: friendlyError(error, 'Please try again.') });
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
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-2xl font-extrabold">{loadState === 'notfound' ? 'Quiz not found' : 'Could not load this quiz'}</h1>
        <p className="mt-2 text-ink-600">
          {loadState === 'notfound'
            ? 'It may have been deleted, or it belongs to another teacher.'
            : 'Check your connection and try again.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
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
        </div>
      </div>
    );
  }

  const selectedQuestion = selectedIndex >= 0 ? draft.questions[selectedIndex] : undefined;
  const busy = saving || statusBusy;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-ink-100 bg-paper/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            to="/teacher/quizzes"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Back to My Quizzes"
          >
            <ArrowLeft className="size-5" />
          </Link>
          {/* On phones the title takes its own row; actions wrap underneath. */}
          <div className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] md:basis-auto">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-extrabold sm:text-xl">{draft.title.trim() || 'Untitled quiz'}</h1>
              <StatusBadge status={draft.status} />
            </div>
            <SaveState saving={saving} dirty={dirty} saved={Boolean(draft.id)} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" leftIcon={<Eye className="size-4" />} onClick={() => void openPreview()} disabled={busy}>
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button
              variant={dirty || !draft.id ? 'secondary' : 'ghost'}
              leftIcon={<Save className="size-4" />}
              onClick={() => void save()}
              loading={saving}
              disabled={statusBusy || (!dirty && Boolean(draft.id))}
            >
              Save
            </Button>
            {draft.status === 'draft' && (
              <Button variant="primary" leftIcon={<Rocket className="size-4" />} onClick={() => void changeStatus('published')} loading={statusBusy} disabled={saving}>
                Publish
              </Button>
            )}
            {draft.status === 'archived' && (
              <Button variant="dark" leftIcon={<RotateCcw className="size-4" />} onClick={() => void changeStatus('draft')} loading={statusBusy}>
                Restore
              </Button>
            )}
            {draft.id && draft.status !== 'archived' && (
              <Menu
                label="More quiz actions"
                trigger={<MoreHorizontal className="size-5" />}
                items={[
                  ...(draft.status === 'published'
                    ? [{ label: 'Move back to drafts', icon: <Undo2 />, onSelect: () => void changeStatus('draft') }]
                    : []),
                  { label: 'Archive quiz', icon: <Archive />, onSelect: () => void changeStatus('archived') },
                ]}
              />
            )}
          </div>
        </div>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <QuestionList
            questions={draft.questions}
            selected={activeSelection}
            onSelect={setSelected}
            onAdd={addQuestion}
            issueKeys={issueKeys}
            detailsHasIssues={draft.title.trim() === ''}
          />
        </aside>

        <section className="min-w-0">
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
              className="mt-4 flex w-full items-center justify-between rounded-2xl border border-ink-100 bg-surface px-5 py-4 text-left font-semibold shadow-card hover:border-ink-200"
            >
              Continue to the questions
              <ChevronRight className="size-5 text-ink-400" />
            </button>
          )}
        </section>

        <PreviewPanel
          draft={draft}
          selectedIndex={selectedIndex}
          className="lg:col-span-2 xl:sticky xl:top-28 xl:col-span-1 xl:self-start"
        />
      </div>

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
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {issues.quiz.map((issue) => (
            <li key={issue}>
              <button
                type="button"
                className="w-full rounded-xl bg-ink-50 px-3 py-2 text-left text-sm hover:bg-ink-100"
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
                  className="w-full rounded-xl bg-ink-50 px-3 py-2 text-left text-sm hover:bg-ink-100"
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

function SaveState({ saving, dirty, saved }: { saving: boolean; dirty: boolean; saved: boolean }) {
  let content;
  if (saving) content = <span className="text-ink-500">Saving…</span>;
  else if (dirty || !saved)
    content = (
      <span className="flex items-center gap-1.5 text-ink-600">
        <span className="size-2 rounded-full bg-sun-500" /> {saved ? 'Unsaved changes' : 'Not saved yet'}
      </span>
    );
  else
    content = (
      <span className="flex items-center gap-1.5 text-ink-500">
        <CheckCircle2 className="size-3.5 text-mint-500" /> All changes saved
      </span>
    );
  return (
    <p className={cn('mt-0.5 text-xs font-medium')} aria-live="polite">
      {content}
    </p>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading quiz">
      <Skeleton className="h-12 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-[520px] rounded-2xl" />
        <Skeleton className="hidden h-[460px] rounded-[2rem] xl:block" />
      </div>
    </div>
  );
}

