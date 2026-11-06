import type { Transition, Variants } from 'motion/react';

/**
 * Rally motion tokens (docs/DESIGN.md §6). Mirrors the CSS tokens in src/styles/index.css.
 *
 * Rules: animate transform and opacity only; never put `layout` on lists longer than 12 items;
 * never hide content behind whileInView. Use these tokens instead of inline springs and durations.
 */

/** Durations in seconds (CSS: --dur-*). */
export const dur = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
  slow: 0.36,
  stage: 0.6,
} as const;

/** Cubic-bezier easings (CSS: --ease-*). */
export const ease = {
  out: [0.22, 1, 0.36, 1],
  in: [0.55, 0, 1, 0.45],
  wipe: [0.65, 0, 0.35, 1],
  snap: [0.2, 0.9, 0.1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

type Bezier = [number, number, number, number];
const bez = (b: readonly [number, number, number, number]): Bezier => [b[0], b[1], b[2], b[3]];

/** Named springs. `press` for taps, `pop` for arrivals, `land` for avatars, `sheet` for dialogs. */
export const spring = {
  press: { type: 'spring', stiffness: 700, damping: 40 },
  pop: { type: 'spring', stiffness: 520, damping: 24 },
  land: { type: 'spring', stiffness: 380, damping: 20, mass: 0.9 },
  sheet: { type: 'spring', stiffness: 420, damping: 40 },
  layout: { type: 'spring', stiffness: 500, damping: 38 },
  roll: { type: 'spring', stiffness: 600, damping: 38 },
} as const satisfies Record<string, Transition>;

/** Short tween presets for opacity-only changes. */
export const tween = {
  fast: { duration: dur.fast, ease: bez(ease.out) },
  base: { duration: dur.base, ease: bez(ease.out) },
  slow: { duration: dur.slow, ease: bez(ease.wipe) },
} as const satisfies Record<string, Transition>;

/* ── Variants (use with initial="hidden" animate="show" exit="exit") ───────── */

/** Page and section content: y 8 → 0 plus opacity. */
export const enterUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: bez(ease.out) } },
  exit: { opacity: 0, y: 4, transition: { duration: dur.fast, ease: bez(ease.in) } },
};

/** Plain crossfade. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base, ease: bez(ease.out) } },
  exit: { opacity: 0, transition: { duration: dur.fast, ease: bez(ease.in) } },
};

/** Arrivals the class watches (avatar joins, digit fills, check stamps): scale 0.4 → 1. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: spring.pop },
  exit: { opacity: 0, scale: 0.8, transition: { duration: dur.fast, ease: bez(ease.in) } },
};

/** Toasts and lower thirds: x -24 → 0. */
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: dur.base, ease: bez(ease.out) } },
  exit: { opacity: 0, x: -12, transition: { duration: dur.fast, ease: bez(ease.in) } },
};

/** Accent rules, bars and armed fills: scaleX 0 → 1 from the left. */
export const wipeIn: Variants = {
  hidden: { scaleX: 0, originX: 0 },
  show: { scaleX: 1, originX: 0, transition: { duration: dur.slow, ease: bez(ease.wipe) } },
  exit: { opacity: 0, transition: { duration: dur.fast } },
};

/**
 * Student join-flow step change: content slides ±24px. Pass 1 when moving forward, -1 when going back.
 * Use as `variants={stepSlide(dir)}`.
 */
export function stepSlide(direction: 1 | -1 = 1): Variants {
  return {
    hidden: { opacity: 0, x: 24 * direction },
    show: { opacity: 1, x: 0, transition: { duration: dur.base, ease: bez(ease.out) } },
    exit: { opacity: 0, x: -24 * direction, transition: { duration: dur.fast, ease: bez(ease.in) } },
  };
}

/** Stagger delay in seconds for item i; capped so long lists never wait. */
export function staggerDelay(i: number): number {
  return Math.min(Math.max(i, 0), 8) * 0.03;
}

/** Celebrations (confetti-like sweeps) only on capable devices and never under reduced motion. */
export function canCelebrate(): boolean {
  if (typeof window === 'undefined') return false;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2;
  return !reduced && cores > 4;
}

/* ── Reserved for Phase 4/5 (exported, not used by any screen yet) ─────────── */

/** Question kick-off: score bug wipes, prompt enters, tiles stagger at 40ms. Use with custom={i}. */
export const kickoff: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: dur.base, ease: bez(ease.out), delay: Math.min(i, 8) * 0.04 },
  }),
};

/** Countdown bar shrinking linearly over the real question duration (seconds via custom). */
export const countdownBar: Variants = {
  full: { scaleX: 1, originX: 0 },
  run: (seconds: number = 20) => ({ scaleX: 0, originX: 0, transition: { duration: seconds, ease: 'linear' } }),
};

/** Lock-in: chosen tile settles to 0.96; the others fade to 0.35. */
export const lockIn: Variants = {
  rest: { scale: 1, opacity: 1 },
  chosen: { scale: 0.96, opacity: 1, transition: spring.press },
  other: { scale: 1, opacity: 0.35, transition: { duration: dur.base } },
};

/** Reveal: the correct tile grows to 1.04 with the pop spring. */
export const reveal: Variants = {
  rest: { scale: 1 },
  correct: { scale: 1.04, transition: spring.pop },
};

/** Wrong or unpicked tiles after reveal (opacity only; colour comes from the answer-dim class). */
export const dimAnswer: Variants = {
  rest: { opacity: 1 },
  dim: { opacity: 0.6, transition: { duration: dur.base } },
};

/** Leaderboard row entering; reorder uses manual FLIP on translateY with spring.layout. */
export const leaderboardRow: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.layout },
};

/** Podium block rising from the bottom (scaleY), ordered 3, 2, 1 via custom delay index. */
export const podiumBlock: Variants = {
  hidden: { scaleY: 0, originY: 1 },
  show: (order: number = 0) => ({
    scaleY: 1,
    originY: 1,
    transition: { duration: dur.stage, ease: bez(ease.out), delay: order * 0.3 },
  }),
};
