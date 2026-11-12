import { ELEMENTS } from './elements';
import { WEAKENED_AT } from './motion';
import { battleLine, type Moment } from './personality';
import type { ElementId, MonsterSpec } from './types';

/*
 * How the monster reacts to the class: worked out on every screen from the server's result for
 * the question, so everyone sees the same reaction. Thematic only: nothing here changes HP or
 * damage, which stay on the server.
 */

/** The element each class weapon carries (the weapon keys come from the server's battle_weapons). */
export const WEAPON_ELEMENT: Readonly<Record<string, ElementId>> = {
  thunder: 'storm',
  inferno: 'fire',
  frost: 'ice',
  shadow: 'shadow',
  crystal: 'arcane',
  healing: 'nature',
};

/** The class's weapon is the element this monster fears. */
export function superEffective(monster: MonsterSpec, weapon: string | null | undefined): boolean {
  return Boolean(weapon && WEAPON_ELEMENT[weapon] === monster.weakness.element);
}

/** What a question's result was, as far as the monster is concerned. */
export type AttackResult = {
  position: number;
  accuracy: number | null;
  hpBefore: number;
  hpAfter: number;
  /** Whether the class stopped this question's special attack; null when there was none. */
  defended: boolean | null;
  mode: 'normal' | 'rage' | 'enraged' | 'defeated' | null;
};

/**
 * The moment a result is: defeated, just weakened, a comeback (the class stopped its strongest
 * attack), a strong class or a weak class. Null when the question was unremarkable.
 */
export function reactionMoment(result: AttackResult, maxHp: number | null): Moment | null {
  if (result.hpAfter <= 0 && result.hpBefore > 0) return 'defeated';
  if (maxHp && result.hpAfter / maxHp <= WEAKENED_AT && result.hpBefore / maxHp > WEAKENED_AT) return 'weakened';
  if (result.defended === true && result.mode === 'enraged') return 'comeback';
  if (result.defended === false) return 'classWeak';
  if (result.defended === true) return 'classStrong';
  if (result.accuracy !== null && result.accuracy >= 70) return 'classStrong';
  if (result.accuracy !== null && result.accuracy < 40) return 'classWeak';
  return null;
}

/** The line the monster says after a question (the same on every screen), or null. */
export function reactionLine(monster: MonsterSpec, result: AttackResult, maxHp: number | null): string | null {
  const moment = reactionMoment(result, maxHp);
  return moment ? battleLine(monster.personality, moment, monster.seed, result.position) : null;
}

/** The current question tests the monster's weak spot (one of this quiz's own topics or objectives). */
export function isWeakSpot(monster: MonsterSpec, question: { topic?: string | null; objective?: string | null } | null | undefined): boolean {
  const topic = monster.weakness.topic?.trim().toLowerCase();
  if (!topic || !question) return false;
  return [question.topic, question.objective].some((t) => t?.trim().toLowerCase() === topic);
}

/** "Weak spot! Ashfang is weak to questions on Loops." */
export function weakSpotNote(monster: MonsterSpec, question: { topic?: string | null; objective?: string | null } | null | undefined): string | null {
  return isWeakSpot(monster, question) ? `🎯 Weak spot! ${monster.name} is weak to questions on ${monster.weakness.topic}` : null;
}

/** What the monster fears, for the announcement: "Fire, and questions on Loops". */
export function weaknessText(monster: MonsterSpec): string {
  const element = ELEMENTS[monster.weakness.element].label;
  return monster.weakness.topic ? `${element}, and questions on ${monster.weakness.topic}` : element;
}
