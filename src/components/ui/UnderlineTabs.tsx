import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';

/**
 * Filter tabs with a 3px bar that slides under the active option (signal-400 on night).
 * Behaves as a radiogroup (it filters a list rather than swapping panels); pass `as="tablist"`
 * when it controls tab panels. Scrolls horizontally on narrow screens.
 */
export function UnderlineTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  layoutId,
  tone = 'paper',
  as = 'radiogroup',
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  /** Unique per instance. */
  layoutId: string;
  tone?: 'paper' | 'night';
  as?: 'radiogroup' | 'tablist';
  className?: string;
}) {
  const night = tone === 'night';
  const itemRole = as === 'tablist' ? 'tab' : 'radio';
  return (
    <div
      role={as}
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        night ? 'border-night-rule' : 'border-line',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role={itemRole}
            aria-checked={itemRole === 'radio' ? active : undefined}
            aria-selected={itemRole === 'tab' ? active : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-label whitespace-nowrap transition-colors duration-[var(--dur-fast)]',
              active
                ? night
                  ? 'text-night-text'
                  : 'text-ink-900'
                : night
                  ? 'text-night-muted hover:text-night-text'
                  : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {opt.label}
            {opt.count !== undefined && <span className="type-score text-score-sm">{opt.count}</span>}
            {active && (
              <m.span
                layoutId={layoutId}
                aria-hidden
                className={cn('absolute inset-x-2 -bottom-px h-[3px]', night ? 'bg-signal-400' : 'bg-ink-900')}
                transition={spring.layout}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
