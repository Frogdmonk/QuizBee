import { Link, Outlet, useLocation } from 'react-router';
import { m } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { PinDigits } from '@/components/ui/PinDigits';
import { AnswerTile } from '@/components/ui/AnswerTile';
import { Avatar } from '@/components/avatar/Avatar';
import { AVATAR_PRESETS } from '@/lib/avatar';
import { APP_NAME } from '@/lib/brand';
import { enterUp } from '@/lib/motion';

/** Six real preset looks, shown as an example of what students build. */
const SAMPLE_AVATARS = [0, 4, 9, 13, 21, 27].map((i) => AVATAR_PRESETS[i].code);

/** Art on the night side of the split, chosen per route. Decorative. */
function AsideArt({ pathname }: { pathname: string }) {
  if (pathname.startsWith('/register')) {
    return (
      <div>
        <div className="flex items-end gap-2 border-b border-night-rule pb-3">
          {SAMPLE_AVATARS.map((code, i) => (
            <Avatar key={code} code={code} className={i % 2 ? 'size-16 rounded-full' : 'size-20 rounded-full'} />
          ))}
        </div>
        <p className="mt-4 text-body text-night-muted">Your students build characters like these when they join.</p>
      </div>
    );
  }
  if (pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) {
    return (
      <div className="max-w-sm">
        <AnswerTile index={3} label="Back in the game" size="stage" />
        <p className="mt-4 text-body text-night-muted">A new password takes a minute. Your quizzes are waiting.</p>
      </div>
    );
  }
  return (
    <div>
      <ScoreBug tab="bg-signal-400" className="py-3 pr-5">
        <span className="type-kicker">PIN · 6 digits</span>
        <PinDigits value="" size="bar" />
      </ScoreBug>
      <p className="mt-5 max-w-sm text-body text-night-muted">Teachers set the game. Students join with a PIN.</p>
    </div>
  );
}

/** Kit stripe: the four answer colours, used under the phone header. */
function KitStripe() {
  return (
    <span aria-hidden className="absolute inset-x-0 bottom-0 grid h-1 grid-cols-4">
      <span className="bg-answer-a" />
      <span className="bg-answer-b" />
      <span className="bg-answer-c" />
      <span className="bg-answer-d" />
    </span>
  );
}

export function AuthLayout() {
  const location = useLocation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="ground-night night-grid relative hidden flex-col bg-night-950 px-10 pt-10 pb-12 text-night-text lg:flex">
        <Link to="/" aria-label={`${APP_NAME} home`} className="self-start rounded-sm">
          <Logo tone="night" />
        </Link>
        <div aria-hidden className="mt-[18vh]">
          <AsideArt pathname={location.pathname} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="ground-night pt-safe relative bg-night-950 lg:hidden">
          <div className="flex h-[72px] items-center px-4 sm:px-8">
            <Link to="/" aria-label={`${APP_NAME} home`} className="rounded-sm">
              <Logo tone="night" />
            </Link>
          </div>
          <KitStripe />
        </div>
        <div className="flex flex-1 justify-center px-4 pt-6 pb-12 sm:px-8 lg:pt-[18vh]">
          <m.div key={location.pathname} variants={enterUp} initial="hidden" animate="show" className="w-full max-w-[26rem]">
            <Outlet />
          </m.div>
        </div>
      </div>
    </div>
  );
}
