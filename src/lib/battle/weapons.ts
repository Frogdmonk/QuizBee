import type { ProjectileKind } from './choreography';

/**
 * How each weapon looks. The rules and the words (name, effects) come from the server's
 * battle_weapons table; this is only colour and the projectile the class fires with it.
 */
export type WeaponArt = { color: string; glow: string; projectile: ProjectileKind };

export const WEAPON_ART: Record<string, WeaponArt> = {
  thunder: { color: '#facc15', glow: '#fde047', projectile: 'bolt' },
  inferno: { color: '#f97316', glow: '#fb923c', projectile: 'fire' },
  frost: { color: '#67e8f9', glow: '#a5f3fc', projectile: 'ice' },
  shadow: { color: '#a78bfa', glow: '#c4b5fd', projectile: 'arrow' },
  crystal: { color: '#5eead4', glow: '#99f6e4', projectile: 'crystal' },
  healing: { color: '#86efac', glow: '#bbf7d0', projectile: 'star' },
};

export const weaponArt = (key: string | null | undefined): WeaponArt | null => (key ? (WEAPON_ART[key] ?? null) : null);

export const RARITY_LABEL = { rare: 'Rare', epic: 'Epic', legendary: 'Legendary' } as const;
/** Chip colours: background, text. */
export const RARITY_COLOR = {
  rare: ['#38bdf8', '#082f49'],
  epic: ['#a78bfa', '#1e1033'],
  legendary: ['#facc15', '#2a1d00'],
} as const;
