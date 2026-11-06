import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'sheet' | 'flat' | 'night';

const variants: Record<CardVariant, string> = {
  /** White sheet with a hairline edge. No shadow. */
  sheet: 'rounded-md border border-line bg-surface',
  /** Paper-sunk band, no border. Never place inputs on it. */
  flat: 'rounded-md bg-paper-sunk',
  /** Raised panel on the night canvas. */
  night: 'rounded-md border border-night-rule bg-night-900 text-night-text',
};

/** Generic container. Prefer a Ledger, StatStrip or SectionHead before reaching for a card. */
export function Card({ className, variant = 'sheet', ...rest }: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div className={cn(variants[variant], className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6', className)}>
      <div className="min-w-0">
        <h2 className="text-title text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-body-sm text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...rest} />;
}
