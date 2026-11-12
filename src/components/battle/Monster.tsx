import '@/styles/battle.css';
import '@/styles/monsters.css';
import { Component, memo, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { BattleStage } from '@/lib/battle/monster';
import type { MonsterSpec } from '@/lib/monsters/types';
import { paletteVars } from '@/lib/monsters/colour';
import { artFor, artState } from '@/lib/monsters/art';
import { RIGS } from '@/components/monsters/registry';
import { MonsterFx } from '@/components/monsters/MonsterFx';
import { monsterState, motionFor, type MonsterActionName, type MonsterState } from '@/lib/monsters/motion';

export type MonsterAction = MonsterActionName;

type MonsterProps = {
  stage: BattleStage;
  action?: MonsterAction;
  className?: string;
  label?: string;
  /** Who to draw (the session's generated monster). Without it, or for the blob, Gloomjaw. */
  monster?: MonsterSpec | null;
  /** HP left, 0–1: a monster at 15 % or less is weakened. */
  hpFraction?: number | null;
  /** Show this state directly (previews); battles leave it to the state machine. */
  state?: MonsterState;
};

/**
 * The monster on every screen. Each generated monster is drawn by its body (rig) in its own palette;
 * stage and action drive the same CSS animations for every body (styles/battle.css, monsters.css):
 *   stage  → calm → rage (glow, sparks) → enraged (cracks, aura) → defeated (greyed, X eyes)
 *   action → idle, taking hits, a flinch, a stagger, the defeat fall, charging a special attack,
 *            regenerating, or stunned after the class stopped its special attack
 * Painted artwork (lib/monsters/art.ts) is used when it exists. Any failure falls back to Gloomjaw.
 */
export const Monster = memo(function Monster(props: MonsterProps) {
  const { monster } = props;
  if (!monster || monster.rig === 'blob' || !RIGS[monster.rig]) return <Gloomjaw {...props} />;
  return (
    <RigBoundary fallback={<Gloomjaw {...props} />}>
      <RigMonster {...props} monster={monster} />
    </RigBoundary>
  );
});

function RigMonster({ stage, action = 'idle', className, label, monster, hpFraction = null, state: forced }: MonsterProps & { monster: MonsterSpec }) {
  const Rig = RIGS[monster.rig]!;
  const state = forced ?? monsterState(stage, action, hpFraction);
  const motion = motionFor(monster, state, forced ? undefined : action);
  const art = artFor(monster.id, artState(stage, action, state === 'weakened'));
  const [brokenArt, setBrokenArt] = useState<string | null>(null);
  return (
    <div
      className={cn('mon mon-rig relative', className)}
      style={{ ...paletteVars(monster.palette), '--m-anim': motion.animation } as CSSProperties}
      data-stage={stage}
      data-action={action}
      data-state={state}
      data-motion={motion.name}
      data-rig={monster.rig}
      data-archetype={monster.archetype}
      data-movement={monster.movement}
      data-rarity={monster.rarity}
      role="img"
      aria-label={label ?? `${monster.name}, ${monster.title}`}
    >
      <div className="mon-fx size-full">
        {art && brokenArt !== art ? (
          <img src={art} alt="" className="mon-svg size-full object-contain" onError={() => setBrokenArt(art)} />
        ) : (
          <svg viewBox="0 0 400 420" className="mon-svg size-full overflow-visible">
            <Rig spec={monster} stage={stage} />
            {/* Keyed by state so one-shot effects replay each time the state is entered. */}
            <MonsterFx key={`${state}:${action}`} fx={motion.fx} rig={monster.rig} />
          </svg>
        )}
      </div>
    </div>
  );
}

/** If a body ever fails to draw, show the default monster instead of breaking the battle. */
class RigBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Monster body failed to draw; showing the default monster.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Gloomjaw, the Riddle Eater: a one-eyed, horned blob that feeds on wrong answers (the original). */
function Gloomjaw({ stage, action = 'idle', className, label = 'Gloomjaw the monster' }: MonsterProps) {
  const defeated = stage === 'defeated';
  return (
    <div className={cn('mon relative', className)} data-stage={stage} data-action={action} role="img" aria-label={label}>
      <svg viewBox="0 0 400 420" className="mon-svg size-full overflow-visible">
        <ellipse className="mon-shadow" cx="200" cy="398" rx="150" ry="18" />
        <g className="mon-body">
          {/* Back spikes */}
          <g className="mon-spikes">
            <path d="M92 150 L60 92 L128 128 Z" />
            <path d="M130 108 L118 44 L170 96 Z" />
            <path d="M232 96 L282 44 L270 108 Z" />
            <path d="M272 128 L340 92 L308 150 Z" />
          </g>
          {/* Horns */}
          <path className="mon-horn" d="M120 120 C 80 90, 70 40, 104 18 C 100 56, 122 82, 152 100 Z" />
          <path className="mon-horn" d="M280 120 C 320 90, 330 40, 296 18 C 300 56, 278 82, 248 100 Z" />
          {/* Feet */}
          <ellipse className="mon-foot" cx="132" cy="378" rx="46" ry="22" />
          <ellipse className="mon-foot" cx="268" cy="378" rx="46" ry="22" />
          {/* Body */}
          <path
            className="mon-skin"
            d="M200 86 C 300 86, 356 160, 356 252 C 356 330, 292 382, 200 382 C 108 382, 44 330, 44 252 C 44 160, 100 86, 200 86 Z"
          />
          <path className="mon-belly" d="M200 210 C 270 210, 304 262, 300 310 C 296 352, 256 372, 200 372 C 144 372, 104 352, 100 310 C 96 262, 130 210, 200 210 Z" />
          {/* Arms */}
          <g className="mon-arm mon-arm-l">
            <path className="mon-skin" d="M62 250 C 28 262, 16 300, 30 326 C 44 330, 58 312, 70 290 Z" />
            <path className="mon-claw" d="M26 322 l-8 14 l14 -6 l2 14 l8 -14 Z" />
          </g>
          <g className="mon-arm mon-arm-r">
            <path className="mon-skin" d="M338 250 C 372 262, 384 300, 370 326 C 356 330, 342 312, 330 290 Z" />
            <path className="mon-claw" d="M374 322 l8 14 l-14 -6 l-2 14 l-8 -14 Z" />
          </g>
          {/* Cracks (enraged) */}
          <g className="mon-cracks">
            <path d="M110 170 l22 26 l-10 18 l20 22" />
            <path d="M300 160 l-18 30 l14 14 l-16 26" />
            <path d="M190 120 l10 22 l-12 14" />
          </g>
          {/* Eye */}
          <g className="mon-eye">
            <ellipse className="mon-eye-white" cx="200" cy="176" rx="58" ry="50" />
            {defeated ? (
              <g className="mon-x">
                <path d="M172 150 L228 202 M228 150 L172 202" />
              </g>
            ) : (
              <>
                <circle className="mon-iris" cx="200" cy="182" r="28" />
                <circle className="mon-pupil" cx="200" cy="184" r="13" />
                <circle cx="210" cy="172" r="6" fill="#fff" />
              </>
            )}
            <path className="mon-brow" d="M136 128 Q 200 112 264 128" />
          </g>
          {/* Mouth */}
          <path className="mon-mouth" d="M128 262 Q 200 330 272 262 Q 200 290 128 262 Z" />
          <g className="mon-teeth">
            <path d="M150 272 l10 18 l8 -14 Z" />
            <path d="M184 284 l8 18 l8 -18 Z" />
            <path d="M232 276 l8 14 l10 -18 Z" />
          </g>
          {/* Stars (stunned) */}
          <g className="mon-stars">
            <path d="M150 52 l6 12 l13 2 l-10 9 l3 13 l-12 -7 l-12 7 l3 -13 l-10 -9 l13 -2 Z" />
            <path d="M232 36 l6 12 l13 2 l-10 9 l3 13 l-12 -7 l-12 7 l3 -13 l-10 -9 l13 -2 Z" />
            <path d="M282 70 l5 10 l11 2 l-8 8 l2 11 l-10 -6 l-10 6 l2 -11 l-8 -8 l11 -2 Z" />
          </g>
          {/* Steam (rage) */}
          <g className="mon-steam">
            <circle cx="96" cy="70" r="14" />
            <circle cx="306" cy="66" r="12" />
            <circle cx="80" cy="44" r="9" />
            <circle cx="322" cy="40" r="8" />
          </g>
        </g>
      </svg>
    </div>
  );
}
