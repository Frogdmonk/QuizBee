import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

/**
 * Broadcast "lower third": a 6px colour tab plus a bar with a sharp right edge. Used for name
 * tags, the join ticker, toasts, inviter lines and the student link on sign-in. Pass `to` to
 * render it as a link. `tab` is a Tailwind bg class.
 */
export function LowerThird({
  children,
  tab = 'bg-signal-600',
  surface = 'paper',
  to,
  className,
}: {
  children: ReactNode;
  tab?: string;
  surface?: 'paper' | 'night';
  to?: string;
  className?: string;
}) {
  const classes = cn(
    'relative inline-flex min-h-11 max-w-full items-center gap-2 rounded-l-sm py-2 pr-4 pl-5 text-label',
    surface === 'night' ? 'bg-night-900 text-night-text' : 'border-y border-r border-line bg-surface text-ink-900',
    to && (surface === 'night' ? 'transition-colors hover:bg-night-800' : 'transition-colors hover:bg-paper-sunk'),
    className,
  );
  const content = (
    <>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5 rounded-l-sm', tab)} />
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
