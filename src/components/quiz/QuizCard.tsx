import { memo } from 'react';
import { Link } from 'react-router';
import { m } from 'motion/react';
import { Archive, Copy, Eye, MoreVertical, Pencil, RotateCcw, Rocket, Trash2, Undo2 } from 'lucide-react';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { relativeTime } from '@/utils/time';
import type { QuizStatus, QuizSummary } from '@/types/quiz';
import { StatusBadge } from './StatusBadge';
import { ANSWER_STYLES } from './answer-styles';

export type QuizCardActions = {
  onEdit: (quiz: QuizSummary) => void;
  onPreview: (quiz: QuizSummary) => void;
  onDuplicate: (quiz: QuizSummary) => void;
  onStatus: (quiz: QuizSummary, status: QuizStatus) => void;
  onDelete: (quiz: QuizSummary) => void;
};

function hashIndex(text: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h) % modulo;
}

export const QuizCard = memo(function QuizCard({ quiz, actions }: { quiz: QuizSummary; actions: QuizCardActions }) {
  const cover = mediaUrl(quiz.coverImagePath);
  const style = ANSWER_STYLES[hashIndex(quiz.id, ANSWER_STYLES.length)];
  const editPath = `/teacher/quizzes/${quiz.id}/edit`;

  const items: MenuItem[] = [
    { label: 'Edit', icon: <Pencil />, onSelect: () => actions.onEdit(quiz) },
    { label: 'Preview', icon: <Eye />, onSelect: () => actions.onPreview(quiz) },
    { label: 'Duplicate', icon: <Copy />, onSelect: () => actions.onDuplicate(quiz) },
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

  return (
    <m.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-card transition-shadow hover:shadow-lift"
    >
      <div className={cn('relative aspect-[16/9] overflow-hidden', !cover && style.bg)}>
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div aria-hidden className="absolute inset-0">
            <span className="absolute -right-6 -bottom-10 size-36 rounded-full bg-white/12" />
            <span className="absolute top-4 -left-8 size-24 rounded-full bg-black/8" />
            <span className="absolute bottom-3 left-4 font-display text-5xl font-extrabold text-white/90">
              {(quiz.title.trim()[0] ?? '?').toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={quiz.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {quiz.subject && <p className="truncate text-xs font-semibold tracking-wide text-ink-400 uppercase">{quiz.subject}</p>}
        <h3 className="line-clamp-2 text-[17px] leading-snug font-bold">
          <Link to={editPath} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {quiz.title}
          </Link>
        </h3>
        <p className="mt-auto pt-2 text-sm text-ink-500">
          {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · Edited {relativeTime(quiz.updatedAt)}
        </p>
      </div>

      <div className="absolute top-2 right-2 z-10">
        <Menu
          label={`Actions for ${quiz.title}`}
          trigger={<MoreVertical className="size-5" />}
          triggerClassName="bg-white/90 text-ink-700 shadow-card backdrop-blur hover:bg-white"
          items={items}
        />
      </div>
    </m.article>
  );
});
