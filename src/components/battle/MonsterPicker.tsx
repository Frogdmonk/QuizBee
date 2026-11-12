import { useMemo, useState } from 'react';
import { Check, Dices, LayoutGrid, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Monster } from './Monster';
import { DRAWN_RIGS } from '@/components/monsters/registry';
import { useToast } from '@/hooks/useToast';
import { setBattleMonster } from '@/services/battle';
import { friendlyError } from '@/utils/errors';
import { cn } from '@/lib/cn';
import { monsterOf } from '@/lib/battle/monster';
import { ARCHETYPE_BY_ID } from '@/lib/monsters/archetypes';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { ELEMENTS } from '@/lib/monsters/elements';
import { catalogueMonster, generateMonster } from '@/lib/monsters/generate';
import { PERSONALITIES } from '@/lib/monsters/personality';
import { weaknessText } from '@/lib/monsters/reactions';
import type { CategoryId, MonsterSpec } from '@/lib/monsters/types';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { BattleState } from '@/types/game';

const FAMILY: Record<CategoryId, string> = {
  dragons: 'Dragons',
  casters: 'Witches & warlocks',
  golems: 'Golems & guardians',
  brutes: 'Trolls, giants & brutes',
  undead: 'Undead & shadow',
  mythic: 'Mythical creatures',
};

/** A fresh seed for a new random monster (not shown anywhere; the result is stored, not the seed). */
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * The host lobby's monster choice: a random monster, a surprise boss or one from the catalogue,
 * with its weakness drawn from this quiz's topics. Saved on the server; every screen shows it and
 * it is fixed once the game starts.
 */
export function MonsterPicker({
  client,
  sessionId,
  battle,
  topics,
  onChanged,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  battle: BattleState;
  topics: readonly string[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'random' | 'surprise' | 'pick' | null>(null);
  const [open, setOpen] = useState(false);
  const monster = monsterOf(battle);
  const archetype = ARCHETYPE_BY_ID.get(monster.archetype);

  const choose = async (spec: MonsterSpec, how: 'random' | 'surprise' | 'pick') => {
    setBusy(how);
    try {
      await setBattleMonster(client, sessionId, spec);
      onChanged();
      setOpen(false);
    } catch (error) {
      toast({ tone: 'error', title: 'Monster not changed', description: friendlyError(error) });
    } finally {
      setBusy(null);
    }
  };
  const roll = (mode: 'random' | 'surprise') =>
    void choose(generateMonster({ seed: newSeed(), mode, topics, rigs: DRAWN_RIGS, avoid: [monster.archetype] }), mode);

  return (
    <div className="space-y-3">
      <div className="ground-night flex items-center gap-4 rounded-md bg-night-950 p-3 text-night-text">
        <Monster monster={monster} stage="normal" className="aspect-[400/420] w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-title">{monster.name}</p>
          <p className="truncate text-caption text-night-muted">{monster.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge tone="dark">
              {archetype?.label} · {ELEMENTS[monster.element].label}
            </Badge>
            <Badge tone={monster.rarity === 'legendary' ? 'warning' : monster.rarity === 'epic' ? 'signal' : monster.rarity === 'rare' ? 'info' : 'neutral'}>{monster.rarity}</Badge>
          </div>
          <p className="mt-1.5 text-caption text-night-muted">
            {PERSONALITIES[monster.personality].label} · weak to {weaknessText(monster)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" leftIcon={<Dices className="size-4" />} loading={busy === 'random'} disabled={busy !== null} onClick={() => roll('random')}>
          New random monster
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<Sparkles className="size-4" />} loading={busy === 'surprise'} disabled={busy !== null} onClick={() => roll('surprise')}>
          Surprise boss
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<LayoutGrid className="size-4" />} disabled={busy !== null} onClick={() => setOpen(true)}>
          Choose…
        </Button>
      </div>
      <p className="text-caption text-ink-500">
        Every screen shows this monster, and it stays the same for the whole game. A surprise boss is rarer to look at, never harder: difficulty is set
        below.
      </p>

      <Dialog open={open} onClose={() => setOpen(false)} size="xl" title="Choose the monster" description="Every named monster. Difficulty is set separately, so any of them suits any class.">
        <Catalogue current={monster.id} topics={topics} busy={busy === 'pick'} onPick={(spec) => void choose(spec, 'pick')} />
      </Dialog>
    </div>
  );
}

function Catalogue({ current, topics, busy, onPick }: { current: string; topics: readonly string[]; busy: boolean; onPick: (spec: MonsterSpec) => void }) {
  const monsters = useMemo(() => CATALOGUE.map((e) => catalogueMonster(e, topics)), [topics]);
  return (
    <div className="space-y-6">
      {(Object.keys(FAMILY) as CategoryId[]).map((family) => {
        const list = monsters.filter((m) => m.category === family);
        if (!list.length) return null;
        return (
          <section key={family} aria-label={FAMILY[family]}>
            <p className="type-kicker">{FAMILY[family]}</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={m.id === current}
                    onClick={() => onPick(m)}
                    className={cn(
                      'ground-night relative flex w-full flex-col items-center gap-1 rounded-md bg-night-950 p-2 text-center text-night-text hover:bg-night-900 disabled:opacity-60',
                      m.id === current && 'ring-[3px] ring-signal-600',
                    )}
                  >
                    {m.id === current && (
                      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-signal-600 text-white">
                        <Check className="size-4" aria-label="Current monster" />
                      </span>
                    )}
                    <Monster monster={m} stage="normal" className="aspect-[400/420] w-full max-w-[7rem]" />
                    <span className="w-full truncate text-label">{m.name}</span>
                    <span className="w-full truncate text-caption text-night-muted">
                      {ELEMENTS[m.element].label} · {m.rarity}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
