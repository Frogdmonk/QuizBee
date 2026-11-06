import { AnimatePresence, m } from 'motion/react';
import { Users } from 'lucide-react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { useGameState } from '@/hooks/useGameState';
import { useServerClock } from '@/hooks/useServerClock';
import { useCountdown } from '@/hooks/useCountdown';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { snapshotFromState } from '@/lib/leaderboard/snapshot';
import { enterUp } from '@/lib/motion';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { Spinner } from '@/components/ui/Spinner';
import { Leaderboard, Podium } from '@/components/leaderboard/Leaderboard';
import { Countdown } from './Countdown';
import { QuestionStage } from './QuestionStage';

/** The classroom screen during a game: question → reveal → animated leaderboard → podium. */
export function PresenterGame({ client, sessionId }: { client: AppSupabaseClient; sessionId: string }) {
  const { state, nudge, answerCount } = useGameState(client, sessionId, { listenHost: true });
  const offset = useServerClock(client);
  const question = state?.question ?? null;
  const open = state?.session.phase === 'question' && question?.status === 'open';
  const remaining = useCountdown(question?.deadlineAt ?? null, offset, open);
  const everyone = Boolean(state && open && state.session.participantCount > 0 && answerCount >= state.session.participantCount);
  useAutoAdvance(state, remaining, everyone, nudge);

  if (!state) {
    return (
      <div className="grid flex-1 place-items-center text-night-muted">
        <Spinner className="size-10" label="Loading the game" />
      </div>
    );
  }

  const phase = state.session.phase;
  const snapshot = snapshotFromState(state);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh] py-[2vh]">
      <div className="flex flex-wrap items-center gap-3">
        {state.session.currentPosition !== null && phase !== 'podium' && phase !== 'leaderboard' && (
          <ScoreBug tab="bg-signal-400" className="py-2 pr-4">
            <span className="type-score text-score-md">
              Q {state.session.currentPosition + 1}
              <span className="text-night-muted"> / {state.session.questionCount}</span>
            </span>
          </ScoreBug>
        )}
        {phase === 'question' && (
          <ScoreBug tab="bg-night-text" className="py-2 pr-4">
            <Users className="size-5 text-night-muted" aria-hidden />
            <span className="type-score text-score-md">
              <CountRoll value={answerCount} />
              <span className="text-night-muted"> / {state.session.participantCount}</span>
            </span>
            <span className="text-stage-label text-night-muted uppercase">answered</span>
          </ScoreBug>
        )}
        {phase === 'question' && question && (
          <Countdown remainingMs={remaining} totalSeconds={question.timeLimitSeconds} size="stage" className="min-w-60 flex-1" />
        )}
      </div>

      <AnimatePresence mode="wait">
        {(phase === 'question' || phase === 'reveal') && question ? (
          <m.div key={`${question.id}-${phase}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="min-h-0 flex-1 overflow-hidden">
            <QuestionStage question={question} />
            {phase === 'question' && remaining <= 0 && (
              <p className="mt-6 inline-flex items-center gap-3 text-stage-name text-night-muted">
                Time’s up <BreathingLine className="w-24" />
              </p>
            )}
          </m.div>
        ) : phase === 'leaderboard' ? (
          <m.div key="board" variants={enterUp} initial="hidden" animate="show" exit="exit" className="min-h-0 flex-1 overflow-hidden">
            <p className="type-kicker text-stage-label">Leaderboard · top {Math.min(10, state.rankedCount)} of {state.rankedCount}</p>
            <Leaderboard snapshot={snapshot} variant="stage" className="mt-3 max-w-5xl" />
          </m.div>
        ) : phase === 'podium' ? (
          <m.div key="podium" variants={enterUp} initial="hidden" animate="show" className="flex min-h-0 flex-1 flex-col">
            <h2 className="type-display text-stage-title">Final results</h2>
            {state.leaderboard.length > 0 ? (
              <>
                <Podium entries={state.leaderboard} className="mt-[3vh]" />
                <p className="mt-[3vh] text-center text-stage-name text-night-muted">
                  {state.rankedCount} {state.rankedCount === 1 ? 'player' : 'players'} · thanks for playing
                </p>
              </>
            ) : (
              <p className="mt-4 text-stage-name text-night-muted">No questions were scored in this game.</p>
            )}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
