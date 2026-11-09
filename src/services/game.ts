import type { AppSupabaseClient } from '@/lib/supabase';
import type { LeaderboardEntry } from '@/lib/leaderboard/types';
import type { LearningState, Misconception, MyPowerup, PowerupInfo } from '@/types/game';
import type { BattleAnnounce, BattleConfig, BattleMode, BattleState, GameQuestion, GameState, SubmitStatus, WeaponInfo, WeaponVote } from '@/types/game';

/*
 * Game engine calls (supabase/migrations/*_phase4_game_engine.sql). The caller passes the client:
 * the teacher client on host screens, the player client on phones, either on the projector.
 * Scores and ranks are computed by the database; nothing here calculates them.
 */

type RawEntry = {
  participant_id: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
  previous_rank: number | null;
  last_points: number;
  last_correct: boolean | null;
  streak: number;
  correct_count: number;
};

export type RawState = {
  role: GameState['role'];
  server_now: string;
  session: {
    id: string;
    quiz_title: string;
    pin: string | null;
    status: GameState['session']['status'];
    phase: GameState['session']['phase'];
    state_version: number;
    question_count: number;
    current_position: number | null;
    is_locked: boolean;
    participant_count: number;
    speed_scoring: boolean;
    reactions_enabled?: boolean;
    reveal_ms?: number;
    mastery_enabled?: boolean;
    mastery_pct?: number;
    review_ms?: number;
  };
  question: {
    id: string;
    position: number;
    type: GameQuestion['type'];
    prompt: string;
    image_path: string | null;
    time_limit_seconds: number;
    points: number;
    status: GameQuestion['status'];
    starts_at: string | null;
    opened_at: string | null;
    deadline_at: string | null;
    closed_at?: string | null;
    board_at?: string | null;
    answer_count: number;
    eligible_count?: number | null;
    role?: 'core' | 'recovery';
    core_position?: number;
    level?: number | null;
    level_start?: boolean;
    objective?: string | null;
    topic?: string | null;
    kind?: string | null;
    difficulty?: string | null;
    misconception?: RawMisconception | null;
    mastery?: { accuracy: number | string | null; passed: boolean; has_recovery: boolean; skipped: boolean } | null;
    review?: {
      core_prompt: string;
      accuracy: number | string | null;
      misconception: RawMisconception | null;
      explanation: string | null;
      correct_label: string | null;
    } | null;
    options: { id: string; position: number; label: string; image_path: string | null }[];
    correct_option_id: string | null;
    explanation: string | null;
    distribution: Record<string, number> | null;
  } | null;
  me: {
    participant_id: string;
    nickname: string;
    avatar: string;
    status: 'active' | 'left' | 'removed';
    answer_option_id: string | null;
    last_correct: boolean | null;
    last_points: number | null;
    score: number;
    rank: number | null;
    previous_rank: number | null;
    streak: number;
    correct_count: number;
    vote?: { vote_id: string; round: number; choice: string } | null;
    powerup?: {
      state: MyPowerup['state'];
      offered: PowerupInfo[] | null;
      chosen: string | null;
      draft_question_id: string;
      armed_question_id: string | null;
      hint: string | null;
    } | null;
  } | null;
  battle?: RawBattle | null;
  learning?: {
    weak_objectives: string[];
    report: { objective: string; topic: string | null; questions: number; accuracy: number | string | null; recovery_accuracy: number | string | null }[] | null;
  } | null;
  leaderboard: RawEntry[];
  /** [participant_id, score, rank, previous_rank, last_points, last_correct, streak, correct_count] */
  ranks?: RankRow[];
  ranked_count: number;
  leaderboard_version: number | null;
};

type RawMisconception = { option_id: string; position: number; label: string; count: number; answered: number; note: string | null };

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const toMisconception = (m: RawMisconception | null | undefined): Misconception | null =>
  m ? { optionId: m.option_id, position: m.position, label: m.label, count: m.count, answered: m.answered, note: m.note } : null;

function toLearning(l: RawState['learning']): LearningState | null {
  if (!l) return null;
  return {
    weakObjectives: l.weak_objectives ?? [],
    report: l.report
      ? l.report.map((r) => ({ objective: r.objective, topic: r.topic, questions: r.questions, accuracy: num(r.accuracy), recoveryAccuracy: num(r.recovery_accuracy) }))
      : null,
  };
}

export type RawBattle = {
  enabled: boolean;
  monster: string;
  hp_setting: number | null;
  base_damage: number;
  max_hp: number | null;
  hp: number | null;
  last: {
    question_id: string;
    position: number;
    eligible: number;
    correct: number;
    accuracy: number | string;
    attackers: string[];
    damage: number;
    hp_before: number;
    hp_after: number;
    mode?: BattleMode | null;
    target_pct?: number | null;
    target_count?: number | null;
    defended?: boolean | null;
    heal?: number;
    unlocked?: boolean;
    weapon?: string | null;
    per_hit?: number | null;
    weapon_bonus?: number;
    burn?: number;
    special?: string | null;
    frozen?: boolean;
    energy_gain?: number;
    energy_reasons?: string[];
    shielded?: boolean;
    lightning?: number;
    rally?: boolean;
    scan?: boolean;
    boosted?: number;
  } | null;
  energy?: number;
  armed?: { shield: number | null; lightning: number | null; rally: number | null; scan: number | null };
  draft_position?: number | null;
  weapon?: (RawWeapon & { charges_left: number; ready_at: number | null; armed_at: number | null }) | null;
  vote?: {
    id: string;
    question_id: string;
    round: 1 | 2;
    status: WeaponVote['status'];
    offered: RawWeapon[] | null;
    options: string[];
    opens_at: string;
    closes_at: string;
    voters: number;
    ballots: number;
    round1_counts: Record<string, number> | null;
    counts: Record<string, number> | null;
    winner: string | null;
    decided_by: WeaponVote['decidedBy'];
    resolved_at: string | null;
  } | null;
  config?: {
    intensity: BattleConfig['intensity'];
    mode_timers: boolean;
    rage_at: number;
    enraged_at: number;
    targets: BattleConfig['targets'];
    heal: BattleConfig['heal'];
    timers: BattleConfig['timers'];
    weapons_enabled?: boolean;
    unlock_pct?: number;
    unlock_cooldown?: number;
    vote_ms?: number;
    runoff_ms?: number;
    powerups_enabled?: boolean;
    draft_ms?: number;
  };
  current?: {
    question_id: string;
    mode: BattleMode;
    target_pct: number | null;
    target_count: number | null;
    announce: BattleAnnounce | null;
    draft?: boolean;
    hidden_option_id?: string | null;
    time_warp_s?: number;
    powerups_used?: number;
    topic?: string | null;
  } | null;
};

type RawWeapon = {
  key: string;
  name: string;
  rarity: WeaponInfo['rarity'];
  description: string;
  passive: string;
  special_name: string;
  special: string;
  charges: number;
  cooldown: number;
};

const toWeapon = (w: RawWeapon): WeaponInfo => ({
  key: w.key,
  name: w.name,
  rarity: w.rarity,
  description: w.description,
  passive: w.passive,
  specialName: w.special_name,
  special: w.special,
  charges: w.charges,
  cooldown: w.cooldown,
});

/** Phase 1 servers send no config: the Standard defaults. */
export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  intensity: 'standard',
  modeTimers: false,
  rageAt: 70,
  enragedAt: 30,
  targets: { normal: 50, rage: 60, enraged: 70 },
  heal: { normal: 3, rage: 5, enraged: 8 },
  timers: { normal: null, rage: 10, enraged: 15 },
  weaponsEnabled: true,
  unlockPct: 90,
  unlockCooldown: 2,
  voteMs: 10000,
  runoffMs: 5000,
  powerupsEnabled: false,
  draftMs: 15000,
};

export function toBattle(b: RawBattle | null | undefined): BattleState | null {
  if (!b) return null;
  return {
    enabled: b.enabled,
    monster: b.monster,
    hpSetting: b.hp_setting,
    baseDamage: b.base_damage,
    maxHp: b.max_hp,
    hp: b.hp,
    config: b.config
      ? {
          intensity: b.config.intensity,
          modeTimers: b.config.mode_timers,
          rageAt: b.config.rage_at,
          enragedAt: b.config.enraged_at,
          targets: b.config.targets,
          heal: b.config.heal,
          timers: b.config.timers,
          weaponsEnabled: b.config.weapons_enabled ?? DEFAULT_BATTLE_CONFIG.weaponsEnabled,
          unlockPct: b.config.unlock_pct ?? DEFAULT_BATTLE_CONFIG.unlockPct,
          unlockCooldown: b.config.unlock_cooldown ?? DEFAULT_BATTLE_CONFIG.unlockCooldown,
          voteMs: b.config.vote_ms ?? DEFAULT_BATTLE_CONFIG.voteMs,
          runoffMs: b.config.runoff_ms ?? DEFAULT_BATTLE_CONFIG.runoffMs,
          powerupsEnabled: b.config.powerups_enabled ?? DEFAULT_BATTLE_CONFIG.powerupsEnabled,
          draftMs: b.config.draft_ms ?? DEFAULT_BATTLE_CONFIG.draftMs,
        }
      : DEFAULT_BATTLE_CONFIG,
    weapon: b.weapon ? { ...toWeapon(b.weapon), chargesLeft: b.weapon.charges_left, readyAt: b.weapon.ready_at, armedAt: b.weapon.armed_at } : null,
    vote: b.vote
      ? {
          id: b.vote.id,
          questionId: b.vote.question_id,
          round: b.vote.round,
          status: b.vote.status,
          offered: (b.vote.offered ?? []).map(toWeapon),
          options: b.vote.options,
          opensAt: b.vote.opens_at,
          closesAt: b.vote.closes_at,
          voters: b.vote.voters,
          ballots: b.vote.ballots,
          round1Counts: b.vote.round1_counts,
          counts: b.vote.counts,
          winner: b.vote.winner,
          decidedBy: b.vote.decided_by,
          resolvedAt: b.vote.resolved_at,
        }
      : null,
    current: b.current
      ? {
          questionId: b.current.question_id,
          mode: b.current.mode,
          targetPct: b.current.target_pct,
          targetCount: b.current.target_count,
          announce: b.current.announce ?? null,
          draft: b.current.draft ?? false,
          hiddenOptionId: b.current.hidden_option_id ?? null,
          timeWarpS: b.current.time_warp_s ?? 0,
          powerupsUsed: b.current.powerups_used ?? 0,
          topic: b.current.topic ?? null,
        }
      : null,
    energy: b.energy ?? 0,
    armed: b.armed ?? { shield: null, lightning: null, rally: null, scan: null },
    draftPosition: b.draft_position ?? null,
    last: b.last && {
      questionId: b.last.question_id,
      position: b.last.position,
      eligible: b.last.eligible,
      correct: b.last.correct,
      // numeric(5,2) can arrive as a string.
      accuracy: Number(b.last.accuracy),
      attackers: Array.isArray(b.last.attackers) ? b.last.attackers : [],
      damage: b.last.damage,
      hpBefore: b.last.hp_before,
      hpAfter: b.last.hp_after,
      mode: b.last.mode ?? null,
      targetPct: b.last.target_pct ?? null,
      targetCount: b.last.target_count ?? null,
      defended: b.last.defended ?? null,
      heal: b.last.heal ?? 0,
      unlocked: b.last.unlocked ?? false,
      weapon: b.last.weapon ?? null,
      perHit: b.last.per_hit ?? null,
      weaponBonus: b.last.weapon_bonus ?? 0,
      burn: b.last.burn ?? 0,
      special: b.last.special ?? null,
      frozen: b.last.frozen ?? false,
      energyGain: b.last.energy_gain ?? 0,
      energyReasons: b.last.energy_reasons ?? [],
      shielded: b.last.shielded ?? false,
      lightning: b.last.lightning ?? 0,
      rally: b.last.rally ?? false,
      scan: b.last.scan ?? false,
      boosted: b.last.boosted ?? 0,
    },
  };
}

export type RankRow = [string, number, number | null, number | null, number, boolean | null, number, number];

export function toEntry(e: RawEntry): LeaderboardEntry {
  return {
    participantId: e.participant_id,
    nickname: e.nickname,
    avatar: e.avatar,
    score: e.score,
    rank: e.rank,
    previousRank: e.previous_rank,
    lastPoints: e.last_points,
    lastCorrect: e.last_correct,
    streak: e.streak,
    correctCount: e.correct_count,
  };
}

export function toGameState(r: RawState): GameState {
  return {
    role: r.role,
    serverNow: r.server_now,
    session: {
      id: r.session.id,
      quizTitle: r.session.quiz_title,
      pin: r.session.pin,
      status: r.session.status,
      phase: r.session.phase,
      stateVersion: r.session.state_version,
      questionCount: r.session.question_count,
      currentPosition: r.session.current_position,
      isLocked: r.session.is_locked,
      participantCount: r.session.participant_count,
      speedScoring: r.session.speed_scoring,
      // Older servers (before Phase 5) send neither: reactions on, 5 s reveal.
      reactionsEnabled: r.session.reactions_enabled ?? true,
      revealMs: r.session.reveal_ms ?? 5000,
      masteryEnabled: r.session.mastery_enabled ?? false,
      masteryPct: r.session.mastery_pct ?? 75,
      reviewMs: r.session.review_ms ?? 8000,
    },
    question: r.question && {
      id: r.question.id,
      position: r.question.position,
      type: r.question.type,
      prompt: r.question.prompt,
      imagePath: r.question.image_path,
      timeLimitSeconds: r.question.time_limit_seconds,
      points: r.question.points,
      status: r.question.status,
      startsAt: r.question.starts_at,
      openedAt: r.question.opened_at,
      deadlineAt: r.question.deadline_at,
      closedAt: r.question.closed_at ?? null,
      boardAt: r.question.board_at ?? null,
      answerCount: r.question.answer_count,
      eligibleCount: r.question.eligible_count ?? null,
      role: r.question.role ?? 'core',
      corePosition: r.question.core_position ?? r.question.position,
      level: r.question.level ?? null,
      levelStart: r.question.level_start ?? false,
      objective: r.question.objective ?? null,
      topic: r.question.topic ?? null,
      kind: r.question.kind ?? null,
      difficulty: r.question.difficulty ?? null,
      misconception: toMisconception(r.question.misconception),
      mastery: r.question.mastery
        ? { accuracy: num(r.question.mastery.accuracy), passed: r.question.mastery.passed, hasRecovery: r.question.mastery.has_recovery, skipped: r.question.mastery.skipped }
        : null,
      review: r.question.review
        ? {
            corePrompt: r.question.review.core_prompt,
            accuracy: num(r.question.review.accuracy),
            misconception: toMisconception(r.question.review.misconception),
            explanation: r.question.review.explanation,
            correctLabel: r.question.review.correct_label,
          }
        : null,
      options: r.question.options.map((o) => ({ id: o.id, position: o.position, label: o.label, imagePath: o.image_path })),
      correctOptionId: r.question.correct_option_id,
      explanation: r.question.explanation,
      distribution: r.question.distribution,
    },
    battle: toBattle(r.battle),
    learning: toLearning(r.learning),
    me: r.me && {
      participantId: r.me.participant_id,
      nickname: r.me.nickname,
      avatar: r.me.avatar,
      status: r.me.status,
      answerOptionId: r.me.answer_option_id,
      lastCorrect: r.me.last_correct,
      lastPoints: r.me.last_points,
      score: r.me.score,
      rank: r.me.rank,
      previousRank: r.me.previous_rank,
      streak: r.me.streak,
      correctCount: r.me.correct_count,
      vote: r.me.vote ? { voteId: r.me.vote.vote_id, round: r.me.vote.round, choice: r.me.vote.choice } : null,
      powerup: r.me.powerup
        ? {
            state: r.me.powerup.state,
            offered: r.me.powerup.offered ?? [],
            chosen: r.me.powerup.chosen,
            draftQuestionId: r.me.powerup.draft_question_id,
            armedQuestionId: r.me.powerup.armed_question_id,
            hint: r.me.powerup.hint,
          }
        : null,
    },
    leaderboard: r.leaderboard.map(toEntry),
    rankedCount: r.ranked_count,
    leaderboardVersion: r.leaderboard_version,
  };
}

export async function getGameState(client: AppSupabaseClient, sessionId: string): Promise<GameState> {
  const { data, error } = await client.rpc('get_game_state', { p_session_id: sessionId });
  if (error) throw error;
  return toGameState(data as unknown as RawState);
}

async function hostCommand(
  client: AppSupabaseClient,
  fn: 'start_game' | 'close_question' | 'show_leaderboard' | 'next_question',
  sessionId: string,
  expectedVersion: number | null,
): Promise<number> {
  const { data, error } = await client.rpc(fn, { p_session_id: sessionId, p_expected_version: expectedVersion });
  if (error) throw error;
  return data as number;
}

export const startGame = (c: AppSupabaseClient, id: string, v: number | null) => hostCommand(c, 'start_game', id, v);
export const closeQuestion = (c: AppSupabaseClient, id: string, v: number | null) => hostCommand(c, 'close_question', id, v);
export const showLeaderboard = (c: AppSupabaseClient, id: string, v: number | null) => hostCommand(c, 'show_leaderboard', id, v);
export const nextQuestion = (c: AppSupabaseClient, id: string, v: number | null) => hostCommand(c, 'next_question', id, v);

export async function endGame(client: AppSupabaseClient, sessionId: string): Promise<number> {
  const { data, error } = await client.rpc('end_game', { p_session_id: sessionId });
  if (error) throw error;
  return data as number;
}

/** Safe for any member: the server closes the question only when it is really due. */
export async function advanceIfDue(client: AppSupabaseClient, sessionId: string): Promise<number> {
  const { data, error } = await client.rpc('advance_if_due', { p_session_id: sessionId });
  if (error) throw error;
  return data as number;
}

export async function submitAnswer(client: AppSupabaseClient, questionId: string, optionId: string): Promise<SubmitStatus> {
  const { data, error } = await client.rpc('submit_answer', { p_session_question_id: questionId, p_option_id: optionId });
  if (error) throw error;
  return (data as { status: SubmitStatus }).status;
}

export async function serverNow(client: AppSupabaseClient): Promise<number> {
  const { data, error } = await client.rpc('server_now');
  if (error) throw error;
  return new Date(data as string).getTime();
}
