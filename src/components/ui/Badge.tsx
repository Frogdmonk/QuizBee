import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'flame' | 'mint' | 'sun' | 'rose' | 'dark';

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  flame: 'bg-flame-100 text-flame-700',
  mint: 'bg-mint-50 text-mint-600',
  sun: 'bg-sun-300/30 text-ink-800',
  rose: 'bg-rose-50 text-rose-600',
  dark: 'bg-ink-900 text-white',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
