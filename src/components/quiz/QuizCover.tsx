import { cn } from '@/lib/cn';
import { hashIndex } from '@/lib/hash';
import { ANSWER_STYLES } from './answer-styles';

/**
 * Quiz cover: the uploaded image, or a band in a hashed answer colour with its kit pattern and
 * the title's first letter. `band` is full-width (cards), `thumb` a square (ledger rows).
 */
export function QuizCover({
  coverUrl,
  seed,
  title,
  size = 'band',
  className,
}: {
  coverUrl?: string | null;
  seed: string;
  title: string;
  size?: 'band' | 'thumb';
  className?: string;
}) {
  const style = ANSWER_STYLES[hashIndex(seed, ANSWER_STYLES.length)];
  const letter = ([...title.trim()][0] ?? '?').toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        'relative shrink-0 overflow-hidden',
        size === 'band' ? 'h-[72px] w-full' : 'size-14 rounded-sm sm:size-16',
        !coverUrl && [style.bg, style.fg],
        className,
      )}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <>
          <span className={cn('absolute inset-y-0 left-0', size === 'band' ? 'w-16' : 'w-1/3', style.kit)} />
          <span
            className={cn(
              'type-display absolute leading-none',
              size === 'band' ? 'right-4 bottom-2 text-[2.75rem]' : 'right-2 bottom-1 text-[1.75rem]',
            )}
          >
            {letter}
          </span>
        </>
      )}
    </div>
  );
}
