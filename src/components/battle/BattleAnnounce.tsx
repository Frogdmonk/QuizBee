import { cn } from '@/lib/cn';
import { MODE_TITLE, battleStage, monsterOf, specialAttack } from '@/lib/battle/monster';
import { battleLine } from '@/lib/monsters/personality';
import { weaknessText } from '@/lib/monsters/reactions';
import type { BattleCurrent, BattleState } from '@/types/game';
import { Monster } from './Monster';
import { HpBar } from './HpBar';

/** The rule of the current question, after "Every question it charges its …": "18 of 30 must answer correctly to stop it". */
function targetLine(current: BattleCurrent, eligible: number | null): string | null {
  if (current.mode === 'defeated' || current.targetCount === null) return null;
  return eligible !== null
    ? `${current.targetCount} of ${eligible} must answer correctly to stop it`
    : `${current.targetPct}% must answer correctly to stop it`;
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
  const info = monsterOf(battle);
  const announce = current.announce ?? 'intro';
  const stage = battleStage(battle.hp, battle.maxHp, battle.config);
  const special = current.mode !== 'defeated' ? specialAttack(info, current.mode) : null;
  const rule = targetLine(current, eligible);
  const stageSize = size === 'stage';
  const angry = current.mode === 'rage' || current.mode === 'enraged';
  // Its first appearance: it rises from the ground and introduces itself. A change of mode: it rages.
  const line = battleLine(info.personality, announce === 'intro' ? 'intro' : angry ? 'rage' : 'classStrong', info.seed);
  return (
    <div className={cn('bx-announce flex flex-1 items-center', stageSize ? 'gap-[4vw]' : 'flex-col gap-4 text-center')} role="status">
      <Monster
        monster={info}
        stage={stage}
        hpFraction={battle.hp / battle.maxHp}
        action={angry ? 'brewing' : 'idle'}
        className={cn(stageSize ? 'size-[min(46vh,30vw)] shrink-0' : 'size-36', announce === 'intro' && 'mon-spawn')}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('type-kicker', angry ? 'text-rose-400' : 'text-night-muted', stageSize && 'text-stage-label')}>
          {kicker ? `${kicker} · ` : ''}
          {announce === 'intro' ? 'Boss battle' : 'The monster changes'}
        </p>
        <h2 className={cn('type-display', stageSize ? 'mt-2 text-[clamp(2.5rem,8vh,6rem)]' : 'mt-1 text-[2rem]', 'leading-[1.05]')}>
          {info.name} {MODE_TITLE[announce]}
        </h2>
        <p className={cn('italic', angry ? 'text-rose-300' : 'text-night-muted', stageSize ? 'mt-2 text-stage-name' : 'mt-1 text-body')}>“{line}”</p>
        {announce === 'intro' && (
          <>
            <p className={cn('text-night-muted', stageSize ? 'mt-3 text-stage-name' : 'mt-2 text-body')}>
              Every correct answer hits it. Bring its {battle.maxHp} HP down together.
            </p>
            <p className={cn('font-semibold text-sun-400', stageSize ? 'mt-2 text-stage-name' : 'mt-1 text-body-sm')}>Weak to: {weaknessText(info)}</p>
          </>
        )}
        {special && rule && (
          <p className={cn('font-semibold', stageSize ? 'mt-[3vh] text-[clamp(1.25rem,3.4vh,2.25rem)]' : 'mt-3 text-body')}>
            Every question it charges its {special}: {rule}.
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
