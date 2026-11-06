import { m } from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * Decorative illustration of the answer-tile motif. It is clearly an
 * illustration (no names, scores or fake data) and animates once on mount.
 */
const tiles = [
  { letter: 'A', color: 'bg-answer-a', width: 'w-[78%]' },
  { letter: 'B', color: 'bg-answer-b', width: 'w-[62%]' },
  { letter: 'C', color: 'bg-answer-c', width: 'w-[70%]' },
  { letter: 'D', color: 'bg-answer-d', width: 'w-[54%]' },
];

export function AnswerTilesArt({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('grid grid-cols-2 gap-3', className)}>
      {tiles.map((tile, i) => (
        <m.div
          key={tile.letter}
          initial={{ opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.12 + i * 0.08, type: 'spring', stiffness: 380, damping: 26 }}
          className={cn(
            'flex aspect-[1.6] flex-col justify-between rounded-2xl p-4 shadow-[inset_0_-4px_0_rgb(0_0_0/0.18)]',
            tile.color,
          )}
        >
          <span className="grid size-9 place-items-center rounded-xl bg-white/20 font-display text-lg font-extrabold text-white">
            {tile.letter}
          </span>
          <span className="space-y-1.5">
            <span className={cn('block h-2.5 rounded-full bg-white/70', tile.width)} />
            <span className="block h-2.5 w-2/5 rounded-full bg-white/35" />
          </span>
        </m.div>
      ))}
    </div>
  );
}
