import { cn } from '@/lib/cn';
import { battleStage } from '@/lib/battle/monster';

/**
 * The monster's health. The coloured bar drops at once; a pale "damage" bar behind it follows a
 * moment later so everyone sees how big the hit was.
 */
export function HpBar({
  hp,
  maxHp,
  size = 'md',
  showNumbers = true,
  at,
  className,
}: {
  hp: number;
  maxHp: number;
  /** The teacher's mode thresholds (colour follows the mode). */
  at?: { rageAt: number; enragedAt: number };
  size?: 'sm' | 'md' | 'stage';
  showNumbers?: boolean;
  className?: string;
}) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const stage = battleStage(hp, maxHp, at);
  const fill = stage === 'normal' ? 'bg-success-400' : stage === 'rage' ? 'bg-sun-400' : 'bg-rose-500';
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div
        role="meter"
        aria-label="Monster health"
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={hp}
        aria-valuetext={`${hp} of ${maxHp} HP`}
        className={cn(
          'relative flex-1 overflow-hidden rounded-full bg-night-800 ring-2 ring-night-950',
          size === 'sm' ? 'h-2.5' : size === 'md' ? 'h-4' : 'h-[clamp(1rem,2.6vh,1.75rem)]',
        )}
      >
        <span className="absolute inset-y-0 left-0 bg-night-text/70 transition-[width] delay-500 duration-700 ease-out" style={{ width: `${pct}%` }} />
        <span className={cn('absolute inset-y-0 left-0 transition-[width] duration-300 ease-out', fill)} style={{ width: `${pct}%` }} />
        <span className="absolute inset-x-0 top-0 h-1/3 bg-white/15" />
      </div>
      {showNumbers && (
        <span
          className={cn(
            'type-score shrink-0 tabular-nums',
            size === 'sm' ? 'text-caption' : size === 'md' ? 'text-body' : 'text-[clamp(1rem,2.6vh,1.9rem)]',
          )}
        >
          {hp}
          <span className="text-night-muted"> / {maxHp} HP</span>
        </span>
      )}
    </div>
  );
}
