import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { enterUp } from '@/lib/motion';

type Tone = 'info' | 'success' | 'warning' | 'error';

const paper: Record<Tone, { box: string; tab: string; icon: ReactNode }> = {
  info: { box: 'bg-info-50 text-ink-900', tab: 'bg-info-700', icon: <Info className="size-5 text-info-700" /> },
  success: { box: 'bg-success-50 text-ink-900', tab: 'bg-success-600', icon: <CheckCircle2 className="size-5 text-success-600" /> },
  warning: { box: 'bg-warning-50 text-ink-900', tab: 'bg-warning-700', icon: <AlertTriangle className="size-5 text-warning-700" /> },
  error: { box: 'bg-error-50 text-ink-900', tab: 'bg-error-600', icon: <XCircle className="size-5 text-error-600" /> },
};

const night: Record<Tone, { box: string; tab: string; icon: ReactNode }> = {
  info: { box: 'bg-night-900 text-night-text', tab: 'bg-night-text', icon: <Info className="size-5 text-night-muted" /> },
  success: { box: 'bg-night-900 text-night-text', tab: 'bg-success-400', icon: <CheckCircle2 className="size-5 text-success-400" /> },
  warning: { box: 'bg-night-900 text-night-text', tab: 'bg-answer-d', icon: <AlertTriangle className="size-5 text-answer-d" /> },
  error: { box: 'bg-night-900 text-night-text', tab: 'bg-error-300', icon: <XCircle className="size-5 text-error-300" /> },
};

/** Inline message: tinted panel with a 4px tone tab on the left. */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
  surface = 'paper',
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  surface?: 'paper' | 'night';
}) {
  const t = (surface === 'night' ? night : paper)[tone];
  return (
    <m.div
      role={tone === 'error' ? 'alert' : 'status'}
      variants={enterUp}
      initial="hidden"
      animate="show"
      className={cn('relative flex gap-3 overflow-hidden rounded-sm py-3 pr-4 pl-5 text-body-sm', t.box, className)}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', t.tab)} />
      <span className="mt-px shrink-0">{t.icon}</span>
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={surface === 'night' ? 'text-night-muted' : 'text-ink-700'}>{children}</div>}
      </div>
    </m.div>
  );
}
