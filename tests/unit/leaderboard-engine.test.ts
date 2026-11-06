import { describe, expect, it } from 'vitest';
import { DEFAULT_LEADERBOARD_CONFIG, makeConfig } from '@/lib/leaderboard/config';
import { classifyMovement, previousOrder } from '@/lib/leaderboard/movement';
import { eligibleThemes, selectTheme } from '@/lib/leaderboard/selection';
import { detectEvents, nearMissMessage } from '@/lib/leaderboard/events';
import { LeaderboardEngine } from '@/lib/leaderboard/engine';
import { THEMES } from '@/lib/leaderboard/themes';
import type { LeaderboardEntry, LeaderboardSnapshot, Movement } from '@/lib/leaderboard/types';

function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Builds entries in server order from [id, score, rank, previousRank]. */
function entries(rows: [string, number, number, number | null, Partial<LeaderboardEntry>?][]): LeaderboardEntry[] {
  return rows.map(([id, score, rank, previousRank, extra]) => ({
    participantId: id,
    nickname: id.toUpperCase(),
    avatar: '000000000',
    score,
    rank,
    previousRank,
    lastPoints: 0,
    lastCorrect: null,
    streak: 0,
    correctCount: 0,
    ...extra,
  }));
}

/** Ten players; previous ranks given as a permutation of 1..10 for the new order. */
function tenPlayers(previousRanks: number[]): LeaderboardSnapshot {
  return {
    updateId: 1,
    fieldSize: 10,
    entries: entries(previousRanks.map((prev, i) => [`p${prev}`, 1000 - i * 100, i + 1, prev] as [string, number, number, number])),
  };
}

describe('movement classification', () => {
  const cfg = DEFAULT_LEADERBOARD_CONFIG;
  it.each([
    [5, 4, { kind: 'up', positions: 1, tier: 'small' }],
    [5, 3, { kind: 'up', positions: 2, tier: 'medium' }],
    [5, 2, { kind: 'up', positions: 3, tier: 'medium' }],
    [8, 4, { kind: 'up', positions: 4, tier: 'major' }],
    [10, 4, { kind: 'up', positions: 6, tier: 'major' }],
    [10, 3, { kind: 'up', positions: 7, tier: 'legendary' }],
    [10, 1, { kind: 'up', positions: 9, tier: 'legendary' }],
    [4, 5, { kind: 'down', positions: 1, tier: 'minor' }],
    [2, 5, { kind: 'down', positions: 3, tier: 'medium' }],
    [1, 6, { kind: 'down', positions: 5, tier: 'major' }],
    [1, 10, { kind: 'down', positions: 9, tier: 'epic' }],
    [1, 1, { kind: 'same', context: 'champion' }],
    [4, 4, { kind: 'same', context: 'steady' }],
    [null, 3, { kind: 'new' }],
  ] as [number | null, number, Movement][])('%s → %s', (prev, rank, expected) => {
    expect(classifyMovement(prev, rank, cfg)).toEqual(expected);
  });

  it('uses configurable thresholds', () => {
    const cfg2 = makeConfig({
      tiers: [
        { maxPositions: 2, up: 'small', down: 'minor' },
        { maxPositions: Number.POSITIVE_INFINITY, up: 'legendary', down: 'epic' },
      ],
    });
    expect(classifyMovement(5, 3, cfg2)).toEqual({ kind: 'up', positions: 2, tier: 'small' });
    expect(classifyMovement(5, 2, cfg2)).toEqual({ kind: 'up', positions: 3, tier: 'legendary' });
  });

  it('orders rows by previous rank with new students last', () => {
    const e = entries([
      ['a', 900, 1, 3],
      ['new', 800, 2, null],
      ['b', 700, 3, 1],
      ['c', 600, 4, 2],
    ]);
    expect(previousOrder(e)).toEqual(['b', 'c', 'a', 'new']);
  });
});

describe('theme library and selection', () => {
  it('has exactly 20 original themes: 8 up, 7 down, 5 idle', () => {
    expect(THEMES).toHaveLength(20);
    expect(THEMES.filter((t) => t.category === 'up')).toHaveLength(8);
    expect(THEMES.filter((t) => t.category === 'down')).toHaveLength(7);
    expect(THEMES.filter((t) => t.category === 'idle')).toHaveLength(5);
  });

  it('every movement tier has at least two themes to choose from', () => {
    const cases: Movement[] = [
      ...(['small', 'medium', 'major', 'legendary'] as const).map((tier) => ({ kind: 'up', positions: 1, tier }) as Movement),
      ...(['minor', 'medium', 'major', 'epic'] as const).map((tier) => ({ kind: 'down', positions: 1, tier }) as Movement),
      { kind: 'same', context: 'champion' },
      { kind: 'same', context: 'steady' },
      { kind: 'new' },
    ];
    for (const m of cases) expect(eligibleThemes(m).length, JSON.stringify(m)).toBeGreaterThanOrEqual(2);
  });

  it('picks only themes of the right category and intensity', () => {
    const rng = seeded();
    for (let i = 0; i < 50; i++) {
      const up = selectTheme({ kind: 'up', positions: 9, tier: 'legendary' }, [], rng);
      expect(['superhero', 'rocket', 'dragon-flight', 'evolution']).toContain(up);
      const down = selectTheme({ kind: 'down', positions: 1, tier: 'minor' }, [], rng);
      expect(['banana', 'volcano']).toContain(down);
    }
  });

  it("avoids a student's last three themes when alternatives exist", () => {
    const rng = seeded(7);
    const movement: Movement = { kind: 'up', positions: 4, tier: 'major' }; // 6 eligible
    for (let i = 0; i < 100; i++) {
      const recent = ['superhero', 'rocket', 'ninja'] as const;
      expect(recent).not.toContain(selectTheme(movement, recent, rng));
    }
  });

  it('repeats only when every eligible theme was used recently', () => {
    const t = selectTheme({ kind: 'down', positions: 1, tier: 'minor' }, ['banana', 'volcano'], seeded());
    expect(['banana', 'volcano']).toContain(t);
  });

  it('falls back when themes fail or none fit', () => {
    const failed = new Set(['banana', 'volcano'] as const);
    expect(selectTheme({ kind: 'down', positions: 1, tier: 'minor' }, [], seeded(), failed)).toBe('fallback');
  });
});

describe('special events', () => {
  const cfg = DEFAULT_LEADERBOARD_CONFIG;

  it('detects a 10th-to-1st legendary comeback and the champion takeover', () => {
    const snap = tenPlayers([10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const events = detectEvents(snap.entries, cfg, 10);
    expect(events).toContainEqual({ type: 'legendary-comeback', participantId: 'p10', from: 10 });
    expect(events).toContainEqual({ type: 'champion-takeover', participantId: 'p10', fromParticipantIds: ['p1'] });
    expect(events.some((e) => e.type === 'champion-defence')).toBe(false);
  });

  it('detects a champion defence', () => {
    const snap = tenPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(detectEvents(snap.entries, cfg, 10)).toContainEqual({ type: 'champion-defence', participantId: 'p1' });
  });

  it('reports near misses, rivalries and streaks from real gaps only', () => {
    const e = entries([
      ['a', 2000, 1, 1, { streak: 4 }],
      ['b', 1999, 2, 2],
      ['c', 1900, 3, 3],
      ['d', 1000, 4, 4],
      ['e', 1000, 4, 5],
    ]);
    const events = detectEvents(e, cfg, 5);
    expect(events).toContainEqual({ type: 'near-miss', participantId: 'b', aheadId: 'a', gap: 1 });
    expect(events).toContainEqual({ type: 'rivalry', participantIds: ['b', 'c'], gap: 99 });
    expect(events).toContainEqual({ type: 'streak', participantId: 'a', streak: 4 });
    // Equal scores are not a near miss, and a 900-point gap is not a rivalry.
    expect(events.some((x) => x.type === 'near-miss' && x.participantId === 'e')).toBe(false);
    expect(events.some((x) => x.type === 'rivalry' && x.participantIds.includes('d') && x.participantIds.includes('c'))).toBe(false);
    expect(nearMissMessage(1)).toBe('Just 1 point away!');
  });

  it('reports nothing about history on the first scored question', () => {
    const e = entries([
      ['a', 1000, 1, null],
      ['b', 0, 2, null],
    ]);
    const types = detectEvents(e, cfg, 2).map((x) => x.type);
    expect(types).not.toContain('champion-takeover');
    expect(types).not.toContain('champion-defence');
  });
});

describe('LeaderboardEngine', () => {
  it('plans an animation for every one of 10 students, staggered 80–120 ms', () => {
    const engine = new LeaderboardEngine(DEFAULT_LEADERBOARD_CONFIG, seeded());
    const result = engine.apply(tenPlayers([3, 1, 2, 7, 5, 4, 10, 6, 8, 9]));
    expect(result.status).toBe('planned');
    const plan = result.plan!;
    expect(Object.keys(plan.rows)).toHaveLength(10);
    const delays = plan.fromOrder.map((id) => plan.rows[id].delayMs);
    expect(delays[0]).toBe(DEFAULT_LEADERBOARD_CONFIG.timeline.charactersAtMs);
    for (let i = 1; i < delays.length; i++) {
      const step = delays[i] - delays[i - 1];
      expect(step).toBeGreaterThanOrEqual(80);
      expect(step).toBeLessThanOrEqual(120);
    }
    // Movers get movement themes, holders get idle themes.
    expect(plan.rows.p7.movement).toMatchObject({ kind: 'up', positions: 3 });
    expect(THEMES.find((t) => t.id === plan.rows.p7.theme)?.category).toBe('up');
    expect(plan.rows.p1.movement).toMatchObject({ kind: 'down', positions: 1 });
    expect(plan.rows.p5.movement).toEqual({ kind: 'same', context: 'steady' });
    expect(THEMES.find((t) => t.id === plan.rows.p5.theme)?.category).toBe('idle');
  });

  it('handles a 1st-to-10th fall and all 10 holding their positions', () => {
    const engine = new LeaderboardEngine(DEFAULT_LEADERBOARD_CONFIG, seeded());
    const fall = engine.apply({ ...tenPlayers([2, 3, 4, 5, 6, 7, 8, 9, 10, 1]), updateId: 1 }).plan!;
    expect(fall.rows.p1.movement).toEqual({ kind: 'down', positions: 9, tier: 'epic' });
    expect(['titanic', 'throne', 'tornado', 'meteor']).toContain(fall.rows.p1.theme);

    const hold = engine.apply({ ...tenPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), updateId: 2 }).plan!;
    expect(Object.values(hold.rows).every((r) => r.movement.kind === 'same')).toBe(true);
    expect(hold.rows.p1.movement).toEqual({ kind: 'same', context: 'champion' });
    expect(hold.fromOrder).toEqual(hold.toOrder);
  });

  it('keeps the authoritative order and scores: the engine only reads them', () => {
    const engine = new LeaderboardEngine();
    const snap = tenPlayers([10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    snap.entries[0].lastPoints = 900;
    const before = JSON.stringify(snap);
    const plan = engine.apply(snap).plan!;
    expect(JSON.stringify(snap)).toBe(before);
    expect(plan.toOrder).toEqual(snap.entries.map((e) => e.participantId));
    expect(plan.rows.p10).toMatchObject({ score: 1000, previousScore: 100, fromRank: 10, rank: 1 });
  });

  it('ignores duplicate and older updates, and lets a newer update supersede', () => {
    const engine = new LeaderboardEngine();
    expect(engine.apply({ ...tenPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), updateId: 5 }).status).toBe('planned');
    expect(engine.apply({ ...tenPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), updateId: 5 }).status).toBe('duplicate');
    expect(engine.apply({ ...tenPlayers([2, 1, 3, 4, 5, 6, 7, 8, 9, 10]), updateId: 3 }).status).toBe('stale');
    expect(engine.apply({ ...tenPlayers([2, 1, 3, 4, 5, 6, 7, 8, 9, 10]), updateId: 7 }).status).toBe('planned');
    expect(engine.currentUpdateId).toBe(7);
  });

  it('remembers history across rapid consecutive updates and never repeats within three', () => {
    const engine = new LeaderboardEngine(DEFAULT_LEADERBOARD_CONFIG, seeded(3));
    const seen: string[] = [];
    for (let i = 1; i <= 12; i++) {
      // p5 climbs four places every time → 'major' up (6 themes available).
      const plan = engine.apply({
        updateId: i,
        fieldSize: 10,
        entries: entries([
          ['p5', 1000, 1, 5],
          ['p1', 900, 2, 1],
          ['p2', 800, 3, 2],
          ['p3', 700, 4, 3],
          ['p4', 600, 5, 4],
        ]),
      }).plan!;
      seen.push(plan.rows.p5.theme);
    }
    for (let i = 3; i < seen.length; i++) {
      expect(seen.slice(i - 3, i)).not.toContain(seen[i]);
    }
  });

  it('stops choosing a theme after it fails to render', () => {
    const engine = new LeaderboardEngine(DEFAULT_LEADERBOARD_CONFIG, seeded());
    engine.reportThemeFailure('banana');
    engine.reportThemeFailure('volcano');
    const plan = engine.apply({
      updateId: 1,
      fieldSize: 2,
      entries: entries([
        ['b', 900, 1, 2],
        ['a', 800, 2, 1],
      ]),
    }).plan!;
    expect(plan.rows.a.theme).toBe('fallback');
  });

  it('shows at most the configured number of rows', () => {
    const engine = new LeaderboardEngine(makeConfig({ visibleRows: 5 }));
    const plan = engine.apply(tenPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).plan!;
    expect(plan.toOrder).toHaveLength(5);
  });
});
