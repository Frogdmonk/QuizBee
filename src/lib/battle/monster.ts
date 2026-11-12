import { resolveMonster } from '@/lib/monsters/resolve';
import type { MonsterSpec } from '@/lib/monsters/types';

/**
 * The monster a battle is fought against: who it is comes from the Monster Generation Engine
 * (lib/monsters); this file keeps the rules for how it looks at a given HP.
 */
export function monsterOf(battle: { monster?: string | null; monsterSpec?: MonsterSpec | null } | null | undefined): MonsterSpec {
  return battle?.monsterSpec ?? resolveMonster(battle);
}

/** A monster passed as its resolved spec or just its catalogue key. */
export function asMonster(monster: MonsterSpec | string | null | undefined): MonsterSpec {
  return typeof monster === 'object' && monster !== null ? monster : resolveMonster({ monster });
}

/** The special attack the monster charges during a question in each mode (from its abilities). */
export function specialAttack(monster: MonsterSpec, mode: 'normal' | 'rage' | 'enraged'): string {
  return monster.abilities.specials[mode];
}

/**
 * The monster's mode at a given HP, the same rule as private.battle_mode_for on the server:
 * above `rageAt` % Normal, above `enragedAt` % Rage, above 0 Enraged, 0 Defeated (70 / 30 by default).
 * The rules of a question come from the server (fixed when it opened); this drives the looks.
 */
export type BattleStage = 'normal' | 'rage' | 'enraged' | 'defeated';

export function battleStage(hp: number | null, maxHp: number | null, at: { rageAt: number; enragedAt: number } = { rageAt: 70, enragedAt: 30 }): BattleStage {
  if (hp === null || maxHp === null || maxHp <= 0) return 'normal';
  if (hp <= 0) return 'defeated';
  const pct = (hp / maxHp) * 100;
  if (pct > at.rageAt) return 'normal';
  if (pct > at.enragedAt) return 'rage';
  return 'enraged';
}

export const MODE_TITLE: Record<'intro' | 'normal' | 'rage' | 'enraged', string> = {
  intro: 'appears!',
  normal: 'calms down',
  rage: 'is in a RAGE!',
  enraged: 'is ENRAGED!',
};

export const STAGE_LABEL: Record<BattleStage, string> = {
  normal: 'Calm',
  rage: 'Rage',
  enraged: 'Enraged',
  defeated: 'Defeated',
};

/** How hard a hit looks: nothing, a flinch, or a stagger with knock-back. */
export type HitSeverity = 'none' | 'hit' | 'stagger';

export function hitSeverity(damage: number, maxHp: number | null): HitSeverity {
  if (damage <= 0) return 'none';
  if (!maxHp || damage / maxHp < 0.06) return 'hit';
  return 'stagger';
}
