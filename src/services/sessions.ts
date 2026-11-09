import { getTeacherClient, type AppSupabaseClient } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { SessionSummary } from '@/types/session';

/* Host-side session operations (teacher client). Every write is an RPC from
 * supabase/migrations/*_phase3_live_sessions.sql. */

export async function createSession(quizId: string, settings: { maxParticipants: number }): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('create_session', {
    p_quiz_id: quizId,
    p_settings: { max_participants: settings.maxParticipants },
  });
  if (error) throw error;
  return data;
}

/** The host's 30 most recent sessions. */
export async function listMySessions(hostId: string): Promise<SessionSummary[]> {
  const { data, error } = await getTeacherClient()
    .from('game_sessions')
    .select('id, quiz_title, pin, status, is_locked, participant_count, max_participants, created_at, ended_at')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    quizTitle: s.quiz_title,
    pin: s.pin,
    status: s.status,
    isLocked: s.is_locked,
    participantCount: s.participant_count,
    maxParticipants: s.max_participants,
    createdAt: s.created_at,
    endedAt: s.ended_at,
  }));
}

export async function setSessionLocked(sessionId: string, locked: boolean): Promise<boolean> {
  const { data, error } = await getTeacherClient().rpc('set_session_locked', {
    p_session_id: sessionId,
    p_locked: locked,
  });
  if (error) throw error;
  return data;
}

export async function removeParticipant(sessionId: string, participantId: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('remove_participant', {
    p_session_id: sessionId,
    p_participant_id: participantId,
  });
  if (error) throw error;
}

export async function cancelSession(sessionId: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('cancel_session', { p_session_id: sessionId });
  if (error) throw error;
}

/** Returns the raw projector key (shown once). Previously linked projectors are disconnected. */
export async function createPresenterLink(sessionId: string): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('create_presenter_link', { p_session_id: sessionId });
  if (error) throw error;
  return data;
}

/** Host: skip (or bring back) the recovery question after the current question. Returns the new state version. */
export async function setRecoverySkipped(client: AppSupabaseClient, sessionId: string, skipped: boolean): Promise<number> {
  const { data, error } = await client.rpc('set_recovery_skipped', { p_session_id: sessionId, p_skipped: skipped });
  if (error) throw error;
  return data as number;
}

export type LearningSettingsInput = { masteryEnabled?: boolean; masteryPct?: number; reviewSeconds?: number };

/** Host, lobby only: the mastery check. Returns the new state version. */
export async function setLearningSettings(client: AppSupabaseClient, sessionId: string, input: LearningSettingsInput): Promise<number> {
  const settings: { [key: string]: Json | undefined } = {};
  if (input.masteryEnabled !== undefined) settings.mastery_enabled = input.masteryEnabled;
  if (input.masteryPct !== undefined) settings.mastery_pct = input.masteryPct;
  if (input.reviewSeconds !== undefined) settings.review_seconds = input.reviewSeconds;
  const { data, error } = await client.rpc('set_learning_settings', { p_session_id: sessionId, p_settings: settings });
  if (error) throw error;
  return data as number;
}
