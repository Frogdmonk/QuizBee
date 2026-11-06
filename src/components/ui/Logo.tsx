import { cn } from '@/lib/cn';
import { APP_NAME } from '@/lib/brand';

/** Original Rally mark: three rising bars (a mini podium) with a spark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <rect width="32" height="32" rx="9" fill="#17161C" />
      <rect x="7" y="17" width="5" height="8" rx="2.5" fill="#F0532B" />
      <rect x="13.5" y="11" width="5" height="14" rx="2.5" fill="#FFC23D" />
      <rect x="20" y="14" width="5" height="11" rx="2.5" fill="#22B07D" />
      <circle cx="16" cy="6.5" r="2.2" fill="#FFC23D" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className={cn('font-display text-xl font-extrabold tracking-tight', inverted ? 'text-white' : 'text-ink-900')}>
        {APP_NAME}
      </span>
    </span>
  );
}
