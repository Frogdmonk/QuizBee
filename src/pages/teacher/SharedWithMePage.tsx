import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Eye, FolderOpen, MoreVertical, Pencil, Search } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { Ledger, LedgerLink, LedgerRow } from '@/components/ui/Ledger';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { StepStrip } from '@/components/ui/StepStrip';
import { inputClasses } from '@/components/ui/field-styles';
import { QuizCover } from '@/components/quiz/QuizCover';
import { cn } from '@/lib/cn';
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

  const counts = {
    all: quizzes.length,
    view: quizzes.filter((q) => q.access === 'view').length,
    copy: quizzes.filter((q) => q.access === 'copy').length,
    edit: quizzes.filter((q) => q.access === 'edit').length,
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="type-kicker">From colleagues</p>
        <h1 className="type-display mt-1 text-display-lg">Shared with me</h1>
        <p className="mt-2 text-body text-ink-700">Quizzes colleagues share with you through your workspaces.</p>
      </header>

      {status === 'ready' && quizzes.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <UnderlineTabs
            label="Filter by access"
            layoutId="shared-filter"
            value={filter}
            onChange={setFilter}
            className="min-w-0 flex-1"
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'view', label: 'View', count: counts.view },
              { value: 'copy', label: 'Copy', count: counts.copy },
              { value: 'edit', label: 'Edit', count: counts.edit },
            ]}
          />
          <label className="relative block lg:w-72">
            <span className="sr-only">Search shared quizzes</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, subject or teacher"
              className={cn(inputClasses, 'h-11 pl-9')}
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
        <div className="space-y-2" aria-busy="true" aria-label="Loading shared quizzes">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : status === 'ready' && quizzes.length === 0 ? (
        <section className="space-y-6 border-t-[3px] border-ink-950 pt-6">
          <div>
            <h2 className="type-headline text-headline">Nothing shared with you yet</h2>
            <p className="mt-2 max-w-md text-body text-ink-700">
              When a colleague shares a quiz with a workspace you belong to, it shows up here.
            </p>
          </div>
          <StepStrip
            steps={[
              { title: 'Join a workspace', body: 'Open an invite link from a colleague, or create your own workspace.' },
              { title: 'Colleagues share', body: 'They choose who can view, copy or edit each quiz.' },
              { title: 'Use it here', body: 'Preview, copy to your library, or edit together.' },
            ]}
          />
          <ButtonLink to="/teacher/workspaces" variant="secondary">
            Go to Workspaces
          </ButtonLink>
        </section>
      ) : status === 'ready' && visible.length === 0 ? (
        <div className="border-t border-line py-10">
          <p className="text-title">No shared quizzes match.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-3"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        status === 'ready' && (
          <div className="space-y-8">
            {/* Quizzes shared through a subject, grouped under it; then quizzes shared one by one. */}
            {groupBySubject(visible).map((group) => (
              <section key={group.key} aria-label={group.subject ? `Subject ${group.subject.name}` : 'Shared quizzes'}>
                {group.subject ? (
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <FolderOpen className="size-4 self-center text-ink-500" aria-hidden />
                    <h2 className="text-title">{group.subject.name}</h2>
                    <span className="text-caption text-ink-500">
                      subject from {group.owner} · {group.quizzes.length} {group.quizzes.length === 1 ? 'quiz' : 'quizzes'}
                    </span>
                  </div>
                ) : (
                  groupBySubject(visible).length > 1 && <h2 className="mb-2 text-title">Shared one by one</h2>
                )}
                <Ledger className="border-t border-line">
                  {group.quizzes.map((quiz) => (
                    <SharedQuizRow key={quiz.id} quiz={quiz} copying={copying === quiz.id} onCopy={() => void copy(quiz)} />
                  ))}
                </Ledger>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}

type SharedGroup = { key: string; subject: { id: string; name: string } | null; owner: string; quizzes: SharedQuiz[] };

/** Shared subjects first (by name), each with its quizzes; then quizzes shared on their own. */
function groupBySubject(quizzes: readonly SharedQuiz[]): SharedGroup[] {
  const groups = new Map<string, SharedGroup>();
  const loose: SharedQuiz[] = [];
  for (const q of quizzes) {
    if (!q.sharedSubject) {
      loose.push(q);
      continue;
    }
    const g = groups.get(q.sharedSubject.id) ?? { key: q.sharedSubject.id, subject: q.sharedSubject, owner: q.ownerName, quizzes: [] };
    g.quizzes.push(q);
    groups.set(q.sharedSubject.id, g);
  }
  const sorted = [...groups.values()].sort((a, b) => a.subject!.name.localeCompare(b.subject!.name));
  return loose.length ? [...sorted, { key: 'loose', subject: null, owner: '', quizzes: loose }] : sorted;
}

function SharedQuizRow({ quiz, copying, onCopy }: { quiz: SharedQuiz; copying: boolean; onCopy: () => void }) {
  const navigate = useNavigate();
  const canEdit = quiz.access === 'edit';
  const openPath = canEdit ? `/teacher/quizzes/${quiz.id}/edit` : `/teacher/quizzes/${quiz.id}/preview`;

  const primary =
    quiz.access === 'edit' ? (
      <ButtonLink to={`/teacher/quizzes/${quiz.id}/edit`} size="sm" variant="secondary" leftIcon={<Pencil className="size-4" />}>
        Edit
      </ButtonLink>
    ) : quiz.access === 'copy' ? (
      <Button size="sm" variant="secondary" leftIcon={<Copy className="size-4" />} loading={copying} onClick={onCopy} aria-label={`Copy ${quiz.title} to My Quizzes`}>
        Copy
      </Button>
    ) : (
      <ButtonLink to={`/teacher/quizzes/${quiz.id}/preview`} size="sm" variant="secondary" leftIcon={<Eye className="size-4" />}>
        Preview
      </ButtonLink>
    );

  const more: MenuItem[] = [
    ...(quiz.access !== 'view' ? [{ label: 'Preview', icon: <Eye />, onSelect: () => navigate(`/teacher/quizzes/${quiz.id}/preview`) }] : []),
    ...(quiz.access === 'edit' ? [{ label: 'Copy to My Quizzes', icon: <Copy />, onSelect: onCopy }] : []),
  ];

  return (
    <LedgerRow
      className="min-h-[76px] pl-3"
      actions={
        <>
          {primary}
          {more.length > 0 && <Menu label={`More actions for ${quiz.title}`} trigger={<MoreVertical className="size-5" />} items={more} />}
        </>
      }
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <QuizCover coverUrl={mediaUrl(quiz.coverImagePath)} seed={quiz.id} title={quiz.title} size="thumb" />
        <div className="min-w-0 flex-1">
          <LedgerLink to={openPath}>{quiz.title}</LedgerLink>
          <p className="mt-0.5 text-caption text-ink-500">
            {quiz.subject && <span>{quiz.subject} · </span>}
            {quiz.ownerName}
            {quiz.workspaces.length > 0 && <span> · via {quiz.workspaces.join(', ')}</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <AccessBadge access={quiz.access} />
            <span className="hidden sm:inline-flex">
              <StatusBadge status={quiz.status} />
            </span>
            <span className="hidden text-caption text-ink-500 md:inline">
              {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · updated {relativeTime(quiz.updatedAt)}
            </span>
          </p>
        </div>
      </div>
    </LedgerRow>
  );
}
