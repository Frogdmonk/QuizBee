import { cn } from '@/lib/cn';
import { battleStage, monsterInfo } from '@/lib/battle/monster';
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
  monster: string;
  hp: number;
  maxHp: number;
  at?: { rageAt: number; enragedAt: number };
  size?: 'stage' | 'phone';
  className?: string;
}) {
  const info = monsterInfo(monster);
  const won = hp <= 0;
  const dealt = maxHp - hp;
  return (
    <div className={cn('flex items-center gap-[2vw]', className)}>
      <Monster stage={battleStage(hp, maxHp, at)} className={size === 'stage' ? 'size-[clamp(5rem,16vh,10rem)] shrink-0' : 'size-16 shrink-0'} />
      <div className="min-w-0 flex-1">
        <p className={cn('type-display leading-tight', size === 'stage' ? 'text-[clamp(1.5rem,4.5vh,3rem)]' : 'text-[1.5rem]')}>
          {won ? `${info.name} is defeated!` : `${info.name} escaped`}
        </p>
        <p className={cn('text-night-muted', size === 'stage' ? 'text-stage-name' : 'text-body-sm')}>
          {won ? 'The whole class brought it down together.' : `The class dealt ${dealt} of ${maxHp} damage. So close!`}
        </p>
        {!won && <HpBar hp={hp} maxHp={maxHp} at={at} size={size === 'stage' ? 'md' : 'sm'} className="mt-2 max-w-xl" />}
      </div>
    </div>
  );
}
