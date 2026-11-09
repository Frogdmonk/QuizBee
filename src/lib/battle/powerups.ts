import { Clock, Eye, Gem, HeartPulse, RotateCcw, ScanSearch, Shield, Zap, type LucideIcon } from 'lucide-react';
import type { BattleState, GameState } from '@/types/game';

/*
 * Power-ups (students) and team abilities (teacher, paid with team energy). The rules live on the
 * server (supabase/migrations/20261117090000_powerups_energy.sql); this is how they look and the
 * client-side mirror of when they can be used, for enabling buttons.
 */

export const POWERUP_ICON: Record<string, LucideIcon> = {
  thunder_strike: Zap,
  guardian_shield: Shield,
  xray: Eye,
  time_warp: Clock,
  revival: RotateCcw,
  scanner: ScanSearch,
  team_heal: HeartPulse,
  comeback: Gem,
};

export type TeamAbilityInfo = { key: 'team_shield' | 'group_lightning' | 'knowledge_reveal' | 'final_rally'; name: string; cost: number; description: string };

export const TEAM_ABILITIES: readonly TeamAbilityInfo[] = [
  { key: 'team_shield', name: 'Team Shield', cost: 30, description: 'Blocks the monster’s healing from one counter-attack.' },
  { key: 'group_lightning', name: 'Group Lightning', cost: 40, description: 'Strikes for 8% of the monster’s HP.' },
  { key: 'knowledge_reveal', name: 'Knowledge Reveal', cost: 25, description: 'Removes one wrong answer from the running question.' },
  { key: 'final_rally', name: 'Final Rally', cost: 60, description: 'Every hit doubled on one final-challenge question.' },
];

export const ENERGY_REASON: Record<string, string> = {
  mastery: 'mastery',
  recovered: 'recovered',
  defended: 'defended',
  participation: 'everyone joined in',
  teamwork: 'weapon unlocked',
  final: 'final challenge',
  wand: 'Healing Wand',
};

/** Whether the teacher can use a team ability now, and why not (mirrors use_team_ability). */
export function abilityStatus(state: GameState, battle: BattleState, key: TeamAbilityInfo['key']): { can: boolean; reason: string } {
  const info = TEAM_ABILITIES.find((a) => a.key === key)!;
  const { phase, status, currentPosition } = state.session;
  const open = phase === 'question' && state.question?.status === 'open';
  if (status !== 'in_progress' || (!open && phase !== 'reveal' && phase !== 'leaderboard')) return { can: false, reason: 'During a question or before the next one.' };
  if (battle.energy < info.cost) return { can: false, reason: `Needs ${info.cost} energy.` };
  const target = open ? currentPosition : null;
  if (key === 'knowledge_reveal') {
    if (!open) return { can: false, reason: 'Only while a question is running.' };
    if (battle.current?.hiddenOptionId) return { can: false, reason: 'Already used on this question.' };
  }
  if (key === 'final_rally' && (battle.draftPosition === null || (currentPosition ?? 0) < battle.draftPosition - (open ? 0 : 1))) {
    return { can: false, reason: 'Final challenge only.' };
  }
  if (key === 'team_shield' && target !== null && battle.armed.shield === target) return { can: false, reason: 'Already up for this question.' };
  if (key === 'group_lightning' && target !== null && battle.armed.lightning === target) return { can: false, reason: 'Already charged for this question.' };
  if (key === 'final_rally' && target !== null && battle.armed.rally === target) return { can: false, reason: 'Already called for this question.' };
  return { can: true, reason: open ? 'Applies to this question.' : 'Applies to the next question.' };
}
