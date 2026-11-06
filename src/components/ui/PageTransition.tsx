import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * Enter-only page transition (opacity + small translate, GPU-friendly).
 * Exit animations are deliberately skipped: they would delay navigation and
 * require freezing the router outlet, which costs more than it adds.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}
