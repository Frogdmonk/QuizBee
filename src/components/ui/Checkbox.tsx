import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A 44px-tall checkbox row: 20px box with a line-strong edge, ink fill when checked. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-1 hover:bg-paper-sunk/60',
        disabled && 'cursor-not-allowed text-ink-500',
        className,
      )}
    >
      <span className="relative grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-surface checked:border-ink-900 checked:bg-ink-900 disabled:cursor-not-allowed disabled:bg-paper-sunk"
        />
        <Check aria-hidden className="pointer-events-none relative size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-body-sm font-semibold text-ink-900">{label}</span>
        {description && <span className="block text-caption text-ink-500">{description}</span>}
      </span>
    </label>
  );
}
