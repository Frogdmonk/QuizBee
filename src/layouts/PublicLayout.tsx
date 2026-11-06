import { Link, Outlet } from 'react-router';
import { LayoutDashboard } from 'lucide-react';
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
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            {state.status === 'signed_in' ? (
              <ButtonLink to="/teacher/dashboard" variant="dark" size="sm" leftIcon={<LayoutDashboard className="size-4" />}>
                Dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm">
                  Teacher sign in
                </ButtonLink>
                <ButtonLink to="/register" variant="dark" size="sm" className="hidden sm:inline-flex">
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
      <footer className="border-t border-ink-100 pb-safe">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-500 sm:px-6">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Built for classrooms.
          </p>
          <div className="flex gap-4">
            <Link to="/join" className="hover:text-ink-800">
              Join a game
            </Link>
            <Link to="/login" className="hover:text-ink-800">
              Teachers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
