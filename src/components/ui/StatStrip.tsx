import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { CountRoll } from './CountRoll';

/**
 * Results-table strip: a paper-sunk band split by hairlines into 3–4 cells, each a big tabular
 * number over a caption. Stays 3-up on phones. Values must be real counts.
 */
export function StatStrip({
  items,
  className,
}: {
  items: { label: string; value: number; to?: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn('grid divide-x divide-line rounded-md bg-paper-sunk', className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const body = (
          <>
            <dt className="order-2 truncate text-caption text-ink-500">{item.label}</dt>
            <dd className="type-score order-1 text-score-xl text-ink-900">
              <CountRoll value={item.value} />
            </dd>
          </>
        );
        return item.to ? (
          <Link
            key={item.label}
            to={item.to}
            className="flex min-w-0 flex-col gap-1 px-3 py-3 transition-colors duration-[var(--dur-fast)] hover:bg-line/40 sm:px-5 sm:py-4"
          >
            {body}
          </Link>
        ) : (
          <div key={item.label} className="flex min-w-0 flex-col gap-1 px-3 py-3 sm:px-5 sm:py-4">
            {body}
          </div>
        );
      })}
    </dl>
  );
}
