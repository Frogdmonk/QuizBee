import { describe, expect, it } from 'vitest';
import { ARCHETYPES, ARCHETYPE_BY_ID } from '@/lib/monsters/archetypes';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { ELEMENT_IDS } from '@/lib/monsters/elements';
import { catalogueMonster, generateMonster, monsterProblems, partPools } from '@/lib/monsters/generate';
import { PERSONALITIES, battleLine } from '@/lib/monsters/personality';
import { monsterFullName, parseMonsterSpec, resolveMonster } from '@/lib/monsters/resolve';
import type { MonsterSpec, RigId } from '@/lib/monsters/types';

const many = (n: number, mode: 'random' | 'surprise' = 'random') => Array.from({ length: n }, (_, i) => generateMonster({ seed: i * 7919 + 13, mode }));

describe('the archetype catalogue', () => {
  it('every archetype is complete: elements, parts, personalities, names, titles, abilities and every animation state', () => {
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(ARCHETYPES.length);
    for (const a of ARCHETYPES) {
      expect(a.elements.length, a.id).toBeGreaterThan(0);
      expect(a.personalities.length, a.id).toBeGreaterThan(0);
      expect(a.titleNouns.length, a.id).toBeGreaterThan(0);
      expect(a.rarities.length, a.id).toBeGreaterThan(0);
      for (const el of a.elements) expect(a.nameEnds.length > 0 || (a.givenNames?.[el]?.length ?? 0) > 0, `${a.id} names for ${el}`).toBe(true);
      expect(Object.keys(a.animations).sort()).toEqual(['attack', 'charge', 'defeat', 'defend', 'hit', 'idle', 'rage', 'recover', 'weakened']);
      // The server accepts part keys and values only in this form (private.clean_monster_spec).
      for (const pools of [a.parts, ...Object.values(a.partsByElement ?? {})]) {
        for (const [key, values] of Object.entries(pools)) {
          expect(key, a.id).toMatch(/^[a-z]{1,20}$/);
          for (const v of values) expect(v, `${a.id}.${key}`).toMatch(/^[a-z0-9][a-z0-9-]{0,19}$/);
        }
      }
      expect(Object.keys(a.parts).length, a.id).toBeLessThanOrEqual(8);
    }
  });

  it('covers the brief: dragons, witches, warlocks, golems, guardians, trolls, giants, orc-like and goblin, demons, undead, shadow, spirits, hydra, basilisk, sea monster, three-headed guardian, chimera, firebird', () => {
    const ids = ARCHETYPES.map((a) => a.id);
    for (const id of ['dragon', 'witch', 'warlock', 'golem', 'guardian', 'troll', 'giant', 'warlord', 'goblin-king', 'demon', 'undead-knight', 'reaper', 'shade', 'spirit', 'hydra', 'basilisk', 'leviathan', 'hound', 'chimera', 'phoenix']) {
      expect(ids, id).toContain(id);
    }
  });

  it('every named monster is a valid, stable identity with a unique id and name', () => {
    expect(new Set(CATALOGUE.map((e) => e.id)).size).toBe(CATALOGUE.length);
    expect(new Set(CATALOGUE.map((e) => e.name)).size).toBe(CATALOGUE.length);
    for (const entry of CATALOGUE) {
      const spec = catalogueMonster(entry);
      expect(monsterProblems(spec), entry.id).toEqual([]);
      expect(ARCHETYPE_BY_ID.get(entry.archetype)!.rarities, `${entry.id} rarity`).toContain(entry.rarity);
      expect(catalogueMonster(entry)).toEqual(spec); // the same look every time
      for (const [key, value] of Object.entries(entry.parts ?? {})) expect(spec.parts[key], `${entry.id}.${key}`).toBe(value);
    }
    expect(monsterFullName(catalogueMonster(CATALOGUE.find((e) => e.id === 'ashfang')!))).toBe('Ashfang, the Ember Tyrant');
  });
});

describe('procedural generation', () => {
  it('thousands of random monsters are all coherent', () => {
    for (const spec of many(3000)) expect(monsterProblems(spec), spec.id).toEqual([]);
  });

  it('is deterministic for a seed, and varied across seeds', () => {
    expect(generateMonster({ seed: 42 })).toEqual(generateMonster({ seed: 42 }));
    const specs = many(600);
    const archetypes = new Set(specs.map((s) => s.archetype));
    expect(archetypes.size).toBe(ARCHETYPES.length - 1); // every body except the original blob
    expect(new Set(specs.map((s) => s.element)).size).toBe(ELEMENT_IDS.length);
    expect(new Set(specs.map((s) => s.id)).size).toBeGreaterThan(450);
    // Not "the same monster in another colour": bodies, names and abilities change together.
    const dragons = specs.filter((s) => s.archetype === 'dragon');
    const golems = specs.filter((s) => s.archetype === 'golem');
    expect(Object.keys(dragons[0].parts).sort()).not.toEqual(Object.keys(golems[0].parts).sort());
    expect(dragons[0].abilities.specials.rage).toBe('Wing Shockwave');
    expect(golems[0].abilities.primary).toBe('Ground Slam');
  });

  it('never makes incompatible monsters, and the checker catches hand-made ones', () => {
    const specs = many(3000);
    expect(specs.some((s) => s.archetype === 'leviathan' && s.element === 'fire')).toBe(false);
    expect(specs.filter((s) => s.rig === 'golem').every((s) => !('wings' in s.parts))).toBe(true);
    expect(specs.filter((s) => s.rig === 'wraith').every((s) => s.movement === 'float')).toBe(true);
    expect(specs.filter((s) => s.archetype === 'hydra' && s.element === 'water').every((s) => s.parts.crest === 'fins')).toBe(true);

    const golem = specs.find((s) => s.archetype === 'golem')!;
    const serpent = specs.find((s) => s.archetype === 'leviathan')!;
    const shade = specs.find((s) => s.archetype === 'shade')!;
    expect(monsterProblems({ ...golem, parts: { ...golem.parts, wings: 'torn' } })).toContain('golem has no wings');
    expect(monsterProblems({ ...serpent, element: 'fire' })).toContain('leviathan cannot be fire');
    expect(monsterProblems({ ...shade, movement: 'stomp' })).toContain('shade moves as float, not stomp');
    expect(monsterProblems({ ...golem, rig: 'dragon' })).toContain('golem is drawn as golem, not dragon');
  });

  it('a surprise boss is rare to look at but carries no difficulty of its own', () => {
    for (const spec of many(300, 'surprise')) {
      expect(['epic', 'legendary']).toContain(spec.rarity);
      expect(spec.source).toBe('surprise');
      expect(spec).not.toHaveProperty('difficulty');
    }
  });

  it('the weakness topic comes only from the quiz’s own objectives', () => {
    const topics = ['Updating key-value pairs', 'Using items()', 'Checking whether a key exists'];
    const specs = Array.from({ length: 50 }, (_, i) => generateMonster({ seed: i, topics }));
    expect(specs.every((s) => s.weakness.topic !== null && topics.includes(s.weakness.topic))).toBe(true);
    expect(generateMonster({ seed: 1 }).weakness.topic).toBeNull();
    expect(generateMonster({ seed: 1, topics: ['', '   '] }).weakness.topic).toBeNull();
  });

  it('stays within the bodies that can be drawn, and avoids the last archetype when it can', () => {
    const rigs = new Set<RigId>(['dragon', 'golem']);
    const drawn = Array.from({ length: 200 }, (_, i) => generateMonster({ seed: i, rigs }));
    expect(drawn.every((s) => rigs.has(s.rig))).toBe(true);
    const avoided = Array.from({ length: 100 }, (_, i) => generateMonster({ seed: i, rigs, avoid: ['dragon'] }));
    expect(avoided.every((s) => s.archetype !== 'dragon')).toBe(true);
    // Nothing drawable: the default monster, not an error.
    expect(generateMonster({ seed: 3, rigs: new Set<RigId>(['blob']) }).id).toBe('gloomjaw');
  });

  it('a teacher’s pick (catalogue) ignores the seed and keeps its look', () => {
    expect(generateMonster({ seed: 1, mode: { catalogueId: 'hollow-king' } })).toEqual(generateMonster({ seed: 999, mode: { catalogueId: 'hollow-king' } }));
    expect(generateMonster({ seed: 1, mode: { catalogueId: 'nope' } }).id).toBe('gloomjaw');
  });

  it('part pools respect element rules', () => {
    expect(partPools(ARCHETYPE_BY_ID.get('hydra')!, 'water').crest).toEqual(['fins']);
    expect(partPools(ARCHETYPE_BY_ID.get('hydra')!, 'fire').crest).toEqual(['fins', 'spines', 'horns']);
  });
});

describe('reading the session’s monster', () => {
  const spec = generateMonster({ seed: 77, topics: ['Loops'] });

  it('a stored spec survives the JSON round trip (reload, reconnect) unchanged', () => {
    const stored = JSON.parse(JSON.stringify(spec));
    expect(parseMonsterSpec(stored)).toEqual(spec);
    expect(resolveMonster({ monster: spec.id, monsterSpec: stored })).toEqual(spec);
  });

  it('a broken or unknown monster falls back instead of breaking the battle', () => {
    expect(resolveMonster(null).id).toBe('gloomjaw');
    expect(resolveMonster({ monster: 'gloomjaw', monsterSpec: null }).abilities.specials).toEqual({ normal: 'Tail Swipe', rage: 'Riddle Roar', enraged: 'Gloom Storm' });
    expect(resolveMonster({ monster: 'ashfang', monsterSpec: null }).name).toBe('Ashfang');
    expect(resolveMonster({ monster: 'x', monsterSpec: { ...spec, archetype: 'kraken' } }).id).toBe('gloomjaw');
    expect(resolveMonster({ monster: 'x', monsterSpec: { ...spec, palette: { main: 'red' } } }).id).toBe('gloomjaw');
    expect(resolveMonster({ monster: 'x', monsterSpec: 'not json' }).id).toBe('gloomjaw');
  });
});

describe('personalities', () => {
  it('lines are short, picked the same way on every screen, and never single anyone out', () => {
    for (const [key, info] of Object.entries(PERSONALITIES)) {
      for (const lines of Object.values(info.lines)) {
        expect(lines.length, key).toBeGreaterThan(0);
        for (const line of lines) {
          expect(line.length, line).toBeLessThanOrEqual(42);
          // Aimed at nobody, and never calling the class weak, slow or hopeless.
          expect(line, line).not.toMatch(/\{|\bstupid\b|\bdumb\b|\blosers?\b|\bweak\b|\bslow\b|study harder|doubt yourselves/i);
        }
      }
    }
    const spec: MonsterSpec = generateMonster({ seed: 5 });
    expect(battleLine(spec.personality, 'classWeak', spec.seed, 3)).toBe(battleLine(spec.personality, 'classWeak', spec.seed, 3));
  });
});
