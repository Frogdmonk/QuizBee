import { useEffect, useRef } from 'react';
import type { GameState } from '@/types/game';

/**
 * When the open question's time is up (or everyone has answered), ask the server to close it.
 * Any screen may do this; the server only acts when the question is really due, so several
 * screens nudging at once is harmless. Retries every 2 s until the phase changes.
 */
export function useAutoAdvance(state: GameState | null, remainingMs: number, everyoneAnswered: boolean, nudge: () => Promise<void>) {
  const lastNudge = useRef<{ questionId: string; at: number } | null>(null);
  const open = state?.session.phase === 'question' && state.question?.status === 'open';
  const questionId = state?.question?.id ?? null;
  const due = open && (remainingMs <= 0 || everyoneAnswered);

  useEffect(() => {
    if (!due || !questionId) return;
    const fire = () => {
      lastNudge.current = { questionId, at: Date.now() };
      void nudge();
    };
    // A short grace period absorbs small clock differences.
    const first = window.setTimeout(fire, everyoneAnswered ? 150 : 400);
    const retry = window.setInterval(fire, 2000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(retry);
    };
  }, [due, questionId, everyoneAnswered, nudge]);
}
