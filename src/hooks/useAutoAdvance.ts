import { useEffect } from 'react';
import type { GameState } from '@/types/game';

/**
 * When the open question's time is up (or everyone has answered), ask the server to close it.
 * Any screen may do this; the server only acts when the question is really due.
 *
 * The host and projector are the primary closers and nudge almost at once. Phones are only a
 * backup (e.g. the teacher's laptop slept), so they wait a few seconds with random jitter:
 * a hundred phones must never all call the server at the same instant.
 */
export function useAutoAdvance(
  state: GameState | null,
  remainingMs: number,
  everyoneAnswered: boolean,
  nudge: () => Promise<void>,
  role: 'primary' | 'backup' = 'primary',
) {
  const open = state?.session.phase === 'question' && state.question?.status === 'open';
  const questionId = state?.question?.id ?? null;
  const due = open && (remainingMs <= 0 || everyoneAnswered);

  useEffect(() => {
    if (!due || !questionId) return;
    const first = role === 'primary' ? (everyoneAnswered ? 150 : 400) : 3000 + Math.random() * 2500;
    const retry = role === 'primary' ? 2000 : 4000 + Math.random() * 2000;
    const firstTimer = window.setTimeout(() => void nudge(), first);
    const retryTimer = window.setInterval(() => void nudge(), retry);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(retryTimer);
    };
  }, [due, questionId, everyoneAnswered, nudge, role]);
}
