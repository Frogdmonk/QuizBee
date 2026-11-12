import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { reactionLine, superEffective } from '@/lib/monsters/reactions';
import { cn } from '@/lib/cn';
import { hashString } from '@/lib/playground/sim';
import { ARENA, CLASS_ZONE, MONSTER_TARGET, formation } from '@/lib/battle/formation';
import { planAttack } from '@/lib/battle/choreography';
import { battleStage, hitSeverity, monsterOf, specialAttack, STAGE_LABEL } from '@/lib/battle/monster';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { music } from '@/lib/audio/engine';
import { Hero } from '@/components/avatar/Hero';
import type { BattleAttack, BattleState } from '@/types/game';
import { Monster, type MonsterAction } from './Monster';
import { WeaponIcon } from './WeaponIcon';
import { weaponArt } from '@/lib/battle/weapons';
import { ENERGY_REASON } from '@/lib/battle/powerups';
import { HpBar } from './HpBar';

export type ArenaPlayer = { id: string; avatar: string; nickname: string };

/** Where the monster is drawn in the 1600×900 world. */
const MONSTER_BOX = { left: 960, top: 250, width: 500, height: 525 };

/**
 * The battle arena on the projector: the class on the left, the monster on the right. When `attack`
 * is given (the reveal of a question), every student whose answer was correct winds up and fires at
 * the monster, the hits land, and the HP bar drops to the server's figure. Everything is played
 * locally from that one result; nothing about the animation travels over the network.
 *
 * No names in the arena on purpose: it should not single out who missed. Students who missed cheer
 * the attackers on.
 */
export function BattleArena({
  battle,
  players,
  attack,
  sound = false,
  weapon,
  equipping = false,
  className,
}: {
  battle: BattleState;
  players: readonly ArenaPlayer[];
  attack: BattleAttack | null;
  sound?: boolean;
  /** The weapon the class holds (default: the equipped one). */
  weapon?: string | null;
  /** The weapon has just been chosen: it pops into every student's hand. */
  equipping?: boolean;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // Fit the 1600×900 world into the box the page gives us.
  useEffect(() => {
    const frame = frameRef.current;
    const world = worldRef.current;
    if (!frame || !world) return;
    const fit = () => {
      const { width, height } = frame.getBoundingClientRect();
      const scale = Math.min(width / ARENA.width, height / ARENA.height) || 0;
      world.style.transform = `translate(${(width - ARENA.width * scale) / 2}px, ${(height - ARENA.height * scale) / 2}px) scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={cn('relative overflow-hidden', className)}>
      <Backdrop />
      <div ref={worldRef} className="absolute top-0 left-0 origin-top-left" style={{ width: ARENA.width, height: ARENA.height }}>
        <Scene
          key={`${attack?.questionId ?? 'idle'}:${equipping ? 'equip' : ''}`}
          battle={battle}
          players={players}
          attack={attack}
          sound={sound}
          held={attack ? attack.weapon : weapon !== undefined ? weapon : (battle.weapon?.key ?? null)}
          equipping={equipping}
        />
      </div>
    </div>
  );
}

/**
 * The reveal, in order: the class winds up and fires (windup → taking), the hits land and HP drops
 * (landed); then either the special attack was stopped (the monster is stunned) or the monster
 * counter-attacks (counter: a shock wave at the class) and regenerates (healed).
 */
type Step = 'windup' | 'taking' | 'landed' | 'prepare' | 'counter' | 'healed' | 'settled';

/** Delays after the last hit lands. */
/** After the hits land: the monster gathers itself (prepare), then counter-attacks. */
const PREPARE_MS = 450;
const COUNTER_MS = 900;
const HEALED_MS = 1700;

const Scene = memo(function Scene({
  battle,
  players,
  attack,
  sound,
  held,
  equipping,
}: {
  battle: BattleState;
  players: readonly ArenaPlayer[];
  attack: BattleAttack | null;
  sound: boolean;
  held: string | null;
  equipping: boolean;
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const plan = useMemo(
    () => (attack ? planAttack(attack.attackers, attack.questionId, weaponArt(attack.weapon)?.projectile) : null),
    [attack],
  );
  const [step, setStep] = useState<Step>(() => (attack && !reduced ? 'windup' : 'settled'));

  const hpAfterHits = attack ? Math.max(0, attack.hpBefore - attack.damage) : 0;
  const counters = Boolean(attack && attack.defended === false && hpAfterHits > 0);
  const stopped = Boolean(attack && attack.defended === true && hpAfterHits > 0);

  useEffect(() => {
    if (!attack || !plan || reduced) return;
    const t = plan.totalMs;
    const timers = [window.setTimeout(() => setStep('taking'), plan.firstImpactMs), window.setTimeout(() => setStep('landed'), t)];
    if (counters) {
      timers.push(window.setTimeout(() => setStep('prepare'), t + PREPARE_MS));
      timers.push(window.setTimeout(() => setStep('counter'), t + COUNTER_MS));
      timers.push(window.setTimeout(() => setStep('healed'), t + HEALED_MS));
      timers.push(window.setTimeout(() => setStep('settled'), t + HEALED_MS + 1300));
    } else {
      timers.push(window.setTimeout(() => setStep('settled'), t + 1100));
    }
    if (sound) {
      if (plan.shots.length > 0) music.sfxIn('whoosh', plan.shots[0].launchMs);
      // In time order: the engine drops a hit that comes too soon after the previous one.
      const impacts = plan.shots.map((s) => s.launchMs + s.flightMs).sort((a, b) => a - b);
      impacts.forEach((ms) => music.sfxIn('hit', ms));
      if (attack.hpAfter === 0 && attack.hpBefore > 0) music.sfxIn('victory', t);
      else if (counters) {
        music.sfxIn('roar', t + COUNTER_MS - 200);
        if (attack.heal > 0) music.sfxIn('heal', t + HEALED_MS);
      } else if (stopped) music.sfxIn('block', t + 150);
      else if (hitSeverity(attack.damage, battle.maxHp) === 'stagger') music.sfxIn('roar', t + 120);
    }
    return () => timers.forEach(window.clearTimeout);
  }, [attack, plan, reduced, sound, battle.maxHp, counters, stopped]);

  const maxHp = battle.maxHp ?? 0;
  const landed = step !== 'windup' && step !== 'taking';
  const hp = !attack ? (battle.hp ?? maxHp) : !landed ? attack.hpBefore : step === 'landed' || step === 'prepare' || step === 'counter' ? hpAfterHits : attack.hpAfter;
  const stage = battleStage(hp, maxHp, battle.config);
  const severity = attack ? hitSeverity(attack.damage, maxHp) : 'none';
  // A monster that is winning (the class did not stop its special) defends while the hits land,
  // then gathers itself and counter-attacks.
  const action: MonsterAction =
    stage === 'defeated'
      ? 'defeat'
      : step === 'taking'
        ? counters
          ? 'defend'
          : 'taking'
        : step === 'prepare'
          ? 'brewing'
        : step === 'landed' && severity !== 'none'
          ? severity
          : step === 'counter'
            ? 'charge'
            : step === 'healed'
              ? 'heal'
              : stopped && step === 'settled'
                ? 'stunned'
                : 'idle';
  const special = attack?.mode && attack.mode !== 'defeated' ? specialAttack(monsterOf(battle), attack.mode) : null;

  const spots = useMemo(() => formation(players.length), [players.length]);
  const spotOf = useMemo(() => new Map(players.map((p, i) => [p.id, spots[i]])), [players, spots]);
  const swingOf = useMemo(() => new Map(plan?.swings.map((s) => [s.id, s.delayMs]) ?? []), [plan]);
  const info = monsterOf(battle);
  const say = attack && landed ? reactionLine(info, attack, maxHp || null) : null;
  const strongWeapon = Boolean(attack && landed && superEffective(info, attack.weapon));
  const playing = Boolean(attack) && !reduced && step !== 'settled';

  return (
    <div className="ba-scene absolute inset-0" data-shake={step === 'landed' && severity === 'stagger' && !reduced ? 'true' : undefined}>
      {/* Monster name and health */}
      <div className="absolute top-[34px] right-[60px] left-[860px] flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4 text-night-text">
          <p className="type-display text-[46px] leading-none">
            {info.name} <span className="text-[26px] text-night-muted">{info.title}</span>
          </p>
          <span
            className={cn(
              'rounded-xs px-3 py-1 text-[22px] font-bold uppercase',
              stage === 'normal' ? 'bg-night-800 text-night-text' : stage === 'defeated' ? 'bg-success-400 text-night-950' : 'bg-rose-500 text-white',
            )}
          >
            {STAGE_LABEL[stage]}
          </span>
        </div>
        <HpBar hp={hp} maxHp={maxHp} size="stage" className="[&_.type-score]:text-[30px] [&_[role=meter]]:h-[30px]" />
      </div>

      {/* The class */}
      {players.map((p, index) => {
        const spot = spotOf.get(p.id);
        if (!spot) return null;
        const delay = swingOf.get(p.id);
        const act = !attack || reduced ? 'idle' : step === 'counter' ? 'brace' : delay !== undefined ? 'attack' : 'cheer';
        const h = hashString(p.id);
        // A full figure: as wide as the old head, feet where the bottom of the head used to be.
        const w = spot.size * 0.95;
        return (
          <div
            key={p.id}
            className="ba-hero"
            data-act={act}
            style={
              {
                left: spot.x - w / 2,
                top: spot.y + spot.size / 2 - w * 1.5,
                width: w,
                height: w * 1.5,
                zIndex: Math.round(spot.y),
                '--d': `${delay ?? (h % 600)}ms`,
                '--idle': `${-(h % 2600)}ms`,
              } as CSSProperties
            }
          >
            <div className="ba-fig size-full">
              <Hero
                code={p.avatar}
                size={w}
                pose={act === 'attack' ? 'attack' : act === 'brace' ? 'brace' : act === 'cheer' || equipping ? 'cheer' : 'idle'}
                mood={act === 'attack' && landed ? 'laugh' : act === 'attack' ? 'happy' : equipping ? 'happy' : null}
                weapon={held}
                equipping={equipping && !reduced}
                delayMs={act === 'attack' ? (delay ?? 0) : equipping ? 300 + ((index * 70) % 1600) : h % 2600}
              />
            </div>
          </div>
        );
      })}

      {/* The monster */}
      <div className="absolute" style={{ left: MONSTER_BOX.left, top: MONSTER_BOX.top, width: MONSTER_BOX.width, height: MONSTER_BOX.height }}>
        <Monster monster={info} stage={stage} action={action} hpFraction={maxHp ? hp / maxHp : null} className="size-full" label={`${info.name}, ${STAGE_LABEL[stage].toLowerCase()}, ${hp} of ${maxHp} HP`} />
      </div>

      {/* Projectiles and hits */}
      {playing &&
        plan?.shots.map((s) => {
          const from = spotOf.get(s.id) ?? { x: (CLASS_ZONE.x0 + CLASS_ZONE.x1) / 2, y: (CLASS_ZONE.y0 + CLASS_ZONE.y1) / 2, size: 60 };
          const tx = MONSTER_TARGET.x + s.hitDx;
          const ty = MONSTER_TARGET.y + s.hitDy;
          return (
            <span key={`shot-${s.id}`}>
              <span
                className="ba-shot-x"
                style={{ left: from.x, top: from.y, '--dx': `${tx - from.x}px`, '--delay': `${s.launchMs}ms`, '--dur': `${s.flightMs}ms` } as CSSProperties}
              >
                <span className="ba-shot-y" style={{ '--dy': `${ty - from.y}px`, '--arc': `${s.arc}px`, '--delay': `${s.launchMs}ms`, '--dur': `${s.flightMs}ms` } as CSSProperties}>
                  <span className="ba-proj" data-kind={s.kind} />
                </span>
              </span>
              <span className="ba-spark" style={{ left: tx, top: ty, '--at': `${s.launchMs + s.flightMs}ms` } as CSSProperties} aria-hidden />
              <span className="ba-impact" style={{ left: tx, top: ty, '--at': `${s.launchMs + s.flightMs}ms` } as CSSProperties}>
                −{s.weight * (attack?.perHit ?? battle.baseDamage)}
              </span>
            </span>
          );
        })}

      {/* What the monster says about this question (one line, at the class, never at a student) */}
      {say && (
        <p key={`say-${attack?.questionId}`} className="mon-say absolute" style={{ left: MONSTER_BOX.left - 300, top: MONSTER_BOX.top + 24, width: 300 }}>
          {say}
        </p>
      )}

      {/* The counter-attack: a shock wave rolls across to the class; then the monster heals. */}
      {step === 'counter' && <span className="ba-wave" style={{ left: MONSTER_BOX.left + 40, top: 360 }} aria-hidden />}
      {attack && (step === 'healed' || (step === 'settled' && counters)) && attack.heal > 0 && (
        <p className="ba-heal type-display absolute text-center text-[64px] leading-none text-success-400" style={{ left: MONSTER_BOX.left - 230, width: 260, top: 430 }}>
          +{attack.heal} HP
        </p>
      )}

      {/* What happened: weapon effects, the special attack, a weapon unlock */}
      {attack && landed && (
        <div role="status" className="absolute top-[24px] left-[50px] flex w-[740px] flex-col gap-2">
          {(weaponLine(attack) || attack.frozen || strongWeapon) && (
            <div className="ba-banner rounded-md bg-night-950/90 px-5 py-2 text-night-text ring-2" style={{ '--tw-ring-color': weaponArt(attack.weapon)?.color } as CSSProperties}>
              <p className="flex items-center gap-3 text-[24px] leading-tight font-bold">
                {attack.weapon && <WeaponIcon weapon={attack.weapon} className="size-9 shrink-0" />}
                {attack.frozen ? 'Deep Freeze! The special attack is frozen.' : weaponLine(attack)}
              </p>
              {strongWeapon && <p className="mt-1 text-[20px] font-bold text-sun-400">Super effective! {info.name} fears this weapon.</p>}
            </div>
          )}
          {special && attack.defended !== null && hpAfterHits > 0 && (
            <div className={cn('ba-banner rounded-md px-5 py-2.5 text-night-text', attack.defended ? 'bg-success-600/90' : 'bg-rose-600/90')}>
              <p className="type-display text-[32px] leading-tight">
                {attack.frozen ? `${special} frozen!` : attack.defended ? `${special} stopped!` : attack.shielded ? `${special} blocked by a shield!` : `${special}!`}
              </p>
              <p className="text-[20px] font-semibold">
                {attack.correct} of {attack.eligible} correct · {attack.targetCount} needed
                {!attack.defended && attack.heal > 0 && ` · ${info.name} heals ${attack.heal} HP`}
              </p>
            </div>
          )}
          {teamLine(attack) && (
            <div className="ba-banner rounded-md bg-night-950/90 px-5 py-1.5 text-[20px] leading-tight font-bold text-sun-400 ring-2 ring-sun-400/70">{teamLine(attack)}</div>
          )}
          {attack.unlocked && (
            <div className="ba-banner ba-unlock rounded-md bg-rank-gold px-5 py-2 text-night-950">
              <p className="type-display text-[28px] leading-tight">
                {Math.round(attack.accuracy)}% correct: weapon unlocked!
              </p>
            </div>
          )}
        </div>
      )}

      {/* The total */}
      {attack && landed && (
        <div className="ba-total absolute text-center" style={{ left: MONSTER_BOX.left, width: MONSTER_BOX.width, top: 170 }}>
          {attack.damage > 0 ? (
            <p className="type-display text-[110px] leading-none text-rank-gold drop-shadow-[0_6px_0_rgb(0_0_0/0.45)]">−{attack.damage}</p>
          ) : (
            <p className="type-display text-[64px] leading-none text-night-muted">Missed!</p>
          )}
        </div>
      )}
      {/* A white flash on a big hit. */}
      {step === 'landed' && severity === 'stagger' && !reduced && <span className="ba-flash" aria-hidden />}
    </div>
  );
});

/** "Thunderclap! Every hit doubled · +20 from the Thunder Blade", "Burning: −10", … */
function weaponLine(attack: BattleAttack): string | null {
  const parts: string[] = [];
  if (attack.special === 'thunder') parts.push('Thunderclap! Every hit doubled');
  if (attack.special === 'shadow') parts.push('Weak Spot! Every hit +3');
  if (attack.special === 'crystal') parts.push('Shatter!');
  if (attack.special === 'inferno') parts.push('Ignite!');
  if (attack.burn > 0) parts.push(`burning −${attack.burn}`);
  const bonus = attack.weaponBonus - attack.burn;
  if (bonus > 0) parts.push(`+${bonus} weapon damage`);
  if (parts.length === 0) return null;
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** Team abilities, power-ups and energy: "Final Rally! · Group Lightning −80 · +25 team energy (mastery, defended)". */
function teamLine(attack: BattleAttack): string | null {
  const parts: string[] = [];
  if (attack.rally) parts.push('Final Rally! Every hit doubled');
  if (attack.scan) parts.push('Weakness found: every hit +1');
  if (attack.lightning > 0) parts.push(`Group Lightning −${attack.lightning}`);
  if (attack.boosted > 0) parts.push(`${attack.boosted} power-up ${attack.boosted === 1 ? 'strike' : 'strikes'}`);
  if (attack.shielded) parts.push('Shield held: no healing');
  if (attack.energyGain > 0) {
    const why = attack.energyReasons.map((r) => ENERGY_REASON[r] ?? r).join(', ');
    parts.push(`+${attack.energyGain} team energy${why ? ` (${why})` : ''}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** Distant hills and the ground, stretched to the whole frame whatever its shape. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(to_bottom,rgb(255_255_255/0.05),rgb(255_255_255/0.015))]" />
      <svg viewBox="0 0 1600 900" className="absolute inset-0 size-full" preserveAspectRatio="none">
        <path d="M0 640 C 400 600, 1200 600, 1600 640" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
