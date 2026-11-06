import { cn } from '@/lib/cn';
import { APP_NAME } from '@/lib/brand';

type LogoTone = 'paper' | 'night';

/**
 * Rally mark: three rising level bars and a spark on a tile with a cut top-right corner
 * (the only angled cut in the system). `tone="night"` gives the tile an edge so it stays
 * visible on the night canvas.
 */
export function LogoMark({ className, tone = 'paper' }: { className?: string; tone?: LogoTone }) {
  const night = tone === 'night';
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <path
        d="M4 0h20.5L32 7.5V28a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z"
        fill={night ? '#2B3036' : '#121214'}
        stroke={night ? '#646B74' : 'none'}
        strokeWidth={night ? 1 : 0}
      />
      <rect x="7" y="17" width="5" height="9" rx="1" fill="#FF7A5C" />
      <rect x="13.5" y="10" width="5" height="16" rx="1" fill="#F2B100" />
      <rect x="20" y="13.5" width="5" height="12.5" rx="1" fill="#33C47A" />
      <path d="M16 3.2l1 2.1 2.1 1-2.1 1L16 9.4l-1-2.1-2.1-1 2.1-1z" fill="#F2B100" />
    </svg>
  );
}

/** Mark plus wordmark. `inverted` (legacy) implies the night tone. */
export function Logo({ className, inverted = false, tone }: { className?: string; inverted?: boolean; tone?: LogoTone }) {
  const resolved: LogoTone = tone ?? (inverted ? 'night' : 'paper');
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark tone={resolved} />
      <span className={cn('type-headline text-[1.375rem] leading-none', resolved === 'night' ? 'text-night-text' : 'text-ink-900')}>
        {APP_NAME}
      </span>
    </span>
  );
}
