import { useId, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { inputClasses } from './TextField';

/* ── Textarea with optional character counter ─────────────────────────────── */

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  maxChars?: number;
  ref?: Ref<HTMLTextAreaElement>;
};

export function TextAreaField({ label, hideLabel, error, hint, maxChars, className, id, value, ref, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const length = typeof value === 'string' ? value.length : 0;
  const over = maxChars !== undefined && length > maxChars;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className={cn('block text-sm font-semibold text-ink-800', hideLabel && 'sr-only')}>
          {label}
        </label>
        {maxChars !== undefined && (
          <span className={cn('tabular text-xs', over ? 'font-semibold text-rose-600' : 'text-ink-400')} aria-live="polite">
            {length}/{maxChars}
          </span>
        )}
      </div>
      <textarea
        ref={ref}
        id={fieldId}
        value={value}
        aria-invalid={error || over ? true : undefined}
        className={cn(
          inputClasses,
          'min-h-[88px] resize-y py-2.5 leading-relaxed',
          error || over ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-50' : 'border-ink-200',
        )}
        {...rest}
      />
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}

/* ── Native select (best on mobile) ───────────────────────────────────────── */

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hideLabel?: boolean;
  icon?: ReactNode;
};

export function SelectField({ label, hideLabel, icon, className, id, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={fieldId} className={cn('block text-sm font-semibold text-ink-800', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-400 [&>svg]:size-4">{icon}</span>}
        <select
          id={fieldId}
          className={cn(inputClasses, 'h-11 appearance-none border-ink-200 pr-10', icon ? 'pl-9' : undefined)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" />
      </div>
    </div>
  );
}

/* ── Switch ───────────────────────────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-semibold text-ink-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
          checked ? 'bg-mint-500' : 'bg-ink-200',
        )}
      >
        <m.span
          className="block size-6 rounded-full bg-white shadow-card"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 700, damping: 40 }}
        />
      </button>
    </div>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────── */

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  layoutId,
}: {
  label: string;
  value: T;
  /** `shortLabel` is shown on phone-sized screens. */
  options: { value: T; label: string; shortLabel?: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  /** Unique per instance so the sliding highlight animates correctly. */
  layoutId: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full gap-1 rounded-xl bg-ink-100 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            aria-label={opt.shortLabel ? opt.label : undefined}
            className={cn(
              'relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition-colors',
              active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            {opt.icon && <span className="relative hidden sm:inline [&>svg]:size-4">{opt.icon}</span>}
            {opt.shortLabel ? (
              <>
                <span className="relative truncate sm:hidden">{opt.shortLabel}</span>
                <span className="relative hidden truncate sm:inline">{opt.label}</span>
              </>
            ) : (
              <span className="relative truncate">{opt.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-ink-100', className)} />;
}
