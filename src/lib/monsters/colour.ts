import type { CSSProperties } from 'react';
import type { Palette } from './types';

/** Mixes a #rrggbb colour towards black (amount < 0) or white (amount > 0), -1…1. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 0xff;
    const target = amount < 0 ? 0 : 255;
    return Math.round(c + (target - c) * Math.abs(amount));
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The CSS custom properties a monster body is painted with (components/monsters/rigs use only these).
 * --m-dark is the outline, --m-light a highlight, --m-bone teeth, claws and bone.
 */
export function paletteVars(palette: Palette): CSSProperties {
  return {
    '--m-main': palette.main,
    '--m-second': palette.secondary,
    '--m-accent': palette.accent,
    '--m-eye': palette.eye,
    '--m-dark': shade(palette.main, -0.62),
    '--m-light': shade(palette.main, 0.28),
    '--m-second-dark': shade(palette.secondary, -0.35),
    '--m-bone': '#efe7d2',
  } as CSSProperties;
}
