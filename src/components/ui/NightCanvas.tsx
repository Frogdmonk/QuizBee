import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The stage: night-950 ground with the static broadcast grid and safe-area padding. Use as the
 * root of every student, projector and full-screen preview screen.
 */
export function NightCanvas({
  children,
  className,
  as: Tag = 'main',
}: {
  children: ReactNode;
  className?: string;
  as?: 'main' | 'div';
}) {
  return (
    <Tag className={cn('ground-night night-grid pt-safe pb-safe relative min-h-dvh bg-night-950 text-night-text', className)}>
      {children}
    </Tag>
  );
}
