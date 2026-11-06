import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { slideFromLeft } from '@/lib/motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastContext, type ToastInput, type ToastTone } from './toast-context';

type ToastItem = Required<Pick<ToastInput, 'title' | 'tone'>> & { id: number; description?: string };

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-success-400" />,
  error: <XCircle className="size-5 text-error-300" />,
  info: <Info className="size-5 text-night-muted" />,
};

const tabs: Record<ToastTone, string> = {
  success: 'bg-success-400',
  error: 'bg-error-300',
  info: 'bg-night-text',
};

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const tone = input.tone ?? 'info';
      setItems((list) => [...list, { id, title: input.title, description: input.description, tone }].slice(-MAX_VISIBLE));
      const duration = input.durationMs ?? (tone === 'error' ? 6000 : 4000);
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[var(--tabbar-h,0px)] z-[100] flex flex-col items-start gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-0 sm:px-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              variants={slideFromLeft}
              initial="hidden"
              animate="show"
              exit="exit"
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="ground-night pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-l-sm bg-night-900 py-3 pr-3 pl-5 text-night-text shadow-pop"
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${tabs[t.tone]}`} />
              <span className="mt-0.5 shrink-0">{icons[t.tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-body-sm text-night-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-my-2 grid size-10 shrink-0 place-items-center rounded-sm text-night-muted hover:bg-night-800 hover:text-night-text"
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
