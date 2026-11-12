import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { asMonster, battleStage, STAGE_LABEL } from '@/lib/battle/monster';
import type { MonsterSpec } from '@/lib/monsters/types';
import { Monster, type MonsterAction } from './Monster';
import { EnergyMeter } from './Powerups';
import { HpBar } from './HpBar';

/** A compact monster + health line: the projector during questions, the host screen and phones. */
export function BattleStrip({
  monster,
  hp,
  maxHp,
  size = 'md',
  action = 'idle',
  at,
  note,
  energy,
  className,
}: {
  monster: MonsterSpec | string;
  hp: number;
  maxHp: number;
  size?: 'sm' | 'md' | 'stage';
  action?: MonsterAction;
  at?: { rageAt: number; enragedAt: number };
  /** A line under the bar, e.g. what the class must do to stop the special attack. */
  note?: ReactNode;
  /** Team energy (0–100), when power-ups are on. */
  energy?: number | null;
  className?: string;
}) {
  const stage = battleStage(hp, maxHp, at);
  const info = asMonster(monster);
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Monster
        monster={info}
        hpFraction={maxHp ? hp / maxHp : null}
        stage={stage}
        action={action}
        className={cn('shrink-0', size === 'stage' ? 'size-[clamp(3rem,7vh,5.5rem)]' : size === 'md' ? 'size-12' : 'size-9')}
        label={`${info.name}, ${STAGE_LABEL[stage].toLowerCase()}`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-baseline gap-2 font-bold', size === 'stage' ? 'text-stage-label' : 'text-caption')}>
          <span className="truncate">{info.name}</span>
          {stage !== 'normal' && (
            <span className={cn('rounded-xs px-1.5 uppercase', stage === 'defeated' ? 'bg-success-400 text-night-950' : 'bg-rose-500 text-white')}>
              {STAGE_LABEL[stage]}
            </span>
          )}
        </p>
        <HpBar hp={hp} maxHp={maxHp} at={at} size={size === 'stage' ? 'md' : 'sm'} className="mt-1" />
        {energy !== null && energy !== undefined && <EnergyMeter energy={energy} size={size === 'stage' ? 'stage' : 'sm'} className="mt-1" />}
        {note && <p className={cn('mt-1 font-semibold text-rose-400', size === 'stage' ? 'text-[clamp(0.85rem,1.9vh,1.25rem)]' : 'text-caption')}>{note}</p>}
      </div>
    </div>
  );
}
