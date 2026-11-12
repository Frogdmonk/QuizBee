import type { BattleAttack, BattleCurrent, BattleState, EquippedWeapon, GameState } from '@/types/game';
import { specialAttack } from './monster';
import { resolveMonster } from '@/lib/monsters/resolve';
import type { MonsterSpec } from '@/lib/monsters/types';

/** The running battle, or null (switched off, not started yet, or an older session). */
export function activeBattle(state: GameState | null): (BattleState & { maxHp: number; hp: number }) | null {
  const b = state?.battle;
  if (!b || !b.enabled || b.maxHp === null || b.hp === null) return null;
  return b as BattleState & { maxHp: number; hp: number };
}

/** The rules of the question on screen (null without a battle, or for another question). */
export function currentRules(state: GameState | null): BattleCurrent | null {
  const b = activeBattle(state);
  if (!b?.current || !state?.question) return null;
  return b.current.questionId === state.question.id ? b.current : null;
}

/** Seconds per question in this mode when the teacher turned battle timers on, else null. */
export function modeTimer(battle: BattleState, mode: BattleCurrent['mode']): number | null {
  if (!battle.config.modeTimers || mode === 'defeated') return null;
  return battle.config.timers[mode];
}

/** "Riddle Roar charging · 18 of 30 needed" for the question HUD. */
export function chargingNote(rules: BattleCurrent | null, eligible: number | null, monster: MonsterSpec = resolveMonster(null)): string | null {
  if (!rules || rules.mode === 'defeated' || rules.targetCount === null) return null;
  const needed = eligible !== null ? `${rules.targetCount} of ${eligible} correct needed` : `${rules.targetPct}% correct needed`;
  return `⚡ ${specialAttack(monster, rules.mode)} charging · ${needed}`;
}

/** The attack to play right now: the current question's, during its reveal. */
export function revealAttack(state: GameState | null): BattleAttack | null {
  const b = activeBattle(state);
  if (!b?.last || !state?.question || state.session.phase !== 'reveal') return null;
  return b.last.questionId === state.question.id ? b.last : null;
}

/** Which question a special used now would apply to, and whether it can be used (mirrors use_weapon_special). */
export function specialStatus(state: GameState, weapon: EquippedWeapon): { target: number | null; can: boolean; reason: string } {
  const { phase, currentPosition, questionCount, status } = state.session;
  const openQuestion = phase === 'question' && state.question?.status === 'open';
  const target =
    status !== 'in_progress' || currentPosition === null
      ? null
      : openQuestion
        ? currentPosition
        : (phase === 'reveal' || phase === 'leaderboard') && currentPosition + 1 < questionCount
          ? currentPosition + 1
          : null;
  if (target === null) return { target, can: false, reason: 'Use it during a question or before the next one.' };
  if (weapon.armedAt === target) return { target, can: false, reason: `Armed for question ${target + 1}.` };
  if (weapon.chargesLeft <= 0) return { target, can: false, reason: 'No charges left.' };
  if (weapon.readyAt !== null && target < weapon.readyAt) return { target, can: false, reason: `Recharging: ready from question ${weapon.readyAt + 1}.` };
  return { target, can: true, reason: openQuestion ? 'Applies to this question.' : `Applies to question ${target + 1}.` };
}
