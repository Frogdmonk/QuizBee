import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Broadcast "score bug": a compact night-900 block with a 4px left tab that holds one piece of
 * state (PIN, count, "Q 2 / 12", status). `tab` is a Tailwind bg class (default signal).
 */
export function ScoreBug({
  children,
  tab = 'bg-signal-600',
  surface = 'night',
  className,
}: {
  children: ReactNode;
  tab?: string;
  surface?: 'night' | 'paper';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative inline-flex min-w-0 items-center gap-3 overflow-hidden rounded-sm py-2 pr-3 pl-4',
        surface === 'night' ? 'ground-night bg-night-900 text-night-text' : 'border border-line bg-surface text-ink-900',
        className,
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', surface === 'paper' && tab === 'bg-signal-600' ? 'bg-ink-900' : tab)} />
      {children}
    </div>
  );
}
