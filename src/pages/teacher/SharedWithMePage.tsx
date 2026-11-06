import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Copy, Eye, Pencil, Search, Share2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { SegmentedControl, Skeleton } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { AccessBadge } from '@/components/sharing/AccessBadge';
import { listSharedWithMe, copySharedQuiz } from '@/services/sharing';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { relativeTime } from '@/utils/time';
import { mediaUrl } from '@/lib/media-url';
import type { QuizAccess, SharedQuiz } from '@/types/workspace';

type Filter = 'all' | QuizAccess;

export default function SharedWithMePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<SharedQuiz[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copying, setCopying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSharedWithMe()
      .then((list) => {
        if (cancelled) return;
        setQuizzes(list);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return quizzes.filter(
      (q) =>
        (filter === 'all' || q.access === filter) &&
        (!needle ||
          q.title.toLowerCase().includes(needle) ||
          q.subject.toLowerCase().includes(needle) ||
          q.ownerName.toLowerCase().includes(needle)),
    );
  }, [quizzes, filter, query]);

  const copy = async (quiz: SharedQuiz) => {
    setCopying(quiz.id);
    try {
      const id = await copySharedQuiz(quiz.id);
      toast({ tone: 'success', title: 'Added to My Quizzes', description: 'Your copy is a draft you can change freely.' });
      navigate(`/teacher/quizzes/${id}/edit`);
    } catch (error) {
      toast({ tone: 'error', title: 'Could not copy', description: friendlyError(error) });
      setCopying(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Shared with Me</h1>
        <p className="mt-2 text-ink-600">Quizzes colleagues share with you through your workspaces.</p>
      </header>

      {status === 'ready' && quizzes.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="md:w-[420px]">
            <SegmentedControl
              label="Filter by access"
              layoutId="shared-filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'view', label: 'View' },
                { value: 'copy', label: 'Copy' },
                { value: 'edit', label: 'Edit' },
              ]}
            />
          </div>
          <label className="relative block md:w-72">
            <span className="sr-only">Search shared quizzes</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, subject or teacher"
              className="h-11 w-full rounded-xl border border-ink-200 bg-surface pr-3 pl-9 text-[15px] outline-none placeholder:text-ink-400 focus:border-flame-400 focus:ring-4 focus:ring-flame-100"
            />
          </label>
        </div>
      )}

      {status === 'error' && (
        <Alert tone="error" title="Could not load shared quizzes">
          <div className="flex flex-wrap items-center gap-3">
            <span>Check your connection and try again.</span>
            <Button size="sm" variant="secondary" onClick={() => setNonce((n) => n + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {status === 'loading' ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading shared quizzes">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : status === 'ready' && quizzes.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-surface px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-flame-50 text-flame-600">
            <Share2 className="size-7" />
          </span>
          <h2 className="mt-5 text-xl font-extrabold">Nothing shared with you yet</h2>
          <p className="mt-2 max-w-sm text-ink-600">
            When a colleague shares a quiz with a workspace you belong to, it shows up here.
          </p>
          <ButtonLink to="/teacher/workspaces" variant="secondary" className="mt-6">
            Go to Workspaces
          </ButtonLink>
        </div>
      ) : status === 'ready' && visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 px-6 py-12 text-center text-ink-500">
          No shared quizzes match.
        </p>
      ) : (
        status === 'ready' && (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((quiz) => (
              <li key={quiz.id}>
                <SharedQuizCard quiz={quiz} copying={copying === quiz.id} onCopy={() => void copy(quiz)} />
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function SharedQuizCard({ quiz, copying, onCopy }: { quiz: SharedQuiz; copying: boolean; onCopy: () => void }) {
  const cover = mediaUrl(quiz.coverImagePath);
  const canEdit = quiz.access === 'edit';
  const openPath = canEdit ? `/teacher/quizzes/${quiz.id}/edit` : `/teacher/quizzes/${quiz.id}/preview`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-ink-900">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span aria-hidden className="absolute bottom-3 left-4 font-display text-5xl font-extrabold text-white/90">
            {(quiz.title.trim()[0] ?? '?').toUpperCase()}
          </span>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <StatusBadge status={quiz.status} />
          <AccessBadge access={quiz.access} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {quiz.subject && <p className="truncate text-xs font-semibold tracking-wide text-ink-400 uppercase">{quiz.subject}</p>}
        <h3 className="line-clamp-2 text-[17px] leading-snug font-bold">
          <Link to={openPath} className="hover:underline">
            {quiz.title}
          </Link>
        </h3>
        <p className="text-sm text-ink-500">
          By {quiz.ownerName} · {quiz.workspaces.join(', ')}
        </p>
        <p className="mt-auto pt-2 text-sm text-ink-500">
          {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · Updated {relativeTime(quiz.updatedAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-ink-100 p-3">
        <ButtonLink to={`/teacher/quizzes/${quiz.id}/preview`} size="sm" variant="ghost" leftIcon={<Eye className="size-4" />}>
          Preview
        </ButtonLink>
        {canEdit && (
          <ButtonLink to={`/teacher/quizzes/${quiz.id}/edit`} size="sm" variant="secondary" leftIcon={<Pencil className="size-4" />}>
            Edit
          </ButtonLink>
        )}
        {quiz.access !== 'view' && (
          <Button size="sm" variant={canEdit ? 'ghost' : 'secondary'} leftIcon={<Copy className="size-4" />} loading={copying} onClick={onCopy}>
            Copy to My Quizzes
          </Button>
        )}
      </div>
    </article>
  );
}
