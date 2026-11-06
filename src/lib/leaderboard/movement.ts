import type { LeaderboardConfig } from './config';
import type { LeaderboardEntry, Movement } from './types';

/**
 * Classifies one student's rank change using the server's previous and current rank.
 * Lower rank numbers are better, so moving from 7 to 2 is "up 5".
 */
export function classifyMovement(previousRank: number | null, rank: number, config: Pick<LeaderboardConfig, 'tiers'>): Movement {
  if (previousRank === null) return { kind: 'new' };
  const delta = previousRank - rank;
  if (delta === 0) return { kind: 'same', context: rank === 1 ? 'champion' : 'steady' };
  const positions = Math.abs(delta);
  const band = config.tiers.find((t) => positions <= t.maxPositions) ?? config.tiers[config.tiers.length - 1];
  return delta > 0 ? { kind: 'up', positions, tier: band.up } : { kind: 'down', positions, tier: band.down };
}

/** Row order before an update: by previous rank (new students last), stable on server order. */
export function previousOrder(entries: LeaderboardEntry[]): string[] {
  return entries
    .map((e, index) => ({ e, index }))
    .sort((a, b) => {
      const ar = a.e.previousRank ?? Number.POSITIVE_INFINITY;
      const br = b.e.previousRank ?? Number.POSITIVE_INFINITY;
      return ar - br || a.index - b.index;
    })
    .map(({ e }) => e.participantId);
}
