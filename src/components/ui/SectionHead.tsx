import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Editorial section opener: a 3px rule, an uppercase kicker, an optional title and an action
 * on the right. Use instead of a card header to group content on teacher screens.
 */
export function SectionHead({
  kicker,
  title,
  action,
  tone = 'paper',
  as: Heading = 'h2',
  id,
  className,
}: {
  kicker: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  tone?: 'paper' | 'night';
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
}) {
  const night = tone === 'night';
  return (
    <div className={cn('flex items-end justify-between gap-4 border-t-[3px] pt-3', night ? 'border-night-text' : 'border-ink-950', className)}>
      <div className="min-w-0">
        {title ? (
          <>
            <p className="type-kicker">{kicker}</p>
            <Heading id={id} className={cn('mt-1 text-title', night ? 'text-night-text' : 'text-ink-900')}>
              {title}
            </Heading>
          </>
        ) : (
          <Heading id={id} className="type-kicker">
            {kicker}
          </Heading>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
