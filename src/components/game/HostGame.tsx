import { useState } from 'react';
import { ExternalLink, Flag, Users } from 'lucide-react';
import { ButtonLink, Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { CountRoll } from '@/components/ui/CountRoll';
import { SectionHead } from '@/components/ui/SectionHead';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Leaderboard, Podium } from '@/components/leaderboard/Leaderboard';
import { ConnectionPill } from '@/components/live/ConnectionPill';
import type { GameController } from '@/hooks/useGameState';
import { useCountdown } from '@/hooks/useCountdown';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useGameCommands } from '@/hooks/useGameCommands';
import { getTeacherClient } from '@/lib/supabase';
import { snapshotFromState } from '@/lib/leaderboard/snapshot';
import { Countdown } from './Countdown';
import { GameCommandButtons } from './GameCommandButtons';
import { QuestionStage } from './QuestionStage';

/**
 * The teacher's controls during a game. Every command carries the state version it was issued
 * against, so a double click or a second tab can never skip a question.
 */
export function HostGame({ sessionId, game }: { sessionId: string; game: GameController }) {
  const client = getTeacherClient();
  const { state, channel, nudge, answerCount, offset } = game;
  const commands = useGameCommands(client, sessionId, game);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const question = state?.question ?? null;
  const open = state?.session.phase === 'question' && question?.status === 'open';
  const untilStart = useCountdown(question?.startsAt ?? null, offset, open);
  const started = untilStart <= 0;
  const remaining = useCountdown(question?.deadlineAt ?? null, offset, open);
  const everyone = Boolean(state && open && started && state.session.participantCount > 0 && answerCount >= state.session.participantCount);
  useAutoAdvance(state, remaining, everyone, nudge, 'primary');

  if (!state) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-ink-500">
        <Spinner className="size-6" label="Loading the game" />
      </div>
    );
  }

  const { phase, currentPosition, questionCount } = state.session;
  const snapshot = snapshotFromState(state);

  return (
    <div className="space-y-6">
      <section
        aria-label="Game controls"
        className="ground-night sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 flex flex-wrap items-center gap-x-5 gap-y-3 bg-night-950 px-4 py-3 text-night-text sm:mx-0 sm:rounded-md sm:px-5 lg:top-4"
      >
        {currentPosition !== null && phase !== 'podium' && (
          <ScoreBug tab="bg-signal-400" className="py-1.5">
            <span className="type-score text-score-md">
              Q {currentPosition + 1}
              <span className="text-night-muted"> / {questionCount}</span>
            </span>
          </ScoreBug>
        )}
        {phase === 'question' && (
          <>
            <span className="inline-flex items-center gap-2 text-body-sm">
              <Users className="size-4 text-night-muted" aria-hidden />
              <span className="type-score text-score-md">
                <CountRoll value={answerCount} />
              </span>
              <span className="text-night-muted">/ {state.session.participantCount} answered</span>
            </span>
            {question && started && <Countdown remainingMs={remaining} totalSeconds={question.timeLimitSeconds} className="w-40" />}
            {question && !started && (
              <span className="text-body-sm font-semibold text-night-muted" role="status">
                Starts in {Math.max(1, Math.ceil(untilStart / 1000))}…
              </span>
            )}
          </>
        )}
        {phase === 'podium' && <Badge surface="night">Game over</Badge>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ConnectionPill status={channel} quiet surface="night" />
          <GameCommandButtons commands={commands} />
          <ButtonLink to={`/presenter/${sessionId}`} target="_blank" rel="noopener" size="sm" variant="night-ghost" leftIcon={<ExternalLink className="size-4" />} className="hidden md:inline-flex">
            Projector
          </ButtonLink>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-label="Current question" className="ground-night min-w-0 rounded-md bg-night-950 p-5 text-night-text">
          {phase === 'podium' ? (
            <>
              <p className="type-kicker">Final results</p>
              {state.leaderboard.length > 0 ? <Podium entries={state.leaderboard} className="mt-6" /> : <p className="mt-3 text-night-muted">No questions were scored.</p>}
            </>
          ) : question ? (
            <QuestionStage question={question} size="panel" />
          ) : null}
        </section>

        <section aria-labelledby="board-heading" className="min-w-0">
          <SectionHead id="board-heading" kicker="Leaderboard" action={<span className="text-caption text-ink-500">{state.rankedCount} ranked</span>} />
          {snapshot ? (
            <Leaderboard snapshot={snapshot} variant="panel" tone="paper" className="mt-3" />
          ) : (
            <p className="mt-4 text-body-sm text-ink-500">Rankings appear after the first question closes.</p>
          )}
        </section>
      </div>

      {phase !== 'podium' && (
        <div className="border-t border-line pt-6">
          <Button variant="danger-outline" size="sm" leftIcon={<Flag className="size-4" />} onClick={() => setConfirmEnd(true)}>
            End game now
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmEnd}
        title="End the game now?"
        description="The current question closes, scores so far stand, and everyone sees the final results."
        confirmLabel="End game"
        tone="danger"
        busy={commands.busy}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => void commands.finish().then(() => setConfirmEnd(false))}
      />
    </div>
  );
}
