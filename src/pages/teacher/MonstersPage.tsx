import { useMemo, useState } from 'react';
import { Dices, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl, SelectField } from '@/components/ui/FormControls';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { SectionHead } from '@/components/ui/SectionHead';
import { Monster } from '@/components/battle/Monster';
import { DRAWN_RIGS } from '@/components/monsters/registry';
import { ARCHETYPE_BY_ID } from '@/lib/monsters/archetypes';
import { CATALOGUE } from '@/lib/monsters/catalogue';
import { ELEMENTS } from '@/lib/monsters/elements';
import { catalogueMonster, generateMonster } from '@/lib/monsters/generate';
import { PERSONALITIES } from '@/lib/monsters/personality';
import { MONSTER_STATES, STATE_LABEL, motionFor, type MonsterState } from '@/lib/monsters/motion';
import type { CategoryId, MonsterSpec, Rarity } from '@/lib/monsters/types';
import type { BattleStage } from '@/lib/battle/monster';
import { cn } from '@/lib/cn';

const CATEGORY_LABEL: Record<CategoryId | 'all', string> = {
  all: 'All',
  dragons: 'Dragons',
  casters: 'Witches & warlocks',
  golems: 'Golems & guardians',
  brutes: 'Trolls, giants & brutes',
  undead: 'Undead & shadow',
  mythic: 'Mythical creatures',
};

const RARITY_TONE: Record<Rarity, 'neutral' | 'info' | 'signal' | 'warning'> = { common: 'neutral', rare: 'info', epic: 'signal', legendary: 'warning' };
const STAGES: { value: BattleStage; label: string }[] = [
  { value: 'normal', label: 'Calm' },
  { value: 'rage', label: 'Rage' },
  { value: 'enraged', label: 'Enraged' },
  { value: 'defeated', label: 'Defeated' },
];

/**
 * The monster catalogue: every named monster, and the generator to try random ones. Choosing the
 * monster for a live session happens in the host lobby; this page is for browsing and previewing.
 */
export default function MonstersPage() {
  const named = useMemo(() => CATALOGUE.map((entry) => catalogueMonster(entry)), []);
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [selected, setSelected] = useState<MonsterSpec>(named.find((m) => m.id === 'ashfang') ?? named[0]);
  const [stage, setStage] = useState<BattleStage>('normal');
  // Behaviour preview: a state picked here (or what the stage implies), replayable.
  const [behaviour, setBehaviour] = useState<MonsterState | 'auto'>('auto');
  const [replay, setReplay] = useState(0);
  const shownState: MonsterState = behaviour !== 'auto' ? behaviour : stage === 'defeated' ? 'defeated' : stage === 'normal' ? 'idle' : stage;
  const motion = motionFor(selected, shownState);

  const roll = (mode: 'random' | 'surprise') => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    setBehaviour('auto');
    setSelected(generateMonster({ seed, mode, rigs: DRAWN_RIGS, avoid: [selected.archetype] }));
  };

  const shown = category === 'all' ? named : named.filter((m) => m.category === category);
  const counts = Object.fromEntries((Object.keys(CATEGORY_LABEL) as (CategoryId | 'all')[]).map((c) => [c, c === 'all' ? named.length : named.filter((m) => m.category === c).length]));

  return (
    <div className="space-y-8">
      <header>
        <p className="type-kicker">Boss battles</p>
        <h1 className="type-display mt-1 text-display-lg">Monsters</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-700">
          Every boss battle has a monster with its own look, personality and attacks. Browse the named monsters or roll a new one. How hard a battle is
          depends on the difficulty you choose for the session, never on how fierce the monster looks.
        </p>
      </header>

      <section aria-label="Monster preview" className="ground-night grid gap-6 overflow-hidden rounded-md bg-night-950 p-5 text-night-text md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-8">
        <div className="flex flex-col items-center gap-4">
          <Monster
            key={`${selected.id}:${shownState}:${replay}`}
            monster={selected}
            stage={stage}
            state={shownState}
            className="aspect-[400/420] w-full max-w-[22rem]"
          />
          <SegmentedControl label="Battle stage" tone="night" layoutId="monster-stage" value={stage} onChange={setStage} options={STAGES} />
          <div className="flex w-full max-w-md items-end gap-2">
            <SelectField label="Behaviour" tone="night" className="flex-1" value={behaviour} onChange={(e) => setBehaviour(e.target.value as MonsterState | 'auto')}>
              <option value="auto">As the stage shows</option>
              {MONSTER_STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </SelectField>
            <Button variant="night-ghost" leftIcon={<RotateCcw className="size-4" />} onClick={() => setReplay((n) => n + 1)} disabled={motion.loop}>
              Replay
            </Button>
          </div>
          <p className="text-caption text-night-muted">
            {STATE_LABEL[shownState]} · {motion.name === 'default' ? 'standard motion' : motion.name.replace(/-/g, ' ')}
          </p>
        </div>
        <MonsterDetails spec={selected} onRandom={() => roll('random')} onSurprise={() => roll('surprise')} />
      </section>

      <section aria-labelledby="named-heading" className="space-y-4">
        <SectionHead id="named-heading" kicker="Named monsters" action={<span className="text-caption text-ink-500">{named.length} monsters</span>} />
        <UnderlineTabs
          label="Filter by family"
          layoutId="monster-family"
          value={category}
          onChange={setCategory}
          options={(Object.keys(CATEGORY_LABEL) as (CategoryId | 'all')[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: counts[c] }))}
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(m);
                  setStage('normal');
                  setBehaviour('auto');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-pressed={selected.id === m.id}
                className={cn(
                  'ground-night flex w-full flex-col items-center gap-2 rounded-md bg-night-950 px-3 pt-3 pb-3 text-center text-night-text ring-offset-2 ring-offset-paper hover:bg-night-900',
                  selected.id === m.id && 'ring-[3px] ring-signal-600',
                )}
              >
                <Monster monster={m} stage="normal" className="aspect-[400/420] w-full max-w-[9rem]" />
                <span className="w-full truncate text-label">{m.name}</span>
                <span className="w-full truncate text-caption text-night-muted">{m.title}</span>
                <span className="flex flex-wrap justify-center gap-1">
                  <Badge tone={RARITY_TONE[m.rarity]}>{m.rarity}</Badge>
                  <Badge tone="dark">{ELEMENTS[m.element].label}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MonsterDetails({ spec, onRandom, onSurprise }: { spec: MonsterSpec; onRandom: () => void; onSurprise: () => void }) {
  const archetype = ARCHETYPE_BY_ID.get(spec.archetype);
  const personality = PERSONALITIES[spec.personality];
  const intro = personality.lines.intro[spec.seed % personality.lines.intro.length];
  return (
    <div className="flex min-w-0 flex-col">
      <p className="type-kicker text-night-muted">
        {archetype?.label} · {ELEMENTS[spec.element].label}
        {spec.source === 'surprise' ? ' · Surprise boss' : spec.source === 'random' ? ' · Generated' : ''}
      </p>
      <h2 className="type-display mt-1 text-[clamp(2rem,4vw,3rem)] leading-[1.05]">{spec.name}</h2>
      <p className="text-title text-night-muted">{spec.title}</p>
      <p className="mt-3 text-body-sm text-night-muted italic">“{intro}”</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={RARITY_TONE[spec.rarity]}>{spec.rarity}</Badge>
        <Badge tone="dark">{personality.label}</Badge>
      </div>
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
        <dt className="text-night-muted">Body</dt>
        <dd>{archetype?.body}</dd>
        <dt className="text-night-muted">Attack</dt>
        <dd>{spec.abilities.primary}</dd>
        <dt className="text-night-muted">Defence</dt>
        <dd>{spec.abilities.defense}</dd>
        <dt className="text-night-muted">Specials</dt>
        <dd>
          {spec.abilities.specials.normal} → {spec.abilities.specials.rage} → {spec.abilities.specials.enraged}
        </dd>
        <dt className="text-night-muted">Weak to</dt>
        <dd>
          {ELEMENTS[spec.weakness.element].label}
          {spec.weakness.topic ? ` · questions on ${spec.weakness.topic}` : ' · and to what your class has learned'}
        </dd>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        <Button variant="night" leftIcon={<Dices className="size-4" />} onClick={onRandom}>
          Random monster
        </Button>
        <Button variant="night-ghost" leftIcon={<Sparkles className="size-4" />} onClick={onSurprise}>
          Surprise boss
        </Button>
      </div>
    </div>
  );
}
