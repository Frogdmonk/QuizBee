import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { CheckSquare, Plus, Search } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SegmentedControl, Skeleton } from '@/components/ui/FormControls';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { Ledger } from '@/components/ui/Ledger';
import { StepStrip } from '@/components/ui/StepStrip';
import { Alert } from '@/components/ui/Alert';
import { inputClasses } from '@/components/ui/field-styles';
import { QuizCard, QuizRow, type QuizCardActions } from '@/components/quiz/QuizCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { ShareQuizDialog } from '@/components/sharing/ShareQuizDialog';
import { HostQuizDialog } from '@/components/live/HostQuizDialog';
import { useMyQuizzes } from '@/hooks/useMyQuizzes';
import { useToast } from '@/hooks/useToast';
import { deleteQuiz, duplicateQuiz, setQuizStatus } from '@/services/quizzes';
import { friendlyError } from '@/utils/errors';
import { SelectionBar, SubjectBar, SubjectHeader, SubjectNameDialog, type Folder } from '@/components/quiz/SubjectControls';
import { createSubject, deleteSubject, listMySubjects, renameSubject, setQuizzesSubject, type Subject } from '@/services/subjects';
import type { QuizStatus, QuizSummary } from '@/types/quiz';

type Filter = 'active' | 'draft' | 'published' | 'archived';
type View = 'grid' | 'list';
const VIEW_KEY = 'rally.library.view';

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

const FILTERS: Record<Filter, (q: QuizSummary) => boolean> = {
  active: (q) => q.status !== 'archived',
  draft: (q) => q.status === 'draft',
  published: (q) => q.status === 'published',
  archived: (q) => q.status === 'archived',
};

export default function QuizzesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { quizzes, setQuizzes, status, reload } = useMyQuizzes();
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<QuizSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toShare, setToShare] = useState<QuizSummary | null>(null);
  const [toHost, setToHost] = useState<QuizSummary | null>(null);
  const [view, setView] = useState<View>(savedView);
  const phone = useMediaQuery('(max-width: 639px)');
  const effectiveView: View = phone ? 'list' : view;

  // Subjects: folders of quizzes; sharing one shares every quiz in it.
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [folder, setFolder] = useState<Folder>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [naming, setNaming] = useState<'create' | 'rename' | 'create-and-move' | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [subjectToShare, setSubjectToShare] = useState<Subject | null>(null);
  const [subjectsNonce, setSubjectsNonce] = useState(0);
  const reloadSubjects = () => setSubjectsNonce((n) => n + 1);
  useEffect(() => {
    let cancelled = false;
    listMySubjects()
      .then((list) => {
        if (!cancelled) setSubjects(list);
      })
      .catch(() => undefined); // the library still works without subjects
    return () => {
      cancelled = true;
    };
  }, [subjectsNonce]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const openSubject = folder !== 'all' && folder !== 'none' ? (subjectById.get(folder) ?? null) : null;
  // A subject that no longer exists (deleted elsewhere) falls back to all quizzes.
  const effectiveFolder: Folder = folder !== 'all' && folder !== 'none' && !openSubject ? 'all' : folder;
  const inFolder = useCallback(
    (q: QuizSummary) =>
      effectiveFolder === 'all' ? true : effectiveFolder === 'none' ? !q.subjectId || !subjectById.has(q.subjectId) : q.subjectId === effectiveFolder,
    [effectiveFolder, subjectById],
  );

  const toggle = (id: string) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const moveSelected = async (subjectId: string | null) => {
    const ids = [...selected];
    if (!ids.length) return;
    setMoving(true);
    try {
      await setQuizzesSubject(ids, subjectId);
      setQuizzes((list) => list.map((q) => (selected.has(q.id) ? { ...q, subjectId } : q)));
      const name = subjectId ? subjectById.get(subjectId)?.name : null;
      toast({
        tone: 'success',
        title: subjectId ? `Moved to ${name ?? 'the subject'}` : 'Taken out of the subject',
        description: `${ids.length} ${ids.length === 1 ? 'quiz' : 'quizzes'}`,
      });
      stopSelecting();
      reloadSubjects();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not move the quizzes', description: friendlyError(error) });
    } finally {
      setMoving(false);
    }
  };

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembering the view is only a convenience.
    }
  };

  const counts = useMemo(() => {
    const here = quizzes.filter(inFolder);
    return {
      active: here.filter(FILTERS.active).length,
      draft: here.filter(FILTERS.draft).length,
      published: here.filter(FILTERS.published).length,
      archived: here.filter(FILTERS.archived).length,
    };
  }, [quizzes, inFolder]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return quizzes.filter(
      (q) =>
        inFolder(q) &&
        FILTERS[filter](q) &&
        (!needle || q.title.toLowerCase().includes(needle) || q.subject.toLowerCase().includes(needle)),
    );
  }, [quizzes, filter, query, inFolder]);

  const patch = useCallback(
    (id: string, changes: Partial<QuizSummary>) =>
      setQuizzes((list) => list.map((q) => (q.id === id ? { ...q, ...changes, updatedAt: new Date().toISOString() } : q))),
    [setQuizzes],
  );

  const actions = useMemo<QuizCardActions>(
    () => ({
      onEdit: (quiz) => navigate(`/teacher/quizzes/${quiz.id}/edit`),
      onPreview: (quiz) => navigate(`/teacher/quizzes/${quiz.id}/preview`),
      onDuplicate: async (quiz) => {
        try {
          await duplicateQuiz(quiz.id);
          toast({ tone: 'success', title: 'Quiz duplicated', description: `“Copy of ${quiz.title}” is in your drafts.` });
          reload();
        } catch (error) {
          toast({ tone: 'error', title: 'Could not duplicate', description: friendlyError(error) });
        }
      },
      onStatus: async (quiz, next: QuizStatus) => {
        try {
          await setQuizStatus(quiz.id, next);
          patch(quiz.id, { status: next });
          const messages: Record<QuizStatus, string> = {
            published: 'Published. Ready to host.',
            draft: quiz.status === 'archived' ? 'Restored to drafts' : 'Moved to drafts',
            archived: 'Archived',
          };
          toast({ tone: 'success', title: messages[next] });
        } catch (error) {
          toast({
            tone: 'error',
            title: next === 'published' ? 'Not ready to publish' : 'Could not update the quiz',
            description: friendlyError(error),
          });
        }
      },
      onShare: (quiz) => setToShare(quiz),
      onHost: (quiz) => setToHost(quiz),
      onDelete: (quiz) => setToDelete(quiz),
    }),
    [navigate, toast, reload, patch],
  );

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteQuiz(toDelete.id);
      setQuizzes((list) => list.filter((q) => q.id !== toDelete.id));
      toast({ tone: 'success', title: 'Quiz deleted' });
      setToDelete(null);
    } catch (error) {
      toast({ tone: 'error', title: 'Could not delete', description: friendlyError(error) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-kicker">Library</p>
          <h1 className="type-display mt-1 text-display-lg">My quizzes</h1>
        </div>
        <ButtonLink to="/teacher/quizzes/create" leftIcon={<Plus className="size-4" />} className="hidden sm:inline-flex">
          New quiz
        </ButtonLink>
      </header>

      {status === 'ready' && quizzes.length > 0 && (
        <SubjectBar
          subjects={subjects}
          folder={effectiveFolder}
          onFolder={setFolder}
          total={quizzes.length}
          unfiled={quizzes.filter((q) => !q.subjectId || !subjectById.has(q.subjectId)).length}
          onNew={() => setNaming('create')}
        />
      )}
      {openSubject && (
        <SubjectHeader
          subject={openSubject}
          onShare={() => setSubjectToShare(openSubject)}
          onRename={() => setNaming('rename')}
          onDelete={() => setSubjectToDelete(openSubject)}
        />
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <UnderlineTabs
          label="Filter quizzes"
          layoutId="quiz-filter"
          value={filter}
          onChange={setFilter}
          className="min-w-0 flex-1"
          options={[
            { value: 'active', label: 'All', count: counts.active },
            { value: 'published', label: 'Published', count: counts.published },
            { value: 'draft', label: 'Drafts', count: counts.draft },
            { value: 'archived', label: 'Archived', count: counts.archived },
          ]}
        />
        <div className="flex items-center gap-2">
          <label className="relative block flex-1 lg:w-72">
            <span className="sr-only">Search quizzes</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or subject"
              className={cn(inputClasses, 'h-11 pl-9')}
            />
          </label>
          {status === 'ready' && quizzes.length > 0 && !selecting && (
            <Button variant="secondary" leftIcon={<CheckSquare className="size-4" />} onClick={() => setSelecting(true)}>
              Select
            </Button>
          )}
          <div className="hidden w-[8.5rem] sm:block">
            <SegmentedControl<View>
              label="Layout"
              layoutId="library-view"
              value={view}
              onChange={changeView}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
            />
          </div>
        </div>
      </div>

      {status === 'error' && (
        <Alert tone="error" title="Could not load your quizzes">
          <div className="flex flex-wrap items-center gap-3">
            <span>Check your connection and try again.</span>
            <Button size="sm" variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {status === 'loading' ? (
        effectiveView === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading quizzes">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[232px] rounded-md" />
            ))}
          </div>
        ) : (
          <div className="space-y-2" aria-busy="true" aria-label="Loading quizzes">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
        )
      ) : status === 'ready' && quizzes.length === 0 ? (
        <EmptyLibrary />
      ) : status === 'ready' && visible.length === 0 ? (
        <div className="border-t border-line py-10">
          <p className="text-title">{query ? `No quizzes match “${query}”.` : 'Nothing here yet.'}</p>
          <p className="mt-1 text-body-sm text-ink-500">
            {query ? 'Search looks at titles and subjects in the selected tab.' : 'Quizzes appear here when they have this status.'}
          </p>
          {query && (
            <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => setQuery('')}>
              Clear search
            </Button>
          )}
        </div>
      ) : effectiveView === 'grid' ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                actions={actions}
                selection={selecting ? { selected: selected.has(quiz.id), onToggle: () => toggle(quiz.id) } : null}
                subjectName={effectiveFolder === 'all' && quiz.subjectId ? (subjectById.get(quiz.subjectId)?.name ?? null) : null}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Ledger className="border-t border-line">
          {visible.map((quiz) => (
            <QuizRow
              key={quiz.id}
              quiz={quiz}
              actions={actions}
              selection={selecting ? { selected: selected.has(quiz.id), onToggle: () => toggle(quiz.id) } : null}
              subjectName={effectiveFolder === 'all' && quiz.subjectId ? (subjectById.get(quiz.subjectId)?.name ?? null) : null}
            />
          ))}
        </Ledger>
      )}

      {/* Phones: the main action floats above the tab bar. */}
      <ButtonLink
        to="/teacher/quizzes/create"
        size="lg"
        leftIcon={<Plus className="size-5" />}
        className="fixed right-4 bottom-[calc(var(--tabbar-h,0px)+env(safe-area-inset-bottom)+1rem)] z-30 h-14 shadow-pop sm:hidden"
      >
        New quiz
      </ButtonLink>

      {selecting && (
        <SelectionBar
          count={selected.size}
          subjects={subjects}
          canRemove={quizzes.some((q) => selected.has(q.id) && q.subjectId)}
          busy={moving}
          onMove={(id) => void moveSelected(id)}
          onNewAndMove={() => setNaming('create-and-move')}
          onRemove={() => void moveSelected(null)}
          onSelectAll={() => setSelected(new Set(visible.map((q) => q.id)))}
          onDone={stopSelecting}
        />
      )}

      <SubjectNameDialog
        open={naming !== null}
        title={naming === 'rename' ? 'Rename subject' : 'New subject'}
        initial={naming === 'rename' ? (openSubject?.name ?? '') : ''}
        confirmLabel={naming === 'rename' ? 'Rename' : naming === 'create-and-move' ? 'Create and move' : 'Create subject'}
        onClose={() => setNaming(null)}
        onSubmit={async (name) => {
          try {
            if (naming === 'rename' && openSubject) {
              await renameSubject(openSubject.id, name);
              toast({ tone: 'success', title: 'Subject renamed' });
            } else {
              const id = await createSubject(name);
              if (naming === 'create-and-move') {
                await setQuizzesSubject([...selected], id);
                setQuizzes((list) => list.map((q) => (selected.has(q.id) ? { ...q, subjectId: id } : q)));
                stopSelecting();
              }
              setFolder(id);
              toast({ tone: 'success', title: `Subject “${name}” created` });
            }
            setNaming(null);
            reloadSubjects();
          } catch (error) {
            throw new Error(friendlyError(error), { cause: error });
          }
        }}
      />
      <ConfirmDialog
        open={subjectToDelete !== null}
        title="Delete this subject?"
        description={
          <>
            <strong className="text-ink-900">{subjectToDelete?.name}</strong> is removed and its sharing ends. Its quizzes are not deleted: they
            stay in your library, not in a subject.
          </>
        }
        confirmLabel="Delete subject"
        tone="danger"
        onCancel={() => setSubjectToDelete(null)}
        onConfirm={() => {
          const s = subjectToDelete;
          if (!s) return;
          setSubjectToDelete(null);
          deleteSubject(s.id)
            .then(() => {
              setQuizzes((list) => list.map((q) => (q.subjectId === s.id ? { ...q, subjectId: null } : q)));
              setFolder('all');
              reloadSubjects();
              toast({ tone: 'success', title: 'Subject deleted', description: 'Its quizzes are still in your library.' });
            })
            .catch((error) => toast({ tone: 'error', title: 'Could not delete the subject', description: friendlyError(error) }));
        }}
      />
      <ShareQuizDialog
        open={subjectToShare !== null}
        quizId={null}
        quizTitle=""
        subject={subjectToShare ? { id: subjectToShare.id, name: subjectToShare.name } : null}
        onClose={() => {
          setSubjectToShare(null);
          reloadSubjects();
        }}
      />

      <HostQuizDialog quiz={toHost} onClose={() => setToHost(null)} />
      <ShareQuizDialog
        open={toShare !== null}
        quizId={toShare?.id ?? null}
        quizTitle={toShare?.title ?? ''}
        onClose={() => setToShare(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this quiz?"
        description={
          <>
            <strong className="text-ink-900">{toDelete?.title}</strong> and all of its questions will be permanently
            deleted. This cannot be undone. Archive it instead if you might need it later.
          </>
        }
        confirmLabel="Delete quiz"
        tone="danger"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function EmptyLibrary() {
  return (
    <section aria-labelledby="empty-heading" className="space-y-6 border-t-[3px] border-ink-950 pt-6">
      <div>
        <h2 id="empty-heading" className="type-headline text-headline">
          Create your first quiz
        </h2>
        <p className="mt-2 max-w-md text-body text-ink-700">It takes about five minutes. Publish it, and you can host it live straight away.</p>
      </div>
      <StepStrip
        steps={[
          { title: 'Write questions', body: 'Multiple choice, true or false, or picture answers.' },
          { title: 'Set the pace', body: 'Choose a timer and points for each question.' },
          { title: 'Publish and host', body: 'Students join with a PIN or QR code.' },
        ]}
      />
      <ButtonLink to="/teacher/quizzes/create" leftIcon={<Plus className="size-4" />}>
        New quiz
      </ButtonLink>
    </section>
  );
}
