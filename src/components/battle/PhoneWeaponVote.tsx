import { useEffect, useState } from 'react';
import { buzz } from '@/lib/haptics';
import { m } from 'motion/react';
import { Check } from 'lucide-react';
import { popIn } from '@/lib/motion';
import { castWeaponVote } from '@/services/battle';
import { friendlyError } from '@/utils/errors';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { VoteStage } from '@/hooks/useWeaponVote';
import type { WeaponVote } from '@/types/game';
import { WeaponIcon } from './WeaponIcon';
import { RarityChip, WeaponCard } from './WeaponVote';

/**
 * The phone during a weapon vote: tap a weapon (once — it can't be changed), then wait for the
 * class. Ties, the teacher's decision and the result are explained in plain words.
 */
export function PhoneWeaponVote({
  client,
  vote,
  stage,
  closesInMs,
  myChoice,
  onVoted,
}: {
  client: AppSupabaseClient;
  vote: WeaponVote;
  stage: VoteStage;
  closesInMs: number;
  /** My ballot in the current round, from the server. */
  myChoice: string | null;
  onVoted: () => void;
}) {
  const [local, setLocal] = useState<{ key: string; round: number; choice: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const voteKey = `${vote.id}:${vote.round}`;
  const choice = myChoice ?? (local?.key === voteKey ? local.choice : null);
  const nameOf = (key: string | null) => vote.offered.find((w) => w.key === key)?.name ?? '';
  useEffect(() => {
    if (stage === 'done') buzz([80, 50, 120]);
  }, [stage, vote.id]);

  const cast = async (weapon: string) => {
    if (choice || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const status = await castWeaponVote(client, vote.id, weapon);
      if (status === 'accepted' || status === 'duplicate') setLocal({ key: voteKey, round: vote.round, choice: weapon });
      if (status === 'duplicate') setNotice('You had already voted.');
      if (status === 'closed') setNotice('Voting has closed.');
      if (status === 'early') setNotice('Voting opens in a moment.');
      if (status === 'not_eligible') setNotice('This vote is for players who were in the last question.');
      onVoted();
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'done') {
    const w = vote.offered.find((o) => o.key === vote.winner);
    if (!w) return null;
    return (
      <m.div variants={popIn} initial="hidden" animate="show" className="flex flex-col items-center gap-3 rounded-md bg-night-900 p-5 text-center" role="status">
        <WeaponIcon weapon={w.key} className="wx-spin size-20" />
        <RarityChip rarity={w.rarity} className="text-caption" />
        <p className="type-display text-[1.75rem] leading-tight">{w.name} equipped!</p>
        <p className="text-body-sm text-night-muted">{vote.decidedBy === 'teacher' ? 'Your teacher chose it.' : 'Your class chose it.'}</p>
        <p className="text-body-sm">
          <span className="font-bold">Always:</span> {w.passive}
        </p>
      </m.div>
    );
  }
  if (stage === 'cancelled') {
    return (
      <p className="rounded-md bg-night-900 p-4 text-body text-night-muted" role="status">
        No new weapon this time.
      </p>
    );
  }
  if (stage === 'teacher') {
    return (
      <div className="rounded-md bg-night-900 p-4" role="status">
        <p className="type-display text-[1.5rem]">Still a tie!</p>
        <p className="mt-1 text-body text-night-muted">Your teacher is choosing between {vote.options.map(nameOf).join(' and ')}.</p>
      </div>
    );
  }
  if (stage === 'pending') {
    return (
      <m.div variants={popIn} initial="hidden" animate="show" className="rounded-md bg-rank-gold p-4 text-night-950" role="status">
        <p className="type-display text-[1.5rem] leading-tight">Weapon unlocked!</p>
        <p className="mt-1 text-body-sm font-semibold">Amazing teamwork. Get ready to vote for the class weapon.</p>
      </m.div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-display text-[1.5rem] leading-tight">{vote.round === 2 ? 'Tie! Vote again' : 'Vote for the class weapon'}</p>
        <span className="type-score text-[1.75rem]" aria-label="Seconds left">
          {Math.max(0, Math.ceil(closesInMs / 1000))}
        </span>
      </div>
      {choice ? (
        <m.div variants={popIn} initial="hidden" animate="show" className="flex items-center gap-3 rounded-md bg-night-900 p-4" role="status">
          <WeaponIcon weapon={choice} className="size-12 shrink-0" />
          <p className="text-body">
            <Check className="mr-1 inline size-4" aria-hidden />
            You voted <span className="font-bold">{nameOf(choice)}</span>. Waiting for the class…
          </p>
        </m.div>
      ) : (
        <>
          <p className="text-body-sm text-night-muted">One vote each. You can’t change it once it’s in.</p>
          <div className="grid gap-2" role="group" aria-label="Weapons">
            {vote.offered
              .filter((w) => vote.options.includes(w.key))
              .map((w) => (
                <button key={w.key} type="button" disabled={busy} onClick={() => void cast(w.key)} className="block text-left disabled:opacity-60" aria-label={`Vote for ${w.name}`}>
                  <WeaponCard weapon={w} size="phone" />
                </button>
              ))}
          </div>
        </>
      )}
      {notice && (
        <p role="alert" className="text-body-sm font-semibold text-error-300">
          {notice}
        </p>
      )}
    </div>
  );
}
