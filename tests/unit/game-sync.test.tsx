import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { applyBroadcast, withAnswer } from '@/lib/game-sync';
import { bestOffset } from '@/hooks/useServerClock';
import { useCountdown } from '@/hooks/useCountdown';
import { useGameCommands } from '@/hooks/useGameCommands';
import { GameCommandButtons } from '@/components/game/GameCommandButtons';
import { ToastProvider } from '@/contexts/ToastProvider';
import type { GameController } from '@/hooks/useGameState';
import type { GameState } from '@/types/game';
import type { AppSupabaseClient } from '@/lib/supabase';

const closeQuestion = vi.fn();
const showLeaderboard = vi.fn();
const nextQuestion = vi.fn();
const endGame = vi.fn();
vi.mock('@/services/game', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/game')>()),
  closeQuestion: (...a: unknown[]) => closeQuestion(...a),
  showLeaderboard: (...a: unknown[]) => showLeaderboard(...a),
  nextQuestion: (...a: unknown[]) => nextQuestion(...a),
  endGame: (...a: unknown[]) => endGame(...a),
}));

/* ── builders ────────────────────────────────────────────────────────────── */

const ME = 'p-me';

function rawSession(version: number, phase = 'question') {
  return {
    id: 's1', quiz_title: 'Planets', status: 'in_progress', phase, state_version: version, question_count: 3,
    current_position: 0, is_locked: false, participant_count: 3, speed_scoring: true,
  };
}

function rawQuestion(id: string, status: 'open' | 'closed', extra: Record<string, unknown> = {}) {
  return {
    id, position: 0, type: 'multiple_choice', prompt: 'Which?', image_path: null, time_limit_seconds: 20, points: 1000,
    status, starts_at: '2026-11-11T10:00:02.000Z', opened_at: '2026-11-11T10:00:02.000Z', deadline_at: '2026-11-11T10:00:22.000Z',
    answer_count: 0, options: [{ id: 'a', position: 0, label: 'A', image_path: null }, { id: 'b', position: 1, label: 'B', image_path: null }],
    correct_option_id: status === 'closed' ? 'a' : null, explanation: null, distribution: status === 'closed' ? { a: 2, b: 1 } : null,
    ...extra,
  };
}

function payload(version: number, status: 'open' | 'closed', questionId = 'q1', ranks: unknown[] = []) {
  return {
    server_now: '2026-11-11T10:00:00.000Z',
    session: rawSession(version, status === 'closed' ? 'reveal' : 'question'),
    question: rawQuestion(questionId, status),
    leaderboard: [],
    ranks,
    ranked_count: 3,
    leaderboard_version: status === 'closed' ? version : null,
  };
}

function baseState(role: GameState['role'] = 'player'): GameState {
  return {
    role, serverNow: '2026-11-11T10:00:00.000Z',
    session: { id: 's1', quizTitle: 'Planets', pin: role === 'player' ? null : '482913', status: 'in_progress', phase: 'question', stateVersion: 5,
      questionCount: 3, currentPosition: 0, isLocked: false, participantCount: 3, speedScoring: true, reactionsEnabled: true, revealMs: 5000, masteryEnabled: true, masteryPct: 75, reviewMs: 8000 },
    question: null,
    battle: null,
    learning: null,
    me: role === 'player'
      ? { participantId: ME, nickname: 'Me', avatar: '000000000', status: 'active', answerOptionId: null, lastCorrect: null, lastPoints: null,
          score: 100, rank: 2, previousRank: 3, streak: 1, correctCount: 1, vote: null, powerup: null }
      : null,
    leaderboard: [], rankedCount: 3, leaderboardVersion: 4,
  };
}

/* ── applying broadcasts ─────────────────────────────────────────────────── */

describe('applyBroadcast', () => {
  it('cannot apply before anything is loaded, or when the payload is malformed', () => {
    expect(applyBroadcast(null, payload(6, 'open'))).toBeNull();
    expect(applyBroadcast(baseState(), { nope: true })).toBeNull();
    expect(applyBroadcast(baseState(), null)).toBeNull();
  });

  it('drops duplicates and older broadcasts, returning the very same state', () => {
    const prev = baseState();
    expect(applyBroadcast(prev, payload(5, 'open'))).toBe(prev);
    expect(applyBroadcast(prev, payload(3, 'open'))).toBe(prev);
  });

  it('applies a newer broadcast without any extra request and keeps the pin and role', () => {
    const host = baseState('host');
    const next = applyBroadcast(host, payload(6, 'open'))!;
    expect(next.session.stateVersion).toBe(6);
    expect(next.session.pin).toBe('482913');
    expect(next.role).toBe('host');
    expect(next.question).toMatchObject({ id: 'q1', status: 'open', startsAt: '2026-11-11T10:00:02.000Z', correctOptionId: null });
    expect(next.question?.options.map((o) => o.label)).toEqual(['A', 'B']);
  });

  it('resets the picked answer for a new question but keeps it through the same question’s reveal', () => {
    const open = applyBroadcast(baseState(), payload(6, 'open', 'q1'))!;
    const picked = withAnswer(open, 'q1', 'b');
    expect(picked.me?.answerOptionId).toBe('b');

    const reveal = applyBroadcast(picked, payload(7, 'closed', 'q1', [[ME, 1100, 1, 2, 1000, true, 2, 2]]))!;
    expect(reveal.me).toMatchObject({ answerOptionId: 'b', lastCorrect: true, lastPoints: 1000, score: 1100, rank: 1, previousRank: 2, streak: 2 });

    const nextQuestion = applyBroadcast(reveal, payload(8, 'open', 'q2'))!;
    expect(nextQuestion.me?.answerOptionId).toBeNull();
    expect(nextQuestion.me?.lastCorrect).toBeNull(); // result only shows once a question has closed
    expect(nextQuestion.me?.score).toBe(1100); // standings carry over
  });

  it('a late joiner without a rank row keeps their numbers and shows no result', () => {
    const prev = withAnswer(applyBroadcast(baseState(), payload(6, 'open'))!, 'q1', 'a');
    const reveal = applyBroadcast(prev, payload(7, 'closed', 'q1', []))!;
    expect(reveal.me).toMatchObject({ lastCorrect: null, lastPoints: null, score: 100, rank: 2 });
  });

  it('withAnswer only changes the matching question', () => {
    const s = applyBroadcast(baseState(), payload(6, 'open', 'q1'))!;
    expect(withAnswer(s, 'other', 'a')).toBe(s);
    expect(withAnswer(s, 'q1', 'a').me?.answerOptionId).toBe('a');
  });
});

/* ── clock ───────────────────────────────────────────────────────────────── */

describe('bestOffset', () => {
  it('takes the median of the fastest round trips and ignores slow outliers', () => {
    expect(
      bestOffset([
        { rtt: 400, offset: 900 }, // slow, asymmetric: ignored
        { rtt: 40, offset: 118 },
        { rtt: 35, offset: 120 },
        { rtt: 60, offset: 125 },
        { rtt: 300, offset: -50 },
      ]),
    ).toBe(120);
    expect(bestOffset([])).toBeNull();
  });
});

/* ── everyone unlocks together ───────────────────────────────────────────── */

describe('scheduled start', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  const startsAt = '2026-11-11T10:00:02.000Z';

  it('a phone that receives the question late still unlocks at the same instant', () => {
    const early = renderHook(() => useCountdown(startsAt, 0, true)); // received at t = 0
    act(() => void vi.advanceTimersByTime(900));
    const late = renderHook(() => useCountdown(startsAt, 0, true)); // received at t = 900 ms
    // The seconds display refreshes every 250 ms, so the early phone may read a little high;
    // what must match is the moment both reach zero.
    expect(early.result.current).toBeGreaterThan(0);
    expect(late.result.current).toBe(1100);

    act(() => void vi.advanceTimersByTime(1099));
    expect(early.result.current).toBeGreaterThan(0);
    expect(late.result.current).toBeGreaterThan(0);

    act(() => void vi.advanceTimersByTime(10)); // just past 10:00:02.000
    expect(early.result.current).toBe(0);
    expect(late.result.current).toBe(0);
  });

  it('flips at the exact moment rather than at the next quarter-second tick', () => {
    // 10:00:00.100 → the 250 ms interval would not fire again until .250 → but the exact timer does.
    const view = renderHook(() => useCountdown('2026-11-11T10:00:00.100Z', 0, true));
    expect(view.result.current).toBe(100);
    act(() => void vi.advanceTimersByTime(105));
    expect(view.result.current).toBe(0);
  });

  it('a phone whose clock is wrong still agrees once its measured offset is applied', () => {
    // Server time is 10:00:00.000. Phone B's clock runs 500 ms behind, and it knows (offset +500).
    const a = renderHook(() => useCountdown(startsAt, 0, true));
    vi.setSystemTime(new Date('2026-11-11T09:59:59.500Z'));
    const b = renderHook(() => useCountdown(startsAt, 500, true));
    expect(a.result.current).toBe(2000);
    expect(b.result.current).toBe(2000);
  });

  it('with no scheduled start (older questions) the question is shown at once', () => {
    const view = renderHook(() => useCountdown(null, 0, true));
    expect(view.result.current).toBe(0);
  });
});

/* ── teacher controls (host page and projector share them) ───────────────── */

function controller(overrides: Partial<GameState['session']> & { role?: GameState['role'] } = {}): GameController {
  const base = baseState('host');
  const state: GameState = { ...base, role: overrides.role ?? 'host', session: { ...base.session, ...overrides } };
  return { state, load: 'ready', channel: 'live', refresh: vi.fn(async () => {}), nudge: vi.fn(async () => {}), answerCount: 0, offset: 0, markAnswered: vi.fn(), voteTally: null };
}

const client = {} as AppSupabaseClient;

function Controls({ game }: { game: GameController }) {
  const commands = useGameCommands(client, 's1', game);
  return <GameCommandButtons commands={commands} />;
}

async function click(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

const wrap = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('teacher game controls', () => {
  beforeEach(() => {
    [closeQuestion, showLeaderboard, nextQuestion, endGame].forEach((f) => f.mockReset().mockResolvedValue(9));
  });

  it('while a question runs: only End question, carrying the state version', async () => {
    render(<Controls game={controller({ phase: 'question', stateVersion: 12 })} />, { wrapper: wrap });
    expect(screen.queryByRole('button', { name: /leaderboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next question/i })).not.toBeInTheDocument();
    await click(/end question/i);
    expect(closeQuestion).toHaveBeenCalledWith(client, 's1', 12);
  });

  it('after the reveal: Leaderboard and Next question', async () => {
    render(<Controls game={controller({ phase: 'reveal', stateVersion: 20 })} />, { wrapper: wrap });
    await click(/leaderboard/i);
    expect(showLeaderboard).toHaveBeenCalledWith(client, 's1', 20);
    await click(/next question/i);
    expect(nextQuestion).toHaveBeenCalledWith(client, 's1', 20);
  });

  it('on the last question the button says Final results', () => {
    render(<Controls game={controller({ phase: 'leaderboard', currentPosition: 2, questionCount: 3 })} />, { wrapper: wrap });
    expect(screen.getByRole('button', { name: /final results/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^leaderboard$/i })).not.toBeInTheDocument();
  });

  it('the keyboard shortcut steps reveal → leaderboard → next, and never ends a running question', () => {
    const reveal = renderHook(() => useGameCommands(client, 's1', controller({ phase: 'reveal' })), { wrapper: wrap });
    const board = renderHook(() => useGameCommands(client, 's1', controller({ phase: 'leaderboard' })), { wrapper: wrap });
    const running = renderHook(() => useGameCommands(client, 's1', controller({ phase: 'question' })), { wrapper: wrap });
    expect(reveal.result.current.primary).toBe(reveal.result.current.showBoard);
    expect(board.result.current.primary).toBe(board.result.current.next);
    expect(running.result.current.primary).toBeNull();
  });
});
