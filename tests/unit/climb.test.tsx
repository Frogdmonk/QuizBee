import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CROWD, LEDGES, climbMotion, ledgeOf } from '@/lib/leaderboard/climb';
import { ClimbBoard } from '@/components/leaderboard/ClimbBoard';
import { worldMood } from '@/lib/world';
import { DEFAULT_BATTLE_CONFIG } from '@/services/game';
import type { LeaderboardSnapshot } from '@/lib/leaderboard/types';
import type { GameState } from '@/types/game';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('the climb', () => {
  it('ten ledges, #1 highest; climbers and their name banners never overlap a neighbour', () => {
    expect(LEDGES).toHaveLength(10);
    expect(ledgeOf(1).y).toBeLessThan(ledgeOf(10).y);
    // Each ledge is a 220 px wide banner under a ≤ 120 px climber: no two may share that box.
    for (let a = 0; a < LEDGES.length; a++)
      for (let b = a + 1; b < LEDGES.length; b++) {
        const dx = Math.abs(LEDGES[a].x - LEDGES[b].x);
        const dy = Math.abs(LEDGES[a].y - LEDGES[b].y);
        expect(dx >= 230 || dy >= 150, `ledges ${a + 1} and ${b + 1}`).toBe(true);
      }
  });

  it('a small rise climbs ledge by ledge; a big one leaps; a drop slides; a newcomer jumps from the crowd', () => {
    const climb = climbMotion(5, 3, { kind: 'up', positions: 2, tier: 'small' });
    expect(climb.kind).toBe('climb');
    expect(climb.x).toHaveLength(5); // start, (hop, ledge) × 2
    expect([climb.x.at(-1), climb.y.at(-1)]).toEqual([ledgeOf(3).x, ledgeOf(3).y]);

    const leap = climbMotion(9, 2, { kind: 'up', positions: 7, tier: 'legendary' });
    expect(leap.kind).toBe('leap');
    expect(Math.min(...leap.y)).toBeLessThan(ledgeOf(2).y); // a high arc

    const slide = climbMotion(2, 4, { kind: 'down', positions: 2, tier: 'minor' });
    expect(slide.kind).toBe('slide');
    expect(slide.rotate.some((r) => r !== 0)).toBe(true); // the wobble
    expect(slide.rotate.at(-1)).toBe(0); // lands upright

    const arrive = climbMotion(14, 8, { kind: 'up', positions: 6, tier: 'major' });
    expect(arrive.kind).toBe('arrive');
    expect([arrive.x[0], arrive.y[0]]).toEqual([CROWD.x, CROWD.y]);

    expect(climbMotion(1, 1, { kind: 'same', context: 'champion' }).kind).toBe('hop');
    expect(climbMotion(6, 6, { kind: 'same', context: 'steady' }).kind).toBe('still');
  });

  it('the board lists the top 10 in the server’s order for screen readers, with the crown on #1', () => {
    const snapshot: LeaderboardSnapshot = {
      updateId: 3,
      fieldSize: 30,
      entries: Array.from({ length: 10 }, (_, i) => ({
        participantId: `p${i}`, nickname: `Player ${i + 1}`, avatar: '000000000', score: 5000 - i * 300, rank: i + 1,
        previousRank: i + 1, lastPoints: 500, lastCorrect: true, streak: i === 0 ? 4 : 0, correctCount: 3,
      })),
    };
    render(<ClimbBoard snapshot={snapshot} monster={{ key: 'gloomjaw', hp: 300, maxHp: 600 }} />);
    expect(screen.getByRole('region', { name: 'Leaderboard' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1. Player 1, 5000 points');
    expect(items[9]).toHaveTextContent('10. Player 10');
    expect(screen.getByRole('img', { name: /Gloomjaw/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.cl-torch')).toHaveLength(1); // the streak of 4
    expect(document.querySelectorAll('.cl-crowd')).toHaveLength(20); // 30 players, 10 on the cliff
  });
});

describe('the world’s mood', () => {
  const s = (hp: number | null, enabled = true) =>
    ({ battle: { enabled, maxHp: 1000, hp, config: DEFAULT_BATTLE_CONFIG } }) as unknown as GameState;
  it('follows the monster: calm, rage, enraged, then dawn when it is defeated; calm without a battle', () => {
    expect(worldMood(s(900))).toBe('calm');
    expect(worldMood(s(600))).toBe('rage');
    expect(worldMood(s(200))).toBe('enraged');
    expect(worldMood(s(0))).toBe('victory');
    expect(worldMood(s(500, false))).toBe('calm');
    expect(worldMood(null)).toBe('calm');
  });
});

describe('figures, wipes and the camp', () => {
  it('a figure has the head on a body in the pose asked for, holding the class weapon', async () => {
    const { Hero } = await import('@/components/avatar/Hero');
    const { container } = render(<Hero code="000000000" size={80} pose="attack" weapon="thunder" />);
    const hero = container.querySelector('.hero')!;
    expect(hero).toHaveAttribute('data-pose', 'attack');
    expect(hero).toHaveStyle({ width: '80px', height: '120px' });
    expect(container.querySelector('.hero-weapon')).not.toBeNull();
  });

  it('no wipe on the first screen; a wipe of the right kind on every change after it', async () => {
    const { PhaseWipe } = await import('@/components/world/PhaseWipe');
    const { wipeFor } = await import('@/lib/world');
    const { container, rerender } = render(<PhaseWipe sceneKey="question:q1" kind={wipeFor('question')} />);
    expect(container.querySelector('.phase-wipe')).toBeNull();
    rerender(<PhaseWipe sceneKey="reveal:q1" kind={wipeFor('reveal')} />);
    expect(container.querySelector('.phase-wipe')).toHaveAttribute('data-kind', 'slash');
    expect(wipeFor('leaderboard')).toBe('dust');
    expect(wipeFor('podium')).toBe('burst');
    expect(wipeFor('lobby')).toBeNull();
  });

  it('the camp shows the monster on the horizon only before a boss battle', async () => {
    const { CampScenery } = await import('@/components/lobby/CampScenery');
    const { container, rerender } = render(<CampScenery lurker />);
    expect(container.querySelector('.world-lurker-eye')).not.toBeNull();
    rerender(<CampScenery />);
    expect(container.querySelector('.world-lurker-eye')).toBeNull();
    expect(container.querySelector('.camp-fire')).not.toBeNull();
  });
});
