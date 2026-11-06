import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { NightCanvas } from '@/components/ui/NightCanvas';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { Kbd } from '@/components/ui/Kbd';
import { spring } from '@/lib/motion';
import { QuestionPreview } from '@/components/quiz/QuestionPreview';
import { getQuizDraft, QuizNotFoundError } from '@/services/quizzes';
import { copySharedQuiz, getQuizPermissions } from '@/services/sharing';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import type { QuizDraft } from '@/types/quiz';
import type { QuizRole } from '@/types/workspace';
import { cn } from '@/lib/cn';

/**
 * Full-screen, projector-style walkthrough of a saved quiz.
 * Keyboard: ← / → to move, Space to reveal the answer, Esc to exit.
 */
export default function QuizPreviewPage() {
  const { quizId = '' } = useParams();
  const [quiz, setQuiz] = useState<QuizDraft | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [role, setRole] = useState<QuizRole>('owner');
  const [copying, setCopying] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getQuizDraft(quizId), getQuizPermissions(quizId)])
      .then(([q, perms]) => {
        if (cancelled) return;
        setQuiz(q);
        setRole(perms.role);
        setState('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        const notFound = e instanceof QuizNotFoundError || (e as { code?: string } | null)?.code === 'P0002';
        setState(notFound ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const total = quiz?.questions.length ?? 0;
  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = Math.min(Math.max(i + delta, 0), Math.max(total - 1, 0));
        if (next !== i) {
          setDirection(delta);
          setReveal(false);
        }
        return next;
      });
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setReveal((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const canEdit = role === 'owner' || role === 'edit';
  const canCopy = role === 'copy' || role === 'edit';
  const editPath = `/teacher/quizzes/${quizId}/edit`;
  const closePath = canEdit ? editPath : '/teacher/shared';

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

  if (state !== 'ready' || !quiz) {
    return (
      <NightCanvas className="grid place-items-center px-6">
        {state === 'loading' ? (
          <span className="text-night-muted">
            <Spinner className="size-8" label="Loading quiz" />
          </span>
        ) : (
          <StatusBlock
            surface="night"
            tone="warning"
            icon={<AlertTriangle />}
            title={state === 'notfound' ? 'Quiz not found' : 'Could not load this quiz'}
            actions={
              <ButtonLink to="/teacher/quizzes" variant="night">
                Back to My Quizzes
              </ButtonLink>
            }
          />
        )}
      </NightCanvas>
    );
  }

  const question = quiz.questions[index];

  return (
    <NightCanvas className="flex flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="type-kicker">Preview</p>
          <h1 className="type-headline truncate text-[1.25rem]">{quiz.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canCopy && (
            <Button
              variant="night-ghost"
              size="sm"
              leftIcon={<Copy className="size-4" />}
              loading={copying}
              onClick={() => void copy()}
            >
              <span className="hidden sm:inline">Copy to My Quizzes</span>
            </Button>
          )}
          {canEdit && (
            <ButtonLink to={editPath} variant="night-ghost" size="sm" leftIcon={<Pencil className="size-4" />}>
              Edit
            </ButtonLink>
          )}
          <Link
            to={closePath}
            className="grid size-11 place-items-center rounded-sm text-night-muted hover:bg-night-900 hover:text-night-text"
            aria-label="Close preview"
          >
            <X className="size-5" />
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 items-center overflow-hidden px-4 py-4 sm:px-8">
        {question ? (
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <m.div
              key={question.key}
              custom={direction}
              initial={{ opacity: 0, x: direction * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -60 }}
              transition={spring.sheet}
              className="mx-auto w-full max-w-6xl"
            >
              <QuestionPreview question={question} index={index} total={total} variant="stage" reveal={reveal} />
              <AnimatePresence>
                {reveal && question.explanation.trim() && (
                  <m.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="relative mt-6 max-w-3xl overflow-hidden rounded-sm bg-night-900 py-4 pr-5 pl-7 text-body text-night-text"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-success-400" />
                    {question.explanation}
                  </m.p>
                )}
              </AnimatePresence>
            </m.div>
          </AnimatePresence>
        ) : (
          <div className="mx-auto text-center">
            <p className="type-headline text-headline">This quiz has no questions yet.</p>
            {canEdit && (
              <ButtonLink to={editPath} variant="night" className="mt-4">
                Add questions
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-night-rule bg-night-950 px-4 py-3 sm:px-8">
        <Button
          variant="night-ghost"
          className="h-12"
          onClick={() => go(-1)}
          disabled={index === 0}
          leftIcon={<ChevronLeft className="size-5" />}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 lg:flex" aria-hidden>
            {quiz.questions.slice(0, 40).map((q, i) => (
              <span key={q.key} className={cn('h-1 w-5', i === index ? 'bg-signal-400' : i < index ? 'bg-night-muted' : 'bg-night-800')} />
            ))}
          </div>
          <span className="hidden items-center gap-1 text-caption text-night-muted xl:flex" aria-hidden>
            <Kbd tone="night">←</Kbd>
            <Kbd tone="night">→</Kbd>
            <Kbd tone="night">Space</Kbd>
          </span>
          <Button
            variant="night"
            className="h-12"
            onClick={() => setReveal((r) => !r)}
            leftIcon={reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            disabled={!question}
          >
            {reveal ? 'Hide answer' : 'Show answer'}
          </Button>
        </div>
        <Button
          variant="primary"
          className="h-12"
          onClick={() => go(1)}
          disabled={index >= total - 1}
          rightIcon={<ChevronRight className="size-5" />}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </footer>
    </NightCanvas>
  );
}
