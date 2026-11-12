import { cn } from '@/lib/cn';
import { asMonster, battleStage } from '@/lib/battle/monster';
import type { MonsterSpec } from '@/lib/monsters/types';
import { battleLine } from '@/lib/monsters/personality';
import { Monster } from './Monster';
import { HpBar } from './HpBar';

/** End of the game: did the class beat the monster? */
export function BattleResult({
  monster,
  hp,
  maxHp,
  size = 'stage',
  at,
  className,
}: {
  monster: MonsterSpec | string;
  hp: number;
  maxHp: number;
  at?: { rageAt: number; enragedAt: number };
  size?: 'stage' | 'phone';
  className?: string;
}) {
  const info = asMonster(monster);
  const won = hp <= 0;
  const dealt = maxHp - hp;
  // Its last words: beaten, or (escaping) admitting the class hurt it. Never a taunt at the end.
  const line = battleLine(info.personality, won ? 'defeated' : 'classStrong', info.seed);
  return (
    <div className={cn('flex items-center gap-[2vw]', className)}>
      <Monster monster={info} stage={battleStage(hp, maxHp, at)} className={size === 'stage' ? 'size-[clamp(5rem,16vh,10rem)] shrink-0' : 'size-16 shrink-0'} />
      <div className="min-w-0 flex-1">
        <p className={cn('type-display leading-tight', size === 'stage' ? 'text-[clamp(1.5rem,4.5vh,3rem)]' : 'text-[1.5rem]')}>
          {won ? `${info.name} is defeated!` : `${info.name} escaped`}
        </p>
        <p className={cn('text-night-muted', size === 'stage' ? 'text-stage-name' : 'text-body-sm')}>
          {won ? 'The whole class brought it down together.' : `The class dealt ${dealt} of ${maxHp} damage. So close!`}
        </p>
        <p className={cn('mt-1 text-night-muted italic', size === 'stage' ? 'text-stage-name' : 'text-body-sm')}>“{line}”</p>
        {!won && <HpBar hp={hp} maxHp={maxHp} at={at} size={size === 'stage' ? 'md' : 'sm'} className="mt-2 max-w-xl" />}
      </div>
    </div>
  );
}
