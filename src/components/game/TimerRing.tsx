import { cn } from '@/lib/cn';

/**
 * Projector countdown: a ring that drains with the real remaining time and the seconds in the
 * middle. The last five seconds turn signal. Driven by the server deadline (see useCountdown).
 */
export function TimerRing({ remainingMs, totalSeconds, className }: { remainingMs: number; totalSeconds: number; className?: string }) {
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = totalSeconds > 0 ? Math.min(1, remainingMs / (totalSeconds * 1000)) : 0;
  const urgent = seconds <= 5;
  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <div role="timer" aria-label={`${seconds} seconds left`} className={cn('relative grid shrink-0 place-items-center', className)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" className="stroke-night-800" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          className={cn('transition-[stroke-dashoffset] duration-[250ms] ease-linear', urgent ? 'stroke-signal-400' : 'stroke-night-text')}
        />
      </svg>
      <span className={cn('type-stage relative text-[clamp(1.75rem,5vh,3.5rem)] leading-none tabular', urgent && 'text-signal-400')}>{seconds}</span>
    </div>
  );
}
