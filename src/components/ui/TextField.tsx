import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export const inputClasses =
  'block w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink-900 placeholder:text-ink-400 ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
  'focus:border-flame-400 focus:ring-4 focus:ring-flame-100 disabled:bg-ink-50 disabled:text-ink-500';

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

export function TextField({ label, error, hint, hideLabel, trailing, className, id, ref, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={inputId} className={cn('block text-sm font-semibold text-ink-800', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputClasses,
            'h-11',
            trailing ? 'pr-11' : undefined,
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-50' : 'border-ink-200',
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
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
          className="grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      }
    />
  );
}
