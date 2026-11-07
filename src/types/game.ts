import type { LeaderboardEntry } from '@/lib/leaderboard/types';
import type { SessionPhase, SessionStatus } from './session';

export type GameRole = 'host' | 'presenter' | 'player';

export type GameOption = { id: string; position: number; label: string; imagePath: string | null };

export type GameQuestion = {
  id: string;
  position: number;
  type: 'multiple_choice' | 'true_false' | 'image_choice';
  prompt: string;
  imagePath: string | null;
  timeLimitSeconds: number;
  points: number;
  status: 'pending' | 'open' | 'closed';
  /** Scheduled start (server time). Screens hold the question back until then. */
  startsAt: string | null;
  openedAt: string | null;
  deadlineAt: string | null;
  answerCount: number;
  options: GameOption[];
  /** Only after the question closes. */
  correctOptionId: string | null;
  explanation: string | null;
  distribution: Record<string, number> | null;
};

export type GameMe = {
  participantId: string;
  nickname: string;
  avatar: string;
  status: 'active' | 'left' | 'removed';
  answerOptionId: string | null;
  lastCorrect: boolean | null;
  lastPoints: number | null;
  score: number;
  rank: number | null;
  previousRank: number | null;
  streak: number;
  correctCount: number;
};

export type GameState = {
  role: GameRole;
  serverNow: string;
  session: {
    id: string;
    quizTitle: string;
    pin: string | null;
    status: SessionStatus;
    phase: SessionPhase;
    stateVersion: number;
    questionCount: number;
    currentPosition: number | null;
    isLocked: boolean;
    participantCount: number;
    speedScoring: boolean;
  };
  question: GameQuestion | null;
  me: GameMe | null;
  leaderboard: LeaderboardEntry[];
  rankedCount: number;
  /** Identifier of the latest scored update (grows with every closed question). */
  leaderboardVersion: number | null;
};

export type SubmitStatus = 'accepted' | 'duplicate' | 'late' | 'early' | 'closed';
