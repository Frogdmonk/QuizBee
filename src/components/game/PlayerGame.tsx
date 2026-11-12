import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, Flame, ImageIcon } from 'lucide-react';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { GameController } from '@/hooks/useGameState';
import { useCountdown } from '@/hooks/useCountdown';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useReactions, type LiveReaction } from '@/hooks/useReactions';
import { EmotePanel } from '@/components/reactions/EmotePanel';
import { ClassReactions } from '@/components/reactions/ClassReactions';
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
import { CodeBlock } from '@/components/code/CodeBlock';
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
import { monsterOf } from '@/lib/battle/monster';
import { weakSpotNote } from '@/lib/monsters/reactions';
import { activeBattle, chargingNote, currentRules, modeTimer, revealAttack } from '@/lib/battle/state';
import { BattleAnnounce } from '@/components/battle/BattleAnnounce';
import { PhoneWeaponVote } from '@/components/battle/PhoneWeaponVote';
import { PhoneDraft, PhonePowerup } from '@/components/battle/Powerups';
import { worldMood } from '@/lib/world';
import { useWeaponVote } from '@/hooks/useWeaponVote';
import { LevelAnnounce, MisconceptionNote, ReviewScreen } from '@/components/learning/LearningScreens';
import { PhoneBattleCard } from '@/components/battle/PhoneBattleCard';
import { BattleResult } from '@/components/battle/BattleResult';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The student's phone during a game: answer, lock in, see the result and their own rank. */
/** Emotes for a phone during the game: never shown while the player still has to answer. */
function GameEmotes({ client, game, reactions, meId }: { client: AppSupabaseClient; game: GameController; reactions: LiveReaction[]; meId: string }) {
  const state = game.state;
  if (!state) return null;
  return (
    <div className="mt-auto space-y-2 pt-2">
      <ClassReactions reactions={reactions} meId={meId} />
      <EmotePanel client={client} sessionId={state.session.id} enabled={state.session.reactionsEnabled} />
    </div>
  );
}

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
  const revealing = state?.session.phase === 'reveal' && Boolean(question?.boardAt);
  const boardIn = useCountdown(question?.boardAt ?? null, offset, revealing);
  useAutoAdvance(state, remaining, false, nudge, 'backup', revealing ? boardIn : Number.POSITIVE_INFINITY);
  const { reactions } = useReactions(client, state?.session.id, offset);
  const weaponVote = useWeaponVote(state, offset, nudge, 'backup');

  if (!state || !state.me) {
    return (
      <div className="grid flex-1 place-items-center text-night-muted">
        <Spinner className="size-8" label="Loading the game" />
      </div>
    );
  }

  const me = state.me;
  const phase = state.session.phase;
  const battle = activeBattle(state);
  const attack = revealAttack(state);
  const rules = currentRules(state);
  const pickedHere = picked?.questionId === question?.id ? picked : null;
  const myPick = question && (pickedHere?.optionId ?? me.answerOptionId ?? null);
  const powerup = me.powerup;
  // A Revival Crystal armed for this question allows one changed answer.
  const revival = Boolean(question && powerup?.state === 'armed' && powerup.chosen === 'revival' && powerup.armedQuestionId === question.id);
  const draftHere = Boolean(question && battle?.current?.draft && battle.current.questionId === question.id);
  const hidden = battle?.current && question && battle.current.questionId === question.id ? battle.current.hiddenOptionId : null;

  const answer = async (optionId: string) => {
    if (!question || (myPick && !revival) || optionId === myPick) return;
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
    <div className="relative isolate flex flex-1 flex-col gap-4 py-4">
      {battle && <div aria-hidden className="phone-mood pointer-events-none fixed inset-0 -z-10" data-mood={worldMood(state)} />}
      <ScoreBug tab="bg-signal-400" className="w-full">
        {state.session.currentPosition !== null && phase !== 'podium' && (
          <span className="type-score text-score-sm">
            {question?.role === 'recovery' ? `Recovery · Q${question.corePosition + 1}` : `Q ${state.session.currentPosition + 1}/${state.session.questionCount}`}
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
        {phase === 'question' && question && !started && draftHere && powerup ? (
          <m.div key={`draft-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col">
            <PhoneDraft client={client} sessionId={state.session.id} powerup={powerup} onChanged={() => void refresh()} />
          </m.div>
        ) : phase === 'question' && question && !started && question.role === 'recovery' && question.review ? (
          <m.div key={`review-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col">
            <ReviewScreen question={question} remainingMs={untilStart} size="phone" />
          </m.div>
        ) : phase === 'question' && question && !started && question.levelStart && question.level && !(battle && rules?.announce) ? (
          <m.div key={`level-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col">
            <LevelAnnounce level={question.level} weakObjectives={state.learning?.weakObjectives ?? []} remainingMs={untilStart} size="phone" />
          </m.div>
        ) : phase === 'question' && question && !started && battle && rules?.announce ? (
          <m.div key={`announce-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col">
            <BattleAnnounce
              battle={battle}
              current={rules}
              eligible={question.eligibleCount}
              timerSeconds={modeTimer(battle, rules.mode)}
              remainingMs={untilStart}
              size="phone"
            />
          </m.div>
        ) : phase === 'question' && question && !started ? (
          <m.div key={`ready-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col">
            <GetReady number={question.position + 1} total={state.session.questionCount} remainingMs={untilStart} />
          </m.div>
        ) : phase === 'question' && question ? (
          <m.div key={`q-${question.id}`} variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col gap-4">
            {battle && chargingNote(rules, question.eligibleCount, monsterOf(battle)) && (
              <p className="-mb-2 text-caption font-semibold text-rose-400">{chargingNote(rules, question.eligibleCount, monsterOf(battle))}</p>
            )}
            {battle && weakSpotNote(monsterOf(battle), question) && (
              <p className="-mb-2 text-caption font-semibold text-sun-400">{weakSpotNote(monsterOf(battle), question)}</p>
            )}
            <p className="type-headline text-pretty text-[1.375rem] leading-snug break-words">{question.prompt}</p>
            {question.imagePath && (
              <img src={mediaUrl(question.imagePath) ?? undefined} alt="" className="max-h-40 w-full rounded-md bg-night-900 object-contain" />
            )}
            {/* Code scrolls sideways rather than shrinking, so indentation stays readable. */}
            {question.code && <CodeBlock code={question.code} size="phone" className="max-h-[42dvh] shrink-0" />}
            {open && <Countdown remainingMs={remaining} totalSeconds={question.timeLimitSeconds} />}

            <div className={cn('grid gap-2', question.type === 'image_choice' && 'grid-cols-2')} role="group" aria-label="Answers">
              {question.options.map((o, i) => {
                const mine = myPick === o.id;
                const locked = Boolean(myPick) && !revival;
                const removed = hidden === o.id;
                const style = answerStyle(i);
                return (
                  <m.button
                    key={o.id}
                    type="button"
                    disabled={locked || removed || !open || !started || remaining <= 0}
                    aria-label={removed ? `${o.label || `Answer ${style.letter}`} (removed by Knowledge Reveal)` : undefined}
                    onClick={() => void answer(o.id)}
                    aria-pressed={mine}
                    animate={removed ? { scale: 0.96, opacity: 0.15 } : locked ? (mine ? { scale: 0.97, opacity: 1 } : { scale: 1, opacity: 0.35 }) : { scale: 1, opacity: 1 }}
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
                      <AnswerTile index={i} label={o.label} code={o.isCode} size="phone" state={mine ? 'yourpick' : 'rest'} />
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
            {powerup?.state === 'offered' && draftHere && (
              <PhoneDraft client={client} sessionId={state.session.id} powerup={powerup} onChanged={() => void refresh()} />
            )}
            {powerup && powerup.state !== 'offered' && started && open && (
              <PhonePowerup
                client={client}
                sessionId={state.session.id}
                powerup={powerup}
                question={question}
                answered={Boolean(myPick)}
                onChanged={() => void refresh()}
              />
            )}
            {myPick ? (
              <m.div variants={popIn} initial="hidden" animate="show" className="mt-auto">
                <LowerThird surface="night" tab="bg-volt-400" className="w-full">
                  <Check className="size-4" aria-hidden /> Locked in · waiting for the others
                </LowerThird>
                {me.answerOptionId && <GameEmotes client={client} game={game} reactions={reactions} meId={me.participantId} />}
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
            {weaponVote.vote && weaponVote.stage && weaponVote.stage !== 'pending' ? (
              <PhoneWeaponVote
                client={client}
                vote={weaponVote.vote}
                stage={weaponVote.stage}
                closesInMs={weaponVote.closesIn}
                myChoice={me.vote && me.vote.voteId === weaponVote.vote.id && me.vote.round === weaponVote.vote.round ? me.vote.choice : null}
                onVoted={() => void refresh()}
              />
            ) : (
              <>
                <RevealCard me={me} question={question} compact={Boolean(attack)} />
                <MisconceptionNote misconception={question.misconception} size="phone" />
                {battle && attack && (
                  <PhoneBattleCard attack={attack} monster={monsterOf(battle)} maxHp={battle.maxHp} baseDamage={attack.perHit ?? battle.baseDamage} me={me} />
                )}
                {weaponVote.vote && weaponVote.stage === 'pending' && (
                  <PhoneWeaponVote client={client} vote={weaponVote.vote} stage="pending" closesInMs={weaponVote.closesIn} myChoice={null} onVoted={() => void refresh()} />
                )}
              </>
            )}
            {revealing && (
              <p className="text-caption font-semibold tracking-[0.06em] text-night-muted uppercase" role="status">
                Leaderboard in {Math.max(1, Math.ceil(boardIn / 1000))}
              </p>
            )}
            <GameEmotes client={client} game={game} reactions={reactions} meId={me.participantId} />
          </m.div>
        ) : phase === 'leaderboard' ? (
          <m.div key="board" variants={enterUp} initial="hidden" animate="show" exit="exit" className="flex flex-1 flex-col gap-5">
            <RankCard me={me} total={state.rankedCount} />
            <Leaderboard snapshot={snapshotFromState(state)} variant="compact" highlightId={me.participantId} />
            <GameEmotes client={client} game={game} reactions={reactions} meId={me.participantId} />
          </m.div>
        ) : phase === 'podium' ? (
          <m.div key="final" variants={enterUp} initial="hidden" animate="show" className="flex flex-1 flex-col gap-5">
            <p className="type-kicker">Final results</p>
            {battle && <BattleResult monster={monsterOf(battle)} hp={battle.hp} maxHp={battle.maxHp} at={battle.config} size="phone" />}
            <RankCard me={me} total={state.rankedCount} final />
            <Leaderboard snapshot={snapshotFromState(state)} variant="compact" highlightId={me.participantId} />
            <GameEmotes client={client} game={game} reactions={reactions} meId={me.participantId} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function RevealCard({ me, question, compact = false }: { me: GameMe; question: GameQuestion; compact?: boolean }) {
  const correctIndex = question.options.findIndex((o) => o.id === question.correctOptionId);
  const letter = correctIndex >= 0 ? answerStyle(correctIndex).letter : '';
  if (me.lastCorrect) {
    return (
      <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2' : 'flex-1 gap-4')}>
        <m.span
          variants={popIn}
          initial="hidden"
          animate="show"
          className={cn('grid place-items-center rounded-full bg-success-400 text-night-950', compact ? 'size-16' : 'size-24')}
        >
          <Check className={compact ? 'size-8' : 'size-12'} strokeWidth={3} aria-hidden />
        </m.span>
        <p className="type-display text-display-lg">Correct!</p>
        <p className="type-score text-score-xl text-success-400">
          +<CountRoll value={me.lastPoints ?? 0} />
        </p>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2' : 'flex-1 gap-4')}>
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
