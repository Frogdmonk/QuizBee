import { toGameState, type RankRow, type RawState } from '@/services/game';
import type { GameState } from '@/types/game';

/**
 * Applies a full-state broadcast ('state' event) to the state already on screen.
 *
 * The broadcast carries the whole shared state (question without its answer key, then after a
 * close the reveal data and a compact rank row per player), so a screen never needs a follow-up
 * request. Returns:
 *   - `prev` itself when the broadcast is older than or equal to what is shown (duplicate / late),
 *   - a new state when it is newer,
 *   - `null` when it cannot be applied (nothing loaded yet or a malformed payload): the caller
 *     then falls back to fetching get_game_state().
 *
 * The caller's own fields (pin, nickname, picked answer) are kept from `prev`.
 */
export function applyBroadcast(prev: GameState | null, payload: unknown): GameState | null {
  if (!prev) return null;
  const p = payload as Partial<RawState> | null;
  if (!p || !p.session || typeof p.session.state_version !== 'number' || !Array.isArray(p.leaderboard)) return null;
  if (p.session.state_version <= prev.session.stateVersion) return prev;

  const next = toGameState({
    ...(p as RawState),
    role: prev.role,
    me: null,
    session: { ...p.session, pin: prev.session.pin },
  });

  const me = prev.me;
  if (!me) return next;

  const newQuestion = next.question?.id !== prev.question?.id;
  const closed = next.question?.status === 'closed';
  const row: RankRow | undefined = (p.ranks ?? []).find((r) => r[0] === me.participantId);
  return {
    ...next,
    me: {
      ...me,
      // A pick belongs to one question: reset for a new one, keep it through that question's reveal.
      answerOptionId: newQuestion ? null : me.answerOptionId,
      lastCorrect: closed && row ? row[5] : null,
      lastPoints: closed && row ? row[4] : null,
      score: row ? row[1] : me.score,
      rank: row ? row[2] : me.rank,
      previousRank: row ? row[3] : me.previousRank,
      streak: row ? row[6] : me.streak,
      correctCount: row ? row[7] : me.correctCount,
    },
  };
}

/** Records the player's own accepted answer locally so a broadcast that lands first cannot erase it. */
export function withAnswer(state: GameState, questionId: string, optionId: string): GameState {
  if (!state.me || state.question?.id !== questionId) return state;
  return { ...state, me: { ...state.me, answerOptionId: optionId } };
}
