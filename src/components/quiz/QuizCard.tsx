import { memo } from 'react';
import { Link } from 'react-router';
import { m } from 'motion/react';
import { Archive, Copy, Eye, MoreVertical, Pencil, Radio, RotateCcw, Rocket, Trash2, Undo2, Users } from 'lucide-react';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { Button } from '@/components/ui/Button';
import { LedgerLink, LedgerRow } from '@/components/ui/Ledger';
import { LEDGER_TABS } from '@/components/ui/ledger-tabs';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { enterUp } from '@/lib/motion';
import { relativeTime } from '@/utils/time';
import type { QuizStatus, QuizSummary } from '@/types/quiz';
import { StatusBadge } from './StatusBadge';
import { QuizCover } from './QuizCover';

export type QuizCardActions = {
  onEdit: (quiz: QuizSummary) => void;
  onPreview: (quiz: QuizSummary) => void;
  onDuplicate: (quiz: QuizSummary) => void;
  onShare: (quiz: QuizSummary) => void;
  onHost: (quiz: QuizSummary) => void;
  onStatus: (quiz: QuizSummary, status: QuizStatus) => void;
  onDelete: (quiz: QuizSummary) => void;
};

function menuItems(quiz: QuizSummary, actions: QuizCardActions): MenuItem[] {
  return [
    ...(quiz.status === 'published'
      ? [{ label: 'Host live', icon: <Radio />, onSelect: () => actions.onHost(quiz) }, 'separator' as const]
      : []),
    { label: 'Edit', icon: <Pencil />, onSelect: () => actions.onEdit(quiz) },
    { label: 'Preview', icon: <Eye />, onSelect: () => actions.onPreview(quiz) },
    { label: 'Duplicate', icon: <Copy />, onSelect: () => actions.onDuplicate(quiz) },
    { label: 'Share', icon: <Users />, onSelect: () => actions.onShare(quiz) },
    'separator',
    ...(quiz.status === 'draft'
      ? [{ label: 'Publish', icon: <Rocket />, onSelect: () => actions.onStatus(quiz, 'published') }]
      : quiz.status === 'published'
        ? [{ label: 'Move to drafts', icon: <Undo2 />, onSelect: () => actions.onStatus(quiz, 'draft') }]
        : [{ label: 'Restore', icon: <RotateCcw />, onSelect: () => actions.onStatus(quiz, 'draft') }]),
    ...(quiz.status !== 'archived' ? [{ label: 'Archive', icon: <Archive />, onSelect: () => actions.onStatus(quiz, 'archived') }] : []),
    'separator',
    { label: 'Delete', icon: <Trash2 />, onSelect: () => actions.onDelete(quiz), tone: 'danger' as const },
  ];
}

const meta = (quiz: QuizSummary) =>
  `${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'} · edited ${relativeTime(quiz.updatedAt)}`;

/** The one main action for a quiz: Host when published, otherwise Edit. */
function PrimaryAction({ quiz, actions, compact = false }: { quiz: QuizSummary; actions: QuizCardActions; compact?: boolean }) {
  return quiz.status === 'published' ? (
    <Button size="sm" variant="secondary" leftIcon={compact ? undefined : <Radio className="size-4" />} onClick={() => actions.onHost(quiz)} aria-label={`Host ${quiz.title}`}>
      Host
    </Button>
  ) : (
    <Button size="sm" variant={compact ? 'ghost' : 'secondary'} leftIcon={compact ? undefined : <Pencil className="size-4" />} onClick={() => actions.onEdit(quiz)} aria-label={`Edit ${quiz.title}`}>
      Edit
    </Button>
  );
}

/** "Fixture card": cover band, subject kicker, title, one action. Status is shown by the left tab and a badge. */
export const QuizCard = memo(function QuizCard({ quiz, actions }: { quiz: QuizSummary; actions: QuizCardActions }) {
  return (
    <m.article
      variants={enterUp}
      initial="hidden"
      animate="show"
      exit="exit"
      className="group relative flex flex-col overflow-hidden rounded-md border border-line bg-surface transition-[transform,box-shadow] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:shadow-pop"
    >
      <span aria-hidden className={cn('absolute top-0 bottom-0 left-0 z-10 w-1', LEDGER_TABS[quiz.status === 'published' ? 'published' : quiz.status === 'archived' ? 'archived' : 'draft'])} />
      <QuizCover coverUrl={mediaUrl(quiz.coverImagePath)} seed={quiz.id} title={quiz.title} />
      <div className="flex flex-1 flex-col gap-1 py-4 pr-4 pl-5">
        <div className="flex items-center justify-between gap-2">
          <p className="type-kicker truncate">{quiz.subject || 'No subject'}</p>
          <StatusBadge status={quiz.status} />
        </div>
        <h3 className="line-clamp-2 text-title text-ink-900">
          <Link to={`/teacher/quizzes/${quiz.id}/edit`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {quiz.title}
          </Link>
        </h3>
        <p className={cn('text-caption', quiz.questionCount === 0 ? 'text-warning-700' : 'text-ink-500')}>{meta(quiz)}</p>
        <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-3">
          <PrimaryAction quiz={quiz} actions={actions} />
          <Menu label={`Actions for ${quiz.title}`} trigger={<MoreVertical className="size-5" />} items={menuItems(quiz, actions)} />
        </div>
      </div>
    </m.article>
  );
});

/** The same quiz as a ledger row (phones, and the list view). */
export const QuizRow = memo(function QuizRow({ quiz, actions }: { quiz: QuizSummary; actions: QuizCardActions }) {
  return (
    <LedgerRow
      tab={quiz.status === 'published' ? 'published' : quiz.status === 'archived' ? 'archived' : 'draft'}
      className="min-h-[72px]"
      actions={
        <>
          <PrimaryAction quiz={quiz} actions={actions} compact />
          <Menu label={`Actions for ${quiz.title}`} trigger={<MoreVertical className="size-5" />} items={menuItems(quiz, actions)} />
        </>
      }
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <LedgerLink to={`/teacher/quizzes/${quiz.id}/edit`}>{quiz.title}</LedgerLink>
          <p className={cn('mt-0.5 truncate text-caption', quiz.questionCount === 0 ? 'text-warning-700' : 'text-ink-500')}>
            {quiz.subject ? `${quiz.subject} · ` : ''}
            {meta(quiz)}
          </p>
        </div>
        <span className="hidden sm:block">
          <StatusBadge status={quiz.status} />
        </span>
      </div>
    </LedgerRow>
  );
});
