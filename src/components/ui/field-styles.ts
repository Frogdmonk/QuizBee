import { cn } from '@/lib/cn';

export type FieldTone = 'paper' | 'night';

/** Shared input look (paper). Inputs never sit directly on paper-sunk. */
export const inputClasses =
  'block w-full rounded-sm border border-line-strong bg-surface px-3.5 text-body text-ink-900 placeholder:text-ink-500 ' +
  'transition-[border-color] duration-[var(--dur-fast)] outline-none ' +
  'focus:border-signal-600 focus:shadow-[0_0_0_1px_var(--color-signal-600)] ' +
  'disabled:bg-paper-sunk disabled:text-ink-500';

/** Night variant for student and projector screens. */
export const nightInputClasses =
  'border-night-line bg-night-900 text-night-text placeholder:text-night-muted focus:border-signal-400 focus:shadow-[0_0_0_1px_var(--color-signal-400)] ' +
  'disabled:bg-night-950 disabled:text-night-muted';

export const fieldErrorClasses = 'border-error-600 focus:border-error-600 focus:shadow-[0_0_0_1px_var(--color-error-600)]';
export const nightFieldErrorClasses = 'border-error-300 focus:border-error-300 focus:shadow-[0_0_0_1px_var(--color-error-300)]';

export function fieldLabelClasses(tone: FieldTone = 'paper') {
  return cn('block text-label', tone === 'night' ? 'text-night-text' : 'text-ink-900');
}

export function fieldHintClasses(tone: FieldTone = 'paper') {
  return cn('text-body-sm', tone === 'night' ? 'text-night-muted' : 'text-ink-500');
}

