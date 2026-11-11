import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ANSWER_DIM, answerStyle } from '@/components/quiz/answer-styles';

export type AnswerTileState = 'rest' | 'locked' | 'dim' | 'correct' | 'yourpick';
export type AnswerTileSize = 'phone' | 'stage' | 'compact';

const SIZES: Record<AnswerTileSize, { box: string; chip: string; label: string; code: string; panel: string }> = {
  compact: { box: 'min-h-14', chip: 'size-8 text-[1.125rem]', label: 'text-body', code: 'text-body-sm', panel: 'w-11' },
  phone: { box: 'min-h-16', chip: 'size-10 text-[1.375rem]', label: 'text-[1.125rem]', code: 'text-[1rem]', panel: 'w-14' },
  stage: {
    box: 'min-h-[clamp(4.5rem,11vh,8rem)]',
    chip: 'size-[clamp(2.5rem,6vh,4rem)] text-[clamp(1.5rem,3.6vh,2.5rem)]',
    label: 'text-[clamp(1.125rem,3vh,2rem)]',
    code: 'text-[clamp(1rem,2.6vh,1.75rem)]',
    panel: 'w-[clamp(3.5rem,8vh,5.5rem)]',
  },
};

/**
 * One answer option as a broadcast tile: the kit panel (letter chip on the answer's pattern)
 * then the label. Colour is never the only cue: letter + kit pattern + fixed position.
 * States `dim`, `correct` and `yourpick` are for game screens (Phase 4) and the preview reveal.
 */
export function AnswerTile({
  index,
  label,
  size = 'phone',
  state = 'rest',
  media,
  code = false,
  className,
}: {
  index: number;
  label: ReactNode;
  size?: AnswerTileSize;
  state?: AnswerTileState;
  media?: ReactNode;
  /** The label is a code snippet: monospaced, line breaks and indentation kept. */
  code?: boolean;
  className?: string;
}) {
  const style = answerStyle(index);
  const s = SIZES[size];
  const dim = state === 'dim';
  return (
    <div
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-md',
        s.box,
        dim ? ANSWER_DIM : [style.bg, style.fg, 'shadow-press'],
        state === 'yourpick' && 'ring-[3px] ring-yourpick ring-offset-2 ring-offset-night-950',
        state === 'correct' && 'ring-[3px] ring-success-400 ring-offset-2 ring-offset-night-950',
        className,
      )}
    >
      <span aria-hidden className={cn('flex shrink-0 items-center justify-center', s.panel, style.kit, dim && 'opacity-60')}>
        <span className={cn('type-stage grid place-items-center rounded-[4px] leading-none', s.chip, dim ? 'bg-night-800 text-night-muted' : [style.bg, style.fg])}>
          {style.letter}
        </span>
      </span>
      <span className="sr-only">Answer {style.letter}: </span>
      {media && <span className="flex shrink-0 items-center p-2">{media}</span>}
      {code ? (
        <code className={cn('flex min-w-0 flex-1 items-center px-3 py-2 font-mono font-semibold break-all whitespace-pre-wrap sm:px-4', s.code)}>{label}</code>
      ) : (
        <span className={cn('hyphens-words flex min-w-0 flex-1 items-center px-3 py-2 font-bold sm:px-4', s.label)}>{label}</span>
      )}
      {state === 'correct' && (
        <span className="mr-3 grid size-8 shrink-0 place-items-center self-center rounded-full bg-success-400 text-night-950">
          <Check className="size-5" strokeWidth={3} aria-label="Correct answer" />
        </span>
      )}
      {state === 'yourpick' && (
        <span className="mr-3 self-center rounded-xs bg-yourpick px-1.5 py-0.5 text-[0.75rem] font-bold tracking-[0.06em] text-night-950">
          YOU
        </span>
      )}
    </div>
  );
}
