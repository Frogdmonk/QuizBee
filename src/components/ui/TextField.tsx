import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  fieldErrorClasses,
  fieldHintClasses,
  fieldLabelClasses,
  inputClasses,
  nightFieldErrorClasses,
  nightInputClasses,
  type FieldTone,
} from './field-styles';

export function FieldError({ id, tone = 'paper', children }: { id?: string; tone?: FieldTone; children: ReactNode }) {
  return (
    <p id={id} className={cn('flex items-start gap-1.5 text-body-sm font-medium', tone === 'night' ? 'text-error-300' : 'text-error-600')}>
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  trailing?: ReactNode;
  /** Content right-aligned on the label row (e.g. a "Forgot password?" link or a counter). */
  labelAside?: ReactNode;
  /** Shows the single "Optional" caption on the label row. */
  optional?: boolean;
  tone?: FieldTone;
  ref?: Ref<HTMLInputElement>;
};

/** Labelled text input. The hint stays visible above the error message. */
export function TextField({
  label,
  error,
  hint,
  hideLabel,
  trailing,
  labelAside,
  optional,
  tone = 'paper',
  className,
  id,
  ref,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const night = tone === 'night';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className={cn('flex items-center justify-between gap-3', hideLabel && !labelAside && 'sr-only')}>
        <label htmlFor={inputId} className={cn(fieldLabelClasses(tone), hideLabel && 'sr-only')}>
          {label}
        </label>
        {(optional || labelAside) && (
          <span className={cn('flex items-center gap-3 text-caption', night ? 'text-night-muted' : 'text-ink-500')}>
            {optional && 'Optional'}
            {labelAside}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputClasses,
            'h-11',
            night && nightInputClasses,
            trailing ? 'pr-12' : undefined,
            error && (night ? nightFieldErrorClasses : fieldErrorClasses),
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
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

export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="grid size-11 place-items-center rounded-sm text-ink-500 hover:text-ink-900"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      }
    />
  );
}
