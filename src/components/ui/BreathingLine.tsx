import { cn } from '@/lib/cn';

/**
 * The single "waiting" idiom: a 2px line that breathes on scaleX. Static at 40% under reduced
 * motion. Decorative; pair it with text that says what is being waited for.
 */
export function BreathingLine({ className, tone = 'night' }: { className?: string; tone?: 'paper' | 'night' }) {
  return (
    <span aria-hidden className={cn('block h-0.5 w-24 overflow-hidden', className)}>
      <span className={cn('breathing-line block h-full w-full', tone === 'night' ? 'bg-signal-400' : 'bg-signal-600')} />
    </span>
  );
}
