import { cn } from '@/lib/cn';
import { hashIndex, initialsOf } from '@/lib/hash';
import { ANSWER_STYLES } from '@/components/quiz/answer-styles';

/**
 * Identity tile for a workspace or a person: initials on a hashed answer colour with that
 * answer's kit pattern. `seed` keeps the colour stable (use an id). `size` in px.
 */
export function Monogram({
  name,
  seed,
  size = 44,
  className,
  tone = 'answer',
}: {
  name: string;
  seed?: string;
  size?: number;
  className?: string;
  /** `ink` gives an ink tile with a signal tab (used for the signed-in teacher). */
  tone?: 'answer' | 'ink';
}) {
  const style = ANSWER_STYLES[hashIndex(seed ?? name, ANSWER_STYLES.length)];
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-sm',
        tone === 'ink' ? 'bg-ink-900 text-white' : [style.kit, style.fg],
        className,
      )}
      style={{ width: size, height: size }}
    >
      {tone === 'ink' && <span className="absolute inset-y-0 left-0 w-1 bg-signal-600" />}
      <span className="type-score relative leading-none" style={{ fontSize: Math.round(size * 0.4) }}>
        {initialsOf(name)}
      </span>
    </span>
  );
}
