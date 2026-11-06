import { m } from 'motion/react';
import { Link } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { AnswerTilesArt } from '@/components/marketing/AnswerTilesArt';

/**
 * Placeholder for /join, /game/:id and /presenter/:id until Phase 3 replaces
 * these routes with the real student and projector experiences.
 */
export default function LiveComingSoonPage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-night-900 px-5 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col py-6">
        <Link to="/" aria-label="Home">
          <Logo inverted />
        </Link>
        <div className="flex flex-1 flex-col justify-center py-10">
          <AnswerTilesArt className="opacity-90" />
          <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h1 className="mt-10 text-3xl font-extrabold">Live games are almost here</h1>
            <p className="mt-3 text-ink-300">
              Joining with a PIN or QR code, avatars and the live game screens arrive in development phase 3. This
              page will become the student join screen.
            </p>
            <ButtonLink to="/" variant="secondary" size="lg" className="mt-8" fullWidth>
              Back to home
            </ButtonLink>
          </m.div>
        </div>
      </div>
    </main>
  );
}
