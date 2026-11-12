import { useState } from 'react';
import { SegmentedControl, Switch } from '@/components/ui/FormControls';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { setBattleDifficulty, setBattleSettings, setPowerupSettings, setWeaponSettings, type BattleSettingsInput, type WeaponSettingsInput } from '@/services/battle';
import { DIFFICULTY_HELP, DIFFICULTY_LABEL, DIFFICULTY_SETTINGS, autoHpAt, effectiveDifficulty } from '@/lib/monsters/difficulty';
import type { DifficultySetting } from '@/lib/monsters/types';
import { friendlyError } from '@/utils/errors';
import { monsterOf } from '@/lib/battle/monster';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { BattleConfig, BattleState } from '@/types/game';

const DAMAGE_OPTIONS = ['1', '3', '5', '10'] as const;

/**
 * The teacher's boss-battle settings in the lobby. Sensible defaults (on, automatic HP, 3 damage per
 * correct answer); everything is saved on the server and locked once the game starts.
 */
export function BattleSettings({
  client,
  sessionId,
  battle,
  players,
  questions,
  difficulties = [],
  onChanged,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  battle: BattleState;
  players: number;
  questions: number;
  /** The quiz's question difficulties (null = untagged), for the automatic preview. */
  difficulties?: readonly (string | null)[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [customHp, setCustomHp] = useState(battle.hpSetting !== null ? String(battle.hpSetting) : '');
  const [hpError, setHpError] = useState<string | null>(null);
  const name = monsterOf(battle).name;
  const difficulty: DifficultySetting = battle.difficulty ?? 'auto';
  const effective = effectiveDifficulty(difficulty, difficulties);
  const autoHp = autoHpAt(players, questions, battle.baseDamage, effective);

  const saveDifficulty = async (value: DifficultySetting) => {
    setBusy(true);
    try {
      await setBattleDifficulty(client, sessionId, value);
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: 'Difficulty not saved', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };

  const save = async (input: BattleSettingsInput) => {
    setBusy(true);
    try {
      await setBattleSettings(client, sessionId, input);
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: 'Battle settings not saved', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };

  const savePowerups = async (powerupsEnabled: boolean) => {
    setBusy(true);
    try {
      await setPowerupSettings(client, sessionId, { powerupsEnabled });
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: 'Power-up settings not saved', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };

  const saveWeapons = async (input: WeaponSettingsInput) => {
    setBusy(true);
    try {
      await setWeaponSettings(client, sessionId, input);
      onChanged();
    } catch (error) {
      toast({ tone: 'error', title: 'Weapon settings not saved', description: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };

  const saveCustomHp = () => {
    const n = Number(customHp);
    if (!Number.isInteger(n) || n < 50 || n > 100000) {
      setHpError('A whole number from 50 to 100000.');
      return;
    }
    setHpError(null);
    void save({ hp: n });
  };

  return (
    <div className="space-y-3">
      <Switch
        checked={battle.enabled}
        disabled={busy}
        onChange={(enabled) => void save({ enabled })}
        label="Boss battle"
        description={`The class fights ${name} together: every correct answer hits it, and the projector shows the attack after each question.`}
      />
      {battle.enabled && (
        <>
          <p className="pt-1 text-body-sm font-semibold text-ink-800">Monster HP</p>
          <SegmentedControl
            label="Monster HP"
            layoutId="battle-hp"
            value={battle.hpSetting === null && customHp === '' ? 'auto' : 'custom'}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'custom', label: 'Set it myself' },
            ]}
            onChange={(v) => {
              if (v === 'auto') {
                setCustomHp('');
                setHpError(null);
                if (battle.hpSetting !== null) void save({ hp: null });
              }
              else setCustomHp(customHp || String(autoHp));
            }}
          />
          {battle.hpSetting === null && customHp === '' ? (
            <p className="text-caption text-ink-500">
              About <span className="font-bold text-ink-800">{autoHp} HP</span> for {players} {players === 1 ? 'player' : 'players'} and {questions}{' '}
              {questions === 1 ? 'question' : 'questions'} at {DIFFICULTY_LABEL[effective].toLowerCase()}: a class getting about 70% right wins near the end. Fixed when you start.
            </p>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveCustomHp();
              }}
            >
              <TextField
                label="HP"
                type="number"
                inputMode="numeric"
                min={50}
                max={100000}
                value={customHp}
                onChange={(e) => setCustomHp(e.target.value)}
                error={hpError ?? undefined}
                className="w-36"
              />
              <Button type="submit" variant="secondary" size="md" loading={busy} disabled={String(battle.hpSetting ?? '') === customHp}>
                Save HP
              </Button>
              {battle.hpSetting === null && (
                <Button type="button" variant="ghost" size="md" onClick={() => setCustomHp('')}>
                  Cancel
                </Button>
              )}
            </form>
          )}
          <p className="pt-1 text-body-sm font-semibold text-ink-800">Damage per correct answer</p>
          <SegmentedControl
            label="Damage per correct answer"
            layoutId="battle-damage"
            value={String(battle.baseDamage) as (typeof DAMAGE_OPTIONS)[number]}
            options={DAMAGE_OPTIONS.map((d) => ({ value: d, label: d }))}
            onChange={(v) => void save({ baseDamage: Number(v) })}
          />
          <p className="pt-1 text-body-sm font-semibold text-ink-800">Difficulty</p>
          <SegmentedControl
            label="Difficulty"
            layoutId="battle-difficulty"
            className="gap-0.5 [&_button]:px-1 [&_button]:text-caption"
            value={difficulty}
            options={DIFFICULTY_SETTINGS.map((d) => ({ value: d, label: d === 'auto' ? 'Auto' : DIFFICULTY_LABEL[d] }))}
            onChange={(v) => {
              if (v !== difficulty) void saveDifficulty(v);
            }}
          />
          <p className="text-caption text-ink-700">
            {difficulty === 'auto' ? (
              <>
                <span className="font-semibold">{DIFFICULTY_LABEL[effective]} for this quiz</span>, worked out from its questions when you start (mostly hard
                questions make an easier monster). {DIFFICULTY_HELP[effective]}
              </>
            ) : (
              DIFFICULTY_HELP[difficulty]
            )}{' '}
            The monster you choose never changes this.
          </p>
          {battle.config.intensity === 'custom' && (
            <p className="text-caption text-warning-700">You tuned class targets or healing by hand under Advanced; your values are kept until you pick a difficulty again.</p>
          )}
          <p className="text-caption text-ink-500">
            Below {battle.config.rageAt}% HP the monster goes into Rage, below {battle.config.enragedAt}% it is Enraged. Each question it
            charges a special attack; the class stops it when at least {battle.config.targets.normal}% / {battle.config.targets.rage}% /{' '}
            {battle.config.targets.enraged}% answer correctly (Normal / Rage / Enraged). If not, it heals {battle.config.heal.normal}% /{' '}
            {battle.config.heal.rage}% / {battle.config.heal.enraged}% of its HP. Correct answers always hit.
          </p>
          <Switch
            checked={battle.config.modeTimers}
            disabled={busy}
            onChange={(modeTimers) => void save({ modeTimers })}
            label="Battle timers"
            description={`Rage questions get ${battle.config.timers.rage} s and Enraged ${battle.config.timers.enraged} s; Normal questions keep ${
              battle.config.timers.normal === null ? 'their own time' : `${battle.config.timers.normal} s`
            }. Off: every question keeps the time set in the quiz.`}
          />
          <Switch
            checked={battle.config.weaponsEnabled}
            disabled={busy}
            onChange={(weaponsEnabled) => void saveWeapons({ weaponsEnabled })}
            label="Weapon unlocks"
            description={`When at least ${battle.config.unlockPct}% of the class answers a question correctly, everyone votes for a weapon for the class (${
              battle.config.voteMs / 1000
            } s, one vote each; a tie goes to a runoff, then to you). Not more often than every ${battle.config.unlockCooldown + 1} questions.`}
          />
          <Switch
            checked={battle.config.powerupsEnabled}
            disabled={busy}
            onChange={(powerupsEnabled) => void savePowerups(powerupsEnabled)}
            label="Power-ups and team energy"
            description={`Before the final challenge everyone picks one of three power-ups (${battle.config.draftMs / 1000} s) to use once. The class earns team energy for mastery, recovery, teamwork and participation; you spend it on team abilities during the game.`}
          />
          <details className="group rounded-sm border border-line px-3 py-2">
            <summary className="cursor-pointer text-body-sm font-semibold text-ink-800">Advanced</summary>
            <WeaponAdvanced key={`w:${battle.config.unlockPct}:${battle.config.unlockCooldown}:${battle.config.voteMs}:${battle.config.runoffMs}`} config={battle.config} busy={busy} onSave={(input) => void saveWeapons(input)} />
            <BattleAdvanced key={JSON.stringify(battle.config)} config={battle.config} busy={busy} onSave={(input) => void save(input)} />
          </details>
        </>
      )}
    </div>
  );
}

type Field = { key: string; label: string; min: number; max: number; optional?: boolean };
const MODES = ['normal', 'rage', 'enraged'] as const;
const MODE_LABEL = { normal: 'Normal', rage: 'Rage', enraged: 'Enraged' } as const;

/** Every threshold, for teachers who want to tune the battle. Saved together; the server validates. */
function BattleAdvanced({ config, busy, onSave }: { config: BattleConfig; busy: boolean; onSave: (input: BattleSettingsInput) => void }) {
  const initial: Record<string, string> = {
    rageAt: String(config.rageAt),
    enragedAt: String(config.enragedAt),
    ...Object.fromEntries(MODES.map((m) => [`target_${m}`, String(config.targets[m])])),
    ...Object.fromEntries(MODES.map((m) => [`heal_${m}`, String(config.heal[m])])),
    ...Object.fromEntries(MODES.map((m) => [`timer_${m}`, config.timers[m] === null ? '' : String(config.timers[m])])),
  };
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const changed = Object.keys(initial).some((k) => initial[k] !== values[k]);

  const groups: { title: string; hint?: string; fields: Field[] }[] = [
    {
      title: 'Mode starts at (HP %)',
      fields: [
        { key: 'rageAt', label: 'Rage', min: 2, max: 99 },
        { key: 'enragedAt', label: 'Enraged', min: 1, max: 98 },
      ],
    },
    { title: 'Class must get right (%)', fields: MODES.map((m) => ({ key: `target_${m}`, label: MODE_LABEL[m], min: 1, max: 100 })) },
    { title: 'Monster heals when not stopped (% of HP)', fields: MODES.map((m) => ({ key: `heal_${m}`, label: MODE_LABEL[m], min: 0, max: 50 })) },
    {
      title: 'Battle timers (seconds)',
      hint: 'Used only when battle timers are on. Leave Normal empty to keep each question’s own time.',
      fields: MODES.map((m) => ({ key: `timer_${m}`, label: MODE_LABEL[m], min: 5, max: 120, optional: m === 'normal' })),
    },
  ];

  const submit = () => {
    const num = (k: string) => (values[k].trim() === '' ? null : Number(values[k]));
    for (const g of groups)
      for (const f of g.fields) {
        const n = num(f.key);
        if (n === null && f.optional) continue;
        if (n === null || !Number.isInteger(n) || n < f.min || n > f.max) {
          setError(`${g.title}: ${f.label} must be a whole number from ${f.min} to ${f.max}.`);
          return;
        }
      }
    if (num('enragedAt')! >= num('rageAt')!) {
      setError('Enraged must start at a lower HP than Rage.');
      return;
    }
    setError(null);
    onSave({
      rageAt: num('rageAt')!,
      enragedAt: num('enragedAt')!,
      targets: { normal: num('target_normal')!, rage: num('target_rage')!, enraged: num('target_enraged')! },
      heal: { normal: num('heal_normal')!, rage: num('heal_rage')!, enraged: num('heal_enraged')! },
      timers: { normal: num('timer_normal'), rage: num('timer_rage')!, enraged: num('timer_enraged')! },
    });
  };

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend className="text-caption font-bold text-ink-700">{g.title}</legend>
          {g.hint && <p className="text-caption text-ink-500">{g.hint}</p>}
          <div className="mt-1 grid grid-cols-3 gap-2">
            {g.fields.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                type="number"
                inputMode="numeric"
                min={f.min}
                max={f.max}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="text-body-sm font-semibold text-error-600">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" size="md" loading={busy} disabled={!changed}>
        Save advanced settings
      </Button>
    </form>
  );
}

/** Weapon unlock thresholds and vote timing (advanced). */
function WeaponAdvanced({ config, busy, onSave }: { config: BattleConfig; busy: boolean; onSave: (input: WeaponSettingsInput) => void }) {
  const initial = {
    unlockPct: String(config.unlockPct),
    unlockCooldown: String(config.unlockCooldown),
    voteSeconds: String(config.voteMs / 1000),
    runoffSeconds: String(config.runoffMs / 1000),
  };
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const fields: { key: keyof typeof initial; label: string; min: number; max: number }[] = [
    { key: 'unlockPct', label: 'Unlock at % correct', min: 50, max: 100 },
    { key: 'unlockCooldown', label: 'Questions between', min: 0, max: 10 },
    { key: 'voteSeconds', label: 'Vote (s)', min: 5, max: 30 },
    { key: 'runoffSeconds', label: 'Runoff (s)', min: 3, max: 15 },
  ];
  const changed = fields.some((f) => values[f.key] !== initial[f.key]);
  const submit = () => {
    for (const f of fields) {
      const n = Number(values[f.key]);
      if (values[f.key].trim() === '' || !Number.isInteger(n) || n < f.min || n > f.max) {
        setError(`${f.label} must be a whole number from ${f.min} to ${f.max}.`);
        return;
      }
    }
    setError(null);
    onSave({
      unlockPct: Number(values.unlockPct),
      unlockCooldown: Number(values.unlockCooldown),
      voteSeconds: Number(values.voteSeconds),
      runoffSeconds: Number(values.runoffSeconds),
    });
  };
  return (
    <form
      className="mt-4 space-y-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-caption font-bold text-ink-700">Weapon unlocks</p>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            type="number"
            inputMode="numeric"
            min={f.min}
            max={f.max}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-body-sm font-semibold text-error-600">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" size="md" loading={busy} disabled={!changed}>
        Save weapon settings
      </Button>
    </form>
  );
}
