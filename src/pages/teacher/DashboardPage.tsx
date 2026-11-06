import { Link } from 'react-router';
import { m } from 'motion/react';
import { ArrowRight, CheckCircle2, CircleDashed, MailWarning, School } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Development roadmap — mirrors docs/ARCHITECTURE.md §6. Replaced by live stats in Phase 2. */
const ROADMAP = [
  { phase: 1, title: 'Foundation, design system & authentication', done: true },
  { phase: 2, title: 'Quiz builder, library & sharing', done: false },
  { phase: 3, title: 'Live sessions: PIN, QR, avatars & waiting room', done: false },
  { phase: 4, title: 'Game engine: questions, answers & scoring', done: false },
  { phase: 5, title: 'Leaderboards, reactions, podium & history', done: false },
  { phase: 6, title: 'Load testing, hardening & deployment', done: false },
];

export default function DashboardPage() {
  const { user, profile, profileStatus, reloadProfile } = useSignedInTeacher();
  const name = profile?.display_name ?? '';
  const emailConfirmed = Boolean(user.email_confirmed_at);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-ink-500">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">
          {greeting()}
          {name ? `, ${name.split(' ')[0]}` : ''}
        </h1>
      </header>

      {profileStatus === 'error' && (
        <Alert tone="error" title="Could not load your profile">
          <div className="flex flex-wrap items-center gap-3">
            <span>Check your connection, then try again.</span>
            <Button size="sm" variant="secondary" onClick={reloadProfile}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader title="Your account" description="Signed in with email and password." />
          <CardBody className="space-y-4">
            {profileStatus === 'loading' ? (
              <div className="flex items-center gap-2 text-ink-500">
                <Spinner className="size-4" /> Loading profile…
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-500">Name</dt>
                  <dd className="truncate font-semibold">{profile?.display_name ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-500">Email</dt>
                  <dd className="truncate font-semibold">{user.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-500">School</dt>
                  <dd className="truncate font-semibold">{profile?.school_name || '—'}</dd>
                </div>
              </dl>
            )}
            {!emailConfirmed && (
              <p className="flex items-start gap-2 rounded-xl bg-sun-300/20 p-3 text-sm text-ink-700">
                <MailWarning className="mt-0.5 size-4 shrink-0 text-sun-500" />
                Your email address is not confirmed. Password reset emails need a confirmed address.
              </p>
            )}
            {profile && !profile.school_name && (
              <Link
                to="/teacher/profile"
                className="flex items-center gap-2 rounded-xl border border-dashed border-ink-200 p-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
              >
                <School className="size-4 text-ink-400" />
                Add your school to your profile
                <ArrowRight className="ml-auto size-4" />
              </Link>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Build progress"
            description="Rally is being built in phases. Features unlock here as each phase ships."
          />
          <CardBody>
            <ol className="space-y-1">
              {ROADMAP.map((step, i) => (
                <m.li
                  key={step.phase}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2"
                >
                  {step.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-mint-500" />
                  ) : (
                    <CircleDashed className="size-5 shrink-0 text-ink-300" />
                  )}
                  <span className={step.done ? 'font-semibold text-ink-900' : 'text-ink-600'}>{step.title}</span>
                  <Badge tone={step.done ? 'mint' : 'neutral'} className="ml-auto">
                    {step.done ? 'Ready' : `Phase ${step.phase}`}
                  </Badge>
                </m.li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
