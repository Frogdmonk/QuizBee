import type { DownTier, UpTier } from './config';

/** One leaderboard row exactly as the server reports it (get_game_state → leaderboard). */
export type LeaderboardEntry = {
  participantId: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
  previousRank: number | null;
  lastPoints: number;
  lastCorrect: boolean | null;
  streak: number;
  correctCount: number;
};

/** An authoritative leaderboard update. `updateId` grows with every scored question. */
export type LeaderboardSnapshot = {
  updateId: number;
  entries: LeaderboardEntry[];
  /** Players with a rank (the whole field, not only the visible rows). */
  fieldSize: number;
};

export type Movement =
  | { kind: 'up'; positions: number; tier: UpTier }
  | { kind: 'down'; positions: number; tier: DownTier }
  | { kind: 'same'; context: 'champion' | 'steady' }
  | { kind: 'new' };

export type ThemeCategory = 'up' | 'down' | 'idle';

export type ThemeId =
  // Rank up (8)
  | 'superhero'
  | 'rocket'
  | 'ninja'
  | 'elevator'
  | 'giant-hand'
  | 'dragon-flight'
  | 'victory-parade'
  | 'evolution'
  // Rank down (7)
  | 'titanic'
  | 'parachute'
  | 'banana'
  | 'throne'
  | 'tornado'
  | 'meteor'
  | 'volcano'
  // Idle / reaction (5)
  | 'crown-polish'
  | 'ufo-scan'
  | 'victory-dance'
  | 'comic-reaction'
  | 'dragon-companion'
  // Fallback when nothing else fits or a theme failed to render
  | 'fallback';

export type SpecialEvent =
  | { type: 'legendary-comeback'; participantId: string; from: number }
  | { type: 'champion-takeover'; participantId: string; fromParticipantIds: string[] }
  | { type: 'champion-defence'; participantId: string }
  | { type: 'rivalry'; participantIds: [string, string]; gap: number }
  | { type: 'near-miss'; participantId: string; aheadId: string; gap: number }
  | { type: 'streak'; participantId: string; streak: number };

export type RowPlan = {
  participantId: string;
  movement: Movement;
  theme: ThemeId;
  /** Character animation start, relative to the plan start. */
  delayMs: number;
  previousScore: number;
  score: number;
  /** Rank shown before the rows move (server previous rank). */
  fromRank: number | null;
  rank: number;
};

export type LeaderboardPlan = {
  updateId: number;
  /** Row order before the update (by previous rank), then after it (server order). */
  fromOrder: string[];
  toOrder: string[];
  rows: Record<string, RowPlan>;
  events: SpecialEvent[];
};
