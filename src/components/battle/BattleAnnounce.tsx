import { cn } from '@/lib/cn';
import { MODE_TITLE, SPECIAL_ATTACK, battleStage, monsterInfo } from '@/lib/battle/monster';
import type { BattleCurrent, BattleState } from '@/types/game';
import { Monster } from './Monster';
import { HpBar } from './HpBar';

/** The rule of the current question in one line: "18 of 30 must answer correctly to stop the Riddle Roar". */
function targetLine(current: BattleCurrent, eligible: number | null): string | null {
  if (current.mode === 'defeated' || current.targetCount === null) return null;
  const special = SPECIAL_ATTACK[current.mode];
  return eligible !== null
    ? `${current.targetCount} of ${eligible} must answer correctly to stop the ${special.name}`
    : `${current.targetPct}% must answer correctly to stop the ${special.name}`;
}

/**
 * Before the first question, and whenever the monster changes mode: the monster, what it is about
 * to do, and what the class has to do about it. Shown during the 5 s the server holds the question
 * back, with the countdown.
 */
export function BattleAnnounce({
  battle,
  current,
  eligible,
  timerSeconds,
  remainingMs,
  size = 'stage',
  kicker,
}: {
  battle: BattleState & { maxHp: number; hp: number };
  current: BattleCurrent;
  eligible: number | null;
  timerSeconds: number | null;
  remainingMs: number;
  size?: 'stage' | 'phone';
  /** e.g. "Level 2" when a new level starts with this question. */
  kicker?: string;
}) {
  const info = monsterInfo(battle.monster);
  const announce = current.announce ?? 'intro';
  const stage = battleStage(battle.hp, battle.maxHp, battle.config);
  const special = current.mode !== 'defeated' ? SPECIAL_ATTACK[current.mode] : null;
  const rule = targetLine(current, eligible);
  const stageSize = size === 'stage';
  const angry = current.mode === 'rage' || current.mode === 'enraged';
  return (
    <div className={cn('bx-announce flex flex-1 items-center', stageSize ? 'gap-[4vw]' : 'flex-col gap-4 text-center')} role="status">
      <Monster stage={stage} action={angry ? 'brewing' : 'idle'} className={stageSize ? 'size-[min(46vh,30vw)] shrink-0' : 'size-36'} />
      <div className="min-w-0 flex-1">
        <p className={cn('type-kicker', angry ? 'text-rose-400' : 'text-night-muted', stageSize && 'text-stage-label')}>
          {kicker ? `${kicker} · ` : ''}
          {announce === 'intro' ? 'Boss battle' : 'The monster changes'}
        </p>
        <h2 className={cn('type-display', stageSize ? 'mt-2 text-[clamp(2.5rem,8vh,6rem)]' : 'mt-1 text-[2rem]', 'leading-[1.05]')}>
          {info.name} {MODE_TITLE[announce]}
        </h2>
        {announce === 'intro' && (
          <p className={cn('text-night-muted', stageSize ? 'mt-3 text-stage-name' : 'mt-2 text-body')}>
            Every correct answer hits it. Bring its {battle.maxHp} HP down together.
          </p>
        )}
        {special && rule && (
          <p className={cn('font-semibold', stageSize ? 'mt-[3vh] text-[clamp(1.25rem,3.4vh,2.25rem)]' : 'mt-3 text-body')}>
            It {special.verb} every question: {rule}.
          </p>
        )}
        {timerSeconds !== null && (
          <p className={cn('text-night-muted', stageSize ? 'mt-2 text-stage-name' : 'mt-1 text-body-sm')}>{timerSeconds} seconds per question.</p>
        )}
        {stageSize && <HpBar hp={battle.hp} maxHp={battle.maxHp} at={battle.config} size="md" className="mt-[3vh] max-w-xl" />}
        <p className={cn('type-score', stageSize ? 'mt-[3vh] text-[clamp(2rem,6vh,4rem)]' : 'mt-3 text-[2rem]')} aria-label="Question starts in">
          {Math.max(1, Math.ceil(remainingMs / 1000))}
        </p>
      </div>
    </div>
  );
}
