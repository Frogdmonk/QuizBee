import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Eye, MoreVertical, Pencil, Plus, Radio } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/FormControls';
import { SectionHead } from '@/components/ui/SectionHead';
import { Ledger, LedgerLink, LedgerRow } from '@/components/ui/Ledger';
import { StatStrip } from '@/components/ui/StatStrip';
import { Banner } from '@/components/ui/Banner';
import { Badge } from '@/components/ui/Badge';
import { PinDigits } from '@/components/ui/PinDigits';
import { CountRoll } from '@/components/ui/CountRoll';
import { StepStrip } from '@/components/ui/StepStrip';
import { Menu } from '@/components/ui/Menu';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { HostQuizDialog } from '@/components/live/HostQuizDialog';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useMyQuizzes } from '@/hooks/useMyQuizzes';
import { listMySessions } from '@/services/sessions';
import { relativeTime } from '@/utils/time';
import type { SessionSummary } from '@/types/session';
import type { QuizSummary } from '@/types/quiz';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, profileStatus, reloadProfile } = useSignedInTeacher();
  const { quizzes, status, reload } = useMyQuizzes();
  const [openSession, setOpenSession] = useState<SessionSummary | null>(null);
  const [hosting, setHosting] = useState<QuizSummary | null>(null);
  const name = profile?.display_name ?? '';
  const emailConfirmed = Boolean(user.email_confirmed_at);

  // The Host band shows a real open lobby when there is one (same data as Live sessions).
  useEffect(() => {
    let cancelled = false;
    listMySessions(user.id)
      .then((list) => {
        if (!cancelled) setOpenSession(list.find((s) => s.status === 'lobby' || s.status === 'in_progress') ?? null);
      })
      .catch(() => {
        // The band falls back to "Host a game"; nothing to report.
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const active = quizzes.filter((q) => q.status !== 'archived');
  const published = quizzes.filter((q) => q.status === 'published').length;
  const drafts = quizzes.filter((q) => q.status === 'draft').length;
  const recent = active.slice(0, 5);
  const brandNew = status === 'ready' && quizzes.length === 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="type-kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="type-display mt-2 text-display-lg">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <ButtonLink to="/teacher/quizzes/create" variant="secondary" leftIcon={<Plus className="size-4" />}>
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

      {/* Host band: always present */}
      <Banner className="-mx-4 rounded-none sm:mx-0 sm:rounded-md" aria-label="Live">
        {openSession ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="min-w-0 flex-1 basis-56">
              <Badge tone="signal" surface="night" dot>
                Lobby open
              </Badge>
              <p className="mt-2 truncate text-title">{openSession.quizTitle}</p>
              <p className="mt-1 text-body-sm text-night-muted">
                <span className="type-score text-score-sm text-night-text">
                  <CountRoll value={openSession.participantCount} />
                </span>{' '}
                waiting
              </p>
            </div>
            <PinDigits value={openSession.pin} size="bar" label={`PIN ${openSession.pin}`} className="text-night-text" />
            <ButtonLink to={`/teacher/sessions/${openSession.id}`}>Back to lobby</ButtonLink>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="type-kicker">Live</p>
              <p className="type-headline mt-1 text-headline">Ready to run a quiz?</p>
              <p className="mt-1 text-body-sm text-night-muted">Open a lobby and put the PIN on the big screen.</p>
            </div>
            <ButtonLink to="/teacher/sessions" leftIcon={<Radio className="size-4" />}>
              Host a game
            </ButtonLink>
          </div>
        )}
      </Banner>

      {status === 'loading' ? (
        <Skeleton className="h-[88px]" />
      ) : status === 'error' ? null : (
        <StatStrip
          items={[
            { label: 'Quizzes', value: active.length, to: '/teacher/quizzes' },
            { label: 'Published', value: published, to: '/teacher/quizzes' },
            { label: 'Drafts', value: drafts, to: '/teacher/quizzes' },
          ]}
        />
      )}

      {brandNew ? (
        <section aria-labelledby="start-heading" className="space-y-6">
          <SectionHead id="start-heading" kicker="Getting started" title="Your first game in three steps" />
          <StepStrip
            steps={[
              { title: 'Build', body: 'Write a few questions. Multiple choice, true or false, or pictures.' },
              { title: 'Host', body: 'Publish the quiz and open a lobby from Live sessions.' },
              { title: 'Join', body: 'Students scan the QR code or type the PIN on their phones.' },
            ]}
          />
          <ButtonLink to="/teacher/quizzes/create" leftIcon={<Plus className="size-4" />}>
            Create your first quiz
          </ButtonLink>
        </section>
      ) : (
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <section aria-labelledby="recent-heading" className="min-w-0">
            <SectionHead
              id="recent-heading"
              kicker="Recent quizzes"
              action={
                <Link to="/teacher/quizzes" className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-signal-600 hover:text-signal-700">
                  View all <ArrowRight className="size-4" />
                </Link>
              }
            />
            {status === 'loading' ? (
              <div className="mt-2 space-y-2" aria-busy="true" aria-label="Loading quizzes">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : status === 'error' ? (
              <div className="flex items-center justify-between gap-3 py-6 text-body-sm text-ink-700">
                Could not load your quizzes.
                <Button size="sm" variant="secondary" onClick={reload}>
                  Retry
                </Button>
              </div>
            ) : (
              <Ledger>
                {recent.map((quiz) => (
                  <LedgerRow
                    key={quiz.id}
                    tab={quiz.status === 'published' ? 'published' : 'draft'}
                    className="min-h-16"
                    actions={
                      <>
                        {quiz.status === 'published' && (
                          <Button size="sm" variant="secondary" className="hidden sm:inline-flex" leftIcon={<Radio className="size-4" />} onClick={() => setHosting(quiz)}>
                            Host
                          </Button>
                        )}
                        <Menu
                          label={`Actions for ${quiz.title}`}
                          trigger={<MoreVertical className="size-5" />}
                          items={[
                            { label: 'Edit', icon: <Pencil />, onSelect: () => navigate(`/teacher/quizzes/${quiz.id}/edit`) },
                            { label: 'Preview', icon: <Eye />, onSelect: () => navigate(`/teacher/quizzes/${quiz.id}/preview`) },
                            ...(quiz.status === 'published' ? [{ label: 'Host live', icon: <Radio />, onSelect: () => setHosting(quiz) }] : []),
                          ]}
                        />
                      </>
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <LedgerLink to={`/teacher/quizzes/${quiz.id}/edit`}>{quiz.title}</LedgerLink>
                        <p className="mt-0.5 truncate text-caption text-ink-500">
                          {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · edited {relativeTime(quiz.updatedAt)}
                        </p>
                      </div>
                      <span className="hidden sm:block">
                        <StatusBadge status={quiz.status} />
                      </span>
                    </div>
                  </LedgerRow>
                ))}
              </Ledger>
            )}
          </section>

          <aside aria-labelledby="account-heading" className="min-w-0 space-y-4">
            <SectionHead id="account-heading" kicker="Account" />
            {!emailConfirmed && (
              <Alert tone="warning" title="Email not confirmed">
                Password reset emails need a confirmed address.
              </Alert>
            )}
            <ul className="divide-y divide-line">
              {[
                { to: '/teacher/profile', label: 'Profile and password' },
                { to: '/teacher/workspaces', label: 'Workspaces' },
                { to: '/teacher/shared', label: 'Shared with me' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="flex min-h-12 items-center justify-between text-body-sm font-semibold text-ink-900 hover:text-signal-600">
                    {link.label}
                    <ArrowRight className="size-4 text-ink-500" />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      <HostQuizDialog quiz={hosting} onClose={() => setHosting(null)} />
    </div>
  );
}
