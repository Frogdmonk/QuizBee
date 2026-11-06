import { m } from 'motion/react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { spring } from '@/lib/motion';
import { AnswerTile } from '@/components/ui/AnswerTile';
import { answerStyle, ANSWER_DIM } from '@/components/quiz/answer-styles';
import type { GameQuestion } from '@/types/game';

/**
 * The current question as the class sees it (projector and host). After the question closes the
 * correct tile is marked and each tile shows how many picked it (real counts from the server).
 */
export function QuestionStage({ question, size = 'stage', className }: { question: GameQuestion; size?: 'stage' | 'panel'; className?: string }) {
  const closed = question.status === 'closed';
  const total = closed ? Object.values(question.distribution ?? {}).reduce((a, b) => a + b, 0) : 0;
  const image = mediaUrl(question.imagePath);
  const stage = size === 'stage';
  const pictures = question.type === 'image_choice';

  return (
    <div className={cn('flex flex-col gap-[2.5vh]', className)}>
      <p className={cn('text-pretty break-words', stage ? 'type-display text-stage-title' : 'type-headline text-headline')}>{question.prompt}</p>
      {image && (
        <div className={cn('overflow-hidden rounded-md bg-night-900', stage ? 'max-w-3xl' : 'max-w-md')}>
          <img src={image} alt="" className={cn('w-full object-contain', stage ? 'max-h-[28vh]' : 'max-h-48')} />
        </div>
      )}
      <div className={cn('grid gap-3', question.options.length > 2 || pictures ? 'md:grid-cols-2' : 'md:grid-cols-2')}>
        {question.options.map((o, i) => {
          const count = question.distribution?.[o.id] ?? 0;
          const correct = closed && o.id === question.correctOptionId;
          const style = answerStyle(i);
          const optionImage = mediaUrl(o.imagePath);
          return (
            <div key={o.id} className="min-w-0">
              {pictures ? (
                <div
                  className={cn(
                    'relative flex aspect-[16/9] overflow-hidden rounded-md',
                    closed && !correct ? ANSWER_DIM : [style.bg, 'shadow-press'],
                    correct && 'ring-[3px] ring-success-400 ring-offset-2 ring-offset-night-950',
                  )}
                >
                  {optionImage ? (
                    <img src={optionImage} alt={o.label || `Answer ${style.letter}`} className={cn('absolute inset-0 size-full object-cover', closed && !correct && 'opacity-40')} />
                  ) : (
                    <ImageIcon className="m-auto size-10 text-night-text/50" aria-hidden />
                  )}
                  <span className={cn('type-stage absolute top-2 left-2 grid size-10 place-items-center rounded-[4px] text-[1.4rem]', style.kit, style.fg)}>{style.letter}</span>
                </div>
              ) : (
                <m.div animate={correct ? { scale: 1.02 } : { scale: 1 }} transition={spring.pop}>
                  <AnswerTile index={i} label={o.label} size={stage ? 'stage' : 'compact'} state={closed ? (correct ? 'correct' : 'dim') : 'rest'} />
                </m.div>
              )}
              {closed && (
                <div className="mt-1.5 flex items-center gap-2" aria-label={`${count} answered ${style.letter}`}>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-night-800">
                    <m.span
                      className={cn('block h-full origin-left', correct ? 'bg-success-400' : 'bg-night-muted')}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: total ? count / total : 0 }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <span className={cn('type-score tabular', stage ? 'text-score-md' : 'text-score-sm')}>{count}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {closed && question.explanation && (
        <p className={cn('relative max-w-3xl overflow-hidden rounded-sm bg-night-900 py-3 pr-4 pl-6', stage ? 'text-stage-name' : 'text-body-sm')}>
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-success-400" />
          {question.explanation}
        </p>
      )}
    </div>
  );
}
