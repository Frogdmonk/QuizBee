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
 *
 * `stage` (projector) fills the height it is given: centred prompt, then answer tiles that grow to
 * use the screen. `panel` (host page) is the compact flowing version.
 */
export function QuestionStage({
  question,
  size = 'stage',
  hiddenOptionId = null,
  className,
}: {
  question: GameQuestion;
  size?: 'stage' | 'panel';
  /** Knowledge Reveal removed this wrong answer (shown dimmed while the question runs). */
  hiddenOptionId?: string | null;
  className?: string;
}) {
  const closed = question.status === 'closed';
  const total = closed ? Object.values(question.distribution ?? {}).reduce((a, b) => a + b, 0) : 0;
  const image = mediaUrl(question.imagePath);
  const stage = size === 'stage';
  const pictures = question.type === 'image_choice';

  return (
    <div className={cn('flex flex-col', stage ? 'h-full min-h-0 gap-[2.2vh]' : 'gap-4', className)}>
      <p
        className={cn(
          'text-pretty break-words',
          stage ? 'type-display mx-auto max-w-[24ch] text-center text-[clamp(2rem,5.6vh,4.5rem)] leading-[1.05]' : 'type-headline text-headline',
        )}
      >
        {question.prompt}
      </p>
      {image && (
        <div className={cn('overflow-hidden rounded-md bg-night-900', stage ? 'mx-auto max-w-[min(60%,48rem)] shrink' : 'max-w-md')}>
          <img src={image} alt="" className={cn('w-full object-contain', stage ? 'max-h-[26vh]' : 'max-h-48')} />
        </div>
      )}
      <div
        className={cn(
          'grid gap-[1.6vh]',
          stage ? ['min-h-0 flex-1 auto-rows-fr grid-cols-2', image || pictures ? 'max-h-[44vh]' : 'max-h-[52vh]'] : 'md:grid-cols-2',
        )}
      >
        {question.options.map((o, i) => {
          const count = question.distribution?.[o.id] ?? 0;
          const correct = closed && o.id === question.correctOptionId;
          const removed = !closed && o.id === hiddenOptionId;
          const style = answerStyle(i);
          const optionImage = mediaUrl(o.imagePath);
          const share = total ? count / total : 0;
          return (
            <m.div
              key={o.id}
              className={cn('relative flex min-h-0 min-w-0 flex-col', stage && 'h-full')}
              aria-label={removed ? `Answer ${style.letter} removed by Knowledge Reveal` : undefined}
              initial={stage ? { opacity: 0, y: 18 } : false}
              animate={{ opacity: removed ? 0.2 : 1, y: 0, scale: correct && stage ? 1.015 : 1 }}
              transition={{ ...spring.pop, delay: stage && !closed ? 0.08 * i : 0 }}
            >
              {pictures ? (
                <div
                  className={cn(
                    'relative flex overflow-hidden rounded-md',
                    stage ? 'min-h-0 flex-1' : 'aspect-[16/9]',
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
                <AnswerTile
                  index={i}
                  label={o.label}
                  size={stage ? 'stage' : 'compact'}
                  state={closed ? (correct ? 'correct' : 'dim') : 'rest'}
                  className={stage ? 'min-h-0 flex-1' : undefined}
                />
              )}
              {closed && (
                <div className={cn('flex items-center gap-2', stage ? 'mt-1' : 'mt-1.5')} aria-label={`${count} answered ${style.letter}`}>
                  <div className={cn('flex-1 overflow-hidden rounded-full bg-night-800', stage ? 'h-[1vh] min-h-1.5' : 'h-2')}>
                    <m.span
                      className={cn('block h-full origin-left', correct ? 'bg-success-400' : 'bg-night-muted')}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: share }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <span className={cn('type-score tabular', stage ? 'text-[clamp(1.25rem,3vh,2rem)]' : 'text-score-sm', correct && 'text-success-400')}>{count}</span>
                </div>
              )}
            </m.div>
          );
        })}
      </div>
      {closed && question.explanation && (
        <m.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn('relative overflow-hidden rounded-sm bg-night-900 py-3 pr-4 pl-6', stage ? 'mx-auto max-w-4xl text-stage-name' : 'max-w-3xl text-body-sm')}
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-success-400" />
          {question.explanation}
        </m.p>
      )}
    </div>
  );
}
