import { useId, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { FieldError } from './TextField';
import {
  fieldErrorClasses,
  fieldHintClasses,
  fieldLabelClasses,
  inputClasses,
  nightFieldErrorClasses,
  nightInputClasses,
  type FieldTone,
} from './field-styles';

/* ── Textarea with optional character counter ─────────────────────────────── */

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  maxChars?: number;
  /** Shows the single "Optional" caption on the label row. */
  optional?: boolean;
  tone?: FieldTone;
  ref?: Ref<HTMLTextAreaElement>;
};

export function TextAreaField({
  label,
  hideLabel,
  error,
  hint,
  maxChars,
  optional,
  tone = 'paper',
  className,
  id,
  value,
  ref,
  ...rest
}: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const length = typeof value === 'string' ? value.length : 0;
  const over = maxChars !== undefined && length > maxChars;
  const night = tone === 'night';
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className={cn(fieldLabelClasses(tone), hideLabel && 'sr-only')}>
          {label}
        </label>
        <span className={cn('flex items-baseline gap-3 text-caption', night ? 'text-night-muted' : 'text-ink-500')}>
          {optional && 'Optional'}
          {maxChars !== undefined && (
            <span className={cn('tabular', over && (night ? 'font-semibold text-error-300' : 'font-semibold text-error-600'))} aria-live="polite">
              {length}/{maxChars}
            </span>
          )}
        </span>
      </div>
      <textarea
        ref={ref}
        id={fieldId}
        value={value}
        aria-invalid={error || over ? true : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
        className={cn(
          inputClasses,
          'min-h-[88px] resize-y py-2.5 leading-relaxed',
          night && nightInputClasses,
          (error || over) && (night ? nightFieldErrorClasses : fieldErrorClasses),
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className={fieldHintClasses(tone)}>
          {hint}
        </p>
      )}
      {error && (
        <FieldError id={errorId} tone={tone}>
          {error}
        </FieldError>
      )}
    </div>
  );
}

/* ── Native select (best on mobile) ───────────────────────────────────────── */

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hideLabel?: boolean;
  icon?: ReactNode;
  tone?: FieldTone;
};

export function SelectField({ label, hideLabel, icon, tone = 'paper', className, id, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const night = tone === 'night';
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={fieldId} className={cn(fieldLabelClasses(tone), hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 left-3 flex items-center [&>svg]:size-4',
              night ? 'text-night-muted' : 'text-ink-500',
            )}
          >
            {icon}
          </span>
        )}
        <select
          id={fieldId}
          className={cn(inputClasses, 'h-11 appearance-none pr-10', night && nightInputClasses, icon ? 'pl-9' : undefined)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2',
            night ? 'text-night-muted' : 'text-ink-500',
          )}
        />
      </div>
    </div>
  );
}

/* ── Switch ───────────────────────────────────────────────────────────────── */

/** On/off toggle, 44×26, ink when on. Prefer it for settings that apply immediately. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = 'paper',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  tone?: FieldTone;
}) {
  const id = useId();
  const night = tone === 'night';
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className={fieldLabelClasses(tone)}>
          {label}
        </label>
        {description && <p className={cn('mt-0.5', fieldHintClasses(tone))}>{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full border p-[3px] transition-colors duration-[var(--dur-fast)] disabled:cursor-not-allowed',
          // Invisible hit area so the target reaches 44px on touch screens.
          "after:absolute after:-inset-[9px] after:content-['']",
          checked
            ? night
              ? 'border-night-text bg-night-text'
              : 'border-ink-900 bg-ink-900'
            : night
              ? 'border-night-line bg-night-900'
              : 'border-line-strong bg-surface',
          disabled && 'border-line bg-paper-sunk',
        )}
      >
        <m.span
          className={cn(
            'block size-[18px] rounded-full',
            checked ? (night ? 'bg-night-950' : 'bg-surface') : night ? 'bg-night-muted' : 'bg-line-strong',
          )}
          animate={{ x: checked ? 18 : 0 }}
          transition={spring.press}
        />
      </button>
    </div>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────── */

/** A small set of mutually exclusive options. The selected pill slides between them. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  layoutId,
  tone = 'paper',
  className,
}: {
  label: string;
  value: T;
  /** `shortLabel` is shown on phone-sized screens; `count` adds a tabular number. */
  options: { value: T; label: string; shortLabel?: string; icon?: ReactNode; count?: number }[];
  onChange: (value: T) => void;
  /** Unique per instance so the sliding highlight animates correctly. */
  layoutId: string;
  tone?: FieldTone;
  className?: string;
}) {
  const night = tone === 'night';
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex w-full gap-1 rounded-sm border p-[3px]',
        night ? 'border-night-line bg-night-900' : 'border-line-strong bg-surface',
        className,
      )}
    >
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
              'relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[4px] px-2 text-label whitespace-nowrap transition-colors duration-[var(--dur-fast)] pointer-coarse:h-11',
              active
                ? night
                  ? 'text-night-text'
                  : 'text-white'
                : night
                  ? 'text-night-muted hover:text-night-text'
                  : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                className={cn('absolute inset-0 rounded-[4px]', night ? 'bg-night-800' : 'bg-ink-900')}
                transition={spring.layout}
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
            {opt.count !== undefined && <span className="type-score relative text-score-sm opacity-80">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

/** Static placeholder block (never animated). Put aria-busy on the container. */
export function Skeleton({ className, tone = 'paper' }: { className?: string; tone?: FieldTone }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-sm',
        tone === 'night' ? 'bg-night-800' : 'bg-paper-sunk shadow-[inset_0_0_0_1px_var(--color-line)]',
        className,
      )}
    />
  );
}
