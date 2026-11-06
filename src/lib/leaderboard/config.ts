/**
 * Leaderboard animation engine configuration. Every threshold and timing lives here so it can be
 * tuned without touching the engine. Nothing in this module affects scores or ranks: those come
 * from the server (participant_scores) and are only ever displayed.
 */

export type UpTier = 'small' | 'medium' | 'major' | 'legendary';
export type DownTier = 'minor' | 'medium' | 'major' | 'epic';

export type TierBand = { maxPositions: number; up: UpTier; down: DownTier };

export type TimelineConfig = {
  /** Previous leaderboard stays on screen. */
  holdMs: number;
  /** Score counters start rolling. */
  scoresAtMs: number;
  /** Character animations start (plus each row's stagger). */
  charactersAtMs: number;
  /** Length of a character animation. */
  characterMs: number;
  /** Rows move to their new positions. */
  rowsAtMs: number;
  /** New positions are highlighted. */
  highlightAtMs: number;
  /** Everything settles into the final leaderboard. */
  settleAtMs: number;
  /** Total length; after this the board is static. */
  totalMs: number;
};

export type LeaderboardConfig = {
  /** Movement bands, checked in order. A move of N positions uses the first band with N <= maxPositions. */
  tiers: TierBand[];
  timeline: TimelineConfig;
  /** Each row's character start is staggered by a random value in this range. */
  staggerMs: { min: number; max: number };
  /** A student's last N themes are avoided when alternatives exist. */
  historySize: number;
  /** Rows shown on the leaderboard. */
  visibleRows: number;
  /** Adjacent players within this many points are highlighted as rivals. */
  rivalryGap: number;
  /** "JUST N POINTS AWAY!" is shown when the gap to the player above is at most this. */
  nearMissGap: number;
  /** Consecutive correct answers needed for the streak effect. */
  streakMin: number;
  /** A legendary comeback is a move to 1st from at least this rank (or from last place in a smaller game). */
  legendaryFromRank: number;
};

export const DEFAULT_LEADERBOARD_CONFIG: LeaderboardConfig = {
  tiers: [
    { maxPositions: 1, up: 'small', down: 'minor' },
    { maxPositions: 3, up: 'medium', down: 'medium' },
    { maxPositions: 6, up: 'major', down: 'major' },
    { maxPositions: Number.POSITIVE_INFINITY, up: 'legendary', down: 'epic' },
  ],
  timeline: {
    holdMs: 400,
    scoresAtMs: 400,
    charactersAtMs: 800,
    characterMs: 1800,
    rowsAtMs: 2000,
    highlightAtMs: 3200,
    settleAtMs: 3800,
    totalMs: 4000,
  },
  staggerMs: { min: 80, max: 120 },
  historySize: 3,
  visibleRows: 10,
  rivalryGap: 150,
  nearMissGap: 50,
  streakMin: 3,
  legendaryFromRank: 10,
};

/** Merges a partial config over the defaults (timeline merged key by key). */
export function makeConfig(overrides: Partial<Omit<LeaderboardConfig, 'timeline'>> & { timeline?: Partial<TimelineConfig> } = {}): LeaderboardConfig {
  return {
    ...DEFAULT_LEADERBOARD_CONFIG,
    ...overrides,
    timeline: { ...DEFAULT_LEADERBOARD_CONFIG.timeline, ...overrides.timeline },
  };
}
