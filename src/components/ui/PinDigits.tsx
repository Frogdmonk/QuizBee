import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring, wipeIn } from '@/lib/motion';

type Size = 'phone' | 'bar' | 'stage';

const SIZES: Record<Size, { cell: string; digit: string; gap: string; split: string; line: string }> = {
  phone: { cell: 'h-16 w-[13%] max-w-13', digit: 'text-[2.75rem]', gap: 'gap-2', split: 'ml-3', line: 'h-[3px]' },
  bar: { cell: 'h-10 w-7', digit: 'text-score-xl', gap: 'gap-0.5', split: 'ml-2.5', line: 'h-0.5' },
  stage: { cell: 'w-[0.62em]', digit: 'text-stage-pin', gap: 'gap-[0.04em]', split: 'ml-[0.22em]', line: 'h-[0.06em]' },
};

/**
 * A six-digit PIN set as broadcast numerals (night surfaces). Renders empty slots for missing
 * digits. `activeIndex` shows a caret (input overlay); `reveal` drops the digits in once and
 * wipes the underline. Decorative unless `label` is given.
 */
export function PinDigits({
  value,
  length = 6,
  size = 'bar',
  reveal = false,
  activeIndex,
  label,
  className,
}: {
  value: string;
  length?: number;
  size?: Size;
  reveal?: boolean;
  activeIndex?: number;
  label?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('type-stage inline-flex items-end leading-none', s.gap, size === 'stage' && s.digit, className)}
    >
      {digits.map((digit, i) => {
        const active = activeIndex === i;
        return (
          <span key={i} className={cn('relative flex flex-col items-center justify-end', s.cell, i === length / 2 && s.split)}>
            {digit ? (
              <m.span
                key={reveal ? `r-${digit}` : digit}
                className={cn('block', size !== 'stage' && s.digit, 'leading-[0.85]')}
                initial={reveal ? { y: '-0.3em', opacity: 0 } : { scale: 0.6, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={reveal ? { ...spring.land, delay: i * 0.04 } : spring.pop}
              >
                {digit}
              </m.span>
            ) : (
              <span className={cn('block opacity-0', size !== 'stage' && s.digit, 'leading-[0.85]')}>0</span>
            )}
            {active && <span aria-hidden className="caret-blink absolute bottom-[22%] h-[45%] w-0.5 bg-signal-400" />}
            <m.span
              aria-hidden
              className={cn(
                'mt-1 block w-full shrink-0',
                s.line,
                active ? 'bg-signal-400' : digit ? 'bg-night-text' : 'bg-night-line',
              )}
              variants={reveal ? wipeIn : undefined}
              initial={reveal ? 'hidden' : false}
              animate={reveal ? 'show' : undefined}
              transition={reveal ? { delay: 0.3 + i * 0.04 } : undefined}
            />
          </span>
        );
      })}
    </span>
  );
}
