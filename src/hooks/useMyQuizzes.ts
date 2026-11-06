import { useCallback, useEffect, useState } from 'react';
import { listMyQuizzes } from '@/services/quizzes';
import type { QuizSummary } from '@/types/quiz';

type Status = 'loading' | 'ready' | 'error';

/** Loads the signed-in teacher's quizzes; exposes setters for optimistic updates. */
export function useMyQuizzes() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyQuizzes()
      .then((list) => {
        if (cancelled) return;
        setQuizzes(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    setNonce((n) => n + 1);
  }, []);

  return { quizzes, setQuizzes, status, reload };
}
