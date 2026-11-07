import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PresenterGame } from '@/components/game/PresenterGame';
import { PlayerGame } from '@/components/game/PlayerGame';
import { ToastProvider } from '@/contexts/ToastProvider';
import type { GameController } from '@/hooks/useGameState';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameState } from '@/types/game';

const showLeaderboard = vi.fn();
const nextQuestion = vi.fn();
const closeQuestion = vi.fn();
const endGame = vi.fn();
const submitAnswer = vi.fn();
vi.mock('@/services/game', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/game')>()),
  showLeaderboard: (...a: unknown[]) => showLeaderboard(...a),
  nextQuestion: (...a: unknown[]) => nextQuestion(...a),
  closeQuestion: (...a: unknown[]) => closeQuestion(...a),
  endGame: (...a: unknown[]) => endGame(...a),
  submitAnswer: (...a: unknown[]) => submitAnswer(...a),
}));

const client = {} as AppSupabaseClient;
const wrap = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00.000Z'));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }),
  });
  [showLeaderboard, nextQuestion, closeQuestion, endGame].forEach((f) => f.mockReset().mockResolvedValue(9));
  submitAnswer.mockReset().mockResolvedValue('accepted');
});
afterEach(() => vi.useRealTimers());

/** A running game. `startsInMs` > 0 puts the first question inside its lead window. */
function game(opts: { role?: GameState['role']; phase?: GameState['session']['phase']; startsInMs?: number; version?: number } = {}): GameController {
  const { role = 'host', phase = 'question', startsInMs = 0, version = 7 } = opts;
  const startsAt = new Date(Date.now() + startsInMs).toISOString();
  const closed = phase !== 'question';
  const state: GameState = {
    role,
    serverNow: new Date().toISOString(),
    session: { id: 's1', quizTitle: 'Planets', pin: role === 'player' ? null : '482913', status: 'in_progress', phase, stateVersion: version, questionCount: 3, currentPosition: 0, isLocked: false, participantCount: 2, speedScoring: true },
    question: {
      id: 'q1', position: 0, type: 'multiple_choice', prompt: 'Which planet is largest?', imagePath: null, timeLimitSeconds: 20, points: 1000,
      status: closed ? 'closed' : 'open', startsAt, openedAt: startsAt, deadlineAt: new Date(Date.now() + startsInMs + 20000).toISOString(), answerCount: 0,
      options: [{ id: 'a', position: 0, label: 'Jupiter', imagePath: null }, { id: 'b', position: 1, label: 'Saturn', imagePath: null }],
      correctOptionId: closed ? 'a' : null, explanation: null, distribution: closed ? { a: 2, b: 0 } : null,
    },
    me: role === 'player'
      ? { participantId: 'me', nickname: 'Me', avatar: '000000000', status: 'active', answerOptionId: null, lastCorrect: null, lastPoints: null, score: 0, rank: null, previousRank: null, streak: 0, correctCount: 0 }
      : null,
    leaderboard: [], rankedCount: 2, leaderboardVersion: null,
  };
  return { state, load: 'ready', channel: 'live', refresh: vi.fn(async () => {}), nudge: vi.fn(async () => {}), answerCount: 0, offset: 0, markAnswered: vi.fn() };
}

describe('projector controls', () => {
  it('the teacher’s own projector shows the game controls after the reveal', async () => {
    render(<PresenterGame client={client} sessionId="s1" game={game({ role: 'host', phase: 'reveal', version: 21 })} />, { wrapper: wrap });
    expect(screen.getByRole('button', { name: /leaderboard/i })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    });
    expect(nextQuestion).toHaveBeenCalledWith(client, 's1', 21);
  });

  it('a projector opened with a projector link is read-only: no controls at all', () => {
    render(<PresenterGame client={client} sessionId="s1" game={game({ role: 'presenter', phase: 'reveal' })} />, { wrapper: wrap });
    expect(screen.queryByRole('button', { name: /leaderboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next question/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end question/i })).not.toBeInTheDocument();
  });

  it('Space shows the leaderboard from the reveal; a held key sends one command', async () => {
    render(<PresenterGame client={client} sessionId="s1" game={game({ role: 'host', phase: 'reveal', version: 30 })} />, { wrapper: wrap });
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: ' ', repeat: true });
      fireEvent.keyDown(window, { key: ' ', repeat: true });
    });
    expect(showLeaderboard).toHaveBeenCalledTimes(1);
    expect(showLeaderboard).toHaveBeenCalledWith(client, 's1', 30);
  });

  it('Space never ends a running question', async () => {
    render(<PresenterGame client={client} sessionId="s1" game={game({ role: 'host', phase: 'question' })} />, { wrapper: wrap });
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(closeQuestion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /end question/i })).toBeInTheDocument();
  });
});

describe('everyone sees the question at the same scheduled moment', () => {
  it('projector: "Get ready" with no question text until the start, then the question', () => {
    render(<PresenterGame client={client} sessionId="s1" game={game({ role: 'presenter', startsInMs: 2000 })} />, { wrapper: wrap });
    expect(screen.getByText('Get ready')).toBeInTheDocument();
    expect(screen.queryByText('Which planet is largest?')).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(2010));
    expect(screen.queryByText('Get ready')).not.toBeInTheDocument();
    expect(screen.getByText('Which planet is largest?')).toBeInTheDocument();
  });

  it('phone: answers are not available before the start, and appear (enabled) at the start', () => {
    render(<PlayerGame client={client} game={game({ role: 'player', startsInMs: 2000 })} />);
    expect(screen.getByText('Get ready')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /jupiter/i })).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(2010));
    const button = screen.getByRole('button', { name: /jupiter/i });
    expect(button).toBeEnabled();
  });

  it('phone: tapping an answer sends it once and remembers it locally', async () => {
    const g = game({ role: 'player' });
    render(<PlayerGame client={client} game={g} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /saturn/i }));
    });
    expect(submitAnswer).toHaveBeenCalledWith(client, 'q1', 'b');
    expect(g.markAnswered).toHaveBeenCalledWith('q1', 'b');
    expect(screen.getByText(/locked in/i)).toBeInTheDocument();
  });

  it('phone: an answer refused as too early is not locked in and explains why', async () => {
    submitAnswer.mockResolvedValue('early');
    const g = game({ role: 'player' });
    render(<PlayerGame client={client} game={g} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /jupiter/i }));
    });
    expect(g.markAnswered).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/not started yet/i);
    expect(screen.queryByText(/locked in/i)).not.toBeInTheDocument();
  });
});
