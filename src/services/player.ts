import { getPlayerClient } from '@/lib/supabase';
import { toParticipant, type RawParticipant } from '@/services/live';
import type { LobbyParticipant, PinLookup, PlayerState, SessionStatus } from '@/types/session';

/*
 * Student-side calls. Uses only the anonymous player client, never teacher
 * auth. Students read nothing from tables directly; everything is an RPC.
 */

/** Signs this device in anonymously once; the identity is reused on rejoin. */
export async function ensurePlayerSession(): Promise<void> {
  const client = getPlayerClient();
  const { data } = await client.auth.getSession();
  if (data.session) return;
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
}

type RawLookup =
  | { found: false }
  | {
      found: true;
      session_id: string;
      quiz_title: string;
      status: SessionStatus;
      is_locked: boolean;
      is_full: boolean;
      me: { id: string; nickname: string; avatar: string; status: LobbyParticipant['status'] } | null;
    };

export async function lookupSession(pin: string): Promise<PinLookup> {
  const { data, error } = await getPlayerClient().rpc('lookup_session', { p_pin: pin });
  if (error) throw error;
  const r = data as unknown as RawLookup;
  if (!r.found) return { found: false };
  return {
    found: true,
    sessionId: r.session_id,
    quizTitle: r.quiz_title,
    status: r.status,
    isLocked: r.is_locked,
    isFull: r.is_full,
    me: r.me,
  };
}

export async function joinSession(sessionId: string, nickname: string, avatar: string): Promise<LobbyParticipant> {
  const { data, error } = await getPlayerClient().rpc('join_session', {
    p_session_id: sessionId,
    p_nickname: nickname,
    p_avatar: avatar,
  });
  if (error) throw error;
  return toParticipant(data as unknown as RawParticipant);
}

export async function leaveSession(sessionId: string): Promise<void> {
  const { error } = await getPlayerClient().rpc('leave_session', { p_session_id: sessionId });
  if (error) throw error;
}

type RawPlayerState = {
  session: {
    id: string;
    quiz_title: string;
    status: PlayerState['session']['status'];
    phase: PlayerState['session']['phase'];
    is_locked: boolean;
    participant_count: number;
    state_version: number;
  };
  me: RawParticipant;
};

/** Current state for this player. Also serves as the heartbeat. */
export async function getPlayerState(sessionId: string): Promise<PlayerState> {
  const { data, error } = await getPlayerClient().rpc('get_player_state', { p_session_id: sessionId });
  if (error) throw error;
  const r = data as unknown as RawPlayerState;
  return {
    session: {
      id: r.session.id,
      quizTitle: r.session.quiz_title,
      status: r.session.status,
      phase: r.session.phase,
      isLocked: r.session.is_locked,
      participantCount: r.session.participant_count,
      stateVersion: r.session.state_version,
    },
    me: toParticipant(r.me),
  };
}

/* Remembers the last nickname and avatar on this device for quick rejoining. */
const PROFILE_KEY = 'rally.player.profile';

export function loadPlayerProfile(): { nickname: string; avatar: string } | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { nickname?: unknown; avatar?: unknown };
    if (typeof parsed.nickname === 'string' && typeof parsed.avatar === 'string') {
      return { nickname: parsed.nickname, avatar: parsed.avatar };
    }
  } catch {
    // Private mode or corrupted value: start fresh.
  }
  return null;
}

export function savePlayerProfile(profile: { nickname: string; avatar: string }): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage may be unavailable; remembering is only a convenience.
  }
}
