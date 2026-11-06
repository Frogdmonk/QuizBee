import { cn } from '@/lib/cn';
import { Monogram } from './Monogram';

/** Overlapping initials for the first few real names, then "+N". Decorative: say the count in text too. */
export function InitialsStack({
  names,
  max = 4,
  size = 28,
  className,
}: {
  names: string[];
  max?: number;
  size?: number;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span aria-hidden className={cn('flex items-center', className)}>
      {shown.map((name, i) => (
        <span key={`${name}-${i}`} className={cn('rounded-sm ring-2 ring-paper', i > 0 && '-ml-2')}>
          <Monogram name={name} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="type-score -ml-2 grid place-items-center rounded-sm bg-paper-sunk text-ink-700 ring-2 ring-paper"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
