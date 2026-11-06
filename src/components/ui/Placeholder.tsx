import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Marks something that is planned but not built. A hairline region with a "COMING NEXT"
 * kicker and one sentence. Never contains a button or anything that looks clickable.
 */
export function Placeholder({
  kicker = 'Coming next',
  children,
  surface = 'paper',
  className,
}: {
  kicker?: ReactNode;
  children: ReactNode;
  surface?: 'paper' | 'night';
  className?: string;
}) {
  const night = surface === 'night';
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3',
        night ? 'ground-night border-night-rule text-night-muted' : 'border-line text-ink-500',
        className,
      )}
    >
      <p className="type-kicker">{kicker}</p>
      <div className="mt-1 text-body-sm">{children}</div>
    </div>
  );
}
