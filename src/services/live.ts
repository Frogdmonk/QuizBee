import type { AppSupabaseClient } from '@/lib/supabase';
import type { LobbyParticipant, SessionLobby, SessionUpdate } from '@/types/session';

/*
 * Session reads shared by the host screen (teacher client) and the projector
 * (teacher client on the same computer, or an anonymous client that claimed a
 * presenter link). Imports no client itself, so the caller chooses the identity.
 */

export type RawParticipant = {
  id: string;
  nickname: string;
  avatar: string;
  status: LobbyParticipant['status'];
  joined_at: string;
  last_seen_at: string;
};

export function toParticipant(p: RawParticipant): LobbyParticipant {
  return {
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    status: p.status,
    joinedAt: p.joined_at,
    lastSeenAt: p.last_seen_at,
  };
}

type RawLobby = {
  id: string;
  role: SessionLobby['role'];
  quiz_id: string | null;
  quiz_title: string;
  question_count: number;
  pin: string;
  status: SessionLobby['status'];
  phase: SessionLobby['phase'];
  state_version: number;
  is_locked: boolean;
  max_participants: number;
  participant_count: number;
  has_presenter_link: boolean;
  created_at: string;
  participants: RawParticipant[];
};

export async function getSessionLobby(client: AppSupabaseClient, sessionId: string): Promise<SessionLobby> {
  const { data, error } = await client.rpc('get_session_lobby', { p_session_id: sessionId });
  if (error) throw error;
  const s = data as unknown as RawLobby;
  return {
    id: s.id,
    role: s.role,
    quizId: s.quiz_id,
    quizTitle: s.quiz_title,
    questionCount: s.question_count,
    pin: s.pin,
    status: s.status,
    phase: s.phase,
    stateVersion: s.state_version,
    isLocked: s.is_locked,
    maxParticipants: s.max_participants,
    participantCount: s.participant_count,
    hasPresenterLink: s.has_presenter_link,
    createdAt: s.created_at,
    participants: s.participants.map(toParticipant),
  };
}

export async function claimPresenter(client: AppSupabaseClient, sessionId: string, key: string): Promise<void> {
  const { error } = await client.rpc('claim_presenter', { p_session_id: sessionId, p_key: key });
  if (error) throw error;
}

type RawSessionUpdate = {
  status: SessionUpdate['status'];
  phase: SessionUpdate['phase'];
  is_locked: boolean;
  state_version: number;
  participant_count: number;
};

export function toSessionUpdate(p: unknown): SessionUpdate {
  const u = p as RawSessionUpdate;
  return {
    status: u.status,
    phase: u.phase,
    isLocked: u.is_locked,
    stateVersion: u.state_version,
    participantCount: u.participant_count,
  };
}

/** Applies a host-topic broadcast to a lobby. Returns the same object when nothing changed. */
export function applyHostEvent(lobby: SessionLobby, event: string, payload: unknown): SessionLobby {
  const p = payload as Record<string, unknown>;
  switch (event) {
    case 'participant_joined': {
      const participant = toParticipant(p.participant as RawParticipant);
      const others = lobby.participants.filter((x) => x.id !== participant.id);
      return {
        ...lobby,
        participants: [...others, participant],
        participantCount: Number(p.participant_count ?? others.length + 1),
      };
    }
    case 'participant_updated': {
      const participant = toParticipant(p.participant as RawParticipant);
      return {
        ...lobby,
        participants: lobby.participants.map((x) => (x.id === participant.id ? participant : x)),
      };
    }
    case 'participant_left':
    case 'participant_removed': {
      const id = String(p.id);
      return {
        ...lobby,
        participants: lobby.participants.filter((x) => x.id !== id),
        participantCount: Number(p.participant_count ?? lobby.participantCount),
      };
    }
    case 'session': {
      const u = toSessionUpdate(payload);
      // Ignore stale versions that arrive out of order.
      if (u.stateVersion < lobby.stateVersion) return lobby;
      return {
        ...lobby,
        status: u.status,
        phase: u.phase,
        isLocked: u.isLocked,
        stateVersion: u.stateVersion,
        participantCount: u.participantCount,
      };
    }
    default:
      return lobby;
  }
}
