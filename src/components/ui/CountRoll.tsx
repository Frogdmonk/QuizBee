import { AnimatePresence, m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';

/**
 * A number that rolls when it changes (translateY with the roll spring; reduced motion
 * falls back to a crossfade via MotionConfig). Announces changes politely.
 * Only ever pass real counts.
 */
export function CountRoll({ value, className }: { value: number | string; className?: string }) {
  return (
    <span aria-live="polite" className={cn('relative inline-grid overflow-hidden align-bottom tabular', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={String(value)}
          className="col-start-1 row-start-1"
          initial={{ y: '-70%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '70%', opacity: 0 }}
          transition={spring.roll}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
