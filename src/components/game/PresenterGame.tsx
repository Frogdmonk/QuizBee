import { useEffect, useState, type CSSProperties } from 'react';
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
import { monsterOf } from '@/lib/battle/monster';
import { weakSpotNote } from '@/lib/monsters/reactions';
import { activeBattle, chargingNote, currentRules, modeTimer, revealAttack } from '@/lib/battle/state';
import { BattleAnnounce } from '@/components/battle/BattleAnnounce';
import { WeaponEquipStage, WeaponVoteStage } from '@/components/battle/WeaponVote';
import { WeaponPanel } from '@/components/battle/WeaponControls';
import { WeaponIcon } from '@/components/battle/WeaponIcon';
import { DraftStage, EnergyMeter, TeamAbilities } from '@/components/battle/Powerups';
import { PhaseWipe } from '@/components/world/PhaseWipe';
import { wipeFor } from '@/lib/world';
import { useWeaponVote } from '@/hooks/useWeaponVote';
import { LevelAnnounce, MasteryBanner, MisconceptionNote, ReviewScreen } from '@/components/learning/LearningScreens';
import { LEVEL_SHORT } from '@/lib/learning';
import type { QuestionLevel } from '@/types/quiz';
import { decideWeaponVote } from '@/services/battle';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import { BattleStrip } from '@/components/battle/BattleStrip';
import { BattleReveal } from '@/components/battle/BattleReveal';
import { BattleResult } from '@/components/battle/BattleResult';
import type { ArenaPlayer } from '@/components/battle/BattleArena';
import type { BattleState, GameQuestion } from '@/types/game';
import { snapshotFromState } from '@/lib/leaderboard/snapshot';
import { enterUp } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { CountRoll } from '@/components/ui/CountRoll';
import { BreathingLine } from '@/components/ui/BreathingLine';
import { Kbd } from '@/components/ui/Kbd';
import { Spinner } from '@/components/ui/Spinner';
import { Podium } from '@/components/leaderboard/Leaderboard';
import { ClimbBoard } from '@/components/leaderboard/ClimbBoard';
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
export function PresenterGame({
  client,
  sessionId,
  game,
  players = [],
}: {
  client: AppSupabaseClient;
  sessionId: string;
  game: GameController;
  /** Everyone in the session (from the lobby roster), for the battle arena. */
  players?: readonly ArenaPlayer[];
}) {
  const { state, nudge, answerCount, offset, refresh, voteTally } = game;
  const { toast } = useToast();
  // The weapon vote after a 90 % question (nudges the server when a round's time is up).
  const weaponVote = useWeaponVote(state, offset, nudge, 'primary');
  const [deciding, setDeciding] = useState(false);
  const decide = async (weapon: string | null) => {
    setDeciding(true);
    try {
      await decideWeaponVote(client, sessionId, weapon);
      await refresh();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not finish the vote', description: friendlyError(error) });
    } finally {
      setDeciding(false);
    }
  };
  useSfxOn(weaponVote.stage === 'open' && weaponVote.vote ? `vote:${weaponVote.vote.id}:${weaponVote.vote.round}` : null, 'burst');
  useSfxOn(weaponVote.stage === 'done' && weaponVote.vote ? `equip:${weaponVote.vote.id}` : null, 'victory');
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
  // The monster announces itself (first question) or its new mode.
  const rules = currentRules(state);
  const announcing = Boolean(gettingReady && rules?.announce);
  useSfxOn(announcing ? `ann:${question?.id}` : null, rules?.mode === 'rage' || rules?.mode === 'enraged' ? 'roar' : 'burst');
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
  const battle = activeBattle(state);
  const attack = revealAttack(state);
  const revealTotal = state.session.revealMs;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col gap-[2vh] py-[2vh]"
      style={{ '--rx-lane': lane ? 'clamp(7rem, 13vw, 13rem)' : '0px' } as CSSProperties}
    >
      <PhaseWipe sceneKey={`${phase}:${question?.id ?? ''}`} kind={wipeFor(phase)} />
      {/* Everything important stays left of the reaction lane. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[2vh] pr-[var(--rx-lane)]">
        <div className="flex min-h-[clamp(3rem,7.5vh,5.5rem)] shrink-0 items-center gap-3">
          {position !== null && phase !== 'podium' && (
            <ScoreBug tab="bg-signal-400" className="py-2 pr-4">
              <span className="type-score text-score-md">
                {question?.role === 'recovery' ? (
                  <>
                    Recovery <span className="text-night-muted">· Q{question.corePosition + 1}</span>
                  </>
                ) : (
                  <>
                    Q {position + 1}
                    <span className="text-night-muted"> / {state.session.questionCount}</span>
                  </>
                )}
              </span>
            </ScoreBug>
          )}
          {question?.level && phase !== 'podium' && (
            <span className="rounded-sm border border-night-rule px-3 py-1.5 text-stage-label text-night-muted uppercase">{LEVEL_SHORT[question.level as QuestionLevel]}</span>
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
                after {question?.role === 'recovery' ? 'the recovery question' : `Q${(question?.corePosition ?? position ?? 0) + 1} of ${state.session.questionCount}`}
              </span>
            </ScoreBug>
          )}
          {battle && phase === 'question' && !announcing && (
            <BattleStrip
              monster={monsterOf(battle)}
              hp={battle.hp}
              maxHp={battle.maxHp}
              at={battle.config}
              action={showHud && (rules?.mode === 'rage' || rules?.mode === 'enraged') ? 'brewing' : 'idle'}
              note={showHud ? hudNote(battle ? chargingNote(rules, question?.eligibleCount ?? null, monsterOf(battle)) : null, battle, question) : null}
              energy={battle.config.powerupsEnabled ? battle.energy : null}
              size="stage"
              className="mx-auto w-full max-w-[34rem] min-w-0 flex-1"
            />
          )}
          <div className="ml-auto flex items-center gap-4">
            {battle && battle.config.powerupsEnabled && phase === 'reveal' && <EnergyMeter energy={battle.energy} className="w-[clamp(8rem,14vw,14rem)]" />}
            {battle?.weapon && phase !== 'podium' && (
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-stage-label',
                  battle.weapon.armedAt === position ? 'border-rank-gold text-rank-gold' : 'border-night-rule text-night-muted',
                )}
                title={battle.weapon.name}
              >
                <WeaponIcon weapon={battle.weapon.key} className="size-[clamp(1.5rem,3.5vh,2.5rem)]" />
                <span className="hidden xl:inline">{battle.weapon.armedAt === position ? `${battle.weapon.specialName}!` : battle.weapon.name}</span>
              </span>
            )}
            {showHud && question && remaining <= 0 && (
              <span className="inline-flex items-center gap-3 text-stage-name text-night-muted">
                Time’s up <BreathingLine className="w-20" />
              </span>
            )}
            {showHud && question && <TimerRing remainingMs={remaining} totalSeconds={question.timeLimitSeconds} className="size-[clamp(3rem,7.5vh,5.5rem)]" />}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'question' && question && !started && battle?.current?.draft && battle.current.questionId === question.id ? (
            <m.div key={`draft-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <DraftStage weakObjectives={state.learning?.weakObjectives ?? []} remainingMs={untilStart} />
            </m.div>
          ) : phase === 'question' && question && !started && question.role === 'recovery' && question.review ? (
            <m.div key={`review-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <ReviewScreen question={question} remainingMs={untilStart} />
            </m.div>
          ) : phase === 'question' && question && !started && battle && rules?.announce ? (
            <m.div key={`announce-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <BattleAnnounce
                battle={battle}
                current={rules}
                eligible={question.eligibleCount}
                timerSeconds={modeTimer(battle, rules.mode)}
                remainingMs={untilStart}
                kicker={question.levelStart && question.level ? LEVEL_SHORT[question.level as QuestionLevel] : undefined}
              />
            </m.div>
          ) : phase === 'question' && question && !started && question.levelStart && question.level ? (
            <m.div key={`level-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <LevelAnnounce level={question.level} weakObjectives={state.learning?.weakObjectives ?? []} remainingMs={untilStart} />
            </m.div>
          ) : phase === 'question' && question && !started ? (
            <m.div key={`ready-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <GetReady number={question.position + 1} total={state.session.questionCount} remainingMs={untilStart} size="stage" />
            </m.div>
          ) : phase === 'reveal' && question && battle && weaponVote.vote && (weaponVote.stage === 'open' || weaponVote.stage === 'teacher') ? (
            <m.div key={`vote-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <WeaponVoteStage
                vote={weaponVote.vote}
                stage={weaponVote.stage}
                tally={voteTally}
                closesInMs={weaponVote.closesIn}
                host={isHost ? { busy: deciding, decide: (w) => void decide(w) } : null}
              />
            </m.div>
          ) : phase === 'reveal' && question && battle && weaponVote.vote && weaponVote.stage === 'done' ? (
            <m.div key={`equip-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <WeaponEquipStage vote={weaponVote.vote} battle={battle} players={players} />
            </m.div>
          ) : phase === 'reveal' && question && battle ? (
            <m.div key={`battle-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <BattleReveal question={question} battle={battle} attack={attack} players={players} />
            </m.div>
          ) : (phase === 'question' || phase === 'reveal') && question ? (
            <m.div key={`q-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              <QuestionStage
                question={question}
                hiddenOptionId={battle?.current?.questionId === question.id ? battle.current.hiddenOptionId : null}
                className="flex-1"
              />
              {phase === 'reveal' && <MisconceptionNote misconception={question.misconception} className="mt-[1.5vh] self-center" />}
            </m.div>
          ) : phase === 'leaderboard' ? (
            <m.div key={`board-${position}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex min-h-0 flex-1 flex-col">
              {snapshot ? (
                <ClimbBoard
                  snapshot={snapshot}
                  monster={battle ? { key: battle.monster, hp: battle.hp, maxHp: battle.maxHp, at: battle.config, spec: monsterOf(battle) } : null}
                  className="min-h-0 w-full flex-1"
                />
              ) : (
                <p className="m-auto text-stage-name text-night-muted">No scores yet.</p>
              )}
              {state.rankedCount > 10 && (
                <p className="relative z-10 mx-auto mt-[1.5vh] text-stage-name text-night-muted">
                  Top 10 of {state.rankedCount} · everyone sees their own place on their phone
                </p>
              )}
              {question && state.session.masteryEnabled && (
                <div className="relative z-10 mx-auto mt-[1.5vh] w-full max-w-5xl">
                  <MasteryBanner
                    question={question}
                    masteryPct={state.session.masteryPct}
                    host={isHost ? { client, sessionId, onChanged: () => void refresh() } : null}
                  />
                </div>
              )}
            </m.div>
          ) : phase === 'podium' ? (
            <m.div key="podium" variants={enterUp} initial="hidden" animate="show" className="flex min-h-0 flex-1 flex-col items-center">
              {battle && <BattleResult monster={monsterOf(battle)} hp={battle.hp} maxHp={battle.maxHp} at={battle.config} className="mb-[3vh] w-full max-w-5xl" />}
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
          <div className="relative z-10 flex flex-wrap items-center justify-end gap-3 border-t border-night-rule pt-3" aria-label="Teacher controls">
            {primary && (
              <span className="mr-auto hidden items-center gap-1.5 text-caption text-night-muted md:inline-flex">
                <Kbd tone="night">Space</Kbd> or <Kbd tone="night">→</Kbd>
                {commands.canBoard ? 'shows the leaderboard now' : commands.last ? 'shows the final results' : 'starts the next question'}
              </span>
            )}
            {battle && phase !== 'podium' && <TeamAbilities client={client} state={state} battle={battle} onChanged={() => void refresh()} className="mr-auto" />}
            {battle?.weapon && phase !== 'podium' && <WeaponPanel client={client} state={state} weapon={battle.weapon} onChanged={() => void refresh()} tone="compact" />}
            {phase !== 'podium' && <ReactionsToggle client={client} sessionId={sessionId} enabled={state.session.reactionsEnabled} onChanged={refresh} />}
            <GameCommandButtons commands={commands} size="md" />
          </div>
        )}
      </div>

      <ReactionLayer reactions={lane ? reactions : []} bursts={lane ? bursts : []} />
    </div>
  );
}

/** The question HUD line: the special attack, plus Time Warp and the Weakness Scanner when used. */
function hudNote(charging: string | null, battle: BattleState, question: GameQuestion | null | undefined): string | null {
  const c = battle.current && battle.current.questionId === question?.id ? battle.current : null;
  const parts = [
    charging,
    c && c.timeWarpS > 0 ? `Time Warp +${c.timeWarpS} s` : null,
    c?.topic ? `Weakness: ${c.topic}` : null,
    weakSpotNote(monsterOf(battle), question),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
