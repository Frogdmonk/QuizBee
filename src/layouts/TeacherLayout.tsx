import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { Monogram } from '@/components/ui/Monogram';
import { PageTransition } from '@/components/ui/PageTransition';
import { NAV_GROUPS, TEACHER_NAV } from '@/components/teacher/nav-items';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { cn } from '@/lib/cn';
import { dur, spring } from '@/lib/motion';
import { APP_NAME } from '@/lib/brand';

const TABBAR_HEIGHT = '64px';
const FOCUSABLE = 'a[href], button:not([disabled])';

function NavList({ onNavigate, layoutId }: { onNavigate?: () => void; layoutId: string }) {
  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <p className="type-kicker px-3">{group}</p>
          <ul className="mt-2 space-y-0.5">
            {TEACHER_NAV.filter((item) => item.group === group).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-11 items-center gap-3 rounded-sm px-3 text-body-sm font-semibold transition-colors duration-[var(--dur-fast)]',
                      isActive ? 'bg-surface text-ink-900' : 'text-ink-700 hover:bg-surface/60 hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <m.span layoutId={layoutId} aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] bg-signal-600" transition={spring.layout} />
                      )}
                      <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-signal-600' : 'text-ink-500')} />
                      <span className="flex-1">{item.label}</span>
                      {item.planned && <Badge>Planned</Badge>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AccountBlock() {
  const { user, profile, signOut } = useSignedInTeacher();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const name = profile?.display_name ?? user.email ?? 'Teacher';

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not sign out', description: friendlyError(error) });
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 border-t border-line pt-4">
      <Link to="/teacher/profile" aria-label="Your profile" className="rounded-sm">
        <Monogram name={name} size={40} tone="ink" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-ink-900">{name}</p>
        <p className="truncate text-caption text-ink-500">{user.email}</p>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="grid size-11 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-surface hover:text-ink-900 disabled:text-line-strong"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-[18px]" />
      </button>
    </div>
  );
}

/** Phone navigation: four tabs plus "More", which opens the full menu. */
function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  return (
    <nav
      aria-label="Teacher"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {TEACHER_NAV.filter((item) => item.tab).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[0.75rem] font-semibold',
                  isActive ? 'text-ink-900' : 'text-ink-500',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <m.span layoutId="tab-active" aria-hidden className="absolute inset-x-4 top-0 h-[3px] bg-signal-600" transition={spring.layout} />}
                  <item.icon className={cn('size-5', isActive && 'text-signal-600')} />
                  {item.short}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-[0.75rem] font-semibold text-ink-500"
          >
            <Menu className="size-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function TeacherLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  // Routes can opt into a wider content area (e.g. the quiz editor) via handle: { wide: true }.
  // Those screens bring their own bottom action bar, so the tab bar steps aside.
  const wide = useMatches().some((match) => (match.handle as { wide?: boolean } | undefined)?.wide);
  const showTabBar = !wide;

  // Toasts and floating bars sit above the tab bar on phones.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => root.style.setProperty('--tabbar-h', showTabBar && !mq.matches ? TABBAR_HEIGHT : '0px');
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      root.style.removeProperty('--tabbar-h');
    };
  }, [showTabBar]);

  // Drawer: Escape closes it, Tab stays inside it, focus returns to the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const previously = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
      if (e.key === 'Tab' && drawerRef.current) {
        const items = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
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
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      previously?.focus?.();
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-paper-sunk px-3 py-5 lg:flex">
        <Link to="/teacher/dashboard" className="self-start rounded-sm px-3" aria-label={`${APP_NAME} dashboard`}>
          <Logo />
        </Link>
        <nav className="mt-8 flex-1 overflow-y-auto" aria-label="Teacher">
          <NavList layoutId="teacher-nav-desktop" />
        </nav>
        <div className="px-1">
          <AccountBlock />
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-paper lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/teacher/dashboard" aria-label={`${APP_NAME} dashboard`} className="rounded-sm">
            <Logo />
          </Link>
          {!showTabBar && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-11 place-items-center rounded-sm text-ink-700 hover:bg-paper-sunk"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu className="size-5" />
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <m.button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              className="absolute inset-0 bg-ink-950/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: dur.fast } }}
              onClick={() => setMenuOpen(false)}
            />
            <m.div
              ref={drawerRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={spring.sheet}
              className="pt-safe pb-safe absolute inset-y-0 right-0 flex w-[min(320px,86vw)] flex-col bg-paper-sunk px-3 py-4"
            >
              <div className="flex items-center justify-between px-3">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="grid size-11 place-items-center rounded-sm text-ink-700 hover:bg-surface"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="mt-6 flex-1 overflow-y-auto" aria-label="All pages">
                <NavList layoutId="teacher-nav-mobile" onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="px-1">
                <AccountBlock />
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      <main className={cn('min-w-0 px-4 pt-6 sm:px-6 lg:px-10 lg:py-10', showTabBar ? 'pb-24 lg:pb-10' : 'pb-6')}>
        <div className={cn('mx-auto', wide ? 'max-w-[1400px]' : 'max-w-[72rem]')}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      {showTabBar && <TabBar onMore={() => setMenuOpen(true)} moreOpen={menuOpen} />}
    </div>
  );
}
