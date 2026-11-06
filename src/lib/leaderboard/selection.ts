import { THEMES, type ThemeMeta } from './themes';
import type { Movement, ThemeId } from './types';

export type Rng = () => number;

/** Themes that suit a movement (category + intensity). */
export function eligibleThemes(movement: Movement, failed: ReadonlySet<ThemeId> = new Set()): ThemeMeta[] {
  return THEMES.filter((t) => {
    if (failed.has(t.id)) return false;
    switch (movement.kind) {
      case 'up':
        return t.category === 'up' && (t.tiers?.includes(movement.tier) ?? false);
      case 'down':
        return t.category === 'down' && (t.tiers?.includes(movement.tier) ?? false);
      case 'same':
        return t.category === 'idle' && (t.contexts?.includes(movement.context) ?? false);
      case 'new':
        return t.category === 'idle' && (t.contexts?.includes('new') ?? false);
    }
  });
}

/**
 * Hybrid selection: movement decides the eligible set, then a random pick avoids the student's
 * recent themes whenever an alternative exists. Falls back to the plain bounce when nothing fits.
 */
export function selectTheme(
  movement: Movement,
  recent: readonly ThemeId[],
  rng: Rng = Math.random,
  failed: ReadonlySet<ThemeId> = new Set(),
): ThemeId {
  const eligible = eligibleThemes(movement, failed);
  if (eligible.length === 0) return 'fallback';
  const fresh = eligible.filter((t) => !recent.includes(t.id));
  const pool = fresh.length > 0 ? fresh : eligible;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index].id;
}
