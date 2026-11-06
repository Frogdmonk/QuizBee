import type { LeaderboardConfig } from './config';
import type { LeaderboardEntry, SpecialEvent } from './types';

/**
 * Detects competitive moments from real data only. `entries` must be in server display order.
 * `previousField` is the number of ranked players before this update (for small games).
 */
export function detectEvents(
  entries: LeaderboardEntry[],
  config: Pick<LeaderboardConfig, 'rivalryGap' | 'nearMissGap' | 'streakMin' | 'legendaryFromRank'>,
  previousField: number,
): SpecialEvent[] {
  const events: SpecialEvent[] = [];
  const hadHistory = entries.some((e) => e.previousRank !== null);
  const champions = entries.filter((e) => e.rank === 1);
  const previousChampions = entries.filter((e) => e.previousRank === 1).map((e) => e.participantId);

  if (hadHistory) {
    for (const c of champions) {
      if (c.previousRank === 1) {
        events.push({ type: 'champion-defence', participantId: c.participantId });
        continue;
      }
      if (c.previousRank !== null) {
        const lastPlace = previousField >= 3 && c.previousRank >= Math.min(config.legendaryFromRank, previousField);
        if (lastPlace) events.push({ type: 'legendary-comeback', participantId: c.participantId, from: c.previousRank });
        events.push({ type: 'champion-takeover', participantId: c.participantId, fromParticipantIds: previousChampions });
      }
    }
  }

  for (let i = 1; i < entries.length; i++) {
    const above = entries[i - 1];
    const here = entries[i];
    const gap = above.score - here.score;
    if (gap <= 0) continue;
    if (gap <= config.nearMissGap) {
      events.push({ type: 'near-miss', participantId: here.participantId, aheadId: above.participantId, gap });
    } else if (gap <= config.rivalryGap) {
      events.push({ type: 'rivalry', participantIds: [above.participantId, here.participantId], gap });
    }
  }

  for (const e of entries) {
    if (e.streak >= config.streakMin) events.push({ type: 'streak', participantId: e.participantId, streak: e.streak });
  }
  return events;
}

/** "JUST 1 POINT AWAY!" */
export function nearMissMessage(gap: number): string {
  return `Just ${gap} ${gap === 1 ? 'point' : 'points'} away!`;
}
