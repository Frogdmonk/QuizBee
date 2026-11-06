import type { DownTier, UpTier } from './config';
import type { ThemeCategory, ThemeId } from './types';

export type ThemeMeta = {
  id: Exclude<ThemeId, 'fallback'>;
  label: string;
  category: ThemeCategory;
  /** Movement tiers this theme suits (up/down themes). */
  tiers?: readonly (UpTier | DownTier)[];
  /** Idle themes: who they suit. */
  contexts?: readonly ('champion' | 'steady' | 'new')[];
};

/**
 * The 20 animation themes. Movement picks the category and intensity; the engine then picks one
 * eligible theme at random, avoiding each student's recent themes.
 */
export const THEMES: readonly ThemeMeta[] = [
  // Rank up
  { id: 'superhero', label: 'Superhero takeover', category: 'up', tiers: ['major', 'legendary'] },
  { id: 'rocket', label: 'Rocket launch', category: 'up', tiers: ['medium', 'major', 'legendary'] },
  { id: 'ninja', label: 'Ninja teleport', category: 'up', tiers: ['small', 'medium', 'major'] },
  { id: 'elevator', label: 'Magical elevator', category: 'up', tiers: ['small', 'medium'] },
  { id: 'giant-hand', label: 'Giant hand rescue', category: 'up', tiers: ['medium', 'major'] },
  { id: 'dragon-flight', label: 'Dragon flight', category: 'up', tiers: ['major', 'legendary'] },
  { id: 'victory-parade', label: 'Victory parade', category: 'up', tiers: ['small', 'medium'] },
  { id: 'evolution', label: 'Character evolution', category: 'up', tiers: ['medium', 'major', 'legendary'] },
  // Rank down
  { id: 'titanic', label: 'Sinking boat', category: 'down', tiers: ['major', 'epic'] },
  { id: 'parachute', label: 'Tiny parachute', category: 'down', tiers: ['medium', 'major'] },
  { id: 'banana', label: 'Banana peel', category: 'down', tiers: ['minor', 'medium'] },
  { id: 'throne', label: 'Collapsing throne', category: 'down', tiers: ['medium', 'major', 'epic'] },
  { id: 'tornado', label: 'Tornado trouble', category: 'down', tiers: ['medium', 'major', 'epic'] },
  { id: 'meteor', label: 'Meteor impact', category: 'down', tiers: ['major', 'epic'] },
  { id: 'volcano', label: 'Volcano launch', category: 'down', tiers: ['minor', 'medium', 'major'] },
  // Idle and reactions
  { id: 'crown-polish', label: 'Crown polishing', category: 'idle', contexts: ['champion'] },
  { id: 'ufo-scan', label: 'UFO scan', category: 'idle', contexts: ['steady', 'new'] },
  { id: 'victory-dance', label: 'Victory dance', category: 'idle', contexts: ['champion', 'steady'] },
  { id: 'comic-reaction', label: 'Comic reaction', category: 'idle', contexts: ['steady', 'new'] },
  { id: 'dragon-companion', label: 'Dragon companion', category: 'idle', contexts: ['champion', 'steady', 'new'] },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function themeMeta(id: ThemeId): ThemeMeta | undefined {
  return THEMES.find((t) => t.id === id);
}
