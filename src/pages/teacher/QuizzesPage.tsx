import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { BookOpenText, Plus, Search } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SegmentedControl, Skeleton } from '@/components/ui/FormControls';
import { Alert } from '@/components/ui/Alert';
import { QuizCard, type QuizCardActions } from '@/components/quiz/QuizCard';
import { useMyQuizzes } from '@/hooks/useMyQuizzes';
import { useToast } from '@/hooks/useToast';
import { deleteQuiz, duplicateQuiz, setQuizStatus } from '@/services/quizzes';
import { friendlyError } from '@/utils/errors';
import type { QuizStatus, QuizSummary } from '@/types/quiz';

type Filter = 'active' | 'draft' | 'published' | 'archived';

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

  const counts = useMemo(
    () => ({
      active: quizzes.filter(FILTERS.active).length,
      draft: quizzes.filter(FILTERS.draft).length,
      published: quizzes.filter(FILTERS.published).length,
      archived: quizzes.filter(FILTERS.archived).length,
    }),
    [quizzes],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return quizzes.filter(
      (q) =>
        FILTERS[filter](q) &&
        (!needle || q.title.toLowerCase().includes(needle) || q.subject.toLowerCase().includes(needle)),
    );
  }, [quizzes, filter, query]);

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
          <h1 className="text-3xl font-extrabold">My Quizzes</h1>
          <p className="mt-2 text-ink-600">Build, organise and publish the quizzes you host.</p>
        </div>
        <ButtonLink to="/teacher/quizzes/create" leftIcon={<Plus className="size-4" />}>
          New quiz
        </ButtonLink>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="md:w-[460px]">
          <SegmentedControl
            label="Filter quizzes"
            layoutId="quiz-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: `All ${counts.active}`, shortLabel: `All ${counts.active}` },
              { value: 'draft', label: `Drafts ${counts.draft}`, shortLabel: 'Drafts' },
              { value: 'published', label: `Published ${counts.published}`, shortLabel: 'Live' },
              { value: 'archived', label: `Archived ${counts.archived}`, shortLabel: 'Archived' },
            ]}
          />
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">Search quizzes</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or subject"
            className="h-11 w-full rounded-xl border border-ink-200 bg-surface pr-3 pl-9 text-[15px] outline-none placeholder:text-ink-400 focus:border-flame-400 focus:ring-4 focus:ring-flame-100"
          />
        </label>
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading quizzes">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : status === 'ready' && quizzes.length === 0 ? (
        <EmptyLibrary />
      ) : status === 'ready' && visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 px-6 py-12 text-center text-ink-500">
          {query ? `No quizzes match “${query}”.` : 'Nothing here yet.'}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} actions={actions} />
            ))}
          </AnimatePresence>
        </div>
      )}

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
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-surface px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-flame-50 text-flame-600">
        <BookOpenText className="size-7" />
      </span>
      <h2 className="mt-5 text-xl font-extrabold">Create your first quiz</h2>
      <p className="mt-2 max-w-sm text-ink-600">
        Add multiple-choice, true/false or picture questions, set timers and points, then publish it to host live.
      </p>
      <ButtonLink to="/teacher/quizzes/create" className="mt-6" leftIcon={<Plus className="size-4" />}>
        New quiz
      </ButtonLink>
    </div>
  );
}
