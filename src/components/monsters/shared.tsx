import type { ReactNode } from 'react';
import type { MonsterSpec } from '@/lib/monsters/types';
import type { BattleStage } from '@/lib/battle/monster';

/** What every body receives. Bodies draw inside the viewBox 0 0 400 420, standing on y ≈ 398. */
export type RigProps = { spec: MonsterSpec; stage: BattleStage };

/** An eye that glows in rage, narrows when enraged and becomes an X when defeated. */
export function Eye({ cx, cy, r = 12, defeated, slit = false, glow = false }: { cx: number; cy: number; r?: number; defeated: boolean; slit?: boolean; glow?: boolean }) {
  if (defeated) {
    const d = r * 0.8;
    return <path className="rg-x" d={`M${cx - d} ${cy - d} L${cx + d} ${cy + d} M${cx + d} ${cy - d} L${cx - d} ${cy + d}`} />;
  }
  return (
    <g className="rg-eye-g">
      <ellipse className={glow ? 'rg-eye rg-eye-glow' : 'rg-eye'} cx={cx} cy={cy} rx={r} ry={r * 0.82} />
      {slit ? (
        <ellipse className="rg-pupil" cx={cx} cy={cy} rx={r * 0.22} ry={r * 0.7} />
      ) : (
        <circle className="rg-pupil" cx={cx} cy={cy + r * 0.08} r={r * 0.42} />
      )}
      <circle className="rg-shine" cx={cx + r * 0.3} cy={cy - r * 0.32} r={r * 0.2} />
    </g>
  );
}

/** Stars circling the head when the class stops the special attack. */
export function Stars({ x = 200, y = 60 }: { x?: number; y?: number }) {
  const star = (cx: number, cy: number, s: number) =>
    `M${cx} ${cy - 13 * s} l${6 * s} ${12 * s} l${13 * s} ${2 * s} l${-10 * s} ${9 * s} l${3 * s} ${13 * s} l${-12 * s} ${-7 * s} l${-12 * s} ${7 * s} l${3 * s} ${-13 * s} l${-10 * s} ${-9 * s} l${13 * s} ${-2 * s} Z`;
  return (
    <g className="mon-stars" style={{ transformOrigin: `${x}px ${y}px` }}>
      <path d={star(x - 56, y, 1)} />
      <path d={star(x + 20, y - 20, 1)} />
      <path d={star(x + 64, y + 10, 0.8)} />
    </g>
  );
}

/** Embers or sparks rising around the monster in Rage and Enraged (in its glow colour). */
export function RageAura({ points }: { points: readonly (readonly [number, number])[] }) {
  return (
    <g className="rg-aura" aria-hidden>
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 6 : 9} style={{ animationDelay: `${(i * 0.37) % 1.8}s` }} />
      ))}
    </g>
  );
}

/** Glowing cracks: faint always for bodies made of element (golems), bright when Enraged for all. */
export function Cracks({ d, always = false }: { d: readonly string[]; always?: boolean }) {
  return (
    <g className={always ? 'mon-cracks rg-cracks-always' : 'mon-cracks'}>
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </g>
  );
}

export const Shadow = ({ rx = 150, cy = 398, float = false }: { rx?: number; cy?: number; float?: boolean }) => (
  <ellipse className={float ? 'mon-shadow rg-shadow-float' : 'mon-shadow'} cx="200" cy={cy} rx={rx} ry={rx * 0.12} />
);

/** Mirrors children across the vertical centre line (for symmetrical wings, arms, horns). */
export const Mirror = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <g transform="translate(400 0) scale(-1 1)">{children}</g>
  </>
);
