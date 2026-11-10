import { useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowDown, ArrowUp, Crown, Flame, Minus, Swords } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, slideFromLeft } from '@/lib/motion';
import { nearMissMessage } from '@/lib/leaderboard/events';
import { eventBanner } from '@/lib/leaderboard/banner';
import type { LeaderboardEntry, LeaderboardSnapshot, Movement } from '@/lib/leaderboard/types';
import { DEFAULT_LEADERBOARD_CONFIG } from '@/lib/leaderboard/config';
import { stageAtLeast, useLeaderboardPlayback } from '@/hooks/useLeaderboardPlayback';
import { CountRoll } from '@/components/ui/CountRoll';
import { Avatar } from '@/components/avatar/Avatar';
import { AnimatedNumber } from './AnimatedNumber';
import { ThemeActor } from './ThemeActor';

type Variant = 'stage' | 'panel' | 'compact';

const RANK_CHIP: Record<number, string> = {
  1: 'bg-rank-gold text-night-950',
  2: 'bg-rank-silver text-night-950',
  3: 'bg-rank-bronze text-night-950',
};

const SIZES: Record<Variant, { row: string; avatar: string; name: string; score: string; chip: string; gap: string }> = {
  // Ten rows, the event banner and the teacher's controls must fit a 16:9 or 4:3 projector without scrolling.
  stage: { row: 'min-h-[clamp(2.5rem,5.1vh,4.5rem)] px-4', avatar: 'size-[clamp(2rem,4.2vh,3.4rem)]', name: 'text-[clamp(1rem,2.3vh,1.6rem)]', score: 'text-[clamp(1.2rem,2.8vh,2.1rem)]', chip: 'size-[clamp(1.8rem,3.8vh,2.8rem)] text-[clamp(1rem,2.2vh,1.45rem)]', gap: 'gap-[clamp(0.2rem,0.5vh,0.45rem)]' },
  panel: { row: 'min-h-14 px-3', avatar: 'size-11', name: 'text-body', score: 'text-score-md', chip: 'size-9 text-[1rem]', gap: 'gap-1.5' },
  compact: { row: 'min-h-12 px-2.5', avatar: 'size-9', name: 'text-body-sm', score: 'text-score-sm', chip: 'size-8 text-[0.95rem]', gap: 'gap-1' },
};

/**
 * The animated leaderboard (top 10). Order, ranks and scores are exactly the server's; the
 * animation engine only decides how the change is shown. Under reduced motion it renders the
 * final board with no character animations.
 */
export function Leaderboard({
  snapshot,
  variant = 'panel',
  highlightId,
  tone = 'night',
  className,
}: {
  snapshot: LeaderboardSnapshot | null;
  variant?: Variant;
  /** The viewer's own row (student phones). */
  highlightId?: string | null;
  tone?: 'night' | 'paper';
  className?: string;
}) {
  // Never move backwards: an older update arriving late is ignored, the newest one stays on screen.
  const [latest, setLatest] = useState<LeaderboardSnapshot | null>(snapshot);
  if (snapshot && snapshot !== latest && (!latest || snapshot.updateId >= latest.updateId)) setLatest(snapshot);
  const current = latest;
  const { plan, stage, reportThemeFailure, reducedMotion } = useLeaderboardPlayback(current);
  const entries = useMemo(() => current?.entries ?? [], [current]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.participantId, e])), [entries]);
  const s = SIZES[variant];
  const night = tone === 'night';

  // Use the plan only when it belongs to the snapshot on screen; otherwise show the final board.
  const live = plan && plan.updateId === current?.updateId ? plan : null;
  const moved = live ? stageAtLeast(stage, 'rows') : true;
  const order = live && !moved ? live.fromOrder : entries.map((e) => e.participantId);
  const scoresRolled = !live || stageAtLeast(stage, 'scores');
  const highlight = !live || stageAtLeast(stage, 'highlight');
  const events = live?.events ?? [];
  const banner = highlight ? eventBanner(events, byId) : null;
  const nearMiss = new Map(events.filter((e) => e.type === 'near-miss').map((e) => [e.participantId, e.gap]));
  const rivals = new Set(events.flatMap((e) => (e.type === 'rivalry' ? e.participantIds : [])));
  const streaks = new Map(events.filter((e) => e.type === 'streak').map((e) => [e.participantId, e.streak]));
  const playing = live && stageAtLeast(stage, 'characters') && stage !== 'settled';

  if (entries.length === 0) return null;

  return (
    <section aria-label="Leaderboard" className={cn('relative', className)}>
      <AnimatePresence>
        {banner && (
          <m.div key={banner.text} variants={slideFromLeft} initial="hidden" animate="show" exit="exit" className="mb-3">
            <p className={cn('inline-flex items-center gap-2 rounded-sm px-3 py-1.5 font-bold tracking-[0.06em] text-night-950 uppercase', banner.tone, variant === 'stage' ? 'text-stage-label' : 'text-caption')}>
              <Crown className="size-[1.1em]" aria-hidden /> {banner.text}
            </p>
          </m.div>
        )}
      </AnimatePresence>

      <ol className={cn('flex flex-col', s.gap)}>
        {order.map((id) => {
          const e = byId.get(id);
          if (!e) return null;
          const row = live?.rows[id];
          const rank = moved ? e.rank : (row?.fromRank ?? e.rank);
          const score = scoresRolled ? e.score : (row?.previousScore ?? e.score);
          const movement = row?.movement;
          const own = highlightId === id;
          const top = RANK_CHIP[rank];
          const near = highlight ? nearMiss.get(id) : undefined;
          const streak = streaks.get(id);
          return (
            <m.li
              key={id}
              layout={!reducedMotion}
              transition={spring.layout}
              className={cn(
                'relative flex items-center gap-3 rounded-md',
                s.row,
                night ? 'bg-night-900 text-night-text' : 'border border-line bg-surface text-ink-900',
                top && night && 'bg-night-800',
                own && 'ring-2 ring-volt-400',
                highlight && movement?.kind === 'up' && 'shadow-[inset_4px_0_0_var(--color-success-400)]',
              )}
            >
              <span className={cn('type-stage grid shrink-0 place-items-center rounded-sm', s.chip, top ?? (night ? 'bg-night-800 text-night-text' : 'bg-paper-sunk text-ink-900'))}>
                <CountRoll value={rank} />
              </span>

              <ThemeActor
                code={e.avatar}
                theme={row?.theme ?? 'fallback'}
                play={Boolean(playing && row)}
                delayMs={row ? Math.max(0, row.delayMs - DEFAULT_LEADERBOARD_CONFIG.timeline.charactersAtMs) : 0}
                className={cn('shrink-0', s.avatar)}
                simplified={variant === 'compact'}
                onError={reportThemeFailure}
              />

              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-bold', s.name)}>
                  {e.nickname}
                  {own && <span className={cn('ml-2 text-caption font-semibold', night ? 'text-night-muted' : 'text-ink-500')}>(you)</span>}
                </p>
                <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption', night ? 'text-night-muted' : 'text-ink-500')}>
                  {streak !== undefined && (
                    <span className="inline-flex items-center gap-1 font-bold text-answer-d">
                      <Flame className="size-3.5" aria-hidden /> {streak} in a row
                    </span>
                  )}
                  {highlight && rivals.has(id) && (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Swords className="size-3.5" aria-hidden /> Rivals
                    </span>
                  )}
                  {near !== undefined && <span className="font-bold text-signal-400 uppercase">{nearMissMessage(near)}</span>}
                </p>
              </div>

              {scoresRolled && e.lastPoints > 0 && variant !== 'compact' && (
                <span className="type-score shrink-0 text-score-sm text-success-400">+{e.lastPoints.toLocaleString()}</span>
              )}
              <AnimatedNumber value={score} className={cn('type-score shrink-0 tabular', s.score)} />

              {highlight && movement && (
                <span className="flex w-8 shrink-0 items-center justify-center text-caption font-bold" aria-label={movementLabel(movement)}>
                  {movement.kind === 'up' ? (
                    <span className="inline-flex items-center text-success-400">
                      <ArrowUp className="size-4" aria-hidden />
                      {movement.positions}
                    </span>
                  ) : movement.kind === 'down' ? (
                    <span className="inline-flex items-center text-night-muted">
                      <ArrowDown className="size-4" aria-hidden />
                      {movement.positions}
                    </span>
                  ) : (
                    <Minus className={cn('size-4', night ? 'text-night-muted' : 'text-ink-500')} aria-hidden />
                  )}
                </span>
              )}
            </m.li>
          );
        })}
      </ol>
    </section>
  );
}

function movementLabel(mv: Movement): string {
  if (mv.kind === 'up') return `Up ${mv.positions}`;
  if (mv.kind === 'down') return `Down ${mv.positions}`;
  if (mv.kind === 'new') return 'New';
  return 'Same place';
}

/** Static top three for the end of the game (real final ranks). */
export function Podium({ entries, className }: { entries: LeaderboardEntry[]; className?: string }) {
  const top = entries.filter((e) => e.rank <= 3).slice(0, 3);
  const slots = [top.find((e) => e.rank === 2) ?? top[1], top.find((e) => e.rank === 1) ?? top[0], top.find((e) => e.rank === 3) ?? top[2]];
  const heights = ['h-[18vh]', 'h-[26vh]', 'h-[12vh]'];
  return (
    <div className={cn('flex items-end justify-center gap-[2vw]', className)}>
      {slots.map((e, i) =>
        e ? (
          <div key={e.participantId} className="flex w-[clamp(6rem,18vw,14rem)] flex-col items-center">
            <m.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring.land, delay: 0.6 + (2 - i) * 0.3 }}>
              <Avatar code={e.avatar} className="size-[clamp(4rem,11vh,8rem)] rounded-full" />
            </m.div>
            <p className="mt-2 w-full truncate text-center text-stage-name font-bold">{e.nickname}</p>
            <p className="type-score text-score-md">{e.score.toLocaleString()}</p>
            <m.div
              className={cn('mt-2 grid w-full origin-bottom place-items-start justify-center rounded-t-md pt-3', heights[i], RANK_CHIP[e.rank] ?? 'bg-night-800')}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.6, delay: (2 - i) * 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="type-stage text-[clamp(2rem,6vh,4rem)]">{e.rank}</span>
            </m.div>
          </div>
        ) : (
          <div key={`empty-${i}`} className="w-[clamp(6rem,18vw,14rem)]" />
        ),
      )}
    </div>
  );
}
