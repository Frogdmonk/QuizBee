import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { QuestionPreview } from '@/components/quiz/QuestionPreview';
import { getQuizDraft, QuizNotFoundError } from '@/services/quizzes';
import type { QuizDraft } from '@/types/quiz';
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

  useEffect(() => {
    let cancelled = false;
    getQuizDraft(quizId)
      .then((q) => {
        if (cancelled) return;
        setQuiz(q);
        setState('ready');
      })
      .catch((e) => !cancelled && setState(e instanceof QuizNotFoundError ? 'notfound' : 'error'));
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

  const editPath = `/teacher/quizzes/${quizId}/edit`;

  if (state !== 'ready' || !quiz) {
    return (
      <main className="grid min-h-dvh place-items-center bg-night-900 px-6 text-center text-white">
        {state === 'loading' ? (
          <Spinner className="size-8" label="Loading quiz" />
        ) : (
          <div>
            <h1 className="text-2xl font-extrabold">{state === 'notfound' ? 'Quiz not found' : 'Could not load this quiz'}</h1>
            <ButtonLink to="/teacher/quizzes" variant="secondary" className="mt-6">
              Back to My Quizzes
            </ButtonLink>
          </div>
        )}
      </main>
    );
  }

  const question = quiz.questions[index];

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-night-900 text-white">
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-sun-400 uppercase">Preview</p>
          <h1 className="truncate font-display text-lg font-bold">{quiz.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink to={editPath} variant="ghost" size="sm" className="text-ink-200 hover:bg-white/10 hover:text-white" leftIcon={<Pencil className="size-4" />}>
            Edit
          </ButtonLink>
          <Link
            to={editPath}
            className="grid size-10 place-items-center rounded-xl text-ink-300 hover:bg-white/10 hover:text-white"
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
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="mx-auto w-full max-w-5xl"
            >
              <QuestionPreview question={question} index={index} total={total} variant="stage" reveal={reveal} />
              <AnimatePresence>
                {reveal && question.explanation.trim() && (
                  <m.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white/8 px-5 py-4 text-center text-lg text-ink-100"
                  >
                    {question.explanation}
                  </m.p>
                )}
              </AnimatePresence>
            </m.div>
          </AnimatePresence>
        ) : (
          <p className="mx-auto text-ink-300">This quiz has no questions yet.</p>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={() => go(-1)}
          disabled={index === 0}
          leftIcon={<ChevronLeft className="size-5" />}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex items-center gap-3">
          <div className="hidden gap-1.5 md:flex" aria-hidden>
            {quiz.questions.slice(0, 40).map((q, i) => (
              <span key={q.key} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-sun-400' : 'w-1.5 bg-white/25')} />
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => setReveal((r) => !r)}
            leftIcon={reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            disabled={!question}
          >
            {reveal ? 'Hide answer' : 'Show answer'}
          </Button>
        </div>
        <Button
          variant="primary"
          onClick={() => go(1)}
          disabled={index >= total - 1}
          rightIcon={<ChevronRight className="size-5" />}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </footer>
    </main>
  );
}
