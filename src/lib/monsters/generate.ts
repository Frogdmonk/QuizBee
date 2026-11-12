import { ARCHETYPES, ARCHETYPE_BY_ID } from './archetypes';
import { CATALOGUE_BY_ID, DEFAULT_MONSTER_ID, type CatalogueEntry } from './catalogue';
import { ELEMENTS } from './elements';
import { PERSONALITIES } from './personality';
import type { Archetype, ElementId, MonsterSpec, Rarity, RigId } from './types';

/*
 * The generator. Deterministic: the same seed and options always give the same monster, so a
 * monster can be re-derived for tests and previews; the session stores the result, not the seed,
 * so a reload or reconnect never re-rolls it.
 *
 * Variety comes only from each archetype's own pools (elements, parts, personalities, names), so
 * every result is coherent: no fire sea serpent, no winged golem, no stomping ghost.
 */

export type GenerateMode = 'random' | 'surprise' | { catalogueId: string };

export type GenerateOptions = {
  seed: number;
  mode?: GenerateMode;
  /** The quiz's learning objectives and topics: the weakness is chosen from these only. */
  topics?: readonly string[];
  /** Bodies that can be drawn; random and surprise picks stay within them. */
  rigs?: ReadonlySet<RigId>;
  /** Archetypes to avoid (e.g. the one the class just fought), when there is any alternative. */
  avoid?: readonly string[];
};

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_WEIGHT: Record<Rarity, number> = { common: 50, rare: 32, epic: 14, legendary: 4 };
const TEXT_MAX = { name: 40, title: 60, ability: 40, topic: 60 } as const;

/** A small, fast, seedable PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

function weighted<T>(r: () => number, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let x = r() * total;
  for (const t of items) {
    x -= weight(t);
    if (x < 0) return t;
  }
  return items[items.length - 1];
}

/** FNV-1a, for content-derived ids: identical monsters get identical ids. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

/** Part pools for an archetype with a given element (element-specific pools win). */
export function partPools(archetype: Archetype, element: ElementId): Record<string, readonly string[]> {
  return { ...archetype.parts, ...(archetype.partsByElement?.[element] ?? {}) };
}

function compoundName(r: () => number, archetype: Archetype, element: ElementId): string {
  const given = archetype.givenNames?.[element];
  if (given?.length) return pick(r, given);
  const start = pick(r, ELEMENTS[element].nameStarts);
  const ends = archetype.nameEnds.filter((e) => !start.toLowerCase().endsWith(e.slice(0, 2)));
  return `${start}${pick(r, ends.length ? ends : archetype.nameEnds)}`;
}

/** The weakness topic: one of the quiz's own objectives or topics, or none. */
function weaknessTopic(r: () => number, topics: readonly string[] | undefined): string | null {
  const clean = [...new Set((topics ?? []).map((t) => t.trim()).filter((t) => t && t.length <= TEXT_MAX.topic))];
  return clean.length ? pick(r, clean) : null;
}

function build(
  r: () => number,
  archetype: Archetype,
  element: ElementId,
  fixed: { name?: string; title?: string; rarity?: Rarity; personality?: MonsterSpec['personality']; parts?: Record<string, string> },
  meta: { seed: number; source: MonsterSpec['source']; catalogueId: string | null; topics?: readonly string[] },
): MonsterSpec {
  const pools = partPools(archetype, element);
  const parts: Record<string, string> = {};
  for (const key of Object.keys(pools).sort()) parts[key] = pick(r, pools[key]);
  for (const [key, value] of Object.entries(fixed.parts ?? {})) if (pools[key]?.includes(value)) parts[key] = value;

  const info = ELEMENTS[element];
  const palette = { ...pick(r, info.palettes) };
  const name = fixed.name ?? compoundName(r, archetype, element);
  const title = fixed.title ?? `the ${pick(r, info.titleWords)} ${pick(r, archetype.titleNouns)}`;
  const personality = fixed.personality ?? pick(r, archetype.personalities);
  const rarity = fixed.rarity ?? weighted(r, archetype.rarities, (x) => RARITY_WEIGHT[x]);
  const words = info.words;
  const abilities = { primary: archetype.primary(words), defense: archetype.defense(words), specials: archetype.specials(words) };
  const weakness = { element: info.weakTo, topic: weaknessTopic(r, meta.topics) };

  const identity = JSON.stringify([archetype.id, element, name, title, parts, palette]);
  return {
    v: 1,
    id: meta.catalogueId ?? `gen-${archetype.id}-${element}-${hash(identity)}`,
    catalogueId: meta.catalogueId,
    source: meta.source,
    archetype: archetype.id,
    rig: archetype.rig,
    category: archetype.category,
    element,
    name,
    title,
    rarity,
    personality,
    movement: archetype.movement,
    parts,
    palette,
    abilities,
    weakness,
    seed: meta.seed >>> 0,
  };
}

/** A catalogue monster, always the same look (its own seed), with this quiz's weakness topic. */
export function catalogueMonster(entry: CatalogueEntry, topics?: readonly string[]): MonsterSpec {
  const archetype = ARCHETYPE_BY_ID.get(entry.archetype);
  if (!archetype) throw new Error(`Unknown archetype ${entry.archetype}`);
  const r = prng(entry.seed);
  return build(
    r,
    archetype,
    entry.element,
    { name: entry.name, title: entry.title, rarity: entry.rarity, personality: entry.personality, parts: entry.parts },
    { seed: entry.seed, source: 'catalogue', catalogueId: entry.id, topics },
  );
}

/** Generates a monster: random (mode A), a teacher's pick (mode B) or a surprise boss (mode C). */
export function generateMonster(options: GenerateOptions): MonsterSpec {
  const { seed, mode = 'random', topics, rigs, avoid = [] } = options;
  if (typeof mode === 'object') {
    const entry = CATALOGUE_BY_ID.get(mode.catalogueId) ?? CATALOGUE_BY_ID.get(DEFAULT_MONSTER_ID)!;
    return catalogueMonster(entry, topics);
  }

  const r = prng(seed);
  const surprise = mode === 'surprise';
  // The original blob is a catalogue monster, not a random body.
  let pool = ARCHETYPES.filter((a) => a.rig !== 'blob' && (!rigs || rigs.has(a.rig)));
  if (surprise) pool = pool.filter((a) => a.rarities.includes('legendary') || a.rarities.includes('epic'));
  const fresh = pool.filter((a) => !avoid.includes(a.id));
  if (fresh.length) pool = fresh;
  if (!pool.length) return catalogueMonster(CATALOGUE_BY_ID.get(DEFAULT_MONSTER_ID)!, topics);

  const archetype = pick(r, pool);
  const element = pick(r, archetype.elements);
  // A surprise boss is rare to look at, not harder to beat: rarity never changes difficulty.
  const rarity: Rarity | undefined = surprise ? (archetype.rarities.includes('legendary') ? 'legendary' : 'epic') : undefined;
  return build(r, archetype, element, { rarity }, { seed, source: surprise ? 'surprise' : 'random', catalogueId: null, topics });
}

// ── Checking a spec (from the generator, or read back from the session) ──────

const HEX = /^#[0-9a-f]{6}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Everything wrong with a spec; empty when it is a coherent monster this version can show. */
export function monsterProblems(spec: MonsterSpec): string[] {
  const out: string[] = [];
  const archetype = ARCHETYPE_BY_ID.get(spec.archetype);
  if (!archetype) return [`unknown archetype ${spec.archetype}`];
  if (spec.v !== 1) out.push('unknown version');
  if (!ID.test(spec.id)) out.push('bad id');
  if (spec.rig !== archetype.rig) out.push(`${spec.archetype} is drawn as ${archetype.rig}, not ${spec.rig}`);
  if (spec.category !== archetype.category) out.push('category does not match the archetype');
  if (spec.movement !== archetype.movement) out.push(`${spec.archetype} moves as ${archetype.movement}, not ${spec.movement}`);
  if (!archetype.elements.includes(spec.element)) out.push(`${spec.archetype} cannot be ${spec.element}`);
  if (!archetype.personalities.includes(spec.personality)) out.push(`${spec.archetype} cannot be ${spec.personality}`);
  if (!(spec.personality in PERSONALITIES)) out.push('unknown personality');
  if (!RARITIES.includes(spec.rarity)) out.push('unknown rarity');
  const pools = partPools(archetype, spec.element);
  for (const [key, value] of Object.entries(spec.parts)) {
    if (!pools[key]) out.push(`${spec.archetype} has no ${key}`);
    else if (!pools[key].includes(value)) out.push(`${spec.archetype} ${key} cannot be ${value}`);
  }
  for (const key of Object.keys(pools)) if (!(key in spec.parts)) out.push(`missing ${key}`);
  for (const colour of Object.values(spec.palette)) if (!HEX.test(colour)) out.push(`bad colour ${colour}`);
  if (!spec.name.trim() || spec.name.length > TEXT_MAX.name) out.push('bad name');
  if (spec.title.length > TEXT_MAX.title) out.push('title too long');
  const abilities = [spec.abilities.primary, spec.abilities.defense, ...Object.values(spec.abilities.specials)];
  if (abilities.some((a) => !a || a.length > TEXT_MAX.ability)) out.push('bad ability name');
  if (!(spec.weakness.element in ELEMENTS)) out.push('bad weakness');
  if (spec.weakness.topic !== null && spec.weakness.topic.length > TEXT_MAX.topic) out.push('weakness topic too long');
  return out;
}
