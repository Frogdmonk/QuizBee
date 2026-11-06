import { Link } from 'react-router';
import { m } from 'motion/react';
import { ArrowRight, BookOpenText, CheckCircle2, CircleDashed, FilePen, MailWarning, Plus, Radio, Rocket } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useMyQuizzes } from '@/hooks/useMyQuizzes';
import { relativeTime } from '@/utils/time';
import { cn } from '@/lib/cn';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Development roadmap, mirroring docs/ARCHITECTURE.md §6. */
const ROADMAP = [
  { title: 'Foundation & authentication', done: true },
  { title: 'Quiz builder & library', done: true },
  { title: 'Quiz sharing between teachers', done: false },
  { title: 'Live sessions: PIN, QR & waiting room', done: false },
  { title: 'Game engine & scoring', done: false },
  { title: 'Leaderboards, reactions & podium', done: false },
];

export default function DashboardPage() {
  const { user, profile, profileStatus, reloadProfile } = useSignedInTeacher();
  const { quizzes, status, reload } = useMyQuizzes();
  const name = profile?.display_name ?? '';
  const emailConfirmed = Boolean(user.email_confirmed_at);

  const active = quizzes.filter((q) => q.status !== 'archived');
  const stats = [
    { label: 'Quizzes', value: active.length, icon: BookOpenText, tone: 'bg-ink-900 text-white' },
    { label: 'Published', value: quizzes.filter((q) => q.status === 'published').length, icon: Rocket, tone: 'bg-mint-50 text-mint-600' },
    { label: 'Drafts', value: quizzes.filter((q) => q.status === 'draft').length, icon: FilePen, tone: 'bg-sun-300/30 text-ink-800' },
  ];
  const recent = active.slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-500">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">
            {greeting()}
            {name ? `, ${name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <ButtonLink to="/teacher/quizzes/create" leftIcon={<Plus className="size-4" />}>
          New quiz
        </ButtonLink>
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

      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <m.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-surface p-5 shadow-card"
          >
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', s.tone)}>
              <s.icon className="size-5" />
            </span>
            <div>
              {status === 'loading' ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="font-display text-3xl font-extrabold tabular">{status === 'error' ? '–' : s.value}</p>
              )}
              <p className="text-sm text-ink-500">{s.label}</p>
            </div>
          </m.div>
        ))}
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-ink-200 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-400">
            <Radio className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-ink-600">Sessions hosted</p>
            <p className="text-sm text-ink-400">Live hosting arrives in phase 3</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Recent quizzes"
            action={
              <Link to="/teacher/quizzes" className="flex items-center gap-1 text-sm font-semibold text-flame-600 hover:text-flame-700">
                View all <ArrowRight className="size-4" />
              </Link>
            }
          />
          <CardBody className="p-2 sm:p-2">
            {status === 'loading' ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : status === 'error' ? (
              <div className="flex items-center justify-between gap-3 p-4 text-sm text-ink-600">
                Could not load your quizzes.
                <Button size="sm" variant="secondary" onClick={reload}>
                  Retry
                </Button>
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <p className="font-semibold">No quizzes yet</p>
                <p className="mt-1 text-sm text-ink-500">Your first quiz takes about five minutes.</p>
                <ButtonLink to="/teacher/quizzes/create" size="sm" className="mt-4" leftIcon={<Plus className="size-4" />}>
                  Create a quiz
                </ButtonLink>
              </div>
            ) : (
              <ul>
                {recent.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      to={`/teacher/quizzes/${quiz.id}/edit`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-ink-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{quiz.title}</p>
                        <p className="text-sm text-ink-500">
                          {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · {relativeTime(quiz.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge status={quiz.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your account" />
            <CardBody className="space-y-3 text-sm">
              {profileStatus === 'loading' ? (
                <Skeleton className="h-16" />
              ) : (
                <dl className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Name</dt>
                    <dd className="truncate font-semibold">{profile?.display_name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Email</dt>
                    <dd className="truncate font-semibold">{user.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">School</dt>
                    <dd className="truncate font-semibold">{profile?.school_name || '—'}</dd>
                  </div>
                </dl>
              )}
              {!emailConfirmed && (
                <p className="flex items-start gap-2 rounded-xl bg-sun-300/20 p-3 text-ink-700">
                  <MailWarning className="mt-0.5 size-4 shrink-0 text-sun-500" />
                  Your email address is not confirmed. Password reset emails need a confirmed address.
                </p>
              )}
              <Link to="/teacher/profile" className="inline-flex items-center gap-1 font-semibold text-flame-600 hover:text-flame-700">
                Edit profile <ArrowRight className="size-4" />
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Build progress" />
            <CardBody>
              <ol className="space-y-2">
                {ROADMAP.map((step) => (
                  <li key={step.title} className="flex items-center gap-3 text-sm">
                    {step.done ? (
                      <CheckCircle2 className="size-5 shrink-0 text-mint-500" />
                    ) : (
                      <CircleDashed className="size-5 shrink-0 text-ink-300" />
                    )}
                    <span className={step.done ? 'font-semibold' : 'text-ink-600'}>{step.title}</span>
                    {step.done && (
                      <Badge tone="mint" className="ml-auto">
                        Ready
                      </Badge>
                    )}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
