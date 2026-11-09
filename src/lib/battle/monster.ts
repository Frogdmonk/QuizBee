/**
 * The monsters a class can fight. Original characters; art is drawn in components/battle/Monster.tsx.
 */
export type MonsterInfo = { key: string; name: string; title: string };

export const MONSTERS: Record<string, MonsterInfo> = {
  gloomjaw: { key: 'gloomjaw', name: 'Gloomjaw', title: 'the Riddle Eater' },
};

export function monsterInfo(key: string | null | undefined): MonsterInfo {
  return (key && MONSTERS[key]) || MONSTERS.gloomjaw;
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

/** The special attack the monster charges during a question in each mode. */
export const SPECIAL_ATTACK: Record<'normal' | 'rage' | 'enraged', { name: string; verb: string }> = {
  normal: { name: 'Tail Swipe', verb: 'swipes its tail' },
  rage: { name: 'Riddle Roar', verb: 'roars a riddle' },
  enraged: { name: 'Gloom Storm', verb: 'summons a storm' },
};

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
