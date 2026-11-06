import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'error';

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-ink-200 bg-ink-50 text-ink-800', icon: <Info className="size-5 text-ink-500" /> },
  success: { box: 'border-mint-400/40 bg-mint-50 text-ink-900', icon: <CheckCircle2 className="size-5 text-mint-600" /> },
  warning: {
    box: 'border-sun-400/50 bg-sun-300/20 text-ink-900',
    icon: <AlertTriangle className="size-5 text-sun-500" />,
  },
  error: { box: 'border-rose-400/40 bg-rose-50 text-ink-900', icon: <XCircle className="size-5 text-rose-500" /> },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <m.div
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', t.box, className)}
    >
      <span className="mt-px shrink-0">{t.icon}</span>
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-700">{children}</div>}
      </div>
    </m.div>
  );
}
