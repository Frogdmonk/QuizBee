import type { GameState } from '@/types/game';
import type { LeaderboardSnapshot } from './types';

/**
 * The leaderboard snapshot carried by a game state, keyed by the server's scored version so the
 * engine can drop duplicates and stale updates. Null until the first question has been scored.
 */
export function snapshotFromState(state: GameState | null): LeaderboardSnapshot | null {
  if (!state || state.leaderboard.length === 0) return null;
  return {
    updateId: state.leaderboardVersion ?? state.session.stateVersion,
    entries: state.leaderboard,
    fieldSize: state.rankedCount,
  };
}
