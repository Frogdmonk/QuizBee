import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastContext, type ToastInput, type ToastTone } from './toast-context';

type ToastItem = Required<Pick<ToastInput, 'title' | 'tone'>> & { id: number; description?: string };

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-mint-400" />,
  error: <XCircle className="size-5 text-rose-400" />,
  info: <Info className="size-5 text-sun-400" />,
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
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:px-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lift"
            >
              <span className="mt-0.5 shrink-0">{icons[t.tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-ink-300">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-white/10 hover:text-white"
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
