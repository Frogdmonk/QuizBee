import { m } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { AnswerTile } from '@/components/ui/AnswerTile';
import { PinDigits } from '@/components/ui/PinDigits';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { dur } from '@/lib/motion';

const EXAMPLE_ANSWERS = ['Mercury', 'Venus', 'Earth', 'Mars'];

export default function LandingPage() {
  const { state } = useTeacherAuth();
  const signedIn = state.status === 'signed_in';

  return (
    <>
      {/* Phones: students are the most likely visitors, so the PIN entry comes first. */}
      <section aria-label="Join a game" className="ground-night night-grid bg-night-950 px-4 py-8 text-night-text sm:hidden">
        <p className="type-kicker">Got a PIN?</p>
        <PinDigits value="" size="phone" className="mt-4 w-full justify-between" />
        <ButtonLink to="/join" size="xl" variant="night" fullWidth className="mt-6" rightIcon={<ArrowRight className="size-5" />}>
          Join a game
        </ButtonLink>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
        <div className="grid gap-12 border-t-[3px] border-ink-950 pt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pt-12">
          <div className="min-w-0">
            <p className="type-kicker">Classroom quiz, live</p>
            <h1 className="type-display mt-4 text-display-xl text-ink-900">
              Turn any lesson
              <br />
              into an <span className="text-signal-600">arena.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[1.125rem] leading-relaxed text-ink-700">
              Build a quiz, put the PIN on the projector, and your class answers from their phones. No student accounts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={signedIn ? '/teacher/dashboard' : '/register'} size="lg" rightIcon={<ArrowRight className="size-5" />}>
                {signedIn ? 'Open dashboard' : 'Create a teacher account'}
              </ButtonLink>
              <ButtonLink to="/join" size="lg" variant="secondary" className="hidden sm:inline-flex">
                Join a game
              </ButtonLink>
            </div>
          </div>

          {/* An honest example of a question as students see it. */}
          <figure className="ground-night min-w-0 rounded-md bg-night-950 p-4 text-night-text sm:p-6" aria-label="Example question">
            <div className="flex items-center justify-between gap-3">
              <ScoreBug tab="bg-signal-400" className="py-1.5">
                <span className="type-kicker">Example</span>
                <span className="type-score text-score-sm">Q 1/1</span>
              </ScoreBug>
            </div>
            <p className="type-headline mt-5 text-headline">Which planet is closest to the sun?</p>
            <div className="mt-2 h-1 overflow-hidden bg-night-800">
              <m.span
                className="block h-full origin-left bg-signal-400"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0.35 }}
                transition={{ duration: 2.4, ease: 'linear', delay: dur.slow }}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {EXAMPLE_ANSWERS.map((label, i) => (
                <AnswerTile key={label} index={i} label={label} size="compact" />
              ))}
            </div>
          </figure>
        </div>
      </section>

      <section aria-labelledby="round-heading" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="border-t-[3px] border-ink-950 pt-3">
          <h2 id="round-heading" className="type-kicker">
            How a round works
          </h2>
        </div>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          <li className="min-w-0">
            <div aria-hidden className="h-40 rounded-md border border-line bg-surface p-4">
              {['Which planet is closest…', 'True or false: the Sun…', 'Pick the gas giant'].map((row, i) => (
                <div key={row} className="relative flex h-10 items-center border-b border-line pl-3 text-caption text-ink-700 last:border-b-0">
                  <span className={`absolute top-2 bottom-2 left-0 w-1 ${['bg-answer-a', 'bg-answer-b', 'bg-answer-c'][i]}`} />
                  {row}
                </div>
              ))}
            </div>
            <p className="type-score mt-4 text-score-sm text-ink-500">01</p>
            <h3 className="mt-1 text-title">Build</h3>
            <p className="mt-1 text-body-sm text-ink-700">Multiple choice, true or false and picture questions, with timers and points.</p>
          </li>
          <li className="min-w-0">
            <div aria-hidden className="ground-night flex h-40 flex-col justify-center rounded-md bg-night-950 px-5 text-night-text">
              <p className="type-kicker">Game PIN · example</p>
              <PinDigits value="482913" size="bar" className="mt-2" />
            </div>
            <p className="type-score mt-4 text-score-sm text-ink-500">02</p>
            <h3 className="mt-1 text-title">Project the PIN</h3>
            <p className="mt-1 text-body-sm text-ink-700">Students scan the QR code or type the PIN. Their avatars appear on the big screen.</p>
          </li>
          <li className="min-w-0">
            <div aria-hidden className="grid h-40 grid-cols-2 gap-2 rounded-md bg-paper-sunk p-4">
              {[0, 1, 2, 3].map((i) => (
                <AnswerTile key={i} index={i} label="" size="compact" className="min-h-0" />
              ))}
            </div>
            <p className="type-score mt-4 text-score-sm text-ink-500">03</p>
            <h3 className="mt-1 text-title">Answer on phones</h3>
            <p className="mt-1 text-body-sm text-ink-700">Everyone answers at the same time from their own phone. No app to install.</p>
          </li>
        </ol>
      </section>

      <section className="mt-20 bg-signal-600 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="type-display text-display-lg">Your first game is five minutes away.</h2>
          <ButtonLink to={signedIn ? '/teacher/quizzes/create' : '/register'} variant="dark" size="lg" rightIcon={<ArrowRight className="size-5" />}>
            {signedIn ? 'Build a quiz' : 'Create an account'}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
