import type { Movement } from './types';

/**
 * "The Climb to the Lair": the top 10 stand on ledges of a cliff path in a 1600×900 world, #10 at
 * the foot (bottom left), #1 at the top (right), just below the lair. Pure geometry and motion
 * paths; components/leaderboard/ClimbBoard.tsx draws it.
 */
export const CLIMB_WORLD = { width: 1600, height: 900 } as const;

/** Ledge centres by rank (index 0 = #1). Three switchbacks; neighbours on a row are ≥ 250 px apart. */
export const LEDGES: readonly { x: number; y: number }[] = [
  { x: 1000, y: 250 }, // 1
  { x: 720, y: 305 }, // 2
  { x: 450, y: 345 }, // 3
  { x: 330, y: 520 }, // 4
  { x: 600, y: 545 }, // 5
  { x: 870, y: 575 }, // 6
  { x: 1140, y: 715 }, // 7
  { x: 870, y: 745 }, // 8
  { x: 600, y: 770 }, // 9
  { x: 330, y: 795 }, // 10
];

/** Where players outside the top 10 gather (the foot of the cliff). */
export const CROWD = { x: 110, y: 860 } as const;
/** The lair at the summit. */
export const LAIR = { x: 1330, y: 185 } as const;

export const ledgeOf = (rank: number): { x: number; y: number } => LEDGES[Math.min(Math.max(rank, 1), LEDGES.length) - 1];

/** An SVG path through every ledge, from the foot of the cliff to the lair. */
export function trailPath(): string {
  const pts = [CROWD, ...[...LEDGES].reverse(), LAIR];
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y + 40}`).join(' ');
}

export type ClimbMotion = {
  kind: 'climb' | 'leap' | 'slide' | 'arrive' | 'hop' | 'still';
  /** Keyframes in world px (absolute positions of the climber's centre) and degrees. */
  x: number[];
  y: number[];
  rotate: number[];
  durationMs: number;
};

const HOP = 55;

/**
 * How a climber gets from the old rank to the new one:
 *   a few places up   → climbs ledge by ledge, hopping between them
 *   4+ places up      → one grappling leap in a high arc
 *   down              → a wobbly slide down through the ledges in between
 *   new / from below  → jumps up from the crowd at the foot of the cliff
 *   same place        → a small hop (the champion) or stays still
 */
export function climbMotion(fromRank: number | null, toRank: number, movement: Movement | undefined): ClimbMotion {
  const to = ledgeOf(toRank);
  const still: ClimbMotion = { kind: 'still', x: [to.x], y: [to.y], rotate: [0], durationMs: 0 };
  if (!movement) return still;

  if (movement.kind === 'new' || fromRank === null || fromRank > LEDGES.length) {
    const apex = Math.min(CROWD.y, to.y) - 220;
    return { kind: 'arrive', x: [CROWD.x, (CROWD.x + to.x) / 2, to.x], y: [CROWD.y, apex, to.y], rotate: [0, -20, 0], durationMs: 1200 };
  }
  if (movement.kind === 'same') {
    return movement.context === 'champion'
      ? { kind: 'hop', x: [to.x, to.x, to.x], y: [to.y, to.y - HOP, to.y], rotate: [0, 0, 0], durationMs: 600 }
      : still;
  }

  const from = ledgeOf(fromRank);
  if (movement.kind === 'up' && fromRank - toRank >= 4) {
    const apex = Math.min(from.y, to.y) - 200;
    return { kind: 'leap', x: [from.x, (from.x + to.x) / 2, to.x], y: [from.y, apex, to.y], rotate: [0, -25, 0], durationMs: 1100 };
  }

  // Through every ledge in between, with a hop (up) or a bump (down) between each.
  const step = fromRank > toRank ? -1 : 1;
  const x: number[] = [from.x];
  const y: number[] = [from.y];
  const rotate: number[] = [0];
  for (let r = fromRank; r !== toRank; r += step) {
    const a = ledgeOf(r);
    const b = ledgeOf(r + step);
    x.push((a.x + b.x) / 2, b.x);
    y.push(Math.min(a.y, b.y) - (step < 0 ? HOP : 15), b.y);
    rotate.push(step < 0 ? -8 : 14, step < 0 ? 0 : -8);
  }
  rotate[rotate.length - 1] = 0;
  const steps = Math.abs(fromRank - toRank);
  return step < 0
    ? { kind: 'climb', x, y, rotate, durationMs: Math.min(1600, 380 * steps) }
    : { kind: 'slide', x, y, rotate, durationMs: Math.min(1500, 300 * steps) };
}
