import { memo } from 'react';
import { m } from 'motion/react';
import { Check, ImageIcon, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { spring } from '@/lib/motion';
import { AnswerTile } from '@/components/ui/AnswerTile';
import { CodeBlock } from '@/components/code/CodeBlock';
import { ScoreBug } from '@/components/ui/ScoreBug';
import type { QuestionDraft } from '@/types/quiz';
import { answerStyle, ANSWER_DIM } from './answer-styles';

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
 * Renders a question the way players will see it, on the night canvas. Used for the editor's
 * live preview and the full-screen preview page. Answers are AnswerTiles (letter + kit + position).
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
    <div className={cn('ground-night flex flex-col bg-night-950 text-night-text', stage ? 'gap-6' : 'gap-4 p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <ScoreBug tab="bg-signal-400" className={stage ? 'py-2 pr-4' : 'py-1 pr-2.5'}>
          <span className={cn('type-score', stage ? 'text-score-md' : 'text-score-sm')}>
            Q {index + 1}
            <span className="text-night-muted"> / {total}</span>
          </span>
        </ScoreBug>
        <ScoreBug tab="bg-night-text" className={stage ? 'py-2 pr-4' : 'py-1 pr-2.5'}>
          <Timer className={stage ? 'size-5 text-night-muted' : 'size-3.5 text-night-muted'} aria-hidden />
          <span className={cn('type-score', stage ? 'text-score-md' : 'text-score-sm')}>
            {question.timeLimitSeconds}
            <span className="sr-only"> seconds</span>
          </span>
        </ScoreBug>
      </div>

      <p
        className={cn(
          'hyphens-words',
          stage ? 'type-display text-stage-title' : 'type-headline text-[1.25rem] leading-snug',
          !question.prompt.trim() && 'text-night-muted',
        )}
      >
        {question.prompt.trim() || 'Your question appears here'}
      </p>

      {imageUrl && (
        <div className={cn('overflow-hidden rounded-md bg-night-900', stage && 'w-full max-w-3xl')}>
          <img src={imageUrl} alt="" loading="lazy" decoding="async" className={cn('w-full object-contain', stage ? 'max-h-[34vh]' : 'max-h-36')} />
        </div>
      )}

      {question.code && question.code.content.trim() !== '' && (
        <CodeBlock code={question.code} size={stage ? 'panel' : 'phone'} className={stage ? 'max-h-[40vh]' : 'max-h-64'} />
      )}

      {pictureAnswers ? (
        <div className={cn('grid grid-cols-2', stage ? 'gap-4' : 'gap-2')}>
          {question.options.map((option, i) => {
            const style = answerStyle(i);
            const optionImage = mediaUrl(option.imagePath);
            const dim = reveal && !option.isCorrect;
            return (
              <div
                key={option.key}
                className={cn(
                  'relative flex aspect-[4/3] flex-col overflow-hidden rounded-md transition-opacity duration-[var(--dur-base)]',
                  dim ? ANSWER_DIM : [style.bg, 'shadow-press'],
                  reveal && option.isCorrect && 'ring-[3px] ring-success-400 ring-offset-2 ring-offset-night-950',
                )}
              >
                {optionImage ? (
                  <img src={optionImage} alt={option.label || `Answer ${style.letter}`} loading="lazy" decoding="async" className={cn('absolute inset-0 size-full object-cover', dim && 'opacity-40')} />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-night-text/50">
                    <ImageIcon className={stage ? 'size-12' : 'size-6'} aria-hidden />
                  </span>
                )}
                <span className={cn('relative m-2 grid place-items-center self-start rounded-[4px]', style.kit, style.fg, stage ? 'size-12' : 'size-8')}>
                  <span className={cn('type-stage', stage ? 'text-[1.5rem]' : 'text-[1rem]')}>{style.letter}</span>
                </span>
                {option.label.trim() && (
                  <span className={cn('relative mt-auto bg-night-950/80 px-2 py-1 font-semibold text-night-text', stage ? 'text-body' : 'text-caption')}>
                    {option.label}
                  </span>
                )}
                {reveal && option.isCorrect && (
                  <m.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring.pop}
                    className={cn('absolute top-2 right-2 grid place-items-center rounded-full bg-success-400 text-night-950', stage ? 'size-10' : 'size-6')}
                  >
                    <Check className={stage ? 'size-6' : 'size-4'} strokeWidth={3} aria-label="Correct answer" />
                  </m.span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn('grid gap-2', stage ? 'gap-4 md:grid-cols-2' : 'grid-cols-1')}>
          {question.options.map((option, i) => (
            <m.div
              key={option.key}
              animate={reveal && option.isCorrect ? { scale: 1.02 } : { scale: 1 }}
              transition={spring.pop}
            >
              <AnswerTile
                index={i}
                size={stage ? 'stage' : 'compact'}
                code={option.isCode && option.label.trim() !== ''}
                label={option.label.trim() || <span className="opacity-60">Answer {answerStyle(i).letter}</span>}
                state={reveal ? (option.isCorrect ? 'correct' : 'dim') : 'rest'}
              />
            </m.div>
          ))}
        </div>
      )}
    </div>
  );
});
