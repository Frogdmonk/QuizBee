import { ImageIcon, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { Switch } from '@/components/ui/FormControls';
import { ScoreBug } from '@/components/ui/ScoreBug';
import type { QuizDraft } from '@/types/quiz';
import { QuestionPreview } from './QuestionPreview';

/** Live phone-frame preview of the selected question (or the quiz's "programme cover"). */
export function PreviewPanel({ draft, selectedIndex, className }: { draft: QuizDraft; selectedIndex: number; className?: string }) {
  const [reveal, setReveal] = useState(false);
  const question = selectedIndex >= 0 ? draft.questions[selectedIndex] : undefined;
  const cover = mediaUrl(draft.coverImagePath);

  return (
    <section aria-label="Live preview" className={cn('mx-auto w-full max-w-[22rem]', className)}>
      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <p className="type-kicker inline-flex items-center gap-1.5">
          <Smartphone className="size-4" /> Student view
        </p>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border-[6px] border-ink-900 bg-night-950 shadow-pop">
        <div aria-hidden className="mx-auto mt-2 h-1 w-12 rounded-full bg-night-800" />
        {question ? (
          <QuestionPreview question={question} index={selectedIndex} total={draft.questions.length} reveal={reveal} className="min-h-[24rem]" />
        ) : (
          <div className="ground-night flex min-h-[24rem] flex-col gap-4 p-4 text-night-text">
            <div className="aspect-[16/9] overflow-hidden rounded-md bg-night-900">
              {cover ? (
                <img src={cover} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-night-muted">
                  <ImageIcon className="size-8" aria-hidden />
                </div>
              )}
            </div>
            {draft.subject.trim() && <p className="type-kicker">{draft.subject}</p>}
            <p className={cn('type-display text-[1.75rem] leading-tight', !draft.title.trim() && 'text-night-muted')}>
              {draft.title.trim() || 'Untitled quiz'}
            </p>
            {draft.description.trim() && <p className="line-clamp-4 text-body-sm text-night-muted">{draft.description}</p>}
            <ScoreBug tab="bg-signal-400" className="mt-auto self-start py-1.5">
              <span className="type-score text-score-sm">{draft.questions.length}</span>
              <span className="text-caption text-night-muted">{draft.questions.length === 1 ? 'question' : 'questions'}</span>
            </ScoreBug>
          </div>
        )}
      </div>
      {question && (
        <div className="mt-4">
          <Switch label="Show answer" description="Highlights the correct answer, as after the reveal." checked={reveal} onChange={setReveal} />
        </div>
      )}
      {question?.explanation.trim() && reveal && (
        <p className="mt-3 rounded-sm border border-line bg-surface p-3 text-body-sm text-ink-700">
          <span className="font-semibold text-ink-900">Explanation: </span>
          {question.explanation}
        </p>
      )}
    </section>
  );
}
