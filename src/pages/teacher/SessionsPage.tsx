import { useEffect, useMemo, useState } from 'react';
import { Radio, Search } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
import { SectionHead } from '@/components/ui/SectionHead';
import { Ledger, LedgerRow } from '@/components/ui/Ledger';
import { ANSWER_TABS } from '@/components/ui/ledger-tabs';
import { Banner } from '@/components/ui/Banner';
import { PinDigits } from '@/components/ui/PinDigits';
import { CountRoll } from '@/components/ui/CountRoll';
import { Placeholder } from '@/components/ui/Placeholder';
import { inputClasses } from '@/components/ui/field-styles';
import { HostQuizDialog } from '@/components/live/HostQuizDialog';
import { useMyQuizzes } from '@/hooks/useMyQuizzes';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { listMySessions } from '@/services/sessions';
import { listSharedWithMe } from '@/services/sharing';
import { hashIndex } from '@/lib/hash';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/utils/time';
import type { SessionSummary } from '@/types/session';

type Hostable = { id: string; title: string; questionCount: number; subject: string; sharedBy: string | null };

export default function SessionsPage() {
  const { user } = useSignedInTeacher();
  const { quizzes, status: quizStatus } = useMyQuizzes();
  const [shared, setShared] = useState<Hostable[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');
  const [hosting, setHosting] = useState<Hostable | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMySessions(user.id), listSharedWithMe()])
      .then(([list, sharedQuizzes]) => {
        if (cancelled) return;
        setSessions(list);
        setShared(
          sharedQuizzes
            .filter((q) => q.access === 'edit' && q.status === 'published')
            .map((q) => ({ id: q.id, title: q.title, questionCount: q.questionCount, subject: q.subject, sharedBy: q.ownerName })),
        );
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [user.id, nonce]);

  const hostable = useMemo(() => {
    const own: Hostable[] = quizzes
      .filter((q) => q.status === 'published')
      .map((q) => ({ id: q.id, title: q.title, questionCount: q.questionCount, subject: q.subject, sharedBy: null }));
    const needle = query.trim().toLowerCase();
    return [...own, ...shared].filter(
      (q) => !needle || q.title.toLowerCase().includes(needle) || q.subject.toLowerCase().includes(needle),
    );
  }, [quizzes, shared, query]);

  const open = sessions.filter((s) => s.status === 'lobby' || s.status === 'in_progress');
  const past = sessions.filter((s) => s.status === 'ended' || s.status === 'cancelled');
  const loading = status === 'loading' || quizStatus === 'loading';

  const recent = (
    <Ledger>
      {past.map((s) => (
        <LedgerRow key={s.id} tab="neutral" interactive={false} className="min-h-12">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink-900">{s.quizTitle}</span>
            <span className="shrink-0 text-caption text-ink-500">{relativeTime(s.createdAt)}</span>
            <Badge>{s.status === 'ended' ? 'Ended' : 'Closed'}</Badge>
          </div>
        </LedgerRow>
      ))}
    </Ledger>
  );

  return (
    <div className="space-y-10">
      <header>
        <p className="type-kicker">Live</p>
        <h1 className="type-display mt-1 text-display-lg">Live sessions</h1>
        <p className="mt-2 text-body text-ink-700">Open a lobby, put the PIN on the big screen, and let your class join.</p>
      </header>

      {(status === 'error' || quizStatus === 'error') && (
        <Alert tone="error" title="Could not load your sessions">
          <div className="flex flex-wrap items-center gap-3">
            <span>Check your connection and try again.</span>
            <Button size="sm" variant="secondary" onClick={() => setNonce((n) => n + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {open.map((s) => (
        <Banner key={s.id} aria-label={`Open lobby: ${s.quizTitle}`}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="min-w-0 flex-1 basis-60">
              <Badge tone="signal" surface="night" dot>
                {s.status === 'lobby' ? 'Lobby open' : 'In progress'}
              </Badge>
              <p className="mt-2 truncate text-title text-night-text">{s.quizTitle}</p>
              <p className="mt-1 text-body-sm text-night-muted">
                <span className="type-score text-score-sm text-night-text">
                  <CountRoll value={s.participantCount} />
                </span>{' '}
                waiting · up to {s.maxParticipants}
                {s.isLocked && ' · locked'}
              </p>
            </div>
            <PinDigits value={s.pin} size="bar" label={`PIN ${s.pin}`} className="text-night-text" />
            <ButtonLink to={`/teacher/sessions/${s.id}`} variant="primary">
              Back to lobby
            </ButtonLink>
          </div>
        </Banner>
      ))}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <section aria-labelledby="host-heading" className="min-w-0">
          <SectionHead
            id="host-heading"
            kicker="Ready to host"
            action={<span className="text-caption text-ink-500">Published quizzes you own or can edit</span>}
          />
          <label className="relative mt-4 block sm:max-w-sm">
            <span className="sr-only">Search quizzes</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or subject"
              className={cn(inputClasses, 'h-11 pl-9')}
            />
          </label>

          {loading ? (
            <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading quizzes">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          ) : hostable.length === 0 ? (
            <div className="mt-6 border-t border-line py-10">
              <p className="text-title">{query ? `No published quizzes match “${query}”.` : 'No published quizzes yet'}</p>
              {query ? (
                <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <>
                  <p className="mt-1 text-body-sm text-ink-500">Publish a quiz from My Quizzes to host it live.</p>
                  <ButtonLink to="/teacher/quizzes" variant="secondary" className="mt-4">
                    Go to My Quizzes
                  </ButtonLink>
                </>
              )}
            </div>
          ) : (
            <Ledger className="mt-4">
              {hostable.map((q) => (
                <LedgerRow
                  key={q.id}
                  tab={ANSWER_TABS[hashIndex(q.id, ANSWER_TABS.length)]}
                  className="min-h-[72px]"
                  actions={
                    <Button size="sm" variant="secondary" leftIcon={<Radio className="size-4" />} onClick={() => setHosting(q)} aria-label={`Host ${q.title}`}>
                      Host
                    </Button>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setHosting(q)}
                    className="block w-full min-w-0 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                  >
                    {q.subject && <span className="type-kicker block truncate">{q.subject}</span>}
                    <span className="block truncate text-title text-ink-900">{q.title}</span>
                    <span className="mt-0.5 block truncate text-caption text-ink-500">
                      {q.questionCount} {q.questionCount === 1 ? 'question' : 'questions'}
                      {q.sharedBy && ` · Shared by ${q.sharedBy}`}
                    </span>
                  </button>
                </LedgerRow>
              ))}
            </Ledger>
          )}
        </section>

        <aside className="min-w-0 space-y-6">
          <section aria-labelledby="recent-heading">
            <SectionHead id="recent-heading" kicker="Recent" />
            {past.length === 0 ? (
              <p className="mt-4 text-body-sm text-ink-500">Sessions you close appear here.</p>
            ) : (
              <>
                <div className="mt-2 hidden lg:block">{recent}</div>
                <details className="mt-2 lg:hidden">
                  <summary className="flex min-h-11 cursor-pointer items-center text-label text-ink-900">
                    Show {past.length} recent {past.length === 1 ? 'session' : 'sessions'}
                  </summary>
                  {recent}
                </details>
              </>
            )}
          </section>
          <Placeholder>Results and podiums for finished games arrive with Quiz history.</Placeholder>
        </aside>
      </div>

      <HostQuizDialog quiz={hosting} onClose={() => setHosting(null)} />
    </div>
  );
}
