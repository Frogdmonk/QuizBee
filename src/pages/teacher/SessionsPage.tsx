import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Lock, Radio, Search, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
import { HostQuizDialog } from '@/components/live/HostQuizDialog';
import { useMyQuizzes } from '@/hooks/useMyQuizzes';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { listMySessions } from '@/services/sessions';
import { listSharedWithMe } from '@/services/sharing';
import { formatPin } from '@/lib/session-rules';
import { relativeTime } from '@/utils/time';
import type { SessionStatus, SessionSummary } from '@/types/session';

type Hostable = { id: string; title: string; questionCount: number; subject: string; sharedBy: string | null };

const STATUS_LABEL: Record<SessionStatus, { label: string; tone: 'mint' | 'flame' | 'neutral' }> = {
  lobby: { label: 'Lobby open', tone: 'mint' },
  in_progress: { label: 'In progress', tone: 'flame' },
  ended: { label: 'Ended', tone: 'neutral' },
  cancelled: { label: 'Closed', tone: 'neutral' },
};

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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold">Live Sessions</h1>
        <p className="mt-2 text-ink-600">Open a lobby, put the PIN on the big screen, and let your class join.</p>
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

      {open.length > 0 && (
        <section aria-labelledby="open-heading" className="space-y-3">
          <h2 id="open-heading" className="text-lg font-extrabold">
            Open now
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {open.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/teacher/sessions/${s.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-mint-400/40 bg-surface p-4 shadow-card transition hover:shadow-lift"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-mint-50 text-mint-600">
                    <Radio className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.quizTitle}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
                      <span className="font-display font-extrabold tracking-wider text-ink-800 tabular">PIN {formatPin(s.pin)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" /> {s.participantCount}/{s.maxParticipants}
                      </span>
                      {s.isLocked && (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="size-3.5" /> Locked
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="host-heading" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="host-heading" className="text-lg font-extrabold">
              Host a quiz
            </h2>
            <p className="text-sm text-ink-500">Published quizzes you own, plus quizzes shared with you to edit.</p>
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Search quizzes</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or subject"
              className="h-11 w-full rounded-xl border border-ink-200 bg-surface pr-3 pl-9 text-[15px] outline-none placeholder:text-ink-400 focus:border-flame-400 focus:ring-4 focus:ring-flame-100"
            />
          </label>
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading quizzes">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : hostable.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-surface px-6 py-10 text-center">
            <p className="font-bold">{query ? `No published quizzes match “${query}”.` : 'No published quizzes yet'}</p>
            {!query && (
              <>
                <p className="mt-1 text-sm text-ink-500">Publish a quiz from My Quizzes to host it live.</p>
                <ButtonLink to="/teacher/quizzes" variant="secondary" className="mt-4">
                  Go to My Quizzes
                </ButtonLink>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-card">
            {hostable.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{q.title}</p>
                  <p className="truncate text-sm text-ink-500">
                    {q.questionCount} {q.questionCount === 1 ? 'question' : 'questions'}
                    {q.subject && ` · ${q.subject}`}
                    {q.sharedBy && ` · Shared by ${q.sharedBy}`}
                  </p>
                </div>
                <Button size="sm" leftIcon={<Radio className="size-4" />} onClick={() => setHosting(q)}>
                  Host
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="space-y-3">
          <h2 id="past-heading" className="text-lg font-extrabold">
            Recent sessions
          </h2>
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-surface">
            {past.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{s.quizTitle}</span>
                <span className="hidden text-ink-500 sm:inline">{relativeTime(s.createdAt)}</span>
                <Badge tone={STATUS_LABEL[s.status].tone}>{STATUS_LABEL[s.status].label}</Badge>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-500">Results and podiums for finished games arrive with Quiz History in Phase 5.</p>
        </section>
      )}

      <HostQuizDialog quiz={hosting} onClose={() => setHosting(null)} />
    </div>
  );
}
