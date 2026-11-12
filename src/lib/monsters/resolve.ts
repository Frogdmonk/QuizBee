import { CATALOGUE_BY_ID, DEFAULT_MONSTER_ID } from './catalogue';
import { catalogueMonster, monsterProblems } from './generate';
import type { MonsterSpec } from './types';

/*
 * Which monster a screen shows. The session's stored spec when it is valid; otherwise the
 * catalogue monster named by the battle's key; otherwise the default (Gloomjaw). A bad or
 * missing monster never stops the quiz: the class always has something to fight.
 */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string';

/** Reads a stored spec defensively (it is JSON from the server); null if it is not a usable monster. */
export function parseMonsterSpec(raw: unknown): MonsterSpec | null {
  if (!isObject(raw) || raw.v !== 1) return null;
  const { palette, abilities, weakness, parts } = raw;
  if (!isObject(palette) || !isObject(abilities) || !isObject(weakness) || !isObject(parts)) return null;
  if (!isObject(abilities.specials)) return null;
  const textFields = [raw.id, raw.archetype, raw.rig, raw.category, raw.element, raw.name, raw.title, raw.rarity, raw.personality, raw.movement, raw.source];
  if (!textFields.every(isText)) return null;
  if (!Object.values(parts).every(isText)) return null;
  const s = abilities.specials;
  if (![abilities.primary, abilities.defense, s.normal, s.rage, s.enraged].every(isText)) return null;
  if (![palette.main, palette.secondary, palette.accent, palette.eye].every(isText)) return null;
  if (!isText(weakness.element) || !(weakness.topic === null || isText(weakness.topic))) return null;
  const spec = {
    v: 1,
    id: raw.id,
    catalogueId: isText(raw.catalogueId) ? raw.catalogueId : null,
    source: raw.source,
    archetype: raw.archetype,
    rig: raw.rig,
    category: raw.category,
    element: raw.element,
    name: raw.name,
    title: raw.title,
    rarity: raw.rarity,
    personality: raw.personality,
    movement: raw.movement,
    parts: { ...parts },
    palette: { main: palette.main, secondary: palette.secondary, accent: palette.accent, eye: palette.eye },
    abilities: { primary: abilities.primary, defense: abilities.defense, specials: { normal: s.normal, rage: s.rage, enraged: s.enraged } },
    weakness: { element: weakness.element, topic: weakness.topic },
    seed: typeof raw.seed === 'number' ? raw.seed : 0,
  } as MonsterSpec;
  return monsterProblems(spec).length === 0 ? spec : null;
}

const fallbacks = new Map<string, MonsterSpec>();

/** The monster for a battle: its stored spec, else its catalogue key, else the default. */
export function resolveMonster(battle: { monster?: string | null; monsterSpec?: unknown } | null | undefined): MonsterSpec {
  const stored = parseMonsterSpec(battle?.monsterSpec);
  if (stored) return stored;
  const key = battle?.monster && CATALOGUE_BY_ID.has(battle.monster) ? battle.monster : DEFAULT_MONSTER_ID;
  let spec = fallbacks.get(key);
  if (!spec) {
    spec = catalogueMonster(CATALOGUE_BY_ID.get(key)!);
    fallbacks.set(key, spec);
  }
  return spec;
}

/** "Ashfang, the Ember Tyrant" (or just the name when the title is empty). */
export function monsterFullName(spec: MonsterSpec): string {
  return spec.title ? `${spec.name}, ${spec.title}` : spec.name;
}
