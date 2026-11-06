export type SessionStatus = 'lobby' | 'in_progress' | 'ended' | 'cancelled';
export type SessionPhase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'podium';
export type ParticipantStatus = 'active' | 'left' | 'removed';

export type LobbyParticipant = {
  id: string;
  nickname: string;
  avatar: string;
  status: ParticipantStatus;
  joinedAt: string;
  lastSeenAt: string;
};

/** What the host and projector screens show. */
export type SessionLobby = {
  id: string;
  role: 'host' | 'presenter';
  quizId: string | null;
  quizTitle: string;
  questionCount: number;
  pin: string;
  status: SessionStatus;
  phase: SessionPhase;
  stateVersion: number;
  isLocked: boolean;
  maxParticipants: number;
  participantCount: number;
  hasPresenterLink: boolean;
  createdAt: string;
  participants: LobbyParticipant[];
};

export type SessionSummary = {
  id: string;
  quizTitle: string;
  pin: string;
  status: SessionStatus;
  isLocked: boolean;
  participantCount: number;
  maxParticipants: number;
  createdAt: string;
  endedAt: string | null;
};

/** Broadcast on session:{id}:host and session:{id}:game. */
export type SessionUpdate = {
  status: SessionStatus;
  phase: SessionPhase;
  isLocked: boolean;
  stateVersion: number;
  participantCount: number;
};

export type PinLookup =
  | { found: false }
  | {
      found: true;
      sessionId: string;
      quizTitle: string;
      status: SessionStatus;
      isLocked: boolean;
      isFull: boolean;
      me: { id: string; nickname: string; avatar: string; status: ParticipantStatus } | null;
    };

export type PlayerState = {
  session: {
    id: string;
    quizTitle: string;
    status: SessionStatus;
    phase: SessionPhase;
    isLocked: boolean;
    participantCount: number;
    stateVersion: number;
  };
  me: LobbyParticipant;
};
