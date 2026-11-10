import { activeBattle } from '@/lib/battle/state';
import { battleStage } from '@/lib/battle/monster';
import type { GameState } from '@/types/game';
import type { WorldMood } from '@/components/world/WorldBackdrop';

/** The projector's weather: the monster's mood, dawn once it is defeated, calm without a battle. */
export function worldMood(state: GameState | null): WorldMood {
  const b = activeBattle(state);
  if (!b) return 'calm';
  const stage = battleStage(b.hp, b.maxHp, b.config);
  if (stage === 'defeated') return 'victory';
  if (stage === 'rage') return 'rage';
  if (stage === 'enraged') return 'enraged';
  return 'calm';
}

/** The cinematic wipe into each phase (components/world/PhaseWipe). */
export type WipeKind = 'brush' | 'slash' | 'dust' | 'burst';

export function wipeFor(phase: string | undefined): WipeKind | null {
  switch (phase) {
    case 'question':
      return 'brush';
    case 'reveal':
      return 'slash';
    case 'leaderboard':
      return 'dust';
    case 'podium':
      return 'burst';
    default:
      return null;
  }
}
