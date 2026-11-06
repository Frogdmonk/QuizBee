import type { AppSupabaseClient } from '@/lib/supabase';
import type { LeaderboardEntry } from '@/lib/leaderboard/types';
import type { GameQuestion, GameState, SubmitStatus } from '@/types/game';

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

type RawState = {
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
    opened_at: string | null;
    deadline_at: string | null;
    answer_count: number;
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
  } | null;
  leaderboard: RawEntry[];
  ranked_count: number;
  leaderboard_version: number | null;
};

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
      openedAt: r.question.opened_at,
      deadlineAt: r.question.deadline_at,
      answerCount: r.question.answer_count,
      options: r.question.options.map((o) => ({ id: o.id, position: o.position, label: o.label, imagePath: o.image_path })),
      correctOptionId: r.question.correct_option_id,
      explanation: r.question.explanation,
      distribution: r.question.distribution,
    },
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
