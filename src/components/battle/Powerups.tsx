import { useState } from 'react';
import { m } from 'motion/react';
import { Check, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { popIn } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { activatePowerup, activateTeamAbility, choosePowerup } from '@/services/battle';
import { friendlyError } from '@/utils/errors';
import { POWERUP_ICON, TEAM_ABILITIES, abilityStatus } from '@/lib/battle/powerups';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { BattleState, GameQuestion, GameState, MyPowerup, PowerupInfo } from '@/types/game';

/** Shared team energy, 0–100. */
export function EnergyMeter({ energy, size = 'stage', className }: { energy: number; size?: 'stage' | 'sm'; className?: string }) {
  const stage = size === 'stage';
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Sparkles className={cn('shrink-0 text-sun-400', stage ? 'size-[clamp(1.1rem,2.6vh,1.6rem)]' : 'size-4')} aria-hidden />
      <div
        role="meter"
        aria-label="Team energy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={energy}
        className={cn('relative flex-1 overflow-hidden rounded-full bg-night-800', stage ? 'h-[clamp(0.6rem,1.4vh,0.9rem)] min-w-24' : 'h-2 min-w-16')}
      >
        <span className="absolute inset-y-0 left-0 bg-sun-400 transition-[width] duration-700 ease-out" style={{ width: `${energy}%` }} />
      </div>
      <span className={cn('type-score shrink-0 tabular-nums', stage ? 'text-[clamp(0.9rem,2.2vh,1.4rem)]' : 'text-caption')}>{energy}</span>
    </div>
  );
}

function PowerupCard({ p, chosen, onPick, busy }: { p: PowerupInfo; chosen?: boolean; onPick?: () => void; busy?: boolean }) {
  const Icon = POWERUP_ICON[p.key] ?? Zap;
  const body = (
    <span className={cn('flex items-center gap-3 rounded-md border-2 bg-night-900 p-3 text-left', chosen ? 'border-sun-400' : 'border-night-rule')}>
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-night-950 text-sun-400">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-body font-bold">{p.name}</span>
        <span className="block text-body-sm text-night-muted">{p.description}</span>
      </span>
      {chosen && <Check className="ml-auto size-5 shrink-0 text-sun-400" aria-hidden />}
    </span>
  );
  if (!onPick) return body;
  return (
    <button type="button" disabled={busy} onClick={onPick} className="block w-full disabled:opacity-60" aria-label={`Choose ${p.name}`}>
      {body}
    </button>
  );
}

/** The phone during the draft: choose one of three power-ups for the final battle. */
export function PhoneDraft({ client, sessionId, powerup, onChanged }: { client: AppSupabaseClient; sessionId: string; powerup: MyPowerup; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pick = async (key: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await choosePowerup(client, sessionId, key);
      if (r.status === 'closed') setNotice('Choosing has closed.');
      onChanged();
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };
  const chosen = powerup.state !== 'offered' ? powerup.chosen : null;
  return (
    <m.div variants={popIn} initial="hidden" animate="show" className="flex flex-col gap-3" role="group" aria-label="Choose a power-up">
      <p className="type-kicker text-sun-400">Final battle</p>
      <p className="type-display text-[1.5rem] leading-tight">{chosen ? 'Power-up ready!' : 'Choose your power-up'}</p>
      <p className="text-body-sm text-night-muted">
        {chosen ? 'Use it once, on any question of the final challenge.' : 'One each. If you don’t choose, you get the first one.'}
      </p>
      {powerup.offered.map((p) => (
        <PowerupCard key={p.key} p={p} chosen={chosen === p.key} onPick={chosen ? undefined : () => void pick(p.key)} busy={busy} />
      ))}
      {notice && (
        <p role="alert" className="text-body-sm font-semibold text-error-300">
          {notice}
        </p>
      )}
    </m.div>
  );
}

/** The projector during the draft. */
export function DraftStage({ weakObjectives, remainingMs }: { weakObjectives: string[]; remainingMs: number }) {
  return (
    <div className="bx-announce flex flex-1 flex-col justify-center gap-[2vh]" role="status">
      <p className="type-kicker text-stage-label text-rank-gold">Final challenge</p>
      <h2 className="type-display text-[clamp(2.5rem,8vh,6rem)] leading-[1.02]">Choose your power-up!</h2>
      <p className="max-w-4xl text-[clamp(1.1rem,3vh,2rem)]">Everyone gets three to choose from on their phone. Use it once in the final battle.</p>
      {weakObjectives.length > 0 && (
        <p className="max-w-4xl text-stage-name text-night-muted">
          The monster aims at what the class found hard: <span className="font-bold text-night-text">{weakObjectives.join(' · ')}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-[1.5vw] text-sun-400" aria-hidden>
        {Object.entries(POWERUP_ICON).map(([key, Icon]) => (
          <Icon key={key} className="size-[clamp(1.8rem,5vh,3rem)]" />
        ))}
      </div>
      <p className="type-score text-[clamp(2rem,6vh,4rem)]" aria-label="Question starts in">
        {Math.max(1, Math.ceil(remainingMs / 1000))}
      </p>
    </div>
  );
}

/** The phone during a question: my power-up, and the button to use it. */
export function PhonePowerup({
  client,
  sessionId,
  powerup,
  question,
  answered,
  onChanged,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  powerup: MyPowerup;
  question: GameQuestion;
  answered: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const info = powerup.offered.find((p) => p.key === powerup.chosen);
  if (!info) return null;
  const Icon = POWERUP_ICON[info.key] ?? Zap;
  const thisQuestion = powerup.armedQuestionId === question.id;

  const use = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await activatePowerup(client, sessionId);
      if (r.status === 'armed') setNotice(info.key === 'revival' ? 'Pick your new answer.' : 'Ready: it counts if your answer is right.');
      onChanged();
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  if (powerup.state === 'used' && !thisQuestion) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-sun-400/50 bg-night-900 p-3">
      <div className="flex items-center gap-3">
        <Icon className="size-6 shrink-0 text-sun-400" aria-hidden />
        <p className="min-w-0 flex-1 text-body-sm">
          <span className="font-bold">{info.name}</span>{' '}
          <span className="text-night-muted">
            {powerup.state === 'held'
              ? info.description
              : powerup.state === 'armed'
                ? info.key === 'revival'
                  ? 'Pick your new answer (once).'
                  : 'Armed for this question.'
                : 'Used.'}
          </span>
        </p>
        {powerup.state === 'held' && (
          <Button size="sm" variant="primary" loading={busy} disabled={info.key === 'revival' && !answered} onClick={() => void use()}>
            Use
          </Button>
        )}
      </div>
      {powerup.hint && thisQuestion && (
        <p className="rounded-sm bg-night-950 p-2 text-body-sm font-semibold text-sun-400" role="status">
          {powerup.hint}
        </p>
      )}
      {notice && (
        <p role="status" className="text-caption font-semibold text-night-text">
          {notice}
        </p>
      )}
    </div>
  );
}

/** The teacher's team abilities, paid with team energy. */
export function TeamAbilities({ client, state, battle, onChanged, className }: { client: AppSupabaseClient; state: GameState; battle: BattleState; onChanged: () => void; className?: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const use = async (key: (typeof TEAM_ABILITIES)[number]['key'], name: string) => {
    setBusy(key);
    try {
      await activateTeamAbility(client, state.session.id, key);
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: `Could not use ${name}`, description: friendlyError(error) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Team abilities">
      <EnergyMeter energy={battle.energy} size="sm" className="w-40" />
      {TEAM_ABILITIES.map((a) => {
        const s = abilityStatus(state, battle, a.key);
        return (
          <Button
            key={a.key}
            size="sm"
            variant="night-ghost"
            disabled={!s.can || busy !== null}
            loading={busy === a.key}
            onClick={() => void use(a.key, a.name)}
            title={`${a.description} ${s.reason}`}
          >
            {a.name} <span className="type-score text-sun-400">{a.cost}</span>
          </Button>
        );
      })}
    </div>
  );
}
