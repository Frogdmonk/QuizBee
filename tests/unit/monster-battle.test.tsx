import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { BattleArena } from '@/components/battle/BattleArena';
import { BattleAnnounce } from '@/components/battle/BattleAnnounce';
import { BattleResult } from '@/components/battle/BattleResult';
import { CampScenery } from '@/components/lobby/CampScenery';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { catalogueMonster } from '@/lib/monsters/generate';
import { battleLine, PERSONALITIES } from '@/lib/monsters/personality';
import { isWeakSpot, reactionLine, reactionMoment, superEffective, WEAPON_ELEMENT, weakSpotNote, weaknessText, type AttackResult } from '@/lib/monsters/reactions';
import { DEFAULT_BATTLE_CONFIG } from '@/services/game';
import type { MonsterSpec } from '@/lib/monsters/types';
import type { BattleAttack, BattleState } from '@/types/game';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const named = (id: string): MonsterSpec => catalogueMonster(CATALOGUE.find((e) => e.id === id)!);
const ashfang = { ...named('ashfang'), weakness: { element: 'ice' as const, topic: 'Loops' } };
const result = (patch: Partial<AttackResult>): AttackResult => ({ position: 2, accuracy: 55, hpBefore: 500, hpAfter: 440, defended: null, mode: 'normal', ...patch });

describe('reactions to the class', () => {
  it('reads the moment from the server’s result', () => {
    expect(reactionMoment(result({ hpAfter: 0 }), 600)).toBe('defeated');
    expect(reactionMoment(result({ hpBefore: 120, hpAfter: 80 }), 600)).toBe('weakened');
    expect(reactionMoment(result({ defended: true, mode: 'enraged' }), 600)).toBe('comeback');
    expect(reactionMoment(result({ defended: false, mode: 'rage' }), 600)).toBe('classWeak');
    expect(reactionMoment(result({ defended: true, mode: 'rage' }), 600)).toBe('classStrong');
    expect(reactionMoment(result({ accuracy: 85 }), 600)).toBe('classStrong');
    expect(reactionMoment(result({ accuracy: 20 }), 600)).toBe('classWeak');
    expect(reactionMoment(result({ accuracy: 55 }), 600)).toBeNull();
  });

  it('every screen picks the same line, in the monster’s own personality', () => {
    const line = reactionLine(ashfang, result({ defended: false, mode: 'rage' }), 600);
    expect(line).toBe(reactionLine(ashfang, result({ defended: false, mode: 'rage' }), 600));
    expect(PERSONALITIES.arrogant.lines.classWeak).toContain(line);
    expect(reactionLine(ashfang, result({ accuracy: 55 }), 600)).toBeNull();
  });

  it('a weapon of the element it fears is super effective; the weak spot is one of the quiz’s topics', () => {
    expect(WEAPON_ELEMENT.frost).toBe('ice');
    expect(superEffective(ashfang, 'frost')).toBe(true);
    expect(superEffective(ashfang, 'inferno')).toBe(false);
    expect(superEffective(ashfang, null)).toBe(false);
    expect(isWeakSpot(ashfang, { topic: 'loops', objective: null })).toBe(true);
    expect(isWeakSpot(ashfang, { topic: null, objective: 'Loops' })).toBe(true);
    expect(isWeakSpot(ashfang, { topic: 'Functions', objective: 'Recursion' })).toBe(false);
    expect(isWeakSpot({ ...ashfang, weakness: { element: 'ice', topic: null } }, { topic: 'Loops' })).toBe(false);
    expect(weakSpotNote(ashfang, { topic: 'Loops' })).toBe('🎯 Weak spot! Ashfang is weak to questions on Loops');
    expect(weaknessText(ashfang)).toBe('Ice, and questions on Loops');
  });
});

describe('the monster in the battle', () => {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, avatar: '000000000', nickname: `Name ${id}` }));
  const base: BattleAttack = {
    questionId: 'q3', position: 2, eligible: 4, correct: 1, accuracy: 25, attackers: ['a'], damage: 3, hpBefore: 60, hpAfter: 62,
    mode: 'rage', targetPct: 60, targetCount: 3, defended: false, heal: 5,
    unlocked: false, weapon: null, perHit: null, weaponBonus: 0, burn: 0, special: null, frozen: false, energyGain: 0, energyReasons: [], shielded: false, lightning: 0, rally: false, scan: false, boosted: 0,
  };
  const battle: BattleState = {
    enabled: true, monster: ashfang.id, monsterSpec: ashfang, hpSetting: null, baseDamage: 3, maxHp: 100, hp: 62, config: DEFAULT_BATTLE_CONFIG, current: null, energy: 0,
    armed: { shield: null, lightning: null, rally: null, scan: null }, draftPosition: null, weapon: null, vote: null, last: base,
  };
  const state = () => (document.querySelector('.mon-rig') as HTMLElement).dataset.state;

  it('winning, it defends while the hits land, gathers itself, then attacks; it says so after', () => {
    vi.useFakeTimers();
    render(<BattleArena battle={battle} players={players} attack={base} sound={false} />);
    act(() => void vi.advanceTimersByTime(1400));
    expect(state()).toBe('defending');
    expect(document.querySelector('.fx-shield')).not.toBeNull();
    const plan = 1650 + 1100; // after the last impact the hits have landed
    act(() => void vi.advanceTimersByTime(plan - 1400 + 500));
    expect(['preparing', 'attacking', 'recovering']).toContain(state());
    act(() => void vi.advanceTimersByTime(6000));
    expect(document.querySelector('.mon-say')).toHaveTextContent(battleLine('arrogant', 'classWeak', ashfang.seed, 2));
  });

  it('losing, it takes the hits; a feared weapon is called super effective', () => {
    vi.useFakeTimers();
    const strong: BattleAttack = { ...base, correct: 4, accuracy: 100, attackers: ['a', 'b', 'c', 'd'], damage: 12, hpAfter: 48, defended: true, heal: 0, weapon: 'frost' };
    render(<BattleArena battle={{ ...battle, hp: 48 }} players={players} attack={strong} sound={false} weapon="frost" />);
    act(() => void vi.advanceTimersByTime(1400));
    expect(state()).toBe('damaged');
    act(() => void vi.advanceTimersByTime(6000));
    expect(screen.getByRole('status')).toHaveTextContent('Super effective! Ashfang fears this weapon.');
    expect(state()).toBe('stunned');
  });

  it('the announcement: it rises from the ground, introduces itself, and says what it fears', () => {
    render(
      <BattleAnnounce
        battle={{ ...battle, hp: 100, maxHp: 100 }}
        current={{ questionId: 'q1', mode: 'normal', targetPct: 50, targetCount: 2, announce: 'intro', draft: false, hiddenOptionId: null, timeWarpS: 0, powerupsUsed: 0, topic: null }}
        eligible={4}
        timerSeconds={null}
        remainingMs={4000}
      />,
    );
    expect(document.querySelector('.mon-spawn')).not.toBeNull();
    expect(screen.getByText(`“${battleLine('arrogant', 'intro', ashfang.seed)}”`)).toBeInTheDocument();
    expect(screen.getByText('Weak to: Ice, and questions on Loops')).toBeInTheDocument();
  });

  it('the result: its last words, and never a taunt when it escapes', () => {
    const { rerender } = render(<BattleResult monster={ashfang} hp={0} maxHp={100} />);
    expect(screen.getByText(`“${battleLine('arrogant', 'defeated', ashfang.seed)}”`)).toBeInTheDocument();
    rerender(<BattleResult monster={ashfang} hp={30} maxHp={100} />);
    expect(screen.getByText(`“${battleLine('arrogant', 'classStrong', ashfang.seed)}”`)).toBeInTheDocument();
  });

  it('in the camp, the session’s monster waits on the horizon (Gloomjaw keeps its silhouette)', () => {
    const { container, rerender } = render(<CampScenery lurker monster={ashfang} />);
    expect(container.querySelector('.camp-lurker')).not.toBeNull();
    // Scenery is decorative (hidden from screen readers); the label is still on the figure.
    expect(container.querySelector('[aria-label="Ashfang waits on the horizon"]')).not.toBeNull();
    expect(container.querySelector('.world-lurker-eye')).toBeNull();
    rerender(<CampScenery lurker monster={named('gloomjaw')} />);
    expect(container.querySelector('.camp-lurker')).toBeNull();
    expect(container.querySelector('.world-lurker-eye')).not.toBeNull();
    rerender(<CampScenery monster={ashfang} />);
    expect(container.querySelector('.camp-lurker')).toBeNull();
  });
});
