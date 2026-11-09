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
  /** When the question closed, and when the reveal hands over to the leaderboard (server time). */
  closedAt: string | null;
  boardAt: string | null;
  answerCount: number;
  /** Active players when the question opened; null before the battle migration. */
  eligibleCount: number | null;
  /** 'recovery' = the parallel question after the class missed the mastery bar on `corePosition`. */
  role: 'core' | 'recovery';
  corePosition: number;
  /** 1–3, 4 = final challenge; `levelStart` = the first question of its level. */
  level: number | null;
  levelStart: boolean;
  objective: string | null;
  topic: string | null;
  kind: string | null;
  difficulty: string | null;
  /** After it closes: the most-picked wrong answer and its note (counts only, never names). */
  misconception: Misconception | null;
  /** After a core question closes: did the class reach the mastery bar? */
  mastery: { accuracy: number | null; passed: boolean; hasRecovery: boolean; skipped: boolean } | null;
  /** A recovery question opens with a review of the question the class missed. */
  review: {
    corePrompt: string;
    accuracy: number | null;
    misconception: Misconception | null;
    explanation: string | null;
    correctLabel: string | null;
  } | null;
  options: GameOption[];
  /** Only after the question closes. */
  correctOptionId: string | null;
  explanation: string | null;
  distribution: Record<string, number> | null;
};

/** The outcome of one question in the boss battle, worked out by the server. */
export type BattleAttack = {
  questionId: string;
  position: number;
  /** Active players when the question opened (the accuracy denominator). */
  eligible: number;
  /** Correct answers among them. */
  correct: number;
  /** 0–100. */
  accuracy: number;
  /** Players whose correct answer hit, in the order they answered. */
  attackers: string[];
  damage: number;
  hpBefore: number;
  /** After the class hits and, if the special attack was not stopped, the monster's healing. */
  hpAfter: number;
  /** The mode the question was played in (null before phase 2). */
  mode: BattleMode | null;
  targetPct: number | null;
  targetCount: number | null;
  /** true: the class stopped the special attack; false: it hit back; null: there was none. */
  defended: boolean | null;
  /** HP the monster regenerated with its counter-attack. */
  heal: number;
  /** 90 % teamwork: a weapon vote follows this question. */
  unlocked: boolean;
  /** The weapon equipped when the question was resolved, and what it added. */
  weapon: string | null;
  /** Damage of one correct answer (base + weapon). */
  perHit: number | null;
  weaponBonus: number;
  burn: number;
  /** The weapon special used on this question (the weapon key), if any. */
  special: string | null;
  /** Frost Hammer's Deep Freeze stopped the special attack. */
  frozen: boolean;
  /** Team energy earned on this question and why ('mastery', 'recovered', 'defended', 'participation', 'teamwork', 'final', 'wand'). */
  energyGain: number;
  energyReasons: string[];
  /** A Team Shield / Guardian Shield blocked the counter-attack heal. */
  shielded: boolean;
  /** Group Lightning damage. */
  lightning: number;
  rally: boolean;
  scan: boolean;
  /** Students whose Thunder Strike / Comeback Charge boosted their hit. */
  boosted: number;
};

export type PowerupInfo = { key: string; name: string; description: string };

/** My power-up for the final challenge. */
export type MyPowerup = {
  state: 'offered' | 'held' | 'armed' | 'used';
  offered: PowerupInfo[];
  chosen: string | null;
  draftQuestionId: string;
  armedQuestionId: string | null;
  /** X-Ray Vision's hint, for the question it was used on. */
  hint: string | null;
};

export type WeaponRarity = 'rare' | 'epic' | 'legendary';

/** A weapon as the server describes it (the numbers live in the battle_weapons table). */
export type WeaponInfo = {
  key: string;
  name: string;
  rarity: WeaponRarity;
  description: string;
  passive: string;
  specialName: string;
  special: string;
  charges: number;
  cooldown: number;
};

export type EquippedWeapon = WeaponInfo & {
  chargesLeft: number;
  /** The special can be used from this question position on. */
  readyAt: number | null;
  /** The question position the special is armed for. */
  armedAt: number | null;
};

export type WeaponVote = {
  id: string;
  questionId: string;
  round: 1 | 2;
  status: 'open' | 'teacher' | 'done' | 'cancelled';
  offered: WeaponInfo[];
  /** The weapons in play this round (all three, or the tied ones in a runoff). */
  options: string[];
  opensAt: string;
  closesAt: string;
  voters: number;
  ballots: number;
  round1Counts: Record<string, number> | null;
  counts: Record<string, number> | null;
  winner: string | null;
  decidedBy: 'vote' | 'runoff' | 'teacher' | 'cancelled' | null;
  resolvedAt: string | null;
};

export type BattleMode = 'normal' | 'rage' | 'enraged' | 'defeated';
export type BattleIntensity = 'gentle' | 'standard' | 'fierce' | 'custom';
export type BattleAnnounce = 'intro' | 'normal' | 'rage' | 'enraged';
export type PerMode<T> = { normal: T; rage: T; enraged: T };

export type BattleConfig = {
  intensity: BattleIntensity;
  modeTimers: boolean;
  /** Rage at or below this % HP, Enraged at or below `enragedAt` %. */
  rageAt: number;
  enragedAt: number;
  targets: PerMode<number>;
  heal: PerMode<number>;
  /** Seconds when battle timers are on; normal null = the question's own. */
  timers: PerMode<number | null>;
  weaponsEnabled: boolean;
  unlockPct: number;
  unlockCooldown: number;
  voteMs: number;
  runoffMs: number;
  powerupsEnabled: boolean;
  draftMs: number;
};

/** The current question's rules, fixed by the server when it opened. */
export type BattleCurrent = {
  questionId: string;
  mode: BattleMode;
  targetPct: number | null;
  targetCount: number | null;
  /** Show the rules before the question: the first question, or a change of mode. */
  announce: BattleAnnounce | null;
  /** The power-up draft happens before this question starts. */
  draft: boolean;
  /** Knowledge Reveal removed this wrong answer. */
  hiddenOptionId: string | null;
  /** Seconds added by Time Warps. */
  timeWarpS: number;
  powerupsUsed: number;
  /** The Weakness Scanner revealed this topic. */
  topic: string | null;
};

export type BattleState = {
  enabled: boolean;
  monster: string;
  /** Teacher's HP choice; null = automatic at the start. */
  hpSetting: number | null;
  baseDamage: number;
  /** Fixed when the game starts (null in the lobby). */
  maxHp: number | null;
  hp: number | null;
  config: BattleConfig;
  current: BattleCurrent | null;
  /** Shared team energy, 0–100. */
  energy: number;
  /** Team abilities and shared power-ups armed for a question position. */
  armed: { shield: number | null; lightning: number | null; rally: number | null; scan: number | null };
  /** Where the power-up draft happened (the final challenge starts there). */
  draftPosition: number | null;
  weapon: EquippedWeapon | null;
  /** The current question's weapon vote, if it unlocked one. */
  vote: WeaponVote | null;
  last: BattleAttack | null;
};

export type Misconception = { optionId: string; position: number; label: string; count: number; answered: number; note: string | null };

/** Learning so far: objectives the class finds hard, and (at the end) a report per objective. */
export type LearningState = {
  weakObjectives: string[];
  report: { objective: string; topic: string | null; questions: number; accuracy: number | null; recoveryAccuracy: number | null }[] | null;
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
  /** My ballot in the current round of the current question's weapon vote. */
  vote: { voteId: string; round: number; choice: string } | null;
  powerup: MyPowerup | null;
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
    /** Students may send emotes (teacher switch). */
    reactionsEnabled: boolean;
    /** How long the answer reveal stays up before the leaderboard. */
    revealMs: number;
    masteryEnabled: boolean;
    masteryPct: number;
    reviewMs: number;
  };
  question: GameQuestion | null;
  learning: LearningState | null;
  /** Boss battle; null on servers without it or for sessions created before it. */
  battle: BattleState | null;
  me: GameMe | null;
  leaderboard: LeaderboardEntry[];
  rankedCount: number;
  /** Identifier of the latest scored update (grows with every closed question). */
  leaderboardVersion: number | null;
};

export type SubmitStatus = 'accepted' | 'duplicate' | 'late' | 'early' | 'closed';
export type VoteStatus = 'accepted' | 'duplicate' | 'early' | 'closed' | 'not_eligible';
