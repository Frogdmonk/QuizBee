import { Link, Outlet } from 'react-router';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { APP_NAME } from '@/lib/brand';

export function PublicLayout() {
  const { state } = useTeacherAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label={`${APP_NAME} home`} className="rounded-sm">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2">
            <Link
              to="/join"
              className="ground-night relative hidden min-h-10 items-center gap-2 overflow-hidden rounded-sm bg-night-950 py-2 pr-3 pl-4 text-label text-night-text transition-colors hover:bg-night-900 md:inline-flex"
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal-400" />
              Got a PIN? <span className="text-night-muted">Join a game</span>
              <ArrowRight className="size-4" />
            </Link>
            {state.status === 'signed_in' ? (
              <ButtonLink to="/teacher/dashboard" variant="dark" size="sm" leftIcon={<LayoutDashboard className="size-4" />}>
                Dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm">
                  <span className="sm:hidden">Sign in</span>
                  <span className="hidden sm:inline">Teacher sign in</span>
                </ButtonLink>
                <ButtonLink to="/register" variant="primary" size="sm" className="hidden sm:inline-flex">
                  Create account
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="pb-safe border-t-[3px] border-ink-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-body-sm sm:grid-cols-3 sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-ink-500">Live quizzes for classrooms. Students join from any phone with a PIN.</p>
        </div>
        <div className="sm:border-l sm:border-line sm:pl-6">
          <p className="type-kicker">Students</p>
          <Link to="/join" className="mt-2 inline-flex min-h-11 items-center font-semibold text-ink-900 hover:text-signal-600">
            Join a game
          </Link>
        </div>
        <div className="sm:border-l sm:border-line sm:pl-6">
          <p className="type-kicker">Teachers</p>
          <div className="mt-2 flex flex-col">
            <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-ink-900 hover:text-signal-600">
              Sign in
            </Link>
            <Link to="/register" className="inline-flex min-h-11 items-center font-semibold text-ink-900 hover:text-signal-600">
              Create an account
            </Link>
          </div>
        </div>
      </div>
      <p className="mx-auto max-w-6xl border-t border-line px-4 py-4 text-caption text-ink-500 sm:px-6">
        © {new Date().getFullYear()} {APP_NAME}. Built for classrooms.
      </p>
    </footer>
  );
}
