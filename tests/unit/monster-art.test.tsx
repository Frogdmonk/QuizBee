import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Monster, type MonsterAction } from '@/components/battle/Monster';
import { DRAWN_RIGS, RIGS } from '@/components/monsters/registry';
import { ARCHETYPES } from '@/lib/monsters/archetypes';
import { artFor, artState } from '@/lib/monsters/art';
import { catalogueMonster, generateMonster, partPools } from '@/lib/monsters/generate';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { paletteVars, shade } from '@/lib/monsters/colour';
import type { MonsterSpec } from '@/lib/monsters/types';
import type { BattleStage } from '@/lib/battle/monster';

afterEach(cleanup);

/** A spec of this archetype (generated, then given the part values we want to see). */
function specOf(archetypeId: string, parts: Record<string, string> = {}): MonsterSpec {
  for (let seed = 0; seed < 5000; seed++) {
    const spec = generateMonster({ seed });
    if (spec.archetype === archetypeId) return { ...spec, parts: { ...spec.parts, ...parts } };
  }
  throw new Error(`no ${archetypeId}`);
}

const STAGES: BattleStage[] = ['normal', 'rage', 'enraged', 'defeated'];
const ACTIONS: MonsterAction[] = ['idle', 'taking', 'hit', 'stagger', 'charge', 'heal', 'stunned', 'brewing', 'defeat'];

describe('monster bodies', () => {
  it('every body an archetype uses is drawn, so the generator never needs the fallback', () => {
    for (const a of ARCHETYPES) expect(DRAWN_RIGS.has(a.rig), a.id).toBe(true);
    expect(Object.keys(RIGS).sort()).toEqual(['beast', 'brute', 'caster', 'dragon', 'golem', 'phoenix', 'serpent', 'undead', 'wraith']);
  });

  it('every archetype draws every one of its part values, in its own body and palette', () => {
    for (const a of ARCHETYPES.filter((x) => x.rig !== 'blob')) {
      for (const element of a.elements) {
        for (const [key, values] of Object.entries(partPools(a, element))) {
          for (const value of values) {
            const spec = { ...specOf(a.id, { [key]: value }), element };
            const { container } = render(<Monster monster={spec} stage="normal" />);
            const root = container.querySelector('.mon-rig');
            expect(root, `${a.id} ${key}=${value}`).not.toBeNull();
            expect(root).toHaveAttribute('data-rig', a.rig);
            expect(root).toHaveAttribute('data-archetype', a.id);
            expect((root as HTMLElement).style.getPropertyValue('--m-main')).toBe(spec.palette.main);
            expect(container.querySelector('.mon-body')).not.toBeNull();
            cleanup();
          }
        }
      }
    }
  }, 30_000);

  it('every stage and action draws for every body; defeated shows crossed-out eyes', () => {
    for (const a of ARCHETYPES.filter((x) => x.rig !== 'blob')) {
      const spec = specOf(a.id);
      // Actions only switch CSS (data-action); every stage gets three, and one stage gets them all.
      const combos = [...STAGES.flatMap((stage) => (['idle', 'charge', 'stagger'] as const).map((action) => [stage, action] as const)), ...ACTIONS.map((action) => ['rage', action] as const)];
      for (const [stage, action] of combos) {
        const { container } = render(<Monster monster={spec} stage={stage} action={action} />);
        const root = container.querySelector('.mon-rig')!;
        expect(root.getAttribute('data-stage')).toBe(stage);
        expect(root.getAttribute('data-action')).toBe(action);
        if (stage === 'defeated') expect(container.querySelector('.rg-x'), `${a.id} defeated eyes`).not.toBeNull();
        cleanup();
      }
    }
  }, 30_000);

  it('is labelled for screen readers with the monster’s name and title (or the label given)', () => {
    const spec = catalogueMonster(CATALOGUE.find((e) => e.id === 'hollow-king')!);
    render(<Monster monster={spec} stage="normal" />);
    expect(screen.getByRole('img', { name: 'The Hollow King, Lord of the Silent Crypt' })).toBeInTheDocument();
    cleanup();
    render(<Monster monster={spec} stage="rage" label="The Hollow King, rage, 300 of 600 HP" />);
    expect(screen.getByRole('img', { name: 'The Hollow King, rage, 300 of 600 HP' })).toBeInTheDocument();
  });

  it('Gloomjaw, no monster, or a body that fails to draw all show the original monster', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, rerender } = render(<Monster stage="normal" />);
    expect(screen.getByRole('img', { name: 'Gloomjaw the monster' })).toBeInTheDocument();
    rerender(<Monster monster={catalogueMonster(CATALOGUE[0])} stage="normal" />);
    expect(container.querySelector('.mon-rig')).toBeNull();
    // A broken spec (no parts) makes the body throw: the boundary shows Gloomjaw instead.
    rerender(<Monster monster={{ ...specOf('dragon'), parts: null as unknown as Record<string, string> }} stage="normal" />);
    expect(screen.getByRole('img', { name: 'Gloomjaw the monster' })).toBeInTheDocument();
    errors.mockRestore();
  });
});

describe('artwork and colours', () => {
  it('maps battle moments to art states and falls back to idle art, then to the drawn body', () => {
    expect(artState('normal', 'idle')).toBe('idle');
    expect(artState('rage', 'idle')).toBe('rage');
    expect(artState('normal', 'charge')).toBe('attack');
    expect(artState('enraged', 'stagger')).toBe('damage');
    expect(artState('normal', 'idle', true)).toBe('weakened');
    expect(artState('defeated', 'idle')).toBe('defeat');
    const art = { ashfang: { idle: '/a/idle.webp', attack: '/a/attack.webp' } };
    expect(artFor('ashfang', 'attack', art)).toBe('/a/attack.webp');
    expect(artFor('ashfang', 'defeat', art)).toBe('/a/idle.webp');
    expect(artFor('nightveil', 'idle', art)).toBeNull();
  });

  it('derives the outline and highlight from the palette', () => {
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#336699', 0)).toBe('#336699');
    const vars = paletteVars({ main: '#2b2324', secondary: '#7a2e14', accent: '#ff8a1f', eye: '#ffc94d' }) as Record<string, string>;
    expect(vars['--m-accent']).toBe('#ff8a1f');
    expect(vars['--m-dark']).toMatch(/^#[0-9a-f]{6}$/);
  });
});
