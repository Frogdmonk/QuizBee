import { useMemo, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { ArrowDown, ArrowUp, Crown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CLIMB_WORLD, CROWD, LAIR, LEDGES, climbMotion, ledgeOf, trailPath } from '@/lib/leaderboard/climb';
import { eventBanner } from '@/lib/leaderboard/banner';
import { nearMissMessage } from '@/lib/leaderboard/events';
import { DEFAULT_LEADERBOARD_CONFIG } from '@/lib/leaderboard/config';
import { stageAtLeast, useLeaderboardPlayback } from '@/hooks/useLeaderboardPlayback';
import { useFitWorld } from '@/hooks/useFitWorld';
import { battleStage } from '@/lib/battle/monster';
import { Hero, type HeroPose } from '@/components/avatar/Hero';
import { Monster } from '@/components/battle/Monster';
import { HpBar } from '@/components/battle/HpBar';
import type { LeaderboardSnapshot } from '@/lib/leaderboard/types';
import { AnimatedNumber } from './AnimatedNumber';
import '@/styles/climb.css';

const RIM: Record<number, string> = { 1: '#facc15', 2: '#cbd5e1', 3: '#d08a4a' };

/**
 * "The Climb to the Lair": the projector's top 10. Each student stands on a ledge of a cliff path,
 * #1 at the top just below the monster's lair. When ranks change, students climb past each other
 * ledge by ledge, leap up several at once, or slide down with a wobble; newcomers jump up from the
 * crowd at the foot of the cliff. Streaks light torches, the top three have lit ledges and #1
 * wears a crown. Ranks, order and scores are exactly the server's; only the way the change is
 * shown is decided here (same playback engine as the list). Reduced motion shows the final board.
 */
export function ClimbBoard({
  snapshot,
  monster,
  className,
}: {
  snapshot: LeaderboardSnapshot | null;
  /** The boss at the summit (boss battle), or null for a summit flag. */
  monster?: { key: string; hp: number; maxHp: number; at?: { rageAt: number; enragedAt: number } } | null;
  className?: string;
}) {
  const [latest, setLatest] = useState<LeaderboardSnapshot | null>(snapshot);
  if (snapshot && snapshot !== latest && (!latest || snapshot.updateId >= latest.updateId)) setLatest(snapshot);
  const current = latest;
  const { plan, stage, reducedMotion } = useLeaderboardPlayback(current);
  const { frameRef, worldRef } = useFitWorld(CLIMB_WORLD.width, CLIMB_WORLD.height);
  const entries = useMemo(() => (current?.entries ?? []).filter((e) => e.rank <= LEDGES.length), [current]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.participantId, e])), [entries]);

  const live = plan && plan.updateId === current?.updateId && !reducedMotion ? plan : null;
  const moving = Boolean(live && stageAtLeast(stage, 'characters'));
  const scoresRolled = !live || stageAtLeast(stage, 'scores');
  const highlight = !live || stageAtLeast(stage, 'highlight');
  const events = live?.events ?? [];
  const banner = highlight ? eventBanner(events, byId) : null;
  const nearMiss = new Map(events.filter((e) => e.type === 'near-miss').map((e) => [e.participantId, e.gap]));
  const crowd = Math.max(0, Math.min(24, (current?.fieldSize ?? 0) - LEDGES.length));
  const trail = useMemo(() => trailPath(), []);
  const stageOf = monster ? battleStage(monster.hp, monster.maxHp, monster.at) : null;

  if (entries.length === 0) return null;

  return (
    <section aria-label="Leaderboard" ref={frameRef} className={cn('relative', className)}>
      <div ref={worldRef} className="absolute top-0 left-0 origin-top-left" style={{ width: CLIMB_WORLD.width, height: CLIMB_WORLD.height }}>
        {/* The cliff, the trail and the ledges */}
        <svg viewBox={`0 0 ${CLIMB_WORLD.width} ${CLIMB_WORLD.height}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="cl-rock" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#221c3a" />
              <stop offset="1" stopColor="#3a3160" />
            </linearGradient>
            <radialGradient id="cl-lair" cx="0.5" cy="0.6" r="0.6">
              <stop offset="0" stopColor="#7c2d12" stopOpacity="0.9" />
              <stop offset="1" stopColor="#0b0712" stopOpacity="1" />
            </radialGradient>
          </defs>
          <path
            d="M-900 1500 L-900 880 C -400 870 200 800 380 700 C 470 660 520 650 560 640 C 700 590 760 470 900 430 C 1040 390 1080 300 1180 250 C 1260 200 1300 90 1450 60 C 1700 20 2100 0 2600 -20 L2600 1500 Z"
            fill="url(#cl-rock)"
          />
          <path d="M120 900 C 320 820 520 760 760 700 M380 640 C 600 560 760 520 980 480 M560 430 C 760 380 900 330 1120 280" stroke="rgb(255 255 255 / 0.05)" strokeWidth="6" fill="none" />
          {/* The lair */}
          <ellipse cx={LAIR.x} cy={LAIR.y + 40} rx="170" ry="130" fill="url(#cl-lair)" />
          <path d={trail} stroke="rgb(255 255 255 / 0.16)" strokeWidth="5" strokeDasharray="4 16" strokeLinecap="round" fill="none" />
          {LEDGES.map((l, i) => {
            const rank = i + 1;
            const rim = RIM[rank];
            const w = rank === 1 ? 130 : 105;
            return (
              <g key={rank}>
                {rim && <ellipse cx={l.x} cy={l.y + 52} rx={w + 14} ry="26" fill={rim} opacity="0.18" className="cl-glow" />}
                <path
                  d={`M ${l.x - w} ${l.y + 46} Q ${l.x} ${l.y + 32} ${l.x + w} ${l.y + 46} L ${l.x + w - 18} ${l.y + 78} Q ${l.x} ${l.y + 92} ${l.x - w + 18} ${l.y + 78} Z`}
                  fill="#3b3357"
                  stroke={rim ?? '#4b4270'}
                  strokeWidth={rim ? 4 : 2}
                />
                <circle cx={l.x - w - 34} cy={l.y + 52} r="22" fill="#151021" stroke={rim ?? '#4b4270'} strokeWidth="3" />
                <text x={l.x - w - 34} y={l.y + 61} textAnchor="middle" fontSize="24" fontWeight="900" fill={rim ?? '#cfc8ee'}>
                  {rank}
                </text>
              </g>
            );
          })}
        </svg>

        {/* The summit: the monster watching, or a flag */}
        <div className="absolute" style={{ left: LAIR.x - 150, top: LAIR.y - 175, width: 300 }}>
          {monster && stageOf ? (
            <>
              <Monster stage={stageOf} action={stageOf === 'rage' || stageOf === 'enraged' ? 'brewing' : 'idle'} className="mx-auto size-[230px]" />
              <HpBar hp={monster.hp} maxHp={monster.maxHp} at={monster.at} size="md" className="-mt-2 [&_.type-score]:text-[18px]" />
            </>
          ) : (
            <svg viewBox="0 0 120 160" className="mx-auto h-[200px]" aria-hidden>
              <path d="M30 150 L30 20" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
              <path className="cl-flag" d="M33 22 L100 40 L33 62 Z" fill="#facc15" />
            </svg>
          )}
        </div>

        {/* The crowd at the foot of the cliff (everyone outside the top 10, no names) */}
        {Array.from({ length: crowd }, (_, i) => (
          <span
            key={i}
            className="cl-crowd absolute rounded-full bg-night-text/25"
            style={{ left: CROWD.x - 90 + (i % 8) * 24, top: CROWD.y - 30 + Math.floor(i / 8) * 18, width: 22, height: 22, animationDelay: `${(i * 137) % 900}ms` } as CSSProperties}
            aria-hidden
          />
        ))}

        {/* Torches for streaks */}
        {highlight &&
          entries
            .filter((e) => e.streak >= DEFAULT_LEADERBOARD_CONFIG.streakMin)
            .map((e) => {
              const l = ledgeOf(e.rank);
              const size = Math.min(1.8, 0.9 + e.streak * 0.12);
              return (
                <span key={`torch-${e.participantId}`} className="absolute" style={{ left: l.x + 62, top: l.y - 24 }} aria-hidden>
                  <span className="cl-torch block" style={{ '--s': size } as CSSProperties} />
                </span>
              );
            })}

        {/* The climbers */}
        {entries.map((e) => {
          const row = live?.rows[e.participantId];
          const motion = climbMotion(row ? row.fromRank : e.rank, e.rank, row?.movement);
          // A full figure standing on the ledge: feet at the ledge, the (x, y) path is the ledge centre.
          const size = e.rank === 1 ? 96 : 78;
          const height = size * 1.5;
          const ox = size / 2;
          const oy = height - 46;
          const startX = motion.x[0] - ox;
          const startY = motion.y[0] - oy;
          const endX = ledgeOf(e.rank).x - ox;
          const endY = ledgeOf(e.rank).y - oy;
          const go = moving && row && motion.kind !== 'still';
          const delay = row ? Math.max(0, row.delayMs - DEFAULT_LEADERBOARD_CONFIG.timeline.charactersAtMs) / 1000 : 0;
          const up = row?.movement.kind === 'up' || row?.movement.kind === 'new';
          const down = row?.movement.kind === 'down';
          const near = highlight ? nearMiss.get(e.participantId) : undefined;
          const score = scoresRolled ? e.score : (row?.previousScore ?? e.score);
          return (
            <m.div
              key={`${e.participantId}:${current?.updateId}`}
              className="absolute top-0 left-0"
              style={{ width: size, zIndex: 10 + LEDGES.length - e.rank }}
              initial={live ? { x: startX, y: startY, rotate: 0 } : { x: endX, y: endY, rotate: 0 }}
              animate={
                go
                  ? { x: motion.x.map((v) => v - ox), y: motion.y.map((v) => v - oy), rotate: motion.rotate }
                  : live && !moving
                    ? { x: startX, y: startY, rotate: 0 }
                    : { x: endX, y: endY, rotate: 0 }
              }
              transition={go ? { duration: motion.durationMs / 1000, delay, ease: 'easeInOut' } : { duration: 0 }}
            >
              <div className="relative" style={{ width: size, height }}>
                <Hero
                  code={e.avatar}
                  size={size}
                  pose={heroPose(Boolean(go), motion.kind, highlight, up)}
                  mood={highlight && up ? 'laugh' : highlight && down ? 'surprised' : null}
                  ring={RIM[e.rank]}
                  delayMs={(e.rank * 211) % 2600}
                />
                {e.rank === 1 && highlight && <Crown className="cl-crown absolute -top-[46px] left-1/2 size-[56px] -translate-x-1/2 fill-rank-gold text-rank-gold" aria-hidden />}
              </div>
              <div
                className="absolute top-full left-1/2 mt-1 flex w-[220px] -translate-x-1/2 flex-col items-center rounded-md bg-night-950/85 px-2 py-0.5 text-center"
                style={RIM[e.rank] ? { boxShadow: `inset 0 -3px 0 ${RIM[e.rank]}` } : undefined}
              >
                <p className="w-full truncate text-[24px] leading-tight font-bold text-night-text">{e.nickname}</p>
                <p className="flex items-center gap-2 text-[22px] leading-tight">
                  <AnimatedNumber value={score} className="type-score tabular text-night-text" />
                  {scoresRolled && e.lastPoints > 0 && <span className="type-score text-[18px] text-success-400">+{e.lastPoints.toLocaleString()}</span>}
                  {highlight && row?.movement.kind === 'up' && (
                    <span className="inline-flex items-center text-[18px] font-bold text-success-400" aria-label={`Up ${row.movement.positions}`}>
                      <ArrowUp className="size-4" aria-hidden />
                      {row.movement.positions}
                    </span>
                  )}
                  {highlight && row?.movement.kind === 'down' && (
                    <span className="inline-flex items-center text-[18px] font-bold text-night-muted" aria-label={`Down ${row.movement.positions}`}>
                      <ArrowDown className="size-4" aria-hidden />
                      {row.movement.positions}
                    </span>
                  )}
                </p>
                {near !== undefined && <p className="text-[16px] font-bold text-signal-400 uppercase">{nearMissMessage(near)}</p>}
              </div>
            </m.div>
          );
        })}
      </div>

      {banner && (
        <p className={cn('absolute top-[2%] left-[2%] z-50 inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-stage-label font-bold tracking-[0.06em] text-night-950 uppercase', banner.tone)}>
          <Crown className="size-[1.1em]" aria-hidden /> {banner.text}
        </p>
      )}
      <ol className="sr-only">
        {entries.map((e) => (
          <li key={e.participantId}>
            {e.rank}. {e.nickname}, {e.score} points
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Climbing up, sliding down with arms flailing, then cheering (risers) or standing (everyone else). */
function heroPose(going: boolean, kind: string, highlight: boolean, up: boolean): HeroPose {
  if (going && (kind === 'climb' || kind === 'arrive')) return 'climb';
  if (going && kind === 'leap') return 'cheer';
  if (going && kind === 'slide') return 'fall';
  return highlight && up ? 'cheer' : 'idle';
}
