import { memo } from 'react';
import { Check, ImageIcon, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import type { QuestionDraft } from '@/types/quiz';
import { answerStyle } from './answer-styles';

type Props = {
  question: QuestionDraft;
  index: number;
  total: number;
  /** 'phone' = compact student view; 'stage' = large projector-style view. */
  variant?: 'phone' | 'stage';
  /** Highlight the correct answer (teacher preview only). */
  reveal?: boolean;
  className?: string;
};

/**
 * Renders a question the way players will see it. Used for the editor's live
 * preview and the full-screen preview page.
 */
export const QuestionPreview = memo(function QuestionPreview({
  question,
  index,
  total,
  variant = 'phone',
  reveal = false,
  className,
}: Props) {
  const stage = variant === 'stage';
  const imageUrl = mediaUrl(question.imagePath);
  const pictureAnswers = question.type === 'image_choice';

  return (
    <div className={cn('flex flex-col bg-night-900 text-white', stage ? 'gap-6' : 'gap-3 p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'rounded-full bg-white/10 font-semibold text-ink-200',
            stage ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-[11px]',
          )}
        >
          Question {index + 1} of {total}
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full bg-sun-400 font-display font-extrabold text-ink-900 tabular',
            stage ? 'px-4 py-1.5 text-2xl' : 'px-2.5 py-0.5 text-sm',
          )}
        >
          <Timer className={stage ? 'size-6' : 'size-3.5'} aria-hidden />
          {question.timeLimitSeconds}
          <span className="sr-only">seconds</span>
        </span>
      </div>

      <p
        className={cn(
          'font-display font-bold break-words',
          stage ? 'text-center text-3xl leading-tight sm:text-4xl lg:text-5xl' : 'text-base leading-snug',
          !question.prompt.trim() && 'text-white/35',
        )}
      >
        {question.prompt.trim() || 'Your question appears here'}
      </p>

      {imageUrl && (
        <div className={cn('overflow-hidden rounded-2xl bg-night-800', stage ? 'mx-auto w-full max-w-3xl' : '')}>
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn('w-full object-contain', stage ? 'max-h-[38vh]' : 'max-h-36')}
          />
        </div>
      )}

      <div className={cn('grid gap-2', question.options.length > 2 || pictureAnswers ? 'grid-cols-2' : 'grid-cols-2', stage && 'gap-4')}>
        {question.options.map((option, i) => {
          const style = answerStyle(i);
          const optionImage = mediaUrl(option.imagePath);
          const dimmed = reveal && !option.isCorrect;
          return (
            <div
              key={option.key}
              className={cn(
                'relative flex overflow-hidden rounded-2xl shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] transition-opacity duration-300',
                style.bg,
                pictureAnswers ? 'aspect-[4/3] flex-col' : stage ? 'min-h-28 items-center gap-4 p-5' : 'min-h-14 items-center gap-2 p-2.5',
                dimmed && 'opacity-30',
                reveal && option.isCorrect && 'ring-4 ring-mint-400 ring-offset-2 ring-offset-night-900',
              )}
            >
              {pictureAnswers ? (
                <>
                  {optionImage ? (
                    <img src={optionImage} alt={option.label || `Answer ${style.letter}`} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-white/40">
                      <ImageIcon className={stage ? 'size-12' : 'size-6'} aria-hidden />
                    </span>
                  )}
                  <span
                    className={cn(
                      'relative m-2 grid place-items-center rounded-lg bg-black/35 font-display font-extrabold backdrop-blur-sm',
                      stage ? 'size-12 text-2xl' : 'size-7 text-sm',
                    )}
                  >
                    {style.letter}
                  </span>
                  {option.label.trim() && (
                    <span className={cn('relative mt-auto bg-black/40 px-2 py-1 font-semibold', stage ? 'text-lg' : 'text-xs')}>
                      {option.label}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'grid shrink-0 place-items-center rounded-lg bg-white/20 font-display font-extrabold',
                      stage ? 'size-12 text-2xl' : 'size-7 text-sm',
                    )}
                  >
                    {style.letter}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 font-semibold break-words',
                      stage ? 'text-2xl leading-tight' : 'text-[13px] leading-tight',
                      !option.label.trim() && 'text-white/45',
                    )}
                  >
                    {option.label.trim() || `Answer ${style.letter}`}
                  </span>
                </>
              )}
              {reveal && option.isCorrect && (
                <span
                  className={cn(
                    'absolute top-2 right-2 grid place-items-center rounded-full bg-mint-500 text-white',
                    stage ? 'size-10' : 'size-6',
                  )}
                >
                  <Check className={stage ? 'size-6' : 'size-4'} strokeWidth={3} aria-label="Correct answer" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
