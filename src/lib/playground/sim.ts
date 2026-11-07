import type { AvatarMood } from '@/components/avatar/Avatar';

/**
 * The lobby playground: characters wander, bump into each other and react.
 *
 * Everything is a PURE FUNCTION OF (session seed, player ids, server time). Every screen (projector,
 * teacher laptop, phones) runs this locally with the shared server clock and gets the same scene,
 * with no positions or animation frames sent over the network. A screen that opens late, or wakes
 * from a sleeping tab, simply computes "now" and is in step at once.
 *
 *  • Walking: each character has its own personality (pace, rhythm, favourite idle moves). Time is
 *    cut into per-character slots; in each slot it walks (or runs) to a new spot, then idles.
 *  • Collisions: checked on a 100 ms grid. Two characters closer than 1.7 radii start a contact; a
 *    contact counts as a new collision only after 1.5 s apart, so it never flickers. The reaction
 *    (bump, friendly wave / high-five / dance, funny spin-and-laugh, or anger when the same pair
 *    keeps colliding) is chosen from a hash of the pair and the moment, so every screen agrees.
 *  • A soft push keeps characters from ever drawing on top of each other.
 */

export const WORLD = { width: 1000, height: 700 } as const;
const TICK_MS = 100;
const GAP_TICKS = 15; // apart this long before a new collision counts
const REPEAT_TICKS = 70; // collided within the last 7 s → the same pair again may get angry
const HISTORY_TICKS = REPEAT_TICKS + GAP_TICKS + 20;
export const REACTION_MS = 1400;
const BOUNCE_MS = 700;
const CONTACT = 1.7; // × radius between centres
const PERSONAL_SPACE = 1.9;

export type SimAct =
  | 'idle'
  | 'walk'
  | 'run'
  | 'look'
  | 'wave'
  | 'jump'
  | 'dance'
  | 'stretch'
  | 'bump'
  | 'angry'
  | 'spin'
  | 'laugh'
  | 'surprised'
  | 'highfive';

export type WalkerFrame = { x: number; y: number; act: SimAct; mood: AvatarMood | null; bubble: string | null; tilt: number };

export type InteractionKind = 'bump' | 'wave' | 'highfive' | 'dance' | 'funny' | 'giggle' | 'angry';

type Personality = { h: number; slotMs: number; phaseMs: number; speed: number };
type Base = { x: number; y: number; act: SimAct; dir: number };

/* ── hashing (deterministic, engine-independent integer maths) ────────────── */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mix(a: number, b: number): number {
  let h = (a ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

const unit = (h: number) => h / 4294967296;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** Character radius (world units) for a crowd of `n`: big when few, smaller as the room fills. */
export function radiusFor(n: number): number {
  return clamp(260 / Math.sqrt(Math.max(1, n)), 20, 52);
}

const IDLE_MOVES: readonly [SimAct, number][] = [
  ['idle', 26],
  ['look', 20],
  ['wave', 12],
  ['jump', 14],
  ['dance', 14],
  ['stretch', 14],
];
const IDLE_TOTAL = IDLE_MOVES.reduce((a, [, w]) => a + w, 0);

function pickIdle(u: number): SimAct {
  let x = u * IDLE_TOTAL;
  for (const [act, w] of IDLE_MOVES) {
    if ((x -= w) < 0) return act;
  }
  return 'idle';
}

/** Interaction for a collision: anger if the pair keeps colliding, otherwise a weighted roll. */
export function interactionFor(pairHash: number, tick: number, repeat: boolean): InteractionKind {
  const u = unit(mix(pairHash, tick));
  if (repeat && unit(mix(pairHash, tick + 7919)) < 0.6) return 'angry';
  if (u < 0.34) return 'bump';
  if (u < 0.46) return 'wave';
  if (u < 0.56) return 'highfive';
  if (u < 0.66) return 'dance';
  if (u < 0.9) return 'funny';
  return 'giggle';
}

type Role = { act: SimAct; mood: AvatarMood | null; bubble: string | null };
const ROLES: Record<InteractionKind, { a: Role; b: Role; push: number }> = {
  bump: { a: { act: 'bump', mood: 'surprised', bubble: '❗' }, b: { act: 'bump', mood: 'surprised', bubble: null }, push: 0.9 },
  wave: { a: { act: 'wave', mood: 'happy', bubble: '👋' }, b: { act: 'wave', mood: 'happy', bubble: '👋' }, push: 0.25 },
  highfive: { a: { act: 'highfive', mood: 'laugh', bubble: '✋' }, b: { act: 'highfive', mood: 'laugh', bubble: null }, push: 0.35 },
  dance: { a: { act: 'dance', mood: 'happy', bubble: '🎵' }, b: { act: 'dance', mood: 'happy', bubble: null }, push: 0.25 },
  funny: { a: { act: 'spin', mood: 'dizzy', bubble: '💫' }, b: { act: 'laugh', mood: 'laugh', bubble: '😂' }, push: 1 },
  giggle: { a: { act: 'laugh', mood: 'laugh', bubble: '😂' }, b: { act: 'laugh', mood: 'laugh', bubble: null }, push: 0.6 },
  angry: { a: { act: 'angry', mood: 'angry', bubble: '💢' }, b: { act: 'surprised', mood: 'surprised', bubble: '❗' }, push: 1.1 },
};

export class PlaygroundSim {
  private readonly seed: number;
  private ids: string[] = [];
  private people = new Map<string, Personality>();
  private pairHash = new Map<string, number>();
  private contacts = new Map<number, Set<string>>();
  private r = radiusFor(1);

  constructor(seed: string) {
    this.seed = hashString(seed);
  }

  get radius(): number {
    return this.r;
  }

  /** The current players. Order does not matter; the result is the same on every screen. */
  setWalkers(ids: readonly string[]) {
    const next = [...new Set(ids)].sort();
    if (next.length === this.ids.length && next.every((id, i) => id === this.ids[i])) return;
    this.ids = next;
    this.r = radiusFor(next.length);
    this.people.clear();
    this.pairHash.clear();
    this.contacts.clear();
    for (const id of next) {
      const h = mix(this.seed, hashString(id));
      this.people.set(id, {
        h,
        slotMs: 5200 + unit(mix(h, 1)) * 3400,
        phaseMs: unit(mix(h, 2)) * 9000,
        speed: 70 + unit(mix(h, 3)) * 120,
      });
    }
  }

  private bounds() {
    const r = this.r;
    // Room above for emote bubbles and below for name labels.
    return { x0: r + 4, x1: WORLD.width - r - 4, y0: r * 2.2 + 10, y1: WORLD.height - r - 48 };
  }

  private waypoint(p: Personality, slot: number): { x: number; y: number } {
    const b = this.bounds();
    const raw = (k: number) => {
      const h = mix(p.h, k * 2 + 11);
      return { x: b.x0 + unit(h) * (b.x1 - b.x0), y: b.y0 + unit(mix(h, 5)) * (b.y1 - b.y0) };
    };
    // Average two random points so steps are shorter, then stretch back so the room is used.
    const a = raw(slot);
    const c = raw(slot - 1);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    return { x: clamp(cx + ((a.x + c.x) / 2 - cx) * 1.95, b.x0, b.x1), y: clamp(cy + ((a.y + c.y) / 2 - cy) * 1.95, b.y0, b.y1) };
  }

  /** Where a character would be with nobody else around. */
  base(id: string, t: number): Base {
    const p = this.people.get(id)!;
    const slot = Math.floor((t + p.phaseMs) / p.slotMs);
    const start = slot * p.slotMs - p.phaseMs;
    const a = this.waypoint(p, slot);
    const b = this.waypoint(p, slot + 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const walkMs = clamp((dist / p.speed) * 1000, 700, p.slotMs * 0.62);
    const e = t - start;
    if (e < walkMs) {
      const s = easeInOut(e / walkMs);
      const speed = (dist / walkMs) * 1000;
      return { x: a.x + dx * s, y: a.y + dy * s, act: speed > 210 ? 'run' : 'walk', dir: dx === 0 ? 0 : dx > 0 ? 1 : -1 };
    }
    const move = pickIdle(unit(mix(p.h, slot * 31 + 7)));
    return { x: b.x, y: b.y, act: e - walkMs < 1800 ? move : 'idle', dir: 0 };
  }

  private hashOf(key: string): number {
    let h = this.pairHash.get(key);
    if (h === undefined) {
      h = mix(this.seed, hashString(key));
      this.pairHash.set(key, h);
    }
    return h;
  }

  /** Pairs in contact at grid tick `g` (spatial hash, so O(n) for a spread-out room). */
  private contactsAt(g: number): Set<string> {
    const cached = this.contacts.get(g);
    if (cached) return cached;
    const t = g * TICK_MS;
    const limit = CONTACT * this.r;
    const pts = this.ids.map((id) => ({ id, ...this.base(id, t) }));
    const set = new Set<string>();
    forNeighbours(pts, limit, (a, b, d) => {
      if (d < limit) set.add(a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
    });
    this.contacts.set(g, set);
    return set;
  }

  private isEvent(key: string, g: number): boolean {
    if (!this.contactsAt(g).has(key)) return false;
    for (let k = 1; k <= GAP_TICKS; k++) if (this.contactsAt(g - k).has(key)) return false;
    return true;
  }

  private isRepeat(key: string, g: number): boolean {
    for (let k = g - REPEAT_TICKS; k < g - GAP_TICKS; k++) if (this.isEvent(key, k)) return true;
    return false;
  }

  /** Collisions that started in the last REACTION_MS before `t` (oldest first). */
  interactions(t: number): { key: string; a: string; b: string; tick: number; kind: InteractionKind }[] {
    const g = Math.floor(t / TICK_MS);
    for (const k of this.contacts.keys()) if (k < g - HISTORY_TICKS) this.contacts.delete(k);
    const out: { key: string; a: string; b: string; tick: number; kind: InteractionKind }[] = [];
    const span = Math.ceil(REACTION_MS / TICK_MS);
    for (let gg = g - span; gg <= g; gg++) {
      for (const key of this.contactsAt(gg)) {
        if (!this.isEvent(key, gg)) continue;
        const [a, b] = key.split('|');
        const h = this.hashOf(key);
        // Which of the two plays the "a" role is part of the hash too.
        const swap = (h & 1) === 1;
        out.push({ key, a: swap ? b : a, b: swap ? a : b, tick: gg, kind: interactionFor(h, gg, this.isRepeat(key, gg)) });
      }
    }
    return out;
  }

  /** The whole scene at server time `t`. */
  frame(t: number): Map<string, WalkerFrame> {
    const r = this.r;
    const out = new Map<string, WalkerFrame>();
    for (const id of this.ids) {
      const b = this.base(id, t);
      out.set(id, { x: b.x, y: b.y, act: b.act, mood: null, bubble: null, tilt: b.act === 'walk' || b.act === 'run' ? b.dir * 7 : 0 });
    }

    for (const ev of this.interactions(t)) {
      const fa = out.get(ev.a);
      const fb = out.get(ev.b);
      if (!fa || !fb) continue;
      const tc = ev.tick * TICK_MS;
      const role = ROLES[ev.kind];
      // Bounce apart along the line between them at the moment of contact.
      const pa = this.base(ev.a, tc);
      const pb = this.base(ev.b, tc);
      let dx = pb.x - pa.x;
      let dy = pb.y - pa.y;
      let len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-6) {
        const ang = unit(this.hashOf(ev.key)) * Math.PI * 2;
        dx = Math.cos(ang);
        dy = Math.sin(ang);
        len = 1;
      }
      const k = (t - tc) / BOUNCE_MS;
      if (k >= 0 && k < 1) {
        const push = Math.sin(k * Math.PI) * (1 - k * 0.35) * role.push * r;
        fa.x -= (dx / len) * push;
        fa.y -= (dy / len) * push;
        fb.x += (dx / len) * push;
        fb.y += (dy / len) * push;
      }
      // Later collisions override earlier ones: one animation per character at a time.
      Object.assign(fa, role.a, { tilt: 0 });
      Object.assign(fb, role.b, { tilt: 0 });
    }

    // Personal space: never draw two characters on top of each other (a few relaxation passes).
    const space = PERSONAL_SPACE * r;
    const bd = this.bounds();
    for (let pass = 0; pass < 4; pass++) {
      const pts = this.ids.map((id) => ({ id, ...out.get(id)! }));
      let moved = false;
      forNeighbours(pts, space, (a, b, d) => {
        if (d >= space) return;
        moved = true;
        const fa = out.get(a.id)!;
        const fb = out.get(b.id)!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (space - d) / 2;
        fa.x -= (dx / d) * push;
        fa.y -= (dy / d) * push;
        fb.x += (dx / d) * push;
        fb.y += (dy / d) * push;
      });
      for (const f of out.values()) {
        f.x = clamp(f.x, bd.x0, bd.x1);
        f.y = clamp(f.y, bd.y0, bd.y1);
      }
      if (!moved) break;
    }
    return out;
  }
}

/** Calls `fn` for every pair closer than `range` (uniform grid). */
function forNeighbours<T extends { id: string; x: number; y: number }>(pts: T[], range: number, fn: (a: T, b: T, d: number) => void) {
  const cell = Math.max(1, range);
  const grid = new Map<string, T[]>();
  for (const p of pts) {
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    const list = grid.get(key);
    if (list) list.push(p);
    else grid.set(key, [p]);
  }
  for (const p of pts) {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const list = grid.get(`${cx + ox},${cy + oy}`);
        if (!list) continue;
        for (const q of list) {
          if (q.id <= p.id) continue; // each pair once
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < range) fn(p, q, d);
        }
      }
    }
  }
}

/** Fixed, tidy positions for reduced motion (no walking at all). */
export function staticLayout(ids: readonly string[]): Map<string, { x: number; y: number }> {
  const sorted = [...ids].sort();
  const n = Math.max(1, sorted.length);
  const cols = Math.ceil(Math.sqrt((n * WORLD.width) / WORLD.height));
  const rows = Math.ceil(n / cols);
  const out = new Map<string, { x: number; y: number }>();
  sorted.forEach((id, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.set(id, { x: ((c + 0.5) / cols) * WORLD.width, y: 30 + ((r + 0.5) / rows) * (WORLD.height - 60) });
  });
  return out;
}
