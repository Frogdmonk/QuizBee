import { useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Users } from 'lucide-react';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameController } from '@/hooks/useGameState';
import { useCountdown } from '@/hooks/useCountdown';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useGameCommands } from '@/hooks/useGameCommands';
import { snapshotFromState } from '@/lib/leaderboard/snapshot';
import { enterUp } from '@/lib/motion';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { Kbd } from '@/components/ui/Kbd';
import { Spinner } from '@/components/ui/Spinner';
import { Leaderboard, Podium } from '@/components/leaderboard/Leaderboard';
import { Countdown } from './Countdown';
import { GameCommandButtons } from './GameCommandButtons';
import { GetReady } from './GetReady';
import { QuestionStage } from './QuestionStage';

/**
 * The classroom screen during a game: get ready → question → reveal → animated leaderboard → podium.
 * When the signed-in teacher is the one viewing it, the same controls as the host page appear at
 * the bottom (and Space / → steps reveal → leaderboard → next question). A projector opened with a
 * projector link stays read-only.
 */
export function PresenterGame({ client, sessionId, game }: { client: AppSupabaseClient; sessionId: string; game: GameController }) {
  const { state, nudge, answerCount, offset } = game;
  const commands = useGameCommands(client, sessionId, game);
  const question = state?.question ?? null;
  const open = state?.session.phase === 'question' && question?.status === 'open';
  const untilStart = useCountdown(question?.startsAt ?? null, offset, open);
  const started = untilStart <= 0;
  const remaining = useCountdown(question?.deadlineAt ?? null, offset, open);
  const everyone = Boolean(state && open && started && state.session.participantCount > 0 && answerCount >= state.session.participantCount);
  useAutoAdvance(state, remaining, everyone, nudge, 'primary');
  const isHost = state?.role === 'host';
  const primary = commands.primary;

  // Keyboard control for the teacher at the projector. Held keys are harmless: commands are
  // version-guarded on the server.
  useEffect(() => {
    if (!isHost || !primary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea|select|button)$/i.test(target.tagName)) return;
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        void primary();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost, primary]);

  if (!state) {
    return (
      <div className="grid flex-1 place-items-center text-night-muted">
        <Spinner className="size-10" label="Loading the game" />
      </div>
    );
  }

  const phase = state.session.phase;
  const snapshot = snapshotFromState(state);
  const showHud = phase === 'question' && started;

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
        {showHud && (
          <ScoreBug tab="bg-night-text" className="py-2 pr-4">
            <Users className="size-5 text-night-muted" aria-hidden />
            <span className="type-score text-score-md">
              <CountRoll value={answerCount} />
              <span className="text-night-muted"> / {state.session.participantCount}</span>
            </span>
            <span className="text-stage-label text-night-muted uppercase">answered</span>
          </ScoreBug>
        )}
        {showHud && question && <Countdown remainingMs={remaining} totalSeconds={question.timeLimitSeconds} size="stage" className="min-w-60 flex-1" />}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'question' && question && !started ? (
          <m.div key={`ready-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
            <GetReady number={question.position + 1} total={state.session.questionCount} remainingMs={untilStart} size="stage" />
          </m.div>
        ) : (phase === 'question' || phase === 'reveal') && question ? (
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
            <p className="type-kicker text-stage-label">
              Leaderboard · top {Math.min(10, state.rankedCount)} of {state.rankedCount}
            </p>
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

      {isHost && (commands.canEnd || commands.canBoard || commands.canNext) && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-night-rule pt-3" aria-label="Teacher controls">
          {primary && (
            <span className="mr-auto hidden items-center gap-1.5 text-caption text-night-muted md:inline-flex">
              <Kbd tone="night">Space</Kbd> or <Kbd tone="night">→</Kbd>
              {commands.canBoard ? 'shows the leaderboard' : commands.last ? 'shows the final results' : 'starts the next question'}
            </span>
          )}
          <GameCommandButtons commands={commands} size="md" />
        </div>
      )}
    </div>
  );
}
