import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { cn } from '@/lib/cn';
import { dur } from '@/lib/motion';

export type MenuItem =
  | {
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      tone?: 'default' | 'danger';
      disabled?: boolean;
    }
  | 'separator';

type MenuProps = {
  /** Accessible label for the trigger button. */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  triggerClassName?: string;
  /** Use only `triggerClassName` (no default icon-button styling). */
  plainTrigger?: boolean;
};

/** Small accessible dropdown menu (click / Enter to open, arrows to move, Escape to close). */
export function Menu({ label, trigger, items, align = 'right', triggerClassName, plainTrigger = false }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    });
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (index + 1) % nodes.length : (index - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          plainTrigger
            ? triggerClassName
            : cn(
                'grid size-9 place-items-center rounded-sm text-ink-500 hover:bg-paper-sunk hover:text-ink-900 pointer-coarse:size-11',
                triggerClassName,
              )
        }
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: dur.instant } }}
            transition={{ duration: dur.fast }}
            className={cn(
              'absolute top-full z-40 mt-1 min-w-52 origin-top rounded-sm border border-line bg-surface p-1 text-ink-900 shadow-pop',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((item, i) =>
              item === 'separator' ? (
                <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex min-h-10 w-full items-center gap-2.5 rounded-[4px] px-3 text-left text-body-sm font-medium outline-none pointer-coarse:min-h-11',
                    'hover:bg-paper-sunk focus-visible:bg-paper-sunk disabled:cursor-not-allowed disabled:text-ink-500',
                    item.tone === 'danger' ? 'text-error-600' : 'text-ink-900',
                  )}
                >
                  {item.icon && <span className="shrink-0 [&>svg]:size-4">{item.icon}</span>}
                  {item.label}
                </button>
              ),
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
