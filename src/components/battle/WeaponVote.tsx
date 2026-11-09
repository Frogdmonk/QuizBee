import { cn } from '@/lib/cn';
import { RARITY_COLOR, RARITY_LABEL, weaponArt } from '@/lib/battle/weapons';
import type { VoteTally } from '@/hooks/useGameState';
import type { VoteStage } from '@/hooks/useWeaponVote';
import { Button } from '@/components/ui/Button';
import type { BattleState, WeaponInfo, WeaponVote } from '@/types/game';
import { WeaponIcon } from './WeaponIcon';
import { BattleArena, type ArenaPlayer } from './BattleArena';

export function RarityChip({ rarity, className }: { rarity: WeaponInfo['rarity']; className?: string }) {
  const [bg, fg] = RARITY_COLOR[rarity];
  return (
    <span className={cn('inline-block rounded-xs px-2 py-0.5 text-[0.75em] font-bold tracking-[0.06em] uppercase', className)} style={{ background: bg, color: fg }}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}

/** One weapon: art, name, rarity, what it does, and (in a vote) its share of the votes. */
export function WeaponCard({
  weapon,
  votes,
  total,
  out = false,
  winner = false,
  size = 'stage',
  className,
  children,
}: {
  weapon: WeaponInfo;
  votes?: number | null;
  total?: number;
  /** Not in this round (a runoff between other weapons). */
  out?: boolean;
  winner?: boolean;
  size?: 'stage' | 'phone';
  className?: string;
  children?: React.ReactNode;
}) {
  const art = weaponArt(weapon.key);
  const stage = size === 'stage';
  const share = votes != null && total ? votes / total : 0;
  return (
    <div
      className={cn(
        'wx-card relative flex min-w-0 flex-col rounded-lg border-2 bg-night-900 text-night-text transition-opacity',
        stage ? 'gap-[1.2vh] p-[2vh]' : 'gap-2 p-3',
        out && 'opacity-35',
        winner ? 'border-rank-gold' : 'border-night-rule',
        className,
      )}
      style={{ boxShadow: winner || !out ? `0 0 ${stage ? 28 : 14}px -8px ${art?.glow ?? '#fff'}` : undefined }}
    >
      <div className={cn('flex items-center', stage ? 'gap-[1.2vw]' : 'gap-3')}>
        <span className={cn('grid shrink-0 place-items-center rounded-md bg-night-950', stage ? 'size-[clamp(4rem,11vh,7.5rem)]' : 'size-14')}>
          <WeaponIcon weapon={weapon.key} className={stage ? 'size-[78%]' : 'size-10'} />
        </span>
        <div className="min-w-0">
          <RarityChip rarity={weapon.rarity} className={stage ? 'text-[clamp(0.8rem,1.6vh,1.1rem)]' : 'text-caption'} />
          <p className={cn('type-display mt-1 truncate', stage ? 'text-[clamp(1.4rem,3.6vh,2.5rem)]' : 'text-[1.25rem]', 'leading-tight')}>{weapon.name}</p>
        </div>
      </div>
      <p className={cn('text-night-muted', stage ? 'text-[clamp(0.85rem,1.7vh,1.2rem)]' : 'text-caption')}>{weapon.description}</p>
      <p className={stage ? 'text-[clamp(0.9rem,1.85vh,1.25rem)]' : 'text-body-sm'}>
        <span className="font-bold" style={{ color: art?.color }}>
          Always:
        </span>{' '}
        {weapon.passive}
      </p>
      <p className={stage ? 'text-[clamp(0.9rem,1.85vh,1.25rem)]' : 'text-body-sm'}>
        <span className="font-bold" style={{ color: art?.color }}>
          {weapon.specialName}
        </span>{' '}
        ({weapon.charges}×): {weapon.special}
      </p>
      {votes != null && (
        <div className="mt-auto pt-1">
          <div className={cn('overflow-hidden rounded-full bg-night-800', stage ? 'h-[clamp(0.6rem,1.4vh,1rem)]' : 'h-2')}>
            <span className="block h-full transition-[width] duration-300" style={{ width: `${Math.round(share * 100)}%`, background: art?.color ?? '#fff' }} />
          </div>
          <p className={cn('type-score mt-1', stage ? 'text-[clamp(1rem,2.4vh,1.6rem)]' : 'text-body-sm')}>
            {votes} {votes === 1 ? 'vote' : 'votes'}
          </p>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The projector during a weapon vote: the unlock announcement, the three weapons with live vote
 * bars (the host topic's tallies), the countdown, and, for the teacher's own projector, the
 * override buttons.
 */
export function WeaponVoteStage({
  vote,
  stage,
  tally,
  closesInMs,
  host,
}: {
  vote: WeaponVote;
  stage: VoteStage;
  tally: VoteTally | null;
  closesInMs: number;
  /** The teacher's controls, when the viewer is the host. */
  host?: { busy: boolean; decide: (weapon: string | null) => void } | null;
}) {
  const live = tally && tally.voteId === vote.id && tally.round === vote.round ? tally : null;
  const counts = live?.counts ?? vote.counts ?? (vote.round === 2 ? null : vote.round1Counts);
  const total = live?.total ?? vote.ballots;
  const runoff = vote.round === 2;
  const teacher = stage === 'teacher';
  return (
    <div className="wx-stage relative flex min-h-0 flex-1 flex-col gap-[2vh]">
      {/* Countdown and the teacher's cancel, out of the way of the cards. */}
      <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
        {stage === 'open' && (
          <p className="type-score text-[clamp(2rem,6vh,4rem)] leading-none" aria-label="Seconds left to vote">
            {Math.max(0, Math.ceil(closesInMs / 1000))}
          </p>
        )}
        {host && (
          <Button size="sm" variant="night-ghost" disabled={host.busy} onClick={() => host.decide(null)}>
            Cancel vote
          </Button>
        )}
      </div>
      <div className="wx-title px-[8vw] text-center">
        <p className="type-kicker text-[clamp(0.9rem,2vh,1.4rem)] text-rank-gold">
          {teacher ? 'Still a tie' : runoff ? 'It’s a tie!' : 'Incredible teamwork!'}
        </p>
        <h2 className="type-display mt-[0.5vh] text-[clamp(1.75rem,5.5vh,4rem)] leading-[1.05]">
          {teacher
            ? 'Your teacher chooses the weapon'
            : runoff
              ? 'Runoff vote: choose again'
              : 'A legendary weapon has been unlocked!'}
        </h2>
        <p className="mt-[0.8vh] text-stage-name text-night-muted">
          {teacher
            ? total === 0
              ? 'Nobody voted this time.'
              : 'The class is split right down the middle.'
            : `Vote on your phone · one vote each · ${total} of ${vote.voters} voted`}
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.5vw]">
        {vote.offered.map((w) => (
          <WeaponCard key={w.key} weapon={w} votes={counts ? (counts[w.key] ?? 0) : vote.options.includes(w.key) ? 0 : null} total={total} out={!vote.options.includes(w.key)}>
            {host && (teacher || stage === 'open') && (
              <Button size="sm" variant={teacher ? 'primary' : 'night-ghost'} disabled={host.busy} onClick={() => host.decide(w.key)} className="mt-1">
                Choose for the class
              </Button>
            )}
          </WeaponCard>
        ))}
      </div>
    </div>
  );
}

/** The result: the chosen weapon appears in every student's hand in the arena. */
export function WeaponEquipStage({
  vote,
  battle,
  players,
}: {
  vote: WeaponVote;
  battle: BattleState;
  players: readonly ArenaPlayer[];
}) {
  const w = vote.offered.find((o) => o.key === vote.winner);
  if (!w) return null;
  const votes = vote.counts?.[w.key];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh]">
      <div className="wx-equip flex items-center justify-center gap-[2vw]">
        <WeaponIcon weapon={w.key} className="wx-spin size-[clamp(4rem,12vh,8rem)]" />
        <div>
          <RarityChip rarity={w.rarity} className="text-[clamp(0.8rem,1.6vh,1.1rem)]" />
          <h2 className="type-display mt-1 text-[clamp(2rem,6vh,4.5rem)] leading-none">{w.name} equipped!</h2>
          <p className="mt-[0.8vh] text-stage-name text-night-muted">
            {vote.decidedBy === 'teacher'
              ? 'Chosen by your teacher.'
              : `${votes ?? 0} ${votes === 1 ? 'vote' : 'votes'}${vote.decidedBy === 'runoff' ? ' in the runoff' : ''}.`}{' '}
            Always: {w.passive} {w.specialName}: {w.special}
          </p>
        </div>
      </div>
      <BattleArena
        battle={battle}
        players={players}
        attack={null}
        weapon={w.key}
        equipping
        className="min-h-0 flex-1 rounded-lg border border-night-rule bg-[radial-gradient(ellipse_at_70%_60%,rgb(255_255_255/0.06),transparent_60%)]"
      />
    </div>
  );
}
