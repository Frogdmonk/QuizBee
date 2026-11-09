import { useEffect } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { activeBattle } from '@/lib/battle/state';
import type { GameState, WeaponVote } from '@/types/game';

/**
 * Where the current question's weapon vote is:
 *   pending   — unlocked; the attack reveal is still playing (it opens at opens_at, server time)
 *   open      — students are voting (closes at closes_at)
 *   teacher   — a tie after the runoff, or nobody voted: the teacher decides
 *   done      — a weapon was chosen and equipped
 *   cancelled — the teacher cancelled it
 */
export type VoteStage = 'pending' | 'open' | 'teacher' | 'done' | 'cancelled';

export function currentVote(state: GameState | null): WeaponVote | null {
  const v = activeBattle(state)?.vote;
  if (!v || !state?.question || state.session.phase !== 'reveal') return null;
  return v.questionId === state.question.id ? v : null;
}

/**
 * The vote on screen, its countdowns, and a nudge when a round's time is up so the server counts it
 * (any screen may nudge; the server only acts once). Phones are a slow, jittered backup.
 */
export function useWeaponVote(state: GameState | null, offsetMs: number, nudge: () => Promise<void>, role: 'primary' | 'backup') {
  const vote = currentVote(state);
  const opensIn = useCountdown(vote?.opensAt ?? null, offsetMs, vote?.status === 'open');
  const closesIn = useCountdown(vote?.closesAt ?? null, offsetMs, vote?.status === 'open');
  const stage: VoteStage | null = !vote ? null : vote.status === 'open' ? (opensIn > 0 ? 'pending' : 'open') : vote.status;
  const due = stage === 'open' && closesIn <= 0;
  const key = vote ? `${vote.id}:${vote.round}` : null;

  useEffect(() => {
    if (!due || !key) return;
    const first = role === 'primary' ? 150 : 2500 + Math.random() * 2500;
    const retry = role === 'primary' ? 2000 : 4000 + Math.random() * 2000;
    const firstTimer = window.setTimeout(() => void nudge(), first);
    const retryTimer = window.setInterval(() => void nudge(), retry);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(retryTimer);
    };
  }, [due, key, nudge, role]);

  return { vote, stage, opensIn, closesIn };
}
