import { useEffect } from 'react';
import type { GameState } from '@/types/game';

/**
 * Asks the server to move the game on when it is due:
 *   • the open question's time is up (or everyone has answered) → close it;
 *   • the reveal has been up for its time (board_at) → show the leaderboard.
 * Any screen may ask; the server only acts when the step is really due, and only once.
 *
 * The host and projector are the primary nudgers and ask almost at once. Phones are only a backup
 * (e.g. the teacher's laptop slept), so they wait a few seconds with random jitter: a hundred
 * phones must never all call the server at the same instant.
 */
export function useAutoAdvance(
  state: GameState | null,
  remainingMs: number,
  everyoneAnswered: boolean,
  nudge: () => Promise<void>,
  role: 'primary' | 'backup' = 'primary',
  /** Milliseconds until the reveal hands over to the leaderboard (Infinity when not revealing). */
  boardInMs = Number.POSITIVE_INFINITY,
) {
  const running = state?.session.status === 'in_progress';
  const open = running && state?.session.phase === 'question' && state.question?.status === 'open';
  const revealing = running && state?.session.phase === 'reveal' && Boolean(state.question?.boardAt);
  const questionId = state?.question?.id ?? null;
  const step = open ? 'close' : revealing ? 'board' : null;
  const due = (open && (remainingMs <= 0 || everyoneAnswered)) || (revealing && boardInMs <= 0);
  const quick = step === 'close' && everyoneAnswered;

  useEffect(() => {
    if (!due || !questionId || !step) return;
    const first = role === 'primary' ? (quick || step === 'board' ? 150 : 400) : 3000 + Math.random() * 2500;
    const retry = role === 'primary' ? 2000 : 4000 + Math.random() * 2000;
    const firstTimer = window.setTimeout(() => void nudge(), first);
    const retryTimer = window.setInterval(() => void nudge(), retry);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(retryTimer);
    };
  }, [due, questionId, step, quick, nudge, role]);
}
