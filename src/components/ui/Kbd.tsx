import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Keyboard key chip. */
export function Kbd({ children, tone = 'paper', className }: { children: ReactNode; tone?: 'paper' | 'night'; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-grid h-6 min-w-6 place-items-center rounded-xs border-b-2 px-1.5 font-sans text-caption font-semibold',
        tone === 'night' ? 'border-night-line bg-night-800 text-night-text' : 'border-line-strong bg-paper-sunk text-ink-900',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
