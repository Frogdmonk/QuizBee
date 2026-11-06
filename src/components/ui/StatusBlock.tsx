import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { enterUp } from '@/lib/motion';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const paperTones: Record<Tone, { tile: string; tab: string }> = {
  neutral: { tile: 'bg-paper-sunk text-ink-700', tab: 'bg-ink-500' },
  info: { tile: 'bg-info-50 text-info-700', tab: 'bg-info-700' },
  success: { tile: 'bg-success-50 text-success-600', tab: 'bg-success-600' },
  warning: { tile: 'bg-warning-50 text-warning-700', tab: 'bg-warning-700' },
  error: { tile: 'bg-error-50 text-error-600', tab: 'bg-error-600' },
};

const nightTones: Record<Tone, { tile: string; tab: string }> = {
  neutral: { tile: 'bg-night-800 text-night-text', tab: 'bg-night-muted' },
  info: { tile: 'bg-night-800 text-night-text', tab: 'bg-night-text' },
  success: { tile: 'bg-night-800 text-success-400', tab: 'bg-success-400' },
  warning: { tile: 'bg-night-800 text-answer-d', tab: 'bg-answer-d' },
  error: { tile: 'bg-night-800 text-error-300', tab: 'bg-error-300' },
};

/**
 * The one pattern for auth results, terminal and error states: a 48px icon tile with a 4px
 * tone tab, then a title, body and actions. Left-aligned.
 */
export function StatusBlock({
  icon,
  title,
  children,
  actions,
  tone = 'neutral',
  surface = 'paper',
  headingLevel = 'h1',
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: Tone;
  surface?: 'paper' | 'night';
  headingLevel?: 'h1' | 'h2';
  className?: string;
}) {
  const night = surface === 'night';
  const t = (night ? nightTones : paperTones)[tone];
  const Heading = headingLevel;
  return (
    <m.div variants={enterUp} initial="hidden" animate="show" className={cn('max-w-lg', className)}>
      <span className={cn('relative grid size-12 place-items-center overflow-hidden rounded-sm [&>svg]:size-6', t.tile)}>
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', t.tab)} />
        {icon}
      </span>
      <Heading className={cn('type-headline mt-5 text-headline', night ? 'text-night-text' : 'text-ink-900')}>{title}</Heading>
      {children && <div className={cn('mt-2 text-body', night ? 'text-night-muted' : 'text-ink-700')}>{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </m.div>
  );
}
