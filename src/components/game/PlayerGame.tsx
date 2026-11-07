import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, Flame, ImageIcon } from 'lucide-react';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameController } from '@/hooks/useGameState';
import { useCountdown } from '@/hooks/useCountdown';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { snapshotFromState } from '@/lib/leaderboard/snapshot';
import { classifyMovement } from '@/lib/leaderboard/movement';
import { DEFAULT_LEADERBOARD_CONFIG } from '@/lib/leaderboard/config';
import { selectTheme } from '@/lib/leaderboard/selection';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { enterUp, popIn, spring } from '@/lib/motion';
import { submitAnswer } from '@/services/game';
import { friendlyError } from '@/utils/errors';
import { AnswerTile } from '@/components/ui/AnswerTile';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { LowerThird } from '@/components/ui/LowerThird';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { CountRoll } from '@/components/ui/CountRoll';
import { Spinner } from '@/components/ui/Spinner';
import { answerStyle } from '@/components/quiz/answer-styles';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { ThemeActor } from '@/components/leaderboard/ThemeActor';
import { AnimatedNumber } from '@/components/leaderboard/AnimatedNumber';
import { Countdown } from './Countdown';
import { GetReady } from './GetReady';
import type { GameMe, GameQuestion } from '@/types/game';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The student's phone during a game: answer, lock in, see the result and their own rank. */
export function PlayerGame({ client, game }: { client: AppSupabaseClient; game: GameController }) {
  const { state, refresh, nudge, offset, markAnswered } = game;
  const [picked, setPicked] = useState<{ questionId: string; optionId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const question = state?.question ?? null;
  const open = state?.session.phase === 'question' && question?.status === 'open';
  // The question is held back until its scheduled start (server clock), so every phone reveals it
  // at the same instant whatever its connection speed.
  const untilStart = useCountdown(question?.startsAt ?? null, offset, open);
  const started = untilStart <= 0;
  const remaining = useCountdown(question?.deadlineAt ?? null, offset, open);
  // Phones only back the host up (a sleeping laptop): the host and projector close questions.
  useAutoAdvance(state, remaining, false, nudge, 'backup');

  if (!state || !state.me) {
    return (
      <div className="grid flex-1 place-items-center text-night-muted">
        <Spinner className="size-8" label="Loading the game" />
      </div>
    );
  }

  const me = state.me;
  const phase = state.session.phase;
  const myPick = question && (me.answerOptionId ?? (picked?.questionId === question.id ? picked.optionId : null));

  const answer = async (optionId: string) => {
    if (!question || myPick) return;
    setPicked({ questionId: question.id, optionId });
    setNotice(null);
    try {
      const status = await submitAnswer(client, question.id, optionId);
      if (status === 'late') setNotice('Too late — time was up.');
      if (status === 'closed') setNotice('This question has already closed.');
      if (status === 'early') setNotice('Hold on — the question has not started yet.');
      if (status === 'accepted' || status === 'duplicate') markAnswered(question.id, optionId);
      if (status === 'late' || status === 'closed' || status === 'early') setPicked(null);
      void refresh();
    } catch (error) {
      setPicked(null);
      setNotice(friendlyError(error));
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <ScoreBug tab="bg-signal-400" className="w-full">
        {state.session.currentPosition !== null && phase !== 'podium' && (
          <span className="type-score text-score-sm">
            Q {state.session.currentPosition + 1}/{state.session.questionCount}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {me.streak >= DEFAULT_LEADERBOARD_CONFIG.streakMin && (
            <span className="inline-flex items-center gap-1 text-caption font-bold text-answer-d">
              <Flame className="size-4" aria-hidden /> {me.streak}
            </span>
          )}
          {me.rank !== null && <span className="type-score text-score-sm">#{me.rank}</span>}
          <AnimatedNumber value={me.score} className="type-score text-score-md" />
        </span>
      </ScoreBug>

      <AnimatePresence mode="wait">
        {phase === 'question' && question && !started ? (
          <m.div key={`ready-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col">
            <GetReady number={question.position + 1} total={state.session.questionCount} remainingMs={untilStart} />
          </m.div>
        ) : phase === 'question' && question ? (
          <m.div key={`q-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col gap-4">
            <p className="type-headline text-pretty text-[1.375rem] leading-snug break-words">{question.prompt}</p>
            {question.imagePath && (
              <img src={mediaUrl(question.imagePath) ?? undefined} alt="" className="max-h-40 w-full rounded-md bg-night-900 object-contain" />
            )}
            {open && <Countdown remainingMs={remaining} totalSeconds={question.timeLimitSeconds} />}

            <div className={cn('grid gap-2', question.type === 'image_choice' && 'grid-cols-2')} role="group" aria-label="Answers">
              {question.options.map((o, i) => {
                const mine = myPick === o.id;
                const locked = Boolean(myPick);
                const style = answerStyle(i);
                return (
                  <m.button
                    key={o.id}
                    type="button"
                    disabled={locked || !open || !started || remaining <= 0}
                    onClick={() => void answer(o.id)}
                    aria-pressed={mine}
                    animate={locked ? (mine ? { scale: 0.97, opacity: 1 } : { scale: 1, opacity: 0.35 }) : { scale: 1, opacity: 1 }}
                    whileTap={locked ? undefined : { scale: 0.96 }}
                    transition={spring.press}
                    className="block w-full text-left disabled:cursor-default"
                  >
                    {question.type === 'image_choice' ? (
                      <span className={cn('relative flex aspect-[4/3] overflow-hidden rounded-md shadow-press', style.bg, mine && 'ring-[3px] ring-yourpick ring-offset-2 ring-offset-night-950')}>
                        {o.imagePath ? (
                          <img src={mediaUrl(o.imagePath) ?? undefined} alt={o.label || `Answer ${style.letter}`} className="absolute inset-0 size-full object-cover" />
                        ) : (
                          <ImageIcon className="m-auto size-8 text-night-text/50" aria-hidden />
                        )}
                        <span className={cn('type-stage absolute top-1.5 left-1.5 grid size-8 place-items-center rounded-[4px]', style.kit, style.fg)}>{style.letter}</span>
                      </span>
                    ) : (
                      <AnswerTile index={i} label={o.label} size="phone" state={mine ? 'yourpick' : 'rest'} />
                    )}
                  </m.button>
                );
              })}
            </div>

            {notice && (
              <p role="alert" className="text-body-sm font-semibold text-error-300">
                {notice}
              </p>
            )}
            {myPick ? (
              <m.div variants={popIn} initial="hidden" animate="show" className="mt-auto">
                <LowerThird surface="night" tab="bg-volt-400" className="w-full">
                  <Check className="size-4" aria-hidden /> Locked in · waiting for the others
                </LowerThird>
              </m.div>
            ) : (
              remaining <= 0 && (
                <p className="mt-auto inline-flex items-center gap-3 text-body text-night-muted">
                  Time’s up <BreathingLine />
                </p>
              )
            )}
          </m.div>
        ) : phase === 'reveal' && question ? (
          <m.div key={`r-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col gap-5">
            <RevealCard me={me} question={question} />
          </m.div>
        ) : phase === 'leaderboard' ? (
          <m.div key="board" variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col gap-5">
            <RankCard me={me} total={state.rankedCount} />
            <Leaderboard snapshot={snapshotFromState(state)} variant="compact" highlightId={me.participantId} />
          </m.div>
        ) : phase === 'podium' ? (
          <m.div key="final" variants={enterUp} initial="hidden" animate="show" className="flex flex-1 flex-col gap-5">
            <p className="type-kicker">Final results</p>
            <RankCard me={me} total={state.rankedCount} final />
            <Leaderboard snapshot={snapshotFromState(state)} variant="compact" highlightId={me.participantId} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function RevealCard({ me, question }: { me: GameMe; question: GameQuestion }) {
  const correctIndex = question.options.findIndex((o) => o.id === question.correctOptionId);
  const letter = correctIndex >= 0 ? answerStyle(correctIndex).letter : '';
  if (me.lastCorrect) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <m.span variants={popIn} initial="hidden" animate="show" className="grid size-24 place-items-center rounded-full bg-success-400 text-night-950">
          <Check className="size-12" strokeWidth={3} aria-hidden />
        </m.span>
        <p className="type-display text-display-lg">Correct!</p>
        <p className="type-score text-score-xl text-success-400">
          +<CountRoll value={me.lastPoints ?? 0} />
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="type-display text-display-lg">{me.answerOptionId ? 'Not this time' : 'No answer this time'}</p>
      {letter && <p className="text-body text-night-muted">{letter} was correct.</p>}
      <p className="text-body-sm text-night-muted">Next question coming up — every question is a fresh chance.</p>
    </div>
  );
}

/** The player's own rank, with their own movement animation (same engine rules as the board). */
function RankCard({ me, total, final = false }: { me: { avatar: string; rank: number | null; previousRank: number | null; score: number; nickname: string }; total: number; final?: boolean }) {
  const movement = me.rank !== null ? classifyMovement(me.previousRank, me.rank, DEFAULT_LEADERBOARD_CONFIG) : null;
  const [theme] = useState(() => (movement ? selectTheme(movement, []) : 'fallback'));
  return (
    <div className="flex items-center gap-4 rounded-md bg-night-900 p-4">
      <ThemeActor code={me.avatar} theme={theme} play={!final} delayMs={300} className="size-20 shrink-0" />
      <div className="min-w-0">
        <p className="type-kicker">{final ? 'You finished' : 'Your rank'}</p>
        <p className="type-display text-display-lg leading-none">{me.rank !== null ? ordinal(me.rank) : '—'}</p>
        <p className="mt-1 text-body-sm text-night-muted">
          of {total} · <span className="type-score text-night-text">{me.score.toLocaleString()}</span> points
          {movement?.kind === 'up' && <span className="ml-2 font-bold text-success-400">▲ {movement.positions}</span>}
        </p>
      </div>
    </div>
  );
}
