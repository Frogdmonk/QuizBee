import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none whitespace-nowrap ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-flame-500 text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.16)] hover:bg-flame-600',
  secondary: 'border border-ink-200 bg-surface text-ink-900 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-rose-500 text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.16)] hover:bg-rose-600',
  dark: 'bg-ink-900 text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.3)] hover:bg-ink-800',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-12 px-5 text-base',
  xl: 'h-14 rounded-2xl px-7 text-lg',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', fullWidth = false) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full');
}
