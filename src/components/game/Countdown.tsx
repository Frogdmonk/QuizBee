import { cn } from '@/lib/cn';

/**
 * Countdown for the open question: a bar that shrinks with the real remaining time plus the
 * seconds. The last five seconds turn signal. Driven by the server deadline (see useCountdown).
 */
export function Countdown({ remainingMs, totalSeconds, size = 'md', className }: { remainingMs: number; totalSeconds: number; size?: 'md' | 'stage'; className?: string }) {
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = totalSeconds > 0 ? Math.min(1, remainingMs / (totalSeconds * 1000)) : 0;
  const urgent = seconds <= 5;
  return (
    <div className={cn('flex items-center gap-3', className)} role="timer" aria-label={`${seconds} seconds left`}>
      <div className={cn('relative flex-1 overflow-hidden rounded-full bg-night-800', size === 'stage' ? 'h-3' : 'h-2')}>
        <span
          className={cn('absolute inset-y-0 left-0 w-full origin-left transition-transform duration-[250ms] ease-linear', urgent ? 'bg-signal-400' : 'bg-night-text')}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <span className={cn('type-stage w-[2.5ch] text-right tabular', urgent && 'text-signal-400', size === 'stage' ? 'text-[clamp(2rem,6vh,4rem)]' : 'text-score-md')}>
        {seconds}
      </span>
    </div>
  );
}
