import { AnimatePresence, m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { BreathingLine } from '@/components/ui/BreathingLine';

/**
 * Shown for the short lead window before a question. The question itself is already delivered but
 * held back: every screen reveals it at the same scheduled instant, so nobody gets a head start
 * from a faster connection and nobody loses time to a slower one.
 */
export function GetReady({ number, total, remainingMs, size = 'phone', className }: { number: number; total: number; remainingMs: number; size?: 'phone' | 'stage'; className?: string }) {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const stage = size === 'stage';
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center text-center', className)} role="status" aria-live="polite" aria-label={`Question ${number} starts in ${seconds}`}>
      <p className="type-kicker text-night-muted">
        Question {number} of {total}
      </p>
      <p className={cn('type-display mt-3', stage ? 'text-stage-title' : 'text-display-lg')}>Get ready</p>
      <div className={cn('relative mt-6 grid place-items-center', stage ? 'size-[18vh]' : 'size-28')}>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={seconds}
            className={cn('type-stage absolute leading-none', stage ? 'text-[14vh]' : 'text-[5.5rem]')}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={spring.pop}
          >
            {seconds}
          </m.span>
        </AnimatePresence>
      </div>
      <BreathingLine className="mt-6" />
    </div>
  );
}
