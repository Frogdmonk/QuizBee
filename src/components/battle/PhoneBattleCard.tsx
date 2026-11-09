import '@/styles/battle.css';
import { m } from 'motion/react';
import { Swords } from 'lucide-react';
import { popIn } from '@/lib/motion';
import { monsterInfo, SPECIAL_ATTACK } from '@/lib/battle/monster';
import { Avatar } from '@/components/avatar/Avatar';
import type { BattleAttack } from '@/types/game';
import { HpBar } from './HpBar';

/**
 * The phone's view of the class attack after a question: did my answer hit, and how the class did.
 * Students who missed get the class result and encouragement; nobody else is named.
 */
export function PhoneBattleCard({
  attack,
  monster,
  maxHp,
  baseDamage,
  me,
}: {
  attack: BattleAttack;
  monster: string;
  maxHp: number;
  baseDamage: number;
  me: { participantId: string; avatar: string };
}) {
  const hit = attack.attackers.includes(me.participantId);
  const name = monsterInfo(monster).name;
  const defeated = attack.hpAfter === 0 && attack.hpBefore > 0;
  const special = attack.mode && attack.mode !== 'defeated' && attack.defended !== null && !defeated ? SPECIAL_ATTACK[attack.mode] : null;
  return (
    <m.div variants={popIn} initial="hidden" animate="show" className="rounded-md bg-night-900 p-4">
      <div className="flex items-center gap-3">
        <span className={hit ? 'ba-hero-phone inline-block' : 'inline-block'}>
          <Avatar code={me.avatar} mood={hit ? 'laugh' : null} className="size-12 rounded-full" />
        </span>
        <p className="min-w-0 flex-1 text-body font-bold">
          {hit ? (
            <>
              Your attack hit {name}! <span className="type-score text-rank-gold">−{baseDamage}</span>
            </>
          ) : (
            <>Your class hit {name}. The next question is your chance.</>
          )}
        </p>
        <Swords className="size-6 shrink-0 text-rank-gold" aria-hidden />
      </div>
      <p className="mt-3 text-body-sm text-night-muted">
        {attack.correct} of {attack.eligible} got it right · class damage{' '}
        <span className="type-score text-night-text">−{attack.damage}</span>
      </p>
      {special && (
        <p className={attack.defended ? 'mt-2 text-body-sm font-bold text-success-400' : 'mt-2 text-body-sm font-bold text-rose-400'}>
          {attack.defended
            ? `Your class stopped the ${special.name}!`
            : `The ${special.name} hit back (${attack.targetCount} needed)${attack.heal > 0 ? `: ${name} healed ${attack.heal} HP` : ''}.`}
        </p>
      )}
      {attack.energyGain > 0 && <p className="mt-2 text-body-sm font-semibold text-sun-400">+{attack.energyGain} team energy</p>}
      <HpBar hp={attack.hpAfter} maxHp={maxHp} size="sm" className="mt-2" />
      {defeated && <p className="mt-3 text-body font-bold text-success-400">{name} is defeated! Great teamwork.</p>}
    </m.div>
  );
}
