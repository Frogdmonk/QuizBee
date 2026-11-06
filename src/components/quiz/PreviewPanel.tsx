import { useState } from 'react';
import { Eye, EyeOff, ImageIcon, Smartphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import type { QuizDraft } from '@/types/quiz';
import { QuestionPreview } from './QuestionPreview';

/** Live phone-frame preview of the selected question (or the quiz cover). */
export function PreviewPanel({ draft, selectedIndex, className }: { draft: QuizDraft; selectedIndex: number; className?: string }) {
  const [reveal, setReveal] = useState(false);
  const question = selectedIndex >= 0 ? draft.questions[selectedIndex] : undefined;
  const cover = mediaUrl(draft.coverImagePath);

  return (
    <section aria-label="Live preview" className={cn('mx-auto w-full max-w-sm', className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-600">
          <Smartphone className="size-4" /> Student view
        </p>
        {question && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {reveal ? 'Hide answer' : 'Show answer'}
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-ink-900 bg-night-900 shadow-lift">
        {question ? (
          <QuestionPreview question={question} index={selectedIndex} total={draft.questions.length} reveal={reveal} className="min-h-[420px]" />
        ) : (
          <div className="flex min-h-[420px] flex-col gap-4 p-5 text-white">
            <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-night-800">
              {cover ? (
                <img src={cover} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-white/30">
                  <ImageIcon className="size-8" aria-hidden />
                </div>
              )}
            </div>
            {draft.subject.trim() && <p className="text-xs font-semibold tracking-wide text-sun-400 uppercase">{draft.subject}</p>}
            <p className={cn('font-display text-2xl leading-tight font-bold', !draft.title.trim() && 'text-white/35')}>
              {draft.title.trim() || 'Untitled quiz'}
            </p>
            {draft.description.trim() && <p className="line-clamp-4 text-sm text-ink-300">{draft.description}</p>}
            <p className="mt-auto text-sm text-ink-400">
              {draft.questions.length} {draft.questions.length === 1 ? 'question' : 'questions'}
            </p>
          </div>
        )}
      </div>
      {question?.explanation.trim() && reveal && (
        <p className="mt-3 rounded-xl bg-surface p-3 text-sm text-ink-700 shadow-card">
          <span className="font-semibold">Explanation: </span>
          {question.explanation}
        </p>
      )}
    </section>
  );
}
