import { Component, type ReactNode } from 'react';
import { m, useReducedMotion, type TargetAndTransition } from 'motion/react';
import { Avatar } from '@/components/avatar/Avatar';
import { cn } from '@/lib/cn';
import type { ThemeId } from '@/lib/leaderboard/types';

/*
 * The 20 animation themes, drawn as small original SVG props around the player's own avatar.
 * Everything animates transform and opacity only. Each theme = a motion path for the avatar plus
 * an optional prop layer (viewBox 0 0 100 100, covering 2× the avatar, avatar in the middle).
 */

type Prop = (p: { t: (delay?: number) => { duration: number; delay: number; times?: number[]; ease?: 'easeInOut' } }) => ReactNode;

type ThemeDef = { avatar: TargetAndTransition; prop?: Prop };

const ink = '#121214';

const THEME_DEFS: Record<ThemeId, ThemeDef> = {
  // ── Rank up ────────────────────────────────────────────────────────────────
  superhero: {
    avatar: { y: [0, 6, -30, -22, 0], rotate: [0, 0, -8, 4, 0], scale: [1, 0.95, 1.12, 1.08, 1] },
    prop: ({ t }) => (
      <>
        <m.path d="M38 52 L22 92 L50 80 L78 92 L62 52 Z" fill="#C8361A" style={{ originY: 0 }} initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }} transition={t()} />
        {[30, 50, 70].map((x, i) => (
          <m.rect key={x} x={x} y={78} width={2} height={14} rx={1} fill="#F3F4F1" animate={{ y: [0, 0, 12], opacity: [0, 0.9, 0] }} transition={t(0.3 + i * 0.05)} />
        ))}
      </>
    ),
  },
  rocket: {
    avatar: { y: [0, 3, -40, -34, 0], scale: [1, 0.96, 1, 1, 1] },
    prop: ({ t }) => (
      <m.g animate={{ y: [0, 3, -40, -34, 0], opacity: [0, 1, 1, 1, 0] }} transition={t()}>
        <path d="M40 74 h20 l-4 12 h-12 Z" fill="#E8E5DD" stroke={ink} strokeWidth={1.5} />
        <path d="M40 76 l-8 8 h8 Z M60 76 l8 8 h-8 Z" fill="#C8361A" />
        <m.path d="M44 86 Q50 104 56 86 Z" fill="#F2B100" animate={{ scaleY: [1, 1.5, 1, 1.4, 1] }} style={{ originY: 0 }} transition={t()} />
      </m.g>
    ),
  },
  ninja: {
    avatar: { opacity: [1, 0, 0, 1, 1], scale: [1, 0.6, 0.6, 1.1, 1] },
    prop: ({ t }) => (
      <>
        {[
          [40, 52],
          [58, 46],
          [50, 60],
          [44, 40],
          [60, 58],
        ].map(([cx, cy], i) => (
          <m.circle key={i} cx={cx} cy={cy} r={10} fill="#A3A9B0" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 0.85, 0], scale: [0, 1.5, 1.9] }} transition={t(i * 0.04)} />
        ))}
        <m.path d="M20 20 l8 3 l-8 3 Z" fill={ink} animate={{ x: [0, 60], opacity: [0, 1, 0] }} transition={t(0.2)} />
      </>
    ),
  },
  elevator: {
    avatar: { y: [0, -4, -18, -18, 0] },
    prop: ({ t }) => (
      <m.g animate={{ y: [0, -4, -18, -18, 0], opacity: [0, 1, 1, 1, 0] }} transition={t()}>
        <rect x={22} y={20} width={56} height={62} rx={4} fill="none" stroke="#F2B100" strokeWidth={3} />
        <path d="M50 8 l7 8 h-14 Z" fill="#F2B100" />
      </m.g>
    ),
  },
  'giant-hand': {
    avatar: { y: [0, 0, -6, -36, 0], rotate: [0, 0, 6, -4, 0] },
    prop: ({ t }) => (
      <m.g initial={{ y: -60 }} animate={{ y: [-60, -18, -18, -54, -90], opacity: [0, 1, 1, 1, 0] }} transition={t()}>
        <path d="M34 30 q0 -12 8 -12 v18 v-22 q0 -6 5 -6 q5 0 5 6 v22 v-20 q0 -6 5 -6 q5 0 5 6 v22 q0 -10 6 -10 q4 0 4 6 v14 q0 14 -14 20 h-12 q-14 -4 -17 -16 Z" fill="#F6CDAF" stroke={ink} strokeWidth={1.5} />
      </m.g>
    ),
  },
  'dragon-flight': {
    avatar: { y: [0, -8, -36, -26, 0], x: [0, -4, 4, 0, 0] },
    prop: ({ t }) => (
      <m.g animate={{ y: [0, -8, -36, -26, 0], opacity: [0, 1, 1, 1, 0] }} transition={t()}>
        <ellipse cx={50} cy={84} rx={24} ry={8} fill="#22B07D" />
        <m.path d="M30 82 L10 66 L28 74 Z" fill="#127A4C" animate={{ rotate: [0, -20, 0, -20, 0] }} style={{ originX: '30px', originY: '82px' }} transition={t()} />
        <m.path d="M70 82 L90 66 L72 74 Z" fill="#127A4C" animate={{ rotate: [0, 20, 0, 20, 0] }} style={{ originX: '70px', originY: '82px' }} transition={t()} />
        <circle cx={76} cy={80} r={5} fill="#22B07D" />
        <circle cx={78} cy={79} r={1.2} fill={ink} />
      </m.g>
    ),
  },
  'victory-parade': {
    avatar: { x: [0, -6, 6, -4, 0], y: [0, -6, -3, -6, 0] },
    prop: ({ t }) => (
      <>
        <m.g animate={{ opacity: [0, 1, 1, 1, 0] }} transition={t()}>
          <rect x={20} y={78} width={60} height={10} rx={3} fill="#3B5BEA" />
          <circle cx={30} cy={90} r={4} fill={ink} />
          <circle cx={70} cy={90} r={4} fill={ink} />
        </m.g>
        {[18, 32, 46, 60, 74, 86].map((x, i) => (
          <m.rect key={x} x={x} y={10} width={4} height={6} fill={['#F2B100', '#B8285F', '#0A7A6E', '#3B5BEA'][i % 4]} animate={{ y: [0, 50], rotate: [0, 180], opacity: [0, 1, 0] }} transition={t(0.15 + i * 0.06)} />
        ))}
      </>
    ),
  },
  evolution: {
    avatar: { scale: [1, 0.85, 1.25, 1.1, 1] },
    prop: ({ t }) => (
      <>
        {[0, 0.15, 0.3].map((d) => (
          <m.circle key={d} cx={50} cy={50} r={22} fill="none" stroke="#D7F23A" strokeWidth={2} animate={{ scale: [0.6, 1.8], opacity: [0, 1, 0] }} transition={t(0.2 + d)} />
        ))}
        {[
          [24, 30],
          [76, 28],
          [80, 66],
          [20, 70],
        ].map(([x, y], i) => (
          <m.path key={i} d={`M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5} Z`} fill="#F2B100" animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }} transition={t(0.35 + i * 0.08)} />
        ))}
      </>
    ),
  },

  // ── Rank down ──────────────────────────────────────────────────────────────
  titanic: {
    avatar: { y: [0, 4, 22, 20, 0], rotate: [0, 8, 14, 0, 0] },
    prop: ({ t }) => (
      <>
        <m.g animate={{ y: [0, 4, 26, 30, 30], rotate: [0, 8, 18, 22, 22], opacity: [0, 1, 1, 0.6, 0] }} style={{ originX: '50px', originY: '80px' }} transition={t()}>
          <path d="M22 76 h56 l-8 12 h-40 Z" fill="#8A5A00" />
          <rect x={46} y={60} width={3} height={16} fill={ink} />
          <path d="M49 60 l14 8 h-14 Z" fill="#F3F4F1" />
        </m.g>
        <m.path d="M10 90 q10 -6 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#3B5BEA" strokeWidth={3} animate={{ x: [0, -10, 0], opacity: [0, 1, 1, 0] }} transition={t()} />
      </>
    ),
  },
  parachute: {
    avatar: { y: [0, -8, 6, 26, 0] },
    prop: ({ t }) => (
      <m.g animate={{ y: [0, -8, 6, 26, 0], opacity: [0, 1, 1, 1, 0] }} transition={t()}>
        <m.path d="M20 30 Q50 0 80 30 Z" fill="#B8285F" animate={{ scale: [1, 1, 0.3, 0.3, 0.3] }} style={{ originX: '50px', originY: '30px' }} transition={t()} />
        <path d="M24 30 L44 46 M76 30 L56 46" stroke={ink} strokeWidth={1} />
      </m.g>
    ),
  },
  banana: {
    avatar: { x: [0, 4, 18, 8, 0], rotate: [0, -12, 70, 20, 0], y: [0, -6, 10, 4, 0] },
    prop: ({ t }) => (
      <m.path d="M36 88 q14 -10 28 0 q-6 -4 -14 -2 q-8 -2 -14 2 Z" fill="#F2B100" stroke="#8A5A00" strokeWidth={1.2} animate={{ x: [0, 0, -12, -20], opacity: [0, 1, 1, 0] }} transition={t()} />
    ),
  },
  throne: {
    avatar: { y: [0, -4, -4, 22, 0] },
    prop: ({ t }) => (
      <>
        <m.path d="M28 62 v24 h10 v-12 h24 v12 h10 v-24 l-6 -18 l-8 8 l-8 -12 l-8 12 l-8 -8 Z" fill="#E8B21A" stroke={ink} strokeWidth={1.2} animate={{ opacity: [0, 1, 1, 0], x: [0, 0, -10, -16], rotate: [0, 0, -18, -30], y: [0, 0, 10, 24] }} transition={t()} />
        <m.path d="M50 50 l3 10 l-5 8 l4 10" fill="none" stroke={ink} strokeWidth={1.5} animate={{ opacity: [0, 0, 1, 0] }} transition={t()} />
      </>
    ),
  },
  tornado: {
    avatar: { rotate: [0, 0, 360, 720, 720], scale: [1, 0.9, 0.8, 0.95, 1], y: [0, -6, -10, 10, 0] },
    prop: ({ t }) => (
      <m.g animate={{ rotate: [0, 0, 180, 360], opacity: [0, 1, 1, 0] }} style={{ originX: '50px', originY: '50px' }} transition={t()}>
        {[
          [50, 20, 30],
          [50, 36, 24],
          [50, 52, 18],
          [50, 68, 12],
          [50, 82, 7],
        ].map(([cx, cy, rx]) => (
          <ellipse key={cy} cx={cx} cy={cy} rx={rx} ry={4} fill="none" stroke="#A3A9B0" strokeWidth={2.5} />
        ))}
      </m.g>
    ),
  },
  meteor: {
    avatar: { x: [0, 0, -5, 5, 0], y: [0, 0, 12, 18, 0] },
    prop: ({ t }) => (
      <>
        <m.g initial={{ x: 40, y: -40 }} animate={{ x: [40, 0, 0], y: [-40, 0, 0], opacity: [0, 1, 0] }} transition={t()}>
          {[
            [58, 30],
            [62, 26],
            [62, 30],
            [66, 26],
            [70, 22],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={4} height={4} fill={i < 3 ? '#C8361A' : '#F2B100'} />
          ))}
        </m.g>
        <m.path d="M50 30 l4 10 l10 -4 l-6 9 l10 6 l-12 1 l2 11 l-8 -8 l-8 8 l2 -11 l-12 -1 l10 -6 l-6 -9 l10 4 Z" fill="#F2B100" stroke={ink} strokeWidth={1} animate={{ scale: [0, 0, 1.2, 0], opacity: [0, 0, 1, 0] }} style={{ originX: '50px', originY: '45px' }} transition={t()} />
      </>
    ),
  },
  volcano: {
    avatar: { y: [0, -36, -42, 12, 0], rotate: [0, 120, 300, 360, 360] },
    prop: ({ t }) => (
      <>
        <m.path d="M20 96 L40 70 h20 L80 96 Z" fill="#5E5A53" animate={{ opacity: [0, 1, 1, 0] }} transition={t()} />
        {[42, 50, 58].map((x, i) => (
          <m.circle key={x} cx={x} cy={70} r={3.5} fill="#FF7A5C" animate={{ y: [0, -30 - i * 6, 0], opacity: [0, 1, 0] }} transition={t(0.1 + i * 0.07)} />
        ))}
      </>
    ),
  },

  // ── Idle and reactions ─────────────────────────────────────────────────────
  'crown-polish': {
    avatar: { y: [0, -3, 0, -3, 0] },
    prop: ({ t }) => (
      <>
        <path d="M36 22 l6 8 l8 -10 l8 10 l6 -8 v14 h-28 Z" fill="#E8B21A" stroke={ink} strokeWidth={1.2} />
        <m.rect x={34} y={30} width={10} height={6} rx={2} fill="#F3F4F1" animate={{ x: [0, 20, 0, 20, 0] }} transition={t()} />
        <m.path d="M70 18 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#F3F4F1" animate={{ scale: [0, 1, 0, 1, 0] }} style={{ originX: '70px', originY: '23px' }} transition={t()} />
      </>
    ),
  },
  'ufo-scan': {
    avatar: { y: [0, -4, -6, -4, 0] },
    prop: ({ t }) => (
      <m.g animate={{ x: [-20, 0, 0, 20], opacity: [0, 1, 1, 0] }} transition={t()}>
        <m.path d="M40 22 L28 70 h44 L60 22 Z" fill="#D7F23A" animate={{ opacity: [0, 0.35, 0.15, 0.35, 0] }} transition={t()} />
        <ellipse cx={50} cy={18} rx={18} ry={5} fill="#A3A9B0" stroke={ink} strokeWidth={1} />
        <path d="M42 15 q8 -10 16 0 Z" fill="#3B5BEA" />
      </m.g>
    ),
  },
  'victory-dance': {
    avatar: { rotate: [0, -12, 12, -12, 12, 0], y: [0, -6, 0, -6, 0, 0] },
    prop: ({ t }) => (
      <>
        {[
          [24, 30],
          [74, 24],
        ].map(([x, y], i) => (
          <m.g key={x} animate={{ y: [0, -16], opacity: [0, 1, 0] }} transition={t(i * 0.4)}>
            <path d={`M${x} ${y} v-10 l6 -2 v10`} fill="none" stroke="#F3F4F1" strokeWidth={1.8} />
            <circle cx={x - 1.5} cy={y} r={2.5} fill="#F3F4F1" />
          </m.g>
        ))}
      </>
    ),
  },
  'comic-reaction': {
    avatar: { scale: [1, 1.12, 0.96, 1.04, 1] },
    prop: ({ t }) => (
      <m.g initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1, 1, 0] }} style={{ originX: '76px', originY: '24px' }} transition={t()}>
        <path d="M62 12 h28 v18 h-16 l-6 6 v-6 h-6 Z" fill="#F3F4F1" stroke={ink} strokeWidth={1.2} />
        <text x={76} y={26} textAnchor="middle" fontSize={11} fontWeight={900} fill={ink} fontFamily="Inter Variable, Inter, sans-serif">
          !?
        </text>
      </m.g>
    ),
  },
  'dragon-companion': {
    avatar: { y: [0, -2, 0] },
    prop: ({ t }) => (
      <m.g animate={{ x: [0, 22, 0, -22, 0], y: [0, -18, -30, -18, 0], opacity: [0, 1, 1, 1, 0] }} transition={t()}>
        <ellipse cx={20} cy={70} rx={8} ry={5} fill="#22B07D" />
        <path d="M16 66 l-6 -8 l8 4 Z" fill="#127A4C" />
        <circle cx={27} cy={68} r={3.5} fill="#22B07D" />
        <circle cx={28} cy={67} r={0.9} fill={ink} />
      </m.g>
    ),
  },

  fallback: { avatar: { y: [0, -8, 0, -4, 0] } },
};

type ActorProps = {
  code: string;
  theme: ThemeId;
  /** When true the theme plays once (after `delayMs`). */
  play: boolean;
  delayMs?: number;
  durationMs?: number;
  className?: string;
  /** Props are hidden on small screens; the avatar motion still runs. */
  simplified?: boolean;
  onError?: (theme: ThemeId) => void;
};

function ThemeLayer({ code, theme, play, delayMs = 0, durationMs = 1800, className, simplified }: ActorProps) {
  const reduce = useReducedMotion();
  const def = THEME_DEFS[theme] ?? THEME_DEFS.fallback;
  const transition = (extra = 0) => ({ duration: durationMs / 1000, delay: delayMs / 1000 + extra, ease: 'easeInOut' as const });
  const active = play && !reduce;
  return (
    <span className={cn('relative inline-block', className)}>
      <m.span className="block size-full" animate={active ? def.avatar : undefined} transition={transition()}>
        <Avatar code={code} className="size-full rounded-full" />
      </m.span>
      {active && def.prop && !simplified && (
        <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-1/2 z-10 size-[200%] overflow-visible">
          {def.prop({ t: transition })}
        </svg>
      )}
    </span>
  );
}

class ThemeBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The player's avatar with one theme animation. If the theme fails to render, the boundary
 * reports it (the engine will not pick it again) and shows the plain bounce instead, so an
 * animation problem can never block the leaderboard.
 */
export function ThemeActor(props: ActorProps) {
  return (
    <ThemeBoundary
      key={`${props.theme}-${props.play}`}
      onError={() => props.onError?.(props.theme)}
      fallback={<ThemeLayer {...props} theme="fallback" />}
    >
      <ThemeLayer {...props} />
    </ThemeBoundary>
  );
}
