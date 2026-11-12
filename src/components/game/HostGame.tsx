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
import { ReactionsToggle } from '@/components/reactions/ReactionsToggle';
import { BattleStrip } from '@/components/battle/BattleStrip';
import { BattleResult } from '@/components/battle/BattleResult';
import { monsterOf } from '@/lib/battle/monster';
import { weakSpotNote } from '@/lib/monsters/reactions';
import { activeBattle, chargingNote, currentRules, revealAttack } from '@/lib/battle/state';
import { VoteHostPanel, WeaponPanel } from '@/components/battle/WeaponControls';
import { TeamAbilities } from '@/components/battle/Powerups';
import { useWeaponVote } from '@/hooks/useWeaponVote';
import { LearningReport, MasteryBanner, MisconceptionNote } from '@/components/learning/LearningScreens';

/**
 * The teacher's controls during a game. Every command carries the state version it was issued
 * against, so a double click or a second tab can never skip a question.
 */
export function HostGame({ sessionId, game }: { sessionId: string; game: GameController }) {
  const client = getTeacherClient();
  const { state, channel, nudge, answerCount, offset, refresh, voteTally } = game;
  const commands = useGameCommands(client, sessionId, game);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const question = state?.question ?? null;
  const open = state?.session.phase === 'question' && question?.status === 'open';
  const untilStart = useCountdown(question?.startsAt ?? null, offset, open);
  const started = untilStart <= 0;
  const remaining = useCountdown(question?.deadlineAt ?? null, offset, open);
  const everyone = Boolean(state && open && started && state.session.participantCount > 0 && answerCount >= state.session.participantCount);
  const revealing = state?.session.phase === 'reveal' && Boolean(question?.boardAt);
  const boardIn = useCountdown(question?.boardAt ?? null, offset, revealing);
  useAutoAdvance(state, remaining, everyone, nudge, 'primary', revealing ? boardIn : Number.POSITIVE_INFINITY);
  const weaponVote = useWeaponVote(state, offset, nudge, 'primary');

  if (!state) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-ink-500">
        <Spinner className="size-6" label="Loading the game" />
      </div>
    );
  }

  const { phase, currentPosition, questionCount } = state.session;
  const snapshot = snapshotFromState(state);
  const battle = activeBattle(state);
  const attack = revealAttack(state);
  const rules = currentRules(state);

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
        {revealing && (
          <span className="text-body-sm font-semibold text-night-muted" role="status">
            Leaderboard in {Math.max(1, Math.ceil(boardIn / 1000))}…
          </span>
        )}
        {phase === 'podium' && <Badge surface="night">Game over</Badge>}
        {battle && (
          <BattleStrip
            monster={monsterOf(battle)}
            hp={battle.hp}
            maxHp={battle.maxHp}
            at={battle.config}
            note={phase === 'question' ? [chargingNote(rules, question?.eligibleCount ?? null, monsterOf(battle)), weakSpotNote(monsterOf(battle), question)].filter(Boolean).join(' · ') || null : null}
            size="sm"
            className="w-72"
          />
        )}
        {attack && (
          <span className="text-body-sm text-night-muted" role="status">
            {attack.correct}/{attack.eligible} correct ({Math.round(attack.accuracy)}%) · <span className="type-score text-rank-gold">−{attack.damage}</span>
            {attack.defended === true && <span className="text-success-400"> · special attack stopped</span>}
            {attack.defended === false && <span className="text-rose-400"> · counter-attack{attack.heal > 0 ? `, +${attack.heal} HP` : ''}</span>}
          </span>
        )}

        {battle?.weapon && phase !== 'podium' && <WeaponPanel client={client} state={state} weapon={battle.weapon} onChanged={() => void refresh()} />}
        {battle && phase !== 'podium' && <TeamAbilities client={client} state={state} battle={battle} onChanged={() => void refresh()} className="w-full" />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ConnectionPill status={channel} quiet surface="night" />
          {phase !== 'podium' && <ReactionsToggle client={client} sessionId={sessionId} enabled={state.session.reactionsEnabled} onChanged={refresh} />}
          <GameCommandButtons commands={commands} />
          <ButtonLink to={`/presenter/${sessionId}`} target="_blank" rel="noopener" size="sm" variant="night-ghost" leftIcon={<ExternalLink className="size-4" />} className="hidden md:inline-flex">
            Projector
          </ButtonLink>
        </div>
        {question && state.session.masteryEnabled && (phase === 'reveal' || phase === 'leaderboard') && question.mastery && !question.mastery.passed && (
          <div className="w-full">
            <MasteryBanner question={question} masteryPct={state.session.masteryPct} host={{ client, sessionId, onChanged: () => void refresh() }} size="panel" />
          </div>
        )}
        {weaponVote.vote && weaponVote.stage && (
          <VoteHostPanel
            client={client}
            sessionId={sessionId}
            vote={weaponVote.vote}
            stage={weaponVote.stage}
            tally={voteTally}
            closesInMs={weaponVote.closesIn}
            onChanged={() => void refresh()}
          />
        )}
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-label="Current question" className="ground-night min-w-0 rounded-md bg-night-950 p-5 text-night-text">
          {phase === 'podium' ? (
            <>
              {battle && <BattleResult monster={monsterOf(battle)} hp={battle.hp} maxHp={battle.maxHp} at={battle.config} size="phone" className="mb-6" />}
              <p className="type-kicker">Final results</p>
              {state.leaderboard.length > 0 ? <Podium entries={state.leaderboard} className="mt-6" /> : <p className="mt-3 text-night-muted">No questions were scored.</p>}
              <LearningReport learning={state.learning} tone="night" className="mt-8" />
            </>
          ) : question ? (
            <>
              {question.role === 'recovery' && <p className="type-kicker mb-2 text-sun-400">Recovery question · same idea as Q{question.corePosition + 1}</p>}
              <QuestionStage
              question={question}
              size="panel"
              hiddenOptionId={battle?.current?.questionId === question.id ? battle.current.hiddenOptionId : null}
            />
              {phase !== 'question' && <MisconceptionNote misconception={question.misconception} size="phone" className="mt-3" />}
            </>
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
