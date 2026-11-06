import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Night block with a 6px signal tab: the "on air" surface on teacher screens (an open live
 * session, the dashboard Host band). Children render on the night canvas: use night buttons
 * and night-text / night-muted colours inside.
 */
export function Banner({ children, className, as: Tag = 'section', ...rest }: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Tag
      className={cn('ground-night relative overflow-hidden rounded-md bg-night-950 py-5 pr-5 pl-7 text-night-text sm:pr-6 sm:pl-8', className)}
      {...rest}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-signal-600" />
      {children}
    </Tag>
  );
}
