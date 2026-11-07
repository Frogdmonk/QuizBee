import { useEffect, type CSSProperties } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Trophy, Users } from 'lucide-react';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameController } from '@/hooks/useGameState';
import { useCountdown } from '@/hooks/useCountdown';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useGameCommands } from '@/hooks/useGameCommands';
import { useReactions } from '@/hooks/useReactions';
import { useReactionSounds, useSfxOn, useSoundtrack } from '@/hooks/useMusic';
import { soundtrackFor } from '@/lib/audio/tracks';
import { snapshotFromState } from '@/lib/leaderboard/snapshot';
import { enterUp } from '@/lib/motion';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { Kbd } from '@/components/ui/Kbd';
import { Spinner } from '@/components/ui/Spinner';
import { Leaderboard, Podium } from '@/components/leaderboard/Leaderboard';
import { ReactionLayer } from '@/components/reactions/ReactionLayer';
import { ReactionsToggle } from '@/components/reactions/ReactionsToggle';
import { GameCommandButtons } from './GameCommandButtons';
import { GetReady } from './GetReady';
import { QuestionStage } from './QuestionStage';
import { TimerRing } from './TimerRing';

/**
 * The classroom screen during a game:
 *   get ready → question → reveal (a few seconds) → leaderboard (automatically, every question) → …
 *   → final podium.
 * Student reactions float up a reserved lane on the right; nothing important is ever under them.
 * When the signed-in teacher is the one viewing it, the controls appear at the bottom (Space / →
 * steps reveal → leaderboard → next question). A projector opened with a projector link is read-only.
 */
export function PresenterGame({ client, sessionId, game }: { client: AppSupabaseClient; sessionId: string; game: GameController }) {
  const { state, nudge, answerCount, offset, refresh } = game;
  const commands = useGameCommands(client, sessionId, game);
  const question = state?.question ?? null;
  const phase = state?.session.phase;
  const open = phase === 'question' && question?.status === 'open';
  const untilStart = useCountdown(question?.startsAt ?? null, offset, open);
  const started = untilStart <= 0;
  const remaining = useCountdown(question?.deadlineAt ?? null, offset, open);
  const revealing = phase === 'reveal' && Boolean(question?.boardAt);
  const boardIn = useCountdown(question?.boardAt ?? null, offset, revealing);
  const everyone = Boolean(state && open && started && state.session.participantCount > 0 && answerCount >= state.session.participantCount);
  useAutoAdvance(state, remaining, everyone, nudge, 'primary', revealing ? boardIn : Number.POSITIVE_INFINITY);
  const { reactions, bursts } = useReactions(client, sessionId, offset);
  const lane = Boolean(state?.session.reactionsEnabled);

  // Soundtrack: get-ready pulse → question groove (faster in the last 5 s) → answer sting →
  // leaderboard drumroll and strut → podium fanfare.
  const gettingReady = open && !started;
  const secondsLeft = open && started ? Math.ceil(remaining / 1000) : null;
  useSoundtrack(soundtrackFor({ phase, gettingReady }), secondsLeft !== null && secondsLeft <= 5 && secondsLeft > 0);
  useSfxOn(gettingReady ? Math.ceil(untilStart / 1000) : null, 'tick');
  useSfxOn(open && started ? `go:${question?.id}` : null, 'go');
  useSfxOn(secondsLeft !== null && secondsLeft <= 5 && secondsLeft > 0 ? secondsLeft : null, secondsLeft !== null && secondsLeft <= 3 ? 'tickHigh' : 'tick');
  useSfxOn(open && started && remaining <= 0 ? `up:${question?.id}` : null, 'timeup');
  useReactionSounds(lane ? reactions : [], lane ? bursts : []);

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

  const snapshot = snapshotFromState(state);
  const showHud = phase === 'question' && started;
  const position = state.session.currentPosition;
  const revealTotal = state.session.revealMs;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col gap-[2vh] py-[2vh]"
      style={{ '--rx-lane': lane ? 'clamp(7rem, 13vw, 13rem)' : '0px' } as CSSProperties}
    >
      {/* Everything important stays left of the reaction lane. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[2vh] pr-[var(--rx-lane)]">
        <div className="flex min-h-[clamp(3rem,7.5vh,5.5rem)] shrink-0 items-center gap-3">
          {position !== null && phase !== 'podium' && (
            <ScoreBug tab="bg-signal-400" className="py-2 pr-4">
              <span className="type-score text-score-md">
                Q {position + 1}
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
          {phase === 'reveal' && (
            <ScoreBug tab="bg-success-400" className="py-2 pr-4">
              <span className="text-stage-label uppercase">Answer</span>
            </ScoreBug>
          )}
          {phase === 'leaderboard' && (
            <ScoreBug tab="bg-rank-gold" className="py-2 pr-4">
              <Trophy className="size-5 text-rank-gold" aria-hidden />
              <span className="text-stage-label uppercase">Leaderboard</span>
              <span className="text-stage-label text-night-muted">
                after Q{(position ?? 0) + 1} of {state.session.questionCount}
              </span>
            </ScoreBug>
          )}
          <div className="ml-auto flex items-center gap-4">
            {showHud && question && remaining <= 0 && (
              <span className="inline-flex items-center gap-3 text-stage-name text-night-muted">
                Time’s up <BreathingLine className="w-20" />
              </span>
            )}
            {showHud && question && <TimerRing remainingMs={remaining} totalSeconds={question.timeLimitSeconds} className="size-[clamp(3rem,7.5vh,5.5rem)]" />}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'question' && question && !started ? (
            <m.div key={`ready-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <GetReady number={question.position + 1} total={state.session.questionCount} remainingMs={untilStart} size="stage" />
            </m.div>
          ) : (phase === 'question' || phase === 'reveal') && question ? (
            <m.div key={`q-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <QuestionStage question={question} className="flex-1" />
            </m.div>
          ) : phase === 'leaderboard' ? (
            <m.div key={`board-${position}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              {snapshot ? (
                <Leaderboard snapshot={snapshot} variant="stage" className="mx-auto w-full max-w-5xl" />
              ) : (
                <p className="m-auto text-stage-name text-night-muted">No scores yet.</p>
              )}
              {state.rankedCount > 10 && (
                <p className="mx-auto mt-[1.5vh] text-stage-name text-night-muted">
                  Top 10 of {state.rankedCount} · everyone sees their own place on their phone
                </p>
              )}
            </m.div>
          ) : phase === 'podium' ? (
            <m.div key="podium" variants={enterUp} initial="hidden" animate="show" className="flex min-h-0 flex-1 flex-col items-center">
              <h2 className="type-display text-center text-stage-title">Final results</h2>
              {state.leaderboard.length > 0 ? (
                <>
                  <Podium entries={state.leaderboard} className="mt-[4vh] w-full" />
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

        {/* The reveal hands over to the leaderboard by itself; this shows when. */}
        {revealing && (
          <div className="flex items-center gap-3" role="status">
            <span className="text-stage-label text-night-muted uppercase">Leaderboard in {Math.max(1, Math.ceil(boardIn / 1000))}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-800">
              <span
                className="block h-full origin-left bg-rank-gold transition-transform duration-[250ms] ease-linear"
                style={{ transform: `scaleX(${revealTotal > 0 ? Math.min(1, boardIn / revealTotal) : 0})` }}
              />
            </div>
          </div>
        )}

        {isHost && (commands.canEnd || commands.canBoard || commands.canNext || phase !== 'podium') && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-night-rule pt-3" aria-label="Teacher controls">
            {primary && (
              <span className="mr-auto hidden items-center gap-1.5 text-caption text-night-muted md:inline-flex">
                <Kbd tone="night">Space</Kbd> or <Kbd tone="night">→</Kbd>
                {commands.canBoard ? 'shows the leaderboard now' : commands.last ? 'shows the final results' : 'starts the next question'}
              </span>
            )}
            {phase !== 'podium' && <ReactionsToggle client={client} sessionId={sessionId} enabled={state.session.reactionsEnabled} onChanged={refresh} />}
            <GameCommandButtons commands={commands} size="md" />
          </div>
        )}
      </div>

      <ReactionLayer reactions={lane ? reactions : []} bursts={lane ? bursts : []} />
    </div>
  );
}
