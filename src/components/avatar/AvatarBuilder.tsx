import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  AVATAR_PRESETS,
  BACKGROUNDS,
  EXTRAS,
  EYES,
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTHS,
  SHIRT_COLORS,
  SHIRT_STYLES,
  SKIN_TONES,
  decodeAvatar,
  randomAvatar,
  withPart,
  type AvatarPartKey,
} from '@/lib/avatar';
import { Avatar } from './Avatar';

type Tab = 'looks' | 'face' | 'hair' | 'outfit' | 'extras';

const TABS: { id: Tab; label: string }[] = [
  { id: 'looks', label: 'Looks' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'extras', label: 'Extras' },
];

type Section =
  | { kind: 'shapes'; part: AvatarPartKey; label: string; names: readonly string[] }
  | { kind: 'colors'; part: AvatarPartKey; label: string; colors: readonly string[] };

const SECTIONS: Record<Exclude<Tab, 'looks'>, Section[]> = {
  face: [
    { kind: 'colors', part: 'skin', label: 'Skin tone', colors: SKIN_TONES.map(([base]) => base) },
    { kind: 'shapes', part: 'eyes', label: 'Eyes', names: EYES },
    { kind: 'shapes', part: 'mouth', label: 'Mouth', names: MOUTHS },
  ],
  hair: [
    { kind: 'shapes', part: 'hairStyle', label: 'Style', names: HAIR_STYLES },
    { kind: 'colors', part: 'hairColor', label: 'Colour', colors: HAIR_COLORS },
  ],
  outfit: [
    { kind: 'shapes', part: 'shirtStyle', label: 'Top', names: SHIRT_STYLES },
    { kind: 'colors', part: 'shirtColor', label: 'Colour', colors: SHIRT_COLORS },
  ],
  extras: [
    { kind: 'shapes', part: 'extra', label: 'Extra', names: EXTRAS },
    { kind: 'colors', part: 'background', label: 'Background', colors: BACKGROUNDS },
  ],
};

/**
 * Pick a ready-made look or build your own from layered parts.
 * Designed for phones: big preview, thumb-sized choices, one tab at a time.
 */
export function AvatarBuilder({
  value,
  onChange,
  dark = false,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Night canvas styling for student screens. */
  dark?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('looks');
  const parts = decodeAvatar(value);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar code={value} className="size-24 rounded-full ring-4 ring-white/15 sm:size-28" title="Your avatar" />
        <button
          type="button"
          onClick={() => onChange(randomAvatar())}
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-95',
            dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-ink-50 text-ink-800 hover:bg-ink-100',
          )}
        >
          <Shuffle className="size-4" /> Surprise me
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Avatar options"
        className={cn('flex gap-1 overflow-x-auto rounded-xl p-1', dark ? 'bg-white/8' : 'bg-ink-50')}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'h-9 flex-1 shrink-0 rounded-lg px-3 text-sm font-bold transition',
              tab === t.id
                ? dark
                  ? 'bg-white text-night-900'
                  : 'bg-surface text-ink-900 shadow-card'
                : dark
                  ? 'text-white/70 hover:text-white'
                  : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-4">
        {tab === 'looks' ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => onChange(preset.code)}
                aria-label={preset.name}
                aria-pressed={value === preset.code}
                className={cn(
                  'rounded-full p-0.5 ring-2 transition active:scale-95',
                  value === preset.code ? 'ring-flame-400' : 'ring-transparent hover:ring-white/30',
                )}
              >
                <Avatar code={preset.code} className="w-full rounded-full" />
              </button>
            ))}
          </div>
        ) : (
          SECTIONS[tab].map((section) => (
            <fieldset key={section.part}>
              <legend className={cn('mb-2 text-xs font-bold tracking-wide uppercase', dark ? 'text-white/60' : 'text-ink-500')}>
                {section.label}
              </legend>
              {section.kind === 'colors' ? (
                <div className="flex flex-wrap gap-2">
                  {section.colors.map((color, i) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onChange(withPart(value, section.part, i))}
                      aria-label={`${section.label} ${i + 1}`}
                      aria-pressed={parts[section.part] === i}
                      className={cn(
                        'size-10 rounded-full border-2 transition active:scale-90',
                        parts[section.part] === i
                          ? 'border-flame-400 ring-2 ring-flame-400/40'
                          : dark
                            ? 'border-white/20'
                            : 'border-ink-200',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {section.names.map((name, i) => {
                    const preview = withPart(value, section.part, i);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => onChange(preview)}
                        aria-pressed={parts[section.part] === i}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl p-1 text-[11px] font-semibold ring-2 transition active:scale-95',
                          parts[section.part] === i
                            ? 'ring-flame-400'
                            : dark
                              ? 'text-white/70 ring-transparent hover:ring-white/20'
                              : 'text-ink-600 ring-transparent hover:ring-ink-200',
                        )}
                      >
                        <Avatar code={preview} className="w-full rounded-full" />
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))
        )}
      </div>
    </div>
  );
}
