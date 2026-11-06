import { Link, useLocation } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { OptionsGrid } from '@/components/marketing/OptionsGrid';
import { APP_NAME } from '@/lib/brand';

/** 404 as a question with four real options. Needs no teacher auth, so it renders anywhere. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link to="/" aria-label={`${APP_NAME} home`} className="rounded-sm">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <div className="grid gap-10 border-t-[3px] border-ink-950 pt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pt-14">
          <div>
            <p className="type-kicker">Error 404</p>
            <h1 className="type-display mt-3 text-display-xl">That page isn’t one of the options.</h1>
            <p className="mt-5 max-w-md text-body text-ink-700">Check the address, or pick an answer.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/">Home</ButtonLink>
              <ButtonLink to="/join" variant="secondary">
                Join a game
              </ButtonLink>
            </div>
          </div>
          <OptionsGrid
            links={[
              { to: '/teacher/dashboard', label: 'Dashboard' },
              { to: '/teacher/quizzes', label: 'My quizzes' },
              { to: '/join', label: 'Join a game' },
              { to: '/login', label: 'Sign in' },
            ]}
            missing={pathname}
          />
        </div>
      </main>
    </div>
  );
}
