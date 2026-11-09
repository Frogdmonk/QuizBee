import { AnswerTile } from '@/components/ui/AnswerTile';
import type { BattleAttack, BattleState, GameQuestion } from '@/types/game';
import { BattleArena, type ArenaPlayer } from './BattleArena';
import { MisconceptionNote } from '@/components/learning/LearningScreens';

/**
 * The projector's reveal in a boss battle: the right answer (still the most important thing to
 * learn) in a compact band, and the arena underneath where the class attack plays out.
 */
export function BattleReveal({
  question,
  battle,
  attack,
  players,
}: {
  question: GameQuestion;
  battle: BattleState;
  attack: BattleAttack | null;
  players: readonly ArenaPlayer[];
}) {
  const correctIndex = question.options.findIndex((o) => o.id === question.correctOptionId);
  const correct = correctIndex >= 0 ? question.options[correctIndex] : null;
  const total = Object.values(question.distribution ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[1.5vh]">
      <div className="flex shrink-0 flex-wrap items-center gap-x-[2vw] gap-y-2">
        <p className="type-headline line-clamp-2 min-w-0 flex-1 basis-[28rem] text-[clamp(1.25rem,3.2vh,2.25rem)] leading-tight text-pretty">{question.prompt}</p>
        {correct && (
          <AnswerTile index={correctIndex} label={correct.label || `Answer ${correctIndex + 1}`} size="compact" state="correct" className="min-w-[16rem] flex-1 basis-[20rem]" />
        )}
        {attack && (
          <p className="text-stage-name text-night-muted">
            <span className="type-score text-night-text">{attack.correct}</span> of {attack.eligible} correct ·{' '}
            <span className="type-score text-night-text">{Math.round(attack.accuracy)}%</span>
          </p>
        )}
        {!attack && total > 0 && <p className="text-stage-name text-night-muted">{total} answered</p>}
      </div>
      {question.explanation && <p className="line-clamp-2 shrink-0 text-stage-name text-night-muted">{question.explanation}</p>}
      <MisconceptionNote misconception={question.misconception} className="shrink-0" />
      <BattleArena
        battle={battle}
        players={players}
        attack={attack}
        sound
        className="min-h-0 flex-1 rounded-lg border border-night-rule bg-[radial-gradient(ellipse_at_70%_60%,rgb(255_255_255/0.06),transparent_60%)]"
      />
    </div>
  );
}
