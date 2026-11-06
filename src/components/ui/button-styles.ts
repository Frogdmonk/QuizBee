import { cn } from '@/lib/cn';

/**
 * Button variants (docs/DESIGN.md §5):
 * - primary: signal fill, the one main action per view.     - secondary: white with a line-strong border.
 * - ghost: text only, paper-sunk hover.                        - dark: ink fill.
 * - danger: error fill. Reserved for the confirm button inside ConfirmDialog.
 * - danger-outline: error outline. Use for every other destructive action, always with an icon.
 * - night / night-ghost: controls on the night canvas (student, projector, preview, Banner).
 * - volt: student phone screens only, at most one per screen.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dark'
  | 'danger-outline'
  | 'night'
  | 'night-ghost'
  | 'volt';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-sm font-[650] select-none whitespace-nowrap ' +
  'transition-transform duration-[var(--dur-instant)] ease-out ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed';

/** Pressable game objects: inset press shadow that disappears instantly on press. */
const pressable = 'shadow-press active:shadow-none disabled:shadow-none aria-disabled:shadow-none';

/** Disabled never uses opacity. */
const paperDisabled =
  'disabled:border-transparent disabled:bg-paper-sunk disabled:text-ink-500 ' +
  'aria-disabled:border-transparent aria-disabled:bg-paper-sunk aria-disabled:text-ink-500';
const nightDisabled =
  'disabled:border disabled:border-dashed disabled:border-night-line disabled:bg-transparent disabled:text-night-muted ' +
  'aria-disabled:border aria-disabled:border-dashed aria-disabled:border-night-line aria-disabled:bg-transparent aria-disabled:text-night-muted';

const variants: Record<ButtonVariant, string> = {
  primary: cn('bg-signal-600 text-white hover:bg-signal-700 [--wipe-color:var(--color-signal-600)]', pressable, paperDisabled),
  secondary: cn('border border-line-strong bg-surface text-ink-900 hover:bg-paper', paperDisabled),
  ghost: cn('text-ink-700 hover:bg-paper-sunk hover:text-ink-900', paperDisabled, 'disabled:bg-transparent aria-disabled:bg-transparent'),
  danger: cn('bg-error-600 text-white hover:bg-[#9c2019] [--wipe-color:var(--color-error-600)]', pressable, paperDisabled),
  dark: cn('bg-ink-900 text-white hover:bg-ink-800 [--wipe-color:var(--color-ink-900)]', pressable, paperDisabled),
  'danger-outline': cn('border-[1.5px] border-error-600 bg-surface text-error-600 hover:bg-error-50', paperDisabled),
  night: cn(
    'border border-night-line bg-night-900 text-night-text hover:bg-night-800 [--wipe-color:var(--color-night-800)]',
    nightDisabled,
  ),
  'night-ghost': cn('border border-night-line bg-transparent text-night-muted hover:bg-night-900 hover:text-night-text', nightDisabled),
  volt: cn('bg-volt-400 text-night-950 hover:bg-[#cce536] [--wipe-color:var(--color-volt-400)]', pressable, nightDisabled),
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-body-sm pointer-coarse:h-11',
  md: 'h-11 px-4 text-body',
  lg: 'h-13 px-5 text-body',
  xl: 'h-15 px-7 text-[1.125rem] font-bold',
};

export type ButtonClassOptions = {
  /** The JS Button animates the press itself (y: 2), so the CSS translate is left out. */
  jsPress?: boolean;
};

/** Class string for a button-styled element (Button, ButtonLink, or a plain <a>/<label>). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  options: ButtonClassOptions = {},
) {
  return cn(
    base,
    variants[variant],
    sizes[size],
    !options.jsPress && 'active:translate-y-[2px] disabled:translate-y-0 aria-disabled:translate-y-0',
    fullWidth && 'w-full',
  );
}
