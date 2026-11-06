import type { HTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { LEDGER_TABS, type LedgerTab } from './ledger-tabs';

/**
 * Ledger: a list without a container, rows separated by hairlines. Pair it with a SectionHead.
 * Use for every teacher list (quizzes, sessions, workspaces, members).
 */
export function Ledger({ className, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('divide-y divide-line border-b border-line', className)} {...rest} />;
}

/**
 * A ledger row (56–72px) with an optional 4px left status tab. To make the whole row clickable,
 * put one <LedgerLink> inside (stretched-link pattern) and keep other buttons in `actions`.
 */
export function LedgerRow({
  tab,
  actions,
  children,
  className,
  interactive = true,
}: {
  tab?: LedgerTab;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Adds the paper-sunk hover. */
  interactive?: boolean;
}) {
  return (
    <li
      className={cn(
        'relative flex min-h-14 items-center gap-3 py-3 pr-1 pl-4 sm:gap-4',
        interactive && 'transition-colors duration-[var(--dur-fast)] hover:bg-paper-sunk/60',
        className,
      )}
    >
      {tab && <span aria-hidden className={cn('absolute top-2 bottom-2 left-0 w-1 rounded-r-[2px]', LEDGER_TABS[tab])} />}
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="relative z-10 flex shrink-0 items-center gap-1">{actions}</div>}
    </li>
  );
}

/** The row's main link. Its hit area stretches over the whole row. */
export function LedgerLink({ className, children, ...rest }: LinkProps) {
  return (
    <Link
      className={cn(
        "block truncate text-title text-ink-900 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline",
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
