import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { enterUp } from '@/lib/motion';

/**
 * Enter-only page transition (enterUp: 8px rise plus fade).
 * Exit animations are deliberately skipped: they would delay navigation.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div variants={enterUp} initial="hidden" animate="show" className={className}>
      {children}
    </m.div>
  );
}
