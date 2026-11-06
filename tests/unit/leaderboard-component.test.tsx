import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import type { LeaderboardEntry, LeaderboardSnapshot } from '@/lib/leaderboard/types';

let reduceMotion = false;

beforeEach(() => {
  reduceMotion = false;
  vi.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('reduce') ? reduceMotion : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Ten players, server order = index; previous ranks from `previous`. */
function snapshot(updateId: number, names: string[], previous: (number | null)[], scores?: number[]): LeaderboardSnapshot {
  const entries: LeaderboardEntry[] = names.map((name, i) => ({
    participantId: name,
    nickname: name,
    avatar: '000000000',
    score: scores?.[i] ?? 1000 - i * 100,
    rank: scores ? 1 + scores.filter((s) => s > scores[i]).length : i + 1,
    previousRank: previous[i],
    lastPoints: 100,
    lastCorrect: true,
    streak: 1,
    correctCount: 1,
  }));
  return { updateId, entries, fieldSize: names.length };
}

const NAMES = ['Ada', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];

function visibleOrder(): string[] {
  return within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.querySelector('p')?.firstChild?.textContent ?? '');
}

function finish() {
  act(() => {
    vi.advanceTimersByTime(5000);
  });
}

describe('Leaderboard (integration)', () => {
  it('shows the previous standings first, then settles on the server order', () => {
    // Jo jumps from 10th to 1st; everyone else drops one place.
    const snap = snapshot(1, ['Jo', ...NAMES.slice(0, 9)], [10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    render(<Leaderboard snapshot={snap} variant="stage" />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(visibleOrder()).toEqual([...NAMES.slice(0, 9), 'Jo']);
    finish();
    expect(visibleOrder()).toEqual(['Jo', ...NAMES.slice(0, 9)]);
    expect(screen.getByText(/Legendary comeback/i)).toBeInTheDocument();
  });

  it('a newer update interrupting the animation wins; final order always matches it', () => {
    const first = snapshot(1, NAMES, [2, 1, 3, 4, 5, 6, 7, 8, 9, 10]);
    const { rerender } = render(<Leaderboard snapshot={first} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const second = snapshot(2, [...NAMES].reverse(), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    rerender(<Leaderboard snapshot={second} />);
    finish();
    expect(visibleOrder()).toEqual([...NAMES].reverse());
  });

  it('ignores an older update that arrives late, and duplicates', () => {
    const newer = snapshot(5, NAMES, NAMES.map((_, i) => i + 1));
    const older = snapshot(4, [...NAMES].reverse(), NAMES.map((_, i) => i + 1));
    const { rerender } = render(<Leaderboard snapshot={newer} />);
    finish();
    rerender(<Leaderboard snapshot={older} />);
    finish();
    expect(visibleOrder()).toEqual(NAMES);
    rerender(<Leaderboard snapshot={{ ...newer }} />);
    finish();
    expect(visibleOrder()).toEqual(NAMES);
  });

  it('keeps all 10 rows (no duplicates) through rapid consecutive updates', () => {
    const { rerender } = render(<Leaderboard snapshot={snapshot(1, NAMES, NAMES.map((_, i) => i + 1))} />);
    for (let u = 2; u <= 8; u++) {
      const rotated = [...NAMES.slice(u % 10), ...NAMES.slice(0, u % 10)];
      rerender(<Leaderboard snapshot={snapshot(u, rotated, rotated.map((n) => NAMES.indexOf(n) + 1))} />);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(new Set(visibleOrder()).size).toBe(10);
    }
    finish();
    expect(visibleOrder()).toEqual([...NAMES.slice(8), ...NAMES.slice(0, 8)]);
  });

  it('shows shared ranks for equal scores', () => {
    render(<Leaderboard snapshot={snapshot(1, ['Ada', 'Ben', 'Cy'], [1, 2, 3], [500, 500, 100])} />);
    finish();
    const ranks = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.type-stage')?.textContent);
    expect(ranks).toEqual(['1', '1', '3']);
  });

  it('under reduced motion shows the final board at once, without character props', () => {
    reduceMotion = true;
    const snap = snapshot(1, ['Jo', ...NAMES.slice(0, 9)], [10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const { container } = render(<Leaderboard snapshot={snap} />);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(visibleOrder()).toEqual(['Jo', ...NAMES.slice(0, 9)]);
    expect(container.querySelectorAll('svg[viewBox="0 0 100 100"]')).toHaveLength(0);
  });

  it('plays a theme for every one of the 10 students during the character stage', () => {
    const snap = snapshot(1, NAMES, [3, 1, 2, 7, 5, 4, 10, 6, 8, 9]);
    const { container } = render(<Leaderboard snapshot={snap} variant="stage" />);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    // Each actor wraps one avatar; props render for themes that have them (all but the fallback).
    expect(container.querySelectorAll('li svg[viewBox="0 0 120 120"]')).toHaveLength(10);
    expect(container.querySelectorAll('svg[viewBox="0 0 100 100"]').length).toBeGreaterThanOrEqual(8);
  });
});
