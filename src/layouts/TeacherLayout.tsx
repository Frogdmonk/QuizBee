import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { PageTransition } from '@/components/ui/PageTransition';
import { TEACHER_NAV } from '@/components/teacher/nav-items';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { cn } from '@/lib/cn';
import { APP_NAME } from '@/lib/brand';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function NavList({ onNavigate, layoutId }: { onNavigate?: () => void; layoutId: string }) {
  return (
    <ul className="space-y-1">
      {TEACHER_NAV.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'relative flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                isActive ? 'text-ink-900' : 'text-ink-500 hover:bg-ink-100/70 hover:text-ink-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <m.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-xl border border-ink-100 bg-surface shadow-card"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <item.icon className={cn('relative size-[18px]', isActive && 'text-flame-500')} />
                <span className="relative flex-1">{item.label}</span>
                {item.availableInPhase && (
                  <Badge className="relative" tone="neutral">
                    Soon
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
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
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <Link
        to="/teacher/profile"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white"
        aria-label="Your profile"
      >
        {initialsOf(name)}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
        <p className="truncate text-xs text-ink-500">{user.email}</p>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-[18px]" />
      </button>
    </div>
  );
}

export function TeacherLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink-100 px-4 py-5 lg:flex">
        <Link to="/teacher/dashboard" className="px-2" aria-label={`${APP_NAME} dashboard`}>
          <Logo />
        </Link>
        <nav className="mt-8 flex-1" aria-label="Teacher">
          <NavList layoutId="teacher-nav-desktop" />
        </nav>
        <AccountBlock />
      </aside>

      {/* Mobile top bar */}
      <header className="pt-safe sticky top-0 z-30 border-b border-ink-100 bg-paper/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/teacher/dashboard" aria-label={`${APP_NAME} dashboard`}>
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-10 place-items-center rounded-xl text-ink-700 hover:bg-ink-100"
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <m.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-ink-950/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <m.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="pt-safe pb-safe absolute inset-y-0 right-0 flex w-[min(320px,86vw)] flex-col bg-paper px-4 py-4"
            >
              <div className="flex items-center justify-between px-2">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="grid size-10 place-items-center rounded-xl text-ink-700 hover:bg-ink-100"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="mt-6 flex-1" aria-label="Teacher">
                <NavList layoutId="teacher-nav-mobile" onNavigate={() => setMenuOpen(false)} />
              </nav>
              <AccountBlock />
            </m.div>
          </div>
        )}
      </AnimatePresence>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
