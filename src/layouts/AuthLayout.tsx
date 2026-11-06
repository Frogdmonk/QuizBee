import { Link, Outlet, useLocation } from 'react-router';
import { m } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { APP_NAME } from '@/lib/brand';
import { AnswerTilesArt } from '@/components/marketing/AnswerTilesArt';

export function AuthLayout() {
  const location = useLocation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-night-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" aria-label={`${APP_NAME} home`}>
          <Logo inverted />
        </Link>
        <div className="mx-auto w-full max-w-md">
          <AnswerTilesArt />
        </div>
        <div className="max-w-md">
          <p className="font-display text-3xl leading-tight font-bold">
            Questions on the big screen. Answers in every hand.
          </p>
          <p className="mt-3 text-ink-300">
            Build a quiz in minutes, share a PIN, and watch the whole class race up the leaderboard.
          </p>
        </div>
      </aside>

      <div className="flex flex-col px-4 py-6 sm:px-8">
        <div className="lg:hidden">
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <m.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}
            className="w-full max-w-[420px]"
          >
            <Outlet />
          </m.div>
        </div>
      </div>
    </div>
  );
}
