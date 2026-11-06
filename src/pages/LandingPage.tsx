import { m } from 'motion/react';
import { ArrowRight, MonitorPlay, Smartphone, Sparkles, Trophy } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { AnswerTilesArt } from '@/components/marketing/AnswerTilesArt';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';

const features = [
  {
    icon: Sparkles,
    title: 'Build in minutes',
    body: 'Multiple choice, true/false and picture questions with timers, points and a live preview.',
  },
  {
    icon: Smartphone,
    title: 'Join from any phone',
    body: 'Students scan a QR code or type a six-digit PIN. No accounts, no passwords, no app install.',
  },
  {
    icon: MonitorPlay,
    title: 'Made for the projector',
    body: 'Huge countdowns, answer distributions and an animated top-10 that reads from the back row.',
  },
  {
    icon: Trophy,
    title: 'Fair, server-side scoring',
    body: 'One shared deadline for everyone. Answers and points are checked on the server, never the browser.',
  },
];

export default function LandingPage() {
  const { state } = useTeacherAuth();
  const signedIn = state.status === 'signed_in';

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16 lg:pb-24">
        <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-surface px-3 py-1 text-sm font-semibold text-ink-700">
            <span className="size-2 rounded-full bg-mint-500" />
            Live classroom quizzes
          </p>
          <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-extrabold text-ink-900 sm:text-6xl">
            Turn any lesson into a <span className="text-flame-500">rally</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-600">
            Put questions on the big screen, let every student answer from their phone, and watch the leaderboard
            shuffle after every round.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/join" size="xl" rightIcon={<ArrowRight className="size-5" />}>
              Join a game
            </ButtonLink>
            <ButtonLink to={signedIn ? '/teacher/dashboard' : '/register'} size="xl" variant="secondary">
              {signedIn ? 'Open dashboard' : 'I’m a teacher'}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-500">Free for classrooms. Students never need an account.</p>
        </m.div>

        <div className="relative">
          <div className="rounded-[28px] bg-night-900 p-5 shadow-lift sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-ink-200">Question 3 of 10</span>
              <m.span
                className="grid size-12 place-items-center rounded-full bg-sun-400 font-display text-lg font-extrabold text-ink-900"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 18 }}
              >
                20
              </m.span>
            </div>
            <div className="mb-5 space-y-2" aria-hidden>
              <div className="h-4 w-4/5 rounded-full bg-white/80" />
              <div className="h-4 w-1/2 rounded-full bg-white/40" />
            </div>
            <AnswerTilesArt />
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {features.map((f, i) => (
            <m.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-ink-900 text-white">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
              <p className="mt-1.5 text-ink-600">{f.body}</p>
            </m.div>
          ))}
        </div>
      </section>
    </>
  );
}
