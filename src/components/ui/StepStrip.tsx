import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { staggerDelay, wipeIn } from '@/lib/motion';

const TABS = ['bg-answer-a', 'bg-answer-b', 'bg-answer-c', 'bg-answer-d'];

/**
 * Numbered steps (e.g. Build / Host / Join) with answer-colour tabs that wipe in once.
 * The text itself is static and always visible.
 */
export function StepStrip({
  steps,
  className,
  tone = 'paper',
}: {
  steps: { title: string; body: string }[];
  className?: string;
  tone?: 'paper' | 'night';
}) {
  const night = tone === 'night';
  return (
    <ol className={cn('grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]', className)}>
      {steps.map((step, i) => (
        <li key={step.title} className="min-w-0">
          <m.span
            aria-hidden
            className={cn('block h-1.5 w-12', TABS[i % TABS.length])}
            variants={wipeIn}
            initial="hidden"
            animate="show"
            transition={{ delay: staggerDelay(i) * 2 }}
          />
          <p className={cn('type-score mt-3 text-score-sm', night ? 'text-night-muted' : 'text-ink-500')}>
            {String(i + 1).padStart(2, '0')}
          </p>
          <p className={cn('mt-1 text-title', night ? 'text-night-text' : 'text-ink-900')}>{step.title}</p>
          <p className={cn('mt-1 text-body-sm', night ? 'text-night-muted' : 'text-ink-700')}>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
