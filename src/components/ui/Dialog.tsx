import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';
import { Button, type ButtonProps } from './Button';
import { cn } from '@/lib/cn';
import { dur, spring } from '@/lib/motion';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevent closing via backdrop / Escape (e.g. while saving). */
  dismissible?: boolean;
  className?: string;
  /** Paper (teacher) or night (student / projector). */
  tone?: 'paper' | 'night';
  /** md = 28rem, lg = 40rem, xl = 56rem. */
  size?: 'md' | 'lg' | 'xl';
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Phone: a bottom sheet with a grabber. Larger screens: a centred panel.
 * Always capped to the viewport with a scrolling body and a sticky footer. Traps focus,
 * closes on Escape (when dismissible) and restores focus on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className,
  tone = 'paper',
  size = 'md',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const night = tone === 'night';
  // The latest onClose, so a parent passing a new function on every render does not re-run the
  // open effect (which would move focus back to the first control while someone types).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element (or the panel itself).
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel)?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
      }
      // Minimal focus trap.
      if (e.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dismissible]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn('fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6', night ? 'ground-night' : 'ground-paper')}>
          <m.div
            className={cn('absolute inset-0', night ? 'bg-black/70' : 'bg-ink-950/50')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
            onClick={dismissible ? onClose : undefined}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24, transition: { duration: dur.fast } }}
            transition={spring.sheet}
            className={cn(
              'relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-16px)] w-full flex-col overflow-hidden rounded-t-md outline-none sm:rounded-md',
              size === 'xl' ? 'sm:max-w-[56rem]' : size === 'lg' ? 'sm:max-w-[40rem]' : 'sm:max-w-md',
              night
                ? 'border border-night-line bg-night-900 text-night-text'
                : 'border-t-[3px] border-ink-950 bg-surface text-ink-900 shadow-pop',
              className,
            )}
          >
            <div aria-hidden className={cn('mx-auto mt-2 h-1 w-10 rounded-full sm:hidden', night ? 'bg-night-line' : 'bg-line')} />
            <div className="flex items-start justify-between gap-4 px-5 pt-3 sm:px-6 sm:pt-5">
              <h2 id={titleId} className="type-headline min-w-0 pt-2 text-headline">
                {title}
              </h2>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    '-mr-2 grid size-11 shrink-0 place-items-center rounded-sm',
                    night ? 'text-night-muted hover:bg-night-800 hover:text-night-text' : 'text-ink-500 hover:bg-paper-sunk hover:text-ink-900',
                  )}
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">
              {description && (
                <div id={descriptionId} className={cn('mt-1 text-body', night ? 'text-night-muted' : 'text-ink-700')}>
                  {description}
                </div>
              )}
              {children && <div className="mt-5">{children}</div>}
            </div>
            {footer && (
              <div
                className={cn(
                  'pb-safe flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6',
                  night ? 'border-night-rule bg-night-900' : 'border-line bg-surface',
                )}
              >
                {footer}
              </div>
            )}
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Variant of the confirm button. `danger` is the only place the filled danger button appears. */
  tone?: ButtonProps['variant'];
  busy?: boolean;
  /** Surface of the dialog itself. */
  surface?: 'paper' | 'night';
};

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  surface = 'paper',
}: ConfirmDialogProps) {
  const night = surface === 'night';
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      dismissible={!busy}
      title={title}
      description={description}
      tone={surface}
      footer={
        <>
          <Button variant={night ? 'night-ghost' : 'secondary'} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
