import type { BattleStage } from '@/lib/battle/monster';

/*
 * Optional artwork per monster and state. Empty today: every monster is drawn by its SVG body
 * (components/monsters/rigs). To add painted art later, put files in /public/monsters/<id>/ and
 * list them here, e.g. ashfang: { idle: '/monsters/ashfang/idle.webp', attack: '…' }. Art is
 * loaded with the app's static files: never generated during a game.
 *
 * Fallback order for a state: its own art → the monster's idle art → the SVG body → Gloomjaw.
 */
export type ArtState = 'idle' | 'attack' | 'damage' | 'rage' | 'weakened' | 'defeat';

export const MONSTER_ART: Readonly<Record<string, Partial<Record<ArtState, string>>>> = {};

/** Which art state shows for a battle stage and the monster's current action. */
export function artState(stage: BattleStage, action: string, weakened = false): ArtState {
  if (stage === 'defeated' || action === 'defeat') return 'defeat';
  if (action === 'charge' || action === 'brewing') return 'attack';
  if (action === 'taking' || action === 'hit' || action === 'stagger') return 'damage';
  if (weakened) return 'weakened';
  if (stage === 'rage' || stage === 'enraged') return 'rage';
  return 'idle';
}

/** The art file for a monster in a state, falling back to its idle art; null when it has none. */
export function artFor(monsterId: string, state: ArtState, art: typeof MONSTER_ART = MONSTER_ART): string | null {
  const set = art[monsterId];
  return set?.[state] ?? set?.idle ?? null;
}
