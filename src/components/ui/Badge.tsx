import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'signal'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  // Legacy aliases (map onto the semantic tones).
  | 'flame'
  | 'mint'
  | 'sun'
  | 'rose'
  | 'dark';

type Resolved = 'neutral' | 'signal' | 'success' | 'warning' | 'error' | 'info' | 'dark';

const alias: Record<BadgeTone, Resolved> = {
  neutral: 'neutral',
  signal: 'signal',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  flame: 'signal',
  mint: 'success',
  sun: 'warning',
  rose: 'error',
  dark: 'dark',
};

const paper: Record<Resolved, string> = {
  neutral: 'bg-paper-sunk text-ink-700',
  signal: 'bg-signal-50 text-signal-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-700',
  error: 'bg-error-50 text-error-600',
  info: 'bg-info-50 text-info-700',
  dark: 'bg-ink-900 text-white',
};

const night: Record<Resolved, string> = {
  neutral: 'bg-night-800 text-night-muted',
  signal: 'bg-night-800 text-signal-400',
  success: 'bg-night-800 text-success-400',
  warning: 'bg-night-800 text-answer-d',
  error: 'bg-night-800 text-error-300',
  info: 'bg-night-800 text-night-text',
  dark: 'bg-night-text text-night-950',
};

const dots: Record<Resolved, string> = {
  neutral: 'bg-ink-500',
  signal: 'bg-signal-600',
  success: 'bg-success-600',
  warning: 'bg-warning-700',
  error: 'bg-error-600',
  info: 'bg-info-700',
  dark: 'bg-white',
};

/** Small uppercase status label. `dot` adds a live-style dot; `icon` a leading lucide icon. */
export function Badge({
  tone = 'neutral',
  surface = 'paper',
  dot = false,
  icon,
  className,
  children,
}: {
  tone?: BadgeTone;
  surface?: 'paper' | 'night';
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const t = alias[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-[0.75rem] leading-4 font-bold tracking-[0.06em] whitespace-nowrap uppercase [&>svg]:size-3.5',
        surface === 'night' ? night[t] : paper[t],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn('size-1.5 rounded-full', surface === 'night' ? (t === 'signal' ? 'bg-signal-400' : 'bg-current') : dots[t])}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
