import { memo } from 'react';
import { cn } from '@/lib/cn';
import { hashString } from '@/lib/playground/sim';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Avatar } from '@/components/avatar/Avatar';
import type { LiveReaction, ReactionBurst } from '@/hooks/useReactions';

/**
 * Reactions on the projector during a game. They float up a reserved lane on the right edge (the
 * game content never extends into it), so questions, answers and scores are never covered. When
 * several players send the same emote together, a short burst fills the top of the screen.
 */
export function ReactionLayer({
  reactions,
  bursts,
  className,
  lifeMs = 4000,
}: {
  reactions: readonly LiveReaction[];
  bursts: readonly ReactionBurst[];
  className?: string;
  lifeMs?: number;
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // In a busy class keep the lane readable: the newest few only.
  const visible = reactions.slice(reduced ? -5 : -14);
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-y-0 right-0 w-[var(--rx-lane)]">
        {visible.map((r, i) => (
          <Bubble key={r.id} reaction={r} reduced={reduced} lifeMs={lifeMs} slot={i} total={visible.length} />
        ))}
      </div>
      {!reduced && bursts.map((b) => <Burst key={b.id} burst={b} />)}
    </div>
  );
}

const Bubble = memo(function Bubble({ reaction, reduced, lifeMs, slot, total }: { reaction: LiveReaction; reduced: boolean; lifeMs: number; slot: number; total: number }) {
  const h = hashString(reaction.id);
  // Spread across the lane (three columns) and start heights, and drift a little, so reactions
  // arriving together never sit on top of each other.
  const column = (h % 3) / 3;
  const startBottom = 3 + ((h >> 4) % 4) * 6;
  const drift = ((h >> 8) % 40) - 20;
  return (
    <div
      className={cn('absolute flex w-1/3 flex-col items-center', reduced ? '' : 'rx-float')}
      style={
        reduced
          ? { right: 8, bottom: `${6 + (total - 1 - slot) * 13}%` }
          : ({
              left: `${column * 88}%`,
              bottom: `${startBottom}%`,
              // A small stagger so a crowd of simultaneous reactions rises one after another.
              animationDelay: `${(slot % 4) * 160}ms`,
              '--rx-life': `${lifeMs}ms`,
              '--rx-drift': `${drift}px`,
            } as React.CSSProperties)
      }
    >
      <span className="relative">
        <Avatar code={reaction.avatar} mood={reaction.emote.mood ?? null} className="size-[clamp(1.9rem,4.6vh,3rem)] rounded-full ring-2 ring-night-950" />
        <span className="absolute -top-[55%] -right-[50%] text-[clamp(1.6rem,4.6vh,3rem)] leading-none drop-shadow-[0_3px_0_rgb(0_0_0/0.3)]">
          {reaction.emote.glyph}
        </span>
      </span>
      <span className="mt-0.5 max-w-full truncate rounded-xs bg-night-950/80 px-1 text-[clamp(0.7rem,1.4vh,0.9rem)] font-bold text-night-text">
        {reaction.nickname}
      </span>
    </div>
  );
});

const Burst = memo(function Burst({ burst }: { burst: ReactionBurst }) {
  const pieces = Math.min(18, 6 + burst.count * 2);
  const seed = hashString(burst.id);
  return (
    <div className="absolute inset-x-0 top-0 h-[40%]">
      {Array.from({ length: pieces }, (_, i) => {
        const h = (seed + Math.imul(i + 1, 2654435761)) >>> 0;
        const x = (h % 1000) / 10;
        return (
          <span
            key={i}
            className="rx-burst absolute top-[30%] text-[clamp(2rem,7vh,4.5rem)] leading-none"
            style={
              {
                left: `${x}%`,
                animationDelay: `${(h >> 10) % 400}ms`,
                '--rx-x': `${((h >> 4) % 200) - 100}px`,
                '--rx-y': `${-((h >> 12) % 25) - 8}vh`,
                '--rx-rot': `${((h >> 6) % 120) - 60}deg`,
              } as React.CSSProperties
            }
          >
            {burst.emote.glyph}
          </span>
        );
      })}
      <div className="absolute inset-x-0 top-[6%] flex justify-center">
        <p className="rx-label rounded-sm bg-night-text px-4 py-1.5 text-stage-label text-night-950 uppercase">
          {burst.count} players · {burst.emote.glyph}
        </p>
      </div>
    </div>
  );
});
