import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { m } from 'motion/react';
import { ANSWER_STYLES } from '@/components/quiz/answer-styles';
import { cn } from '@/lib/cn';

/**
 * The 404 / error "answer grid": four real links set as answer tiles, plus a dimmed fifth tile
 * for the thing that went wrong (struck through, nudging once).
 */
export function OptionsGrid({ links, missing }: { links: { to: string; label: string; reload?: boolean }[]; missing: ReactNode }) {
  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-2 gap-2">
        {links.map((link, i) => {
          const style = ANSWER_STYLES[i % ANSWER_STYLES.length];
          return (
            <li key={link.to + link.label}>
              <Link
                to={link.to}
                reloadDocument={link.reload}
                className={cn(
                  'flex min-h-16 items-stretch overflow-hidden rounded-md shadow-press transition-transform duration-[var(--dur-instant)] active:translate-y-[2px]',
                  style.bg,
                  style.fg,
                )}
              >
                <span aria-hidden className={cn('flex w-11 shrink-0 items-center justify-center', style.kit)}>
                  <span className={cn('type-stage grid size-8 place-items-center rounded-[4px] text-[1.125rem]', style.bg)}>{style.letter}</span>
                </span>
                <span className="flex min-w-0 items-center px-3 text-body font-bold">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <m.div
        className="flex min-h-14 items-center gap-3 rounded-md border border-night-line bg-answer-dim px-4 text-night-muted"
        initial={{ x: 0 }}
        animate={{ x: [0, -6, 6, -3, 0] }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <span className="type-stage text-[1.125rem]">?</span>
        <span className="min-w-0 truncate font-mono text-body-sm line-through">{missing}</span>
      </m.div>
    </div>
  );
}
