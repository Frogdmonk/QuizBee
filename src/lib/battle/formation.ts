/**
 * Where each student's avatar stands in the arena. The arena is a fixed 1600×900 world (scaled to
 * the screen); the class stands on the left, the monster on the right. Pure and deterministic, so
 * every screen draws the same formation.
 */
export const ARENA = { width: 1600, height: 900 } as const;
/** The class's half of the arena (the strip above it is for the result banners). */
export const CLASS_ZONE = { x0: 50, x1: 760, y0: 250, y1: 870 } as const;
/** The monster's centre and the area projectiles aim at. */
export const MONSTER_TARGET = { x: 1210, y: 520, spreadX: 120, spreadY: 150 } as const;

export type Spot = { x: number; y: number; size: number };

/** A staggered (honeycomb) block that fills the class zone; avatars shrink as the class grows. */
export function formation(count: number): Spot[] {
  if (count <= 0) return [];
  const w = CLASS_ZONE.x1 - CLASS_ZONE.x0;
  const h = CLASS_ZONE.y1 - CLASS_ZONE.y0;
  // Pick the column count whose cells come out largest.
  let best = { cols: 1, rows: count, cell: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cell = Math.min(w / (cols + (rows > 1 ? 0.5 : 0)), h / (rows * 0.88 + 0.12));
    if (cell > best.cell) best = { cols, rows, cell };
  }
  const cell = Math.min(best.cell, 150);
  const size = cell * 0.82;
  const blockW = cell * (best.cols + (best.rows > 1 ? 0.5 : 0));
  const blockH = cell * (best.rows * 0.88 + 0.12);
  const left = CLASS_ZONE.x0 + (w - blockW) / 2;
  const top = CLASS_ZONE.y0 + (h - blockH) / 2;
  const spots: Spot[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / best.cols);
    const col = i % best.cols;
    const shift = row % 2 === 1 ? cell / 2 : 0;
    spots.push({ x: left + shift + col * cell + cell / 2, y: top + row * cell * 0.88 + cell / 2, size });
  }
  return spots;
}
