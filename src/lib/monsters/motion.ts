import type { BattleStage } from '@/lib/battle/monster';
import { PERSONALITIES } from './personality';
import { ARCHETYPE_BY_ID } from './archetypes';
import type { AnimationSet, MonsterSpec } from './types';

/*
 * The monster's state machine and how each archetype moves in each state.
 *
 * The state is worked out on every screen from what the server says (HP, mode) and where the
 * battle animation is (the arena's action), so every screen shows the same thing and nothing
 * extra travels over the network. Each archetype names its own motion per state
 * (archetypes.ts → animations); every name resolves to a body motion plus an optional effect.
 * An unknown name falls back to the state's default motion, so a new archetype never breaks.
 */

export type MonsterState =
  | 'idle'
  | 'preparing'
  | 'attacking'
  | 'damaged'
  | 'defending'
  | 'recovering'
  | 'rage'
  | 'enraged'
  | 'weakened'
  | 'stunned'
  | 'defeated';

export const MONSTER_STATES: readonly MonsterState[] = ['idle', 'preparing', 'attacking', 'damaged', 'defending', 'recovering', 'rage', 'enraged', 'weakened', 'stunned', 'defeated'];

export const STATE_LABEL: Record<MonsterState, string> = {
  idle: 'Idle',
  preparing: 'Preparing attack',
  attacking: 'Attacking',
  damaged: 'Taking damage',
  defending: 'Defending',
  recovering: 'Recovering',
  rage: 'Rage',
  enraged: 'Enraged',
  weakened: 'Weakened',
  stunned: 'Stunned',
  defeated: 'Defeated',
};

/** Below this share of its HP (and above 0) a monster is weakened: slower, drooping, visibly tired. */
export const WEAKENED_AT = 0.15;

/** The arena's actions (components/battle/Monster.tsx). */
export type MonsterActionName = 'idle' | 'taking' | 'hit' | 'stagger' | 'defeat' | 'charge' | 'heal' | 'stunned' | 'brewing' | 'attack' | 'defend';

/** The state for a stage, the arena's current action and the HP left (0–1, or null if unknown). */
export function monsterState(stage: BattleStage, action: MonsterActionName = 'idle', hpFraction: number | null = null): MonsterState {
  if (stage === 'defeated' || action === 'defeat') return 'defeated';
  switch (action) {
    case 'taking':
    case 'hit':
    case 'stagger':
      return 'damaged';
    case 'charge':
    case 'attack':
      return 'attacking';
    case 'brewing':
      return 'preparing';
    case 'heal':
      return 'recovering';
    case 'defend':
      return 'defending';
    case 'stunned':
      return 'stunned';
    default:
      break;
  }
  if (hpFraction !== null && hpFraction > 0 && hpFraction <= WEAKENED_AT) return 'weakened';
  if (stage === 'enraged') return 'enraged';
  if (stage === 'rage') return 'rage';
  return 'idle';
}

/** The effect drawn with a motion (components/monsters/MonsterFx.tsx). */
export type FxKind =
  | 'breath'
  | 'bolt'
  | 'ring'
  | 'slash'
  | 'beam'
  | 'shield'
  | 'heal'
  | 'charge'
  | 'runes'
  | 'chips'
  | 'feathers'
  | 'smoke'
  | 'pebbles'
  | 'dust'
  | 'sparks'
  | 'drip';

/** A body motion: a keyframe set (styles/monsters.css, `mm-…`), its length and whether it loops. */
export type Motion = { keyframes: string; ms: number; ease?: string; loop: boolean; fx?: FxKind };

const loop = (keyframes: string, ms: number, fx?: FxKind): Motion => ({ keyframes, ms, loop: true, ease: 'ease-in-out', fx });
const once = (keyframes: string, ms: number, fx?: FxKind, ease = 'cubic-bezier(0.2, 0.8, 0.3, 1)'): Motion => ({ keyframes, ms, loop: false, ease, fx });

/** Every motion name an archetype may use. Kept in one place so names stay consistent. */
export const MOTIONS: Readonly<Record<string, Motion>> = {
  // Idle
  wingbeat: loop('mm-breathe', 2800, 'smoke'),
  hover: loop('mm-hover', 3200),
  'breathe-heavy': loop('mm-breathe', 3400, 'pebbles'),
  creak: loop('mm-sway', 4200, 'pebbles'),
  scratch: loop('mm-breathe', 2600),
  yawn: loop('mm-yawn', 4600),
  snarl: loop('mm-breathe', 2000),
  giggle: loop('mm-hop', 900),
  smoulder: loop('mm-breathe', 2400, 'smoke'),
  loom: loop('mm-loom', 4000),
  drift: loop('mm-hover', 3600),
  sway: loop('mm-sway', 3000),
  pace: loop('mm-pace', 3200),
  glide: loop('mm-glide', 3000),
  wobble: loop('mm-breathe', 2800),
  // Preparing an attack (charging)
  'chest-glow': loop('mm-gather', 900, 'charge'),
  'runes-appear': loop('mm-rise', 1100, 'runes'),
  'fists-glow': loop('mm-gather', 1000, 'charge'),
  'wind-up': loop('mm-windup', 1000),
  'element-gather': loop('mm-gather', 900, 'charge'),
  rummage: loop('mm-hop', 600),
  'blade-raise': loop('mm-rise', 1200, 'charge'),
  'scythe-raise': loop('mm-rise', 1200, 'charge'),
  'gather-dark': loop('mm-gather', 1000, 'charge'),
  bloom: loop('mm-gather', 1200, 'charge'),
  'heads-rear': loop('mm-rear', 1000),
  'eyes-glow': loop('mm-gather', 900, 'charge'),
  'rear-up': loop('mm-rear', 1100),
  crouch: loop('mm-crouch', 900),
  'feathers-blaze': loop('mm-gather', 900, 'charge'),
  brew: loop('mm-gather', 1100, 'charge'),
  // Attacking (the counter-attack)
  breath: once('mm-lunge', 900, 'breath'),
  'spell-cast': once('mm-cast', 900, 'bolt'),
  slam: once('mm-slam', 900, 'ring'),
  'club-smash': once('mm-slam', 900, 'ring'),
  stomp: once('mm-slam', 900, 'ring'),
  cleave: once('mm-lunge', 800, 'slash'),
  toss: once('mm-cast', 800, 'bolt'),
  blast: once('mm-lunge', 900, 'breath'),
  sweep: once('mm-lunge', 900, 'slash'),
  lash: once('mm-lunge', 800, 'slash'),
  gust: once('mm-cast', 900, 'breath'),
  strike: once('mm-strike', 700, 'slash'),
  gaze: once('mm-rear', 900, 'beam'),
  wave: once('mm-slam', 1000, 'ring'),
  pounce: once('mm-pounce', 900, 'slash'),
  dive: once('mm-pounce', 900, 'breath'),
  roar: once('mm-lunge', 900, 'ring'),
  // Taking damage
  'scale-crack': once('mm-flinch', 600, 'sparks'),
  'shield-crack': once('mm-flinch', 600, 'sparks'),
  chip: once('mm-flinch', 600, 'chips'),
  yelp: once('mm-flinch', 600),
  'armour-crack': once('mm-flinch', 600, 'chips'),
  tatter: once('mm-scatter', 600),
  scatter: once('mm-scatter', 600),
  recoil: once('mm-recoil', 600),
  'feathers-fly': once('mm-flinch', 600, 'feathers'),
  flinch: once('mm-flinch', 600),
  // Defending
  'wing-shield': loop('mm-brace', 1200, 'shield'),
  'shield-up': loop('mm-brace', 1200, 'shield'),
  brace: loop('mm-brace', 1200, 'shield'),
  duck: loop('mm-crouch', 800, 'shield'),
  mist: loop('mm-fade', 1400, 'shield'),
  fade: loop('mm-fade', 1400, 'shield'),
  shelter: loop('mm-brace', 1400, 'shield'),
  'coil-up': loop('mm-crouch', 1200, 'shield'),
  growl: loop('mm-crouch', 900, 'shield'),
  'wing-wrap': loop('mm-brace', 1200, 'shield'),
  // Recovering (healing)
  mend: once('mm-mend', 1300, 'heal'),
  drain: once('mm-mend', 1300, 'heal'),
  regrow: once('mm-mend', 1300, 'heal'),
  regenerate: once('mm-mend', 1300, 'heal'),
  snack: once('mm-hop', 1300, 'heal'),
  'soul-mend': once('mm-mend', 1300, 'heal'),
  reform: once('mm-mend', 1300, 'heal'),
  shed: once('mm-mend', 1300, 'heal'),
  surface: once('mm-rise', 1300, 'heal'),
  lick: once('mm-mend', 1300, 'heal'),
  'rebirth-glow': once('mm-mend', 1300, 'heal'),
  'heal-glow': once('mm-mend', 1300, 'heal'),
  // Rage and Enraged
  'wings-spread': loop('mm-rage', 1500, 'sparks'),
  'dark-expand': loop('mm-swell', 1400, 'sparks'),
  'cracks-blaze': loop('mm-rage', 1400, 'sparks'),
  flare: loop('mm-swell', 1200, 'sparks'),
  tantrum: loop('mm-hop', 700, 'sparks'),
  'eyes-flare': loop('mm-rage', 1600, 'sparks'),
  swell: loop('mm-swell', 1400, 'sparks'),
  hiss: loop('mm-thrash', 1200, 'sparks'),
  thrash: loop('mm-thrash', 1000, 'sparks'),
  howl: loop('mm-rage', 1300, 'sparks'),
  blaze: loop('mm-swell', 1200, 'sparks'),
  steam: loop('mm-rage', 1500, 'smoke'),
  // Weakened
  droop: loop('mm-droop', 3200, 'drip'),
  flicker: loop('mm-fade', 2000, 'drip'),
  slump: loop('mm-droop', 3400, 'drip'),
  cower: loop('mm-crouch', 1600, 'drip'),
  kneel: loop('mm-droop', 3200, 'drip'),
  thin: loop('mm-fade', 2400, 'drip'),
  wilt: loop('mm-droop', 3200, 'drip'),
  limp: loop('mm-droop', 2600, 'drip'),
  falter: loop('mm-droop', 2600, 'drip'),
};

/** Defeat falls are separate: they play once and hold the last frame. */
export const DEFEATS: Readonly<Record<string, Motion>> = {
  crash: once('mm-crash', 1600, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
  disperse: once('mm-disperse', 1800),
  crumble: once('mm-crumble', 1700, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
  topple: once('mm-topple', 1700, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
  faceplant: once('mm-crash', 1500, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
  kneel: once('mm-kneel', 1600, 'dust'),
  tumble: once('mm-topple', 1500, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
  dissolve: once('mm-disperse', 1800),
  collapse: once('mm-crumble', 1600, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
  evaporate: once('mm-disperse', 1800),
  'fade-petals': once('mm-disperse', 1800),
  sink: once('mm-sink', 1800),
  slump: once('mm-kneel', 1600, 'dust'),
  'ash-fall': once('mm-sink', 1800, 'smoke'),
  fall: once('mm-crash', 1600, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
};

/** Each state's default motion, used when an archetype names something unknown. */
const DEFAULTS: Record<MonsterState, Motion> = {
  idle: loop('mm-breathe', 2800),
  preparing: loop('mm-gather', 1000, 'charge'),
  attacking: once('mm-lunge', 900),
  damaged: once('mm-flinch', 600),
  defending: loop('mm-brace', 1200, 'shield'),
  recovering: once('mm-mend', 1300, 'heal'),
  rage: loop('mm-rage', 1500, 'sparks'),
  enraged: loop('mm-rage', 800, 'sparks'),
  weakened: loop('mm-droop', 3200, 'drip'),
  stunned: loop('mm-stunned', 1400),
  defeated: once('mm-crash', 1600, 'dust', 'cubic-bezier(0.5, 0, 0.75, 0)'),
};

const SLOT: Record<MonsterState, keyof AnimationSet | null> = {
  idle: 'idle',
  preparing: 'charge',
  attacking: 'attack',
  damaged: 'hit',
  defending: 'defend',
  recovering: 'recover',
  rage: 'rage',
  enraged: 'rage',
  weakened: 'weakened',
  stunned: null,
  defeated: 'defeat',
};

export type ResolvedMotion = {
  /** The archetype's name for it (or "default"). */
  name: string;
  /** CSS animation shorthand for the body. */
  animation: string;
  fx: FxKind | null;
  loop: boolean;
};

/**
 * The arena's timing for taking damage, kept for every body: a quick jitter while the class's
 * hits land, and a big knock-back after a heavy blow. The archetype's hit effect still plays.
 */
const DAMAGE_TIMING: Partial<Record<MonsterActionName, string>> = {
  taking: 'mon-taking 180ms linear infinite',
  stagger: 'mon-stagger 1000ms cubic-bezier(0.2, 0.8, 0.3, 1) 1 both',
};

/** How this monster moves in this state, timed by its personality (loops only: one-shots keep the battle's timing). */
export function motionFor(spec: MonsterSpec, state: MonsterState, action?: MonsterActionName): ResolvedMotion {
  const slot = SLOT[state];
  const archetype = ARCHETYPE_BY_ID.get(spec.archetype);
  const name = slot && archetype ? archetype.animations[slot] : null;
  const table = state === 'defeated' ? DEFEATS : MOTIONS;
  const motion = (name && table[name]) || DEFAULTS[state];
  const tempo = PERSONALITIES[spec.personality]?.tempo ?? 1;
  // Enraged is the rage motion played faster; weakened is always slow.
  const speed = state === 'enraged' ? tempo * 1.7 : state === 'weakened' ? 1 : tempo;
  const ms = Math.round(motion.loop ? motion.ms / speed : motion.ms);
  const animation = motion.loop
    ? `${motion.keyframes} ${ms}ms ${motion.ease ?? 'ease-in-out'} infinite`
    : `${motion.keyframes} ${ms}ms ${motion.ease ?? 'ease-out'} 1 both`;
  const timing = state === 'damaged' && action ? DAMAGE_TIMING[action] : undefined;
  return {
    name: name && table[name] ? name : 'default',
    animation: timing ?? animation,
    fx: motion.fx ?? null,
    loop: timing ? action === 'taking' : motion.loop,
  };
}
