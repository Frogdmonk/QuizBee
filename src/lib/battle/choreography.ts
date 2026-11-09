import { hashString } from '@/lib/playground/sim';
import { MONSTER_TARGET } from './formation';

/**
 * The plan for one class attack, worked out on each screen from the server's result (who attacked).
 * Nothing about it travels over the network. Deterministic: the same attack plays the same way on
 * every screen. Timings vary per student so a class never moves as one copy-pasted block.
 */
export type ProjectileKind = 'bolt' | 'orb' | 'star' | 'slash' | 'fire' | 'ice' | 'arrow' | 'crystal';
/** Bare-handed classes throw a mix of these; an equipped weapon fires its own kind. */
export const PROJECTILE_KINDS: readonly ProjectileKind[] = ['bolt', 'orb', 'star', 'slash'];

export type Swing = { id: string; delayMs: number };
export type Shot = {
  id: string;
  kind: ProjectileKind;
  launchMs: number;
  flightMs: number;
  /** Peak height of the arc above the straight line, in world px (negative = up). */
  arc: number;
  /** Where it lands, relative to the monster's centre. */
  hitDx: number;
  hitDy: number;
  /** Several attacks merged into one projectile (very large classes). */
  weight: number;
};

export type AttackPlan = {
  swings: Swing[];
  shots: Shot[];
  /** When the first and last projectiles land. */
  firstImpactMs: number;
  lastImpactMs: number;
  /** When the HP bar drops and the total damage shows. */
  totalMs: number;
};

/** Above this many attackers some projectiles carry several hits (every attacker still swings). */
export const MAX_SHOTS = 40;
const WIND_UP_MS = 450;

export function planAttack(attackerIds: readonly string[], seed: string, kind?: ProjectileKind): AttackPlan {
  const n = attackerIds.length;
  if (n === 0) return { swings: [], shots: [], firstImpactMs: 0, lastImpactMs: 0, totalMs: 900 };
  // A short class volley stays snappy; a big one spreads over at most ~2.2 s.
  const spread = Math.min(2200, 250 + n * 70);
  const swings: Swing[] = attackerIds.map((id, i) => {
    const h = hashString(`${seed}:${id}`);
    const jitter = (h % 140) - 70;
    return { id, delayMs: Math.max(0, Math.round(WIND_UP_MS + (n === 1 ? 0 : (i / (n - 1)) * spread) + jitter)) };
  });

  const shotCount = Math.min(n, MAX_SHOTS);
  const shots: Shot[] = [];
  for (let s = 0; s < shotCount; s++) {
    // Even sampling of the attackers when there are more of them than projectiles.
    const from = Math.floor((s * n) / shotCount);
    const to = Math.floor(((s + 1) * n) / shotCount);
    const swing = swings[from];
    const h = hashString(`${seed}:shot:${swing.id}`);
    shots.push({
      id: swing.id,
      kind: kind ?? PROJECTILE_KINDS[h % PROJECTILE_KINDS.length],
      launchMs: swing.delayMs + 120,
      flightMs: 480 + ((h >> 3) % 220),
      arc: -(70 + ((h >> 7) % 230)),
      hitDx: ((h >> 11) % (MONSTER_TARGET.spreadX * 2)) - MONSTER_TARGET.spreadX,
      hitDy: ((h >> 17) % (MONSTER_TARGET.spreadY * 2)) - MONSTER_TARGET.spreadY,
      weight: Math.max(1, to - from),
    });
  }
  const impacts = shots.map((s) => s.launchMs + s.flightMs);
  const firstImpactMs = Math.min(...impacts);
  const lastImpactMs = Math.max(...impacts);
  return { swings, shots, firstImpactMs, lastImpactMs, totalMs: lastImpactMs + 300 };
}
