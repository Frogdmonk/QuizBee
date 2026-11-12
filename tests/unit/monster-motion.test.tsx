import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Monster } from '@/components/battle/Monster';
import { ARCHETYPES } from '@/lib/monsters/archetypes';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { catalogueMonster, generateMonster } from '@/lib/monsters/generate';
import { DEFEATS, MONSTER_STATES, MOTIONS, monsterState, motionFor, WEAKENED_AT } from '@/lib/monsters/motion';
import type { MonsterSpec } from '@/lib/monsters/types';

afterEach(cleanup);

const named = (id: string): MonsterSpec => catalogueMonster(CATALOGUE.find((e) => e.id === id)!);

describe('the state machine', () => {
  it('turns the battle (stage, action, HP) into one of the brief’s states', () => {
    expect(monsterState('normal')).toBe('idle');
    expect(monsterState('normal', 'brewing')).toBe('preparing');
    expect(monsterState('rage', 'charge')).toBe('attacking');
    expect(monsterState('normal', 'attack')).toBe('attacking');
    expect(monsterState('normal', 'taking')).toBe('damaged');
    expect(monsterState('enraged', 'stagger')).toBe('damaged');
    expect(monsterState('normal', 'defend')).toBe('defending');
    expect(monsterState('rage', 'heal')).toBe('recovering');
    expect(monsterState('rage')).toBe('rage');
    expect(monsterState('enraged')).toBe('enraged');
    expect(monsterState('enraged', 'idle', 0.1)).toBe('weakened');
    expect(monsterState('enraged', 'idle', WEAKENED_AT + 0.01)).toBe('enraged');
    expect(monsterState('normal', 'stunned')).toBe('stunned');
    expect(monsterState('defeated')).toBe('defeated');
    expect(monsterState('normal', 'defeat')).toBe('defeated');
    // Damage and attacks show even when the monster is weakened.
    expect(monsterState('enraged', 'hit', 0.05)).toBe('damaged');
  });
});

describe('motions', () => {
  it('every archetype names a real motion for every state (no silent fallbacks)', () => {
    for (const a of ARCHETYPES) {
      for (const [slot, name] of Object.entries(a.animations)) {
        const table = slot === 'defeat' ? DEFEATS : MOTIONS;
        expect(table[name], `${a.id}.${slot} = ${name}`).toBeDefined();
      }
    }
  });

  it('different archetypes move differently in the same state', () => {
    const attacks = new Set(['ashfang', 'morvexa', 'stonebreaker', 'nightveil', 'tidecoil', 'gravefang'].map((id) => motionFor(named(id), 'attacking').animation.split(' ')[0]));
    expect(attacks.size).toBeGreaterThanOrEqual(4);
    expect(motionFor(named('ashfang'), 'attacking').fx).toBe('breath');
    expect(motionFor(named('stonebreaker'), 'attacking').fx).toBe('ring');
    expect(motionFor(named('morvexa'), 'preparing').fx).toBe('runes');
    expect(motionFor(named('stonebreaker'), 'idle').fx).toBe('pebbles');
    expect(motionFor(named('hollow-king'), 'defending').fx).toBe('shield');
    expect(motionFor(named('obsidian-colossus'), 'defeated').name).toBe('crumble');
    expect(motionFor(named('nightveil'), 'defeated').name).toBe('evaporate');
  });

  it('personality sets the pace of looping motions; one-shots keep the battle’s timing', () => {
    const sleepy = { ...named('frostjaw'), personality: 'sleepy' as const };
    const furious = { ...sleepy, personality: 'furious' as const };
    const ms = (s: MonsterSpec, st: Parameters<typeof motionFor>[1]) => Number(motionFor(s, st).animation.split(' ')[1].replace('ms', ''));
    expect(ms(sleepy, 'idle')).toBeGreaterThan(ms(furious, 'idle'));
    expect(ms(sleepy, 'attacking')).toBe(ms(furious, 'attacking'));
    expect(ms(furious, 'enraged')).toBeLessThan(ms(furious, 'rage'));
    expect(motionFor(furious, 'idle').loop).toBe(true);
    expect(motionFor(furious, 'attacking').animation).toMatch(/ 1 both$/);
  });

  it('taking hits keeps the arena’s jitter and a heavy blow its knock-back, on every body', () => {
    const spec = named('tidecoil');
    expect(motionFor(spec, 'damaged', 'taking').animation).toMatch(/^mon-taking 180ms/);
    expect(motionFor(spec, 'damaged', 'stagger').animation).toMatch(/^mon-stagger 1000ms/);
    expect(motionFor(spec, 'damaged', 'hit').animation).toMatch(/^mm-recoil/);
    expect(motionFor(spec, 'damaged', 'stagger').name).toBe('recoil');
  });

  it('an archetype with an unknown motion name falls back to the state’s default', () => {
    const spec = { ...named('ashfang'), archetype: 'not-a-thing' };
    expect(motionFor(spec, 'attacking').name).toBe('default');
    expect(motionFor(spec, 'attacking').animation).toMatch(/^mm-lunge/);
  });
});

describe('the monster on screen', () => {
  it('shows its state, motion and effect; weakened at low HP; every state draws for every archetype', () => {
    const { container, rerender } = render(<Monster monster={named('ashfang')} stage="rage" action="charge" />);
    const root = () => container.querySelector('.mon-rig') as HTMLElement;
    expect(root().dataset.state).toBe('attacking');
    expect(root().dataset.motion).toBe('breath');
    expect(root().style.getPropertyValue('--m-anim')).toMatch(/^mm-lunge/);
    expect(container.querySelector('.fx-breath')).not.toBeNull();

    rerender(<Monster monster={named('ashfang')} stage="enraged" hpFraction={0.08} />);
    expect(root().dataset.state).toBe('weakened');
    expect(container.querySelector('.fx-drip')).not.toBeNull();

    rerender(<Monster monster={named('hollow-king')} stage="normal" state="defending" />);
    expect(container.querySelector('.fx-shield')).not.toBeNull();
    cleanup();

    for (const a of ARCHETYPES.filter((x) => x.rig !== 'blob')) {
      let spec: MonsterSpec | null = null;
      for (let seed = 0; !spec; seed++) {
        const s = generateMonster({ seed });
        if (s.archetype === a.id) spec = s;
      }
      for (const state of MONSTER_STATES) {
        const { container: c } = render(<Monster monster={spec} stage="rage" state={state} />);
        expect((c.querySelector('.mon-rig') as HTMLElement).dataset.state, `${a.id} ${state}`).toBe(state);
        cleanup();
      }
    }
  }, 30_000);
});
