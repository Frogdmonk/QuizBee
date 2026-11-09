import { useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { decideWeaponVote, activateWeaponSpecial } from '@/services/battle';
import { friendlyError } from '@/utils/errors';
import { weaponArt } from '@/lib/battle/weapons';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { VoteTally } from '@/hooks/useGameState';
import type { VoteStage } from '@/hooks/useWeaponVote';
import type { EquippedWeapon, GameState, WeaponVote } from '@/types/game';
import { specialStatus } from '@/lib/battle/state';
import { WeaponIcon } from './WeaponIcon';

/** The class weapon and its special, for the teacher. */
export function WeaponPanel({
  client,
  state,
  weapon,
  onChanged,
  tone = 'night',
  className,
}: {
  client: AppSupabaseClient;
  state: GameState;
  weapon: EquippedWeapon;
  onChanged: () => void;
  tone?: 'night' | 'compact';
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const s = specialStatus(state, weapon);
  const use = async () => {
    setBusy(true);
    try {
      await activateWeaponSpecial(client, state.session.id);
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: `Could not use ${weapon.specialName}`, description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };
  const armed = weapon.armedAt !== null && weapon.armedAt === s.target;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <WeaponIcon weapon={weapon.key} className="size-9 shrink-0" title={weapon.name} />
      <div className="min-w-0">
        <p className="truncate text-body-sm font-bold">
          {weapon.name}{' '}
          <span className="font-normal text-night-muted" aria-label={`${weapon.chargesLeft} of ${weapon.charges} charges left`}>
            {'●'.repeat(weapon.chargesLeft)}
            {'○'.repeat(Math.max(0, weapon.charges - weapon.chargesLeft))}
          </span>
        </p>
        {tone === 'night' && <p className="truncate text-caption text-night-muted">{s.reason}</p>}
      </div>
      <Button
        size="sm"
        variant={armed ? 'night-ghost' : 'primary'}
        disabled={!s.can || busy}
        loading={busy}
        onClick={() => void use()}
        leftIcon={<Zap className="size-4" />}
        title={s.reason}
        style={armed ? { boxShadow: `0 0 16px -2px ${weaponArt(weapon.key)?.glow}` } : undefined}
      >
        {armed ? `${weapon.specialName} armed` : weapon.specialName}
      </Button>
    </div>
  );
}

/** The teacher's view of a weapon vote: live counts, and the override (choose / cancel). */
export function VoteHostPanel({
  client,
  sessionId,
  vote,
  stage,
  tally,
  closesInMs,
  onChanged,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  vote: WeaponVote;
  stage: VoteStage;
  tally: VoteTally | null;
  closesInMs: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const live = tally && tally.voteId === vote.id && tally.round === vote.round ? tally : null;
  const counts = live?.counts ?? vote.counts ?? {};
  const total = live?.total ?? vote.ballots;
  const decide = async (weapon: string | null) => {
    setBusy(true);
    try {
      await decideWeaponVote(client, sessionId, weapon);
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: 'Could not finish the vote', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };
  const unresolved = stage === 'pending' || stage === 'open' || stage === 'teacher';
  return (
    <div className="w-full rounded-md border border-night-rule p-3" role="status">
      <p className="text-body-sm font-bold">
        {stage === 'teacher'
          ? 'Tie: you choose the weapon'
          : stage === 'pending'
            ? 'Weapon unlocked: the vote opens after the attack'
            : stage === 'open'
              ? `Weapon vote${vote.round === 2 ? ' (runoff)' : ''} · ${total} of ${vote.voters} voted · ${Math.max(0, Math.ceil(closesInMs / 1000))} s`
              : stage === 'done'
                ? `${vote.offered.find((w) => w.key === vote.winner)?.name ?? ''} equipped`
                : 'Vote cancelled'}
      </p>
      {unresolved && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {vote.offered.map((w) => (
            <Button key={w.key} size="sm" variant={stage === 'teacher' && vote.options.includes(w.key) ? 'primary' : 'night-ghost'} disabled={busy} onClick={() => void decide(w.key)}>
              <WeaponIcon weapon={w.key} className="size-5" />
              {w.name}
              {counts[w.key] !== undefined && <span className="type-score">· {counts[w.key]}</span>}
            </Button>
          ))}
          <Button size="sm" variant="night-ghost" disabled={busy} onClick={() => void decide(null)}>
            Cancel vote
          </Button>
        </div>
      )}
    </div>
  );
}
