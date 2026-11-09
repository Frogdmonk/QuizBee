import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ARENA, CLASS_ZONE, formation } from '@/lib/battle/formation';
import { MAX_SHOTS, planAttack } from '@/lib/battle/choreography';
import { battleStage, hitSeverity } from '@/lib/battle/monster';
import { BattleAnnounce } from '@/components/battle/BattleAnnounce';
import { autoMonsterHp } from '@/lib/battle/hp';
import { activeBattle, chargingNote, currentRules, modeTimer, revealAttack } from '@/lib/battle/state';
import { DEFAULT_BATTLE_CONFIG, toBattle } from '@/services/game';
import { BattleArena } from '@/components/battle/BattleArena';
import { PhoneBattleCard } from '@/components/battle/PhoneBattleCard';
import type { BattleAttack, BattleState, GameState } from '@/types/game';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p-${String(i).padStart(3, '0')}`);

describe('arena formation', () => {
  it.each([1, 5, 30, 60, 100])('%i students fit in the class half without overlapping', (n) => {
    const spots = formation(n);
    expect(spots).toHaveLength(n);
    for (const s of spots) {
      expect(s.x - s.size / 2).toBeGreaterThanOrEqual(CLASS_ZONE.x0 - 0.5);
      expect(s.x + s.size / 2).toBeLessThanOrEqual(CLASS_ZONE.x1 + 0.5);
      expect(s.y - s.size / 2).toBeGreaterThanOrEqual(CLASS_ZONE.y0 - 0.5);
      expect(s.y + s.size / 2).toBeLessThanOrEqual(CLASS_ZONE.y1 + 0.5);
      expect(s.x).toBeLessThan(ARENA.width / 2);
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y);
        expect(d).toBeGreaterThanOrEqual(spots[i].size * 0.99);
      }
  });

  it('avatars stay recognisable: at least ~50 px in the 1600 px world even with 100 students', () => {
    expect(formation(30)[0].size).toBeGreaterThan(80);
    expect(formation(100)[0].size).toBeGreaterThan(50);
  });
});

describe('attack choreography', () => {
  it('is the same on every screen, and differs per question', () => {
    expect(planAttack(ids(30), 'q1')).toEqual(planAttack(ids(30), 'q1'));
    expect(planAttack(ids(30), 'q1')).not.toEqual(planAttack(ids(30), 'q2'));
  });

  it('every attacker swings at their own moment, within about three seconds', () => {
    const plan = planAttack(ids(30), 'q1');
    expect(plan.swings).toHaveLength(30);
    expect(new Set(plan.swings.map((s) => s.delayMs)).size).toBeGreaterThan(20); // not one copy-pasted block
    expect(plan.totalMs).toBeLessThan(3600);
    expect(plan.firstImpactMs).toBeLessThanOrEqual(plan.lastImpactMs);
    expect(new Set(plan.shots.map((s) => s.kind)).size).toBeGreaterThan(1);
  });

  it('a big class caps the projectiles but still counts every hit', () => {
    const plan = planAttack(ids(100), 'q1');
    expect(plan.swings).toHaveLength(100);
    expect(plan.shots).toHaveLength(MAX_SHOTS);
    expect(plan.shots.reduce((a, s) => a + s.weight, 0)).toBe(100);
  });

  it('nobody correct: no attack, a short pause', () => {
    expect(planAttack([], 'q1')).toMatchObject({ swings: [], shots: [] });
  });
});

describe('monster state', () => {
  it('stages follow HP: >70% calm, >30% rage, >0 enraged, 0 defeated', () => {
    expect(battleStage(1000, 1000)).toBe('normal');
    expect(battleStage(710, 1000)).toBe('normal');
    expect(battleStage(700, 1000)).toBe('rage');
    expect(battleStage(310, 1000)).toBe('rage');
    expect(battleStage(300, 1000)).toBe('enraged');
    expect(battleStage(1, 1000)).toBe('enraged');
    expect(battleStage(0, 1000)).toBe('defeated');
    // The teacher's thresholds.
    expect(battleStage(720, 1000, { rageAt: 75, enragedAt: 25 })).toBe('rage');
    expect(battleStage(260, 1000, { rageAt: 75, enragedAt: 25 })).toBe('rage');
    expect(battleStage(250, 1000, { rageAt: 75, enragedAt: 25 })).toBe('enraged');
  });

  it('big hits stagger, small ones flinch, none does nothing', () => {
    expect(hitSeverity(0, 1000)).toBe('none');
    expect(hitSeverity(30, 1000)).toBe('hit');
    expect(hitSeverity(90, 1000)).toBe('stagger');
  });

  it('the lobby estimate matches the server formula', () => {
    expect(autoMonsterHp(10, 3, 3)).toBe(60); // same case as the DB test
    expect(autoMonsterHp(30, 10, 3)).toBe(630);
    expect(autoMonsterHp(1, 1, 1)).toBe(50);
  });
});

const attack: BattleAttack = {
  questionId: 'q1', position: 0, eligible: 4, correct: 3, accuracy: 75, attackers: ['a', 'b', 'c'], damage: 9, hpBefore: 100, hpAfter: 91,
  mode: null, targetPct: null, targetCount: null, defended: null, heal: 0,
  unlocked: false, weapon: null, perHit: null, weaponBonus: 0, burn: 0, special: null, frozen: false, energyGain: 0, energyReasons: [], shielded: false, lightning: 0, rally: false, scan: false, boosted: 0,
};
const battle: BattleState = {
  enabled: true, monster: 'gloomjaw', hpSetting: null, baseDamage: 3, maxHp: 100, hp: 91, config: DEFAULT_BATTLE_CONFIG, current: null, energy: 0, armed: { shield: null, lightning: null, rally: null, scan: null }, draftPosition: null, weapon: null, vote: null, last: attack,
};

describe('battle state from the server', () => {
  it('parses the payload (accuracy may arrive as a string)', () => {
    expect(
      toBattle({
        enabled: true, monster: 'gloomjaw', hp_setting: null, base_damage: 3, max_hp: 100, hp: 91,
        last: { question_id: 'q1', position: 0, eligible: 4, correct: 3, accuracy: '75.00', attackers: ['a', 'b', 'c'], damage: 9, hp_before: 100, hp_after: 91 },
      }),
    ).toEqual(battle);
    expect(toBattle(null)).toBeNull();
  });

  it('parses the modes: config, the current question’s rules and the special-attack result', () => {
    const b = toBattle({
      enabled: true, monster: 'gloomjaw', hp_setting: null, base_damage: 3, max_hp: 1000, hp: 635,
      config: {
        intensity: 'fierce', mode_timers: true, rage_at: 75, enraged_at: 25,
        targets: { normal: 60, rage: 70, enraged: 80 }, heal: { normal: 5, rage: 8, enraged: 12 }, timers: { normal: null, rage: 10, enraged: 15 },
      },
      current: { question_id: 'q2', mode: 'rage', target_pct: 70, target_count: 7, announce: 'rage' },
      last: {
        question_id: 'q1', position: 0, eligible: 10, correct: 5, accuracy: 50, attackers: [], damage: 15, hp_before: 600, hp_after: 635,
        mode: 'rage', target_pct: 60, target_count: 6, defended: false, heal: 50,
      },
    })!;
    expect(b.config).toMatchObject({ intensity: 'fierce', modeTimers: true, rageAt: 75, enragedAt: 25 });
    expect(b.current).toMatchObject({ questionId: 'q2', mode: 'rage', targetPct: 70, targetCount: 7, announce: 'rage', draft: false, hiddenOptionId: null });
    expect(b.last).toMatchObject({ mode: 'rage', targetCount: 6, defended: false, heal: 50 });
  });

  it('the question’s rules, the HUD note and the battle timer', () => {
    const rules = { questionId: 'q1', mode: 'rage' as const, targetPct: 60, targetCount: 18, announce: null, draft: false, hiddenOptionId: null, timeWarpS: 0, powerupsUsed: 0, topic: null };
    const s = { battle: { ...battle, current: rules }, question: { id: 'q1' }, session: { phase: 'question' } } as unknown as GameState;
    expect(currentRules(s)).toBe(rules);
    expect(currentRules({ ...s, question: { id: 'q9' } } as unknown as GameState)).toBeNull();
    expect(chargingNote(rules, 30)).toBe('⚡ Riddle Roar charging · 18 of 30 correct needed');
    expect(chargingNote({ ...rules, mode: 'defeated', targetCount: null }, 30)).toBeNull();
    expect(modeTimer(battle, 'rage')).toBeNull(); // timers off
    expect(modeTimer({ ...battle, config: { ...DEFAULT_BATTLE_CONFIG, modeTimers: true } }, 'rage')).toBe(10);
    expect(modeTimer({ ...battle, config: { ...DEFAULT_BATTLE_CONFIG, modeTimers: true } }, 'normal')).toBeNull(); // the question's own
  });

  it('only a started, switched-on battle is active, and only the current question’s attack plays', () => {
    const s = { battle, question: { id: 'q1' }, session: { phase: 'reveal' } } as unknown as GameState;
    expect(activeBattle(s)).not.toBeNull();
    expect(revealAttack(s)).toBe(attack);
    expect(revealAttack({ ...s, session: { phase: 'leaderboard' } } as unknown as GameState)).toBeNull();
    expect(revealAttack({ ...s, question: { id: 'q2' } } as unknown as GameState)).toBeNull();
    expect(activeBattle({ ...s, battle: { ...battle, enabled: false } } as GameState)).toBeNull();
    expect(activeBattle({ ...s, battle: { ...battle, maxHp: null, hp: null } } as GameState)).toBeNull();
  });
});

describe('battle screens', () => {
  // jsdom has no ResizeObserver (every browser does); the arena only uses it to scale itself.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, avatar: '000000000', nickname: `Name ${id}` }));

  it('the arena shows the monster, its health and every student, without names', () => {
    render(<BattleArena battle={battle} players={players} attack={attack} />);
    expect(screen.getByRole('img', { name: /Gloomjaw/ })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Monster health' })).toHaveAttribute('aria-valuemax', '100');
    expect(screen.queryByText('Name a')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.ba-hero')).toHaveLength(4);
    expect(document.querySelectorAll('.ba-hero[data-act="attack"]')).toHaveLength(3);
    expect(document.querySelectorAll('.ba-hero[data-act="cheer"]')).toHaveLength(1);
  });

  describe('the special attack in the reveal', () => {
    afterEach(() => vi.useRealTimers());
    const rage = (defended: boolean): BattleAttack => ({
      ...attack, eligible: 4, correct: defended ? 3 : 1, attackers: defended ? ['a', 'b', 'c'] : ['a'], damage: defended ? 9 : 3,
      hpBefore: 60, hpAfter: defended ? 51 : 62, mode: 'rage', targetPct: 60, targetCount: 3, defended, heal: defended ? 0 : 5,
    });

    it('stopped: a green banner, HP only goes down', () => {
      vi.useFakeTimers();
      render(<BattleArena battle={{ ...battle, hp: 51 }} players={players} attack={rage(true)} />);
      act(() => void vi.advanceTimersByTime(6000));
      expect(screen.getByRole('status')).toHaveTextContent('Riddle Roar stopped!');
      expect(screen.getByRole('status')).toHaveTextContent('3 of 4 correct · 3 needed');
      expect(screen.getByRole('meter', { name: 'Monster health' })).toHaveAttribute('aria-valuenow', '51');
    });

    it('missed: the hits land first (HP 57), then the counter-attack heals it to 62', () => {
      vi.useFakeTimers();
      render(<BattleArena battle={{ ...battle, hp: 62 }} players={players} attack={rage(false)} />);
      const meter = () => screen.getByRole('meter', { name: 'Monster health' });
      expect(meter()).toHaveAttribute('aria-valuenow', '60');
      act(() => void vi.advanceTimersByTime(2000));
      expect(meter()).toHaveAttribute('aria-valuenow', '57');
      expect(screen.getByRole('status')).toHaveTextContent('Riddle Roar!');
      expect(screen.getByRole('status')).toHaveTextContent('heals 5 HP');
      // One attacker lands between 1.3 s and 1.65 s, so 2.7 s is always inside the counter-attack.
      act(() => void vi.advanceTimersByTime(700));
      expect(document.querySelectorAll('.ba-hero[data-act="brace"]')).toHaveLength(4);
      act(() => void vi.advanceTimersByTime(3300));
      expect(meter()).toHaveAttribute('aria-valuenow', '62');
      expect(screen.getByText('+5 HP')).toBeInTheDocument();
    });

    it('the phone explains it too', () => {
      const { rerender } = render(<PhoneBattleCard attack={rage(true)} monster="gloomjaw" maxHp={100} baseDamage={3} me={{ participantId: 'a', avatar: '000000000' }} />);
      expect(screen.getByText('Your class stopped the Riddle Roar!')).toBeInTheDocument();
      rerender(<PhoneBattleCard attack={rage(false)} monster="gloomjaw" maxHp={100} baseDamage={3} me={{ participantId: 'a', avatar: '000000000' }} />);
      expect(screen.getByText('The Riddle Roar hit back (3 needed): Gloomjaw healed 5 HP.')).toBeInTheDocument();
    });
  });

  it('the announcement says what the class must do', () => {
    render(
      <BattleAnnounce
        battle={{ ...battle, maxHp: 100, hp: 60 }}
        current={{ questionId: 'q1', mode: 'rage', targetPct: 60, targetCount: 18, announce: 'rage', draft: false, hiddenOptionId: null, timeWarpS: 0, powerupsUsed: 0, topic: null }}
        eligible={30}
        timerSeconds={10}
        remainingMs={4200}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Gloomjaw is in a RAGE!');
    expect(screen.getByText(/18 of 30 must answer correctly to stop the Riddle Roar/)).toBeInTheDocument();
    expect(screen.getByText('10 seconds per question.')).toBeInTheDocument();
  });

  it('the phone says whether my answer hit, and never names anyone else', () => {
    const { rerender } = render(<PhoneBattleCard attack={attack} monster="gloomjaw" maxHp={100} baseDamage={3} me={{ participantId: 'a', avatar: '000000000' }} />);
    expect(screen.getByText(/Your attack hit Gloomjaw/)).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 got it right/)).toBeInTheDocument();
    rerender(<PhoneBattleCard attack={attack} monster="gloomjaw" maxHp={100} baseDamage={3} me={{ participantId: 'd', avatar: '000000000' }} />);
    expect(screen.getByText(/Your class hit Gloomjaw/)).toBeInTheDocument();
  });
});
