import { useState } from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import {
  AVATAR_PRESETS,
  BACKGROUND_NAMES,
  BACKGROUNDS,
  EXTRAS,
  EYES,
  HAIR_COLOR_NAMES,
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTHS,
  SHIRT_COLOR_NAMES,
  SHIRT_COLORS,
  SHIRT_STYLES,
  SKIN_NAMES,
  SKIN_TONES,
  decodeAvatar,
  withPart,
  type AvatarPartKey,
} from '@/lib/avatar';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { Avatar } from './Avatar';

type Tab = 'looks' | 'face' | 'hair' | 'outfit' | 'extras';

const TABS: { value: Tab; label: string }[] = [
  { value: 'looks', label: 'Looks' },
  { value: 'face', label: 'Face' },
  { value: 'hair', label: 'Hair' },
  { value: 'outfit', label: 'Outfit' },
  { value: 'extras', label: 'Extras' },
];

type Section =
  | { kind: 'shapes'; part: AvatarPartKey; label: string; names: readonly string[] }
  | { kind: 'colors'; part: AvatarPartKey; label: string; colors: readonly string[]; names: readonly string[] };

const SECTIONS: Record<Exclude<Tab, 'looks'>, Section[]> = {
  face: [
    { kind: 'colors', part: 'skin', label: 'Skin tone', colors: SKIN_TONES.map(([base]) => base), names: SKIN_NAMES },
    { kind: 'shapes', part: 'eyes', label: 'Eyes', names: EYES },
    { kind: 'shapes', part: 'mouth', label: 'Mouth', names: MOUTHS },
  ],
  hair: [
    { kind: 'shapes', part: 'hairStyle', label: 'Style', names: HAIR_STYLES },
    { kind: 'colors', part: 'hairColor', label: 'Colour', colors: HAIR_COLORS, names: HAIR_COLOR_NAMES },
  ],
  outfit: [
    { kind: 'shapes', part: 'shirtStyle', label: 'Top', names: SHIRT_STYLES },
    { kind: 'colors', part: 'shirtColor', label: 'Colour', colors: SHIRT_COLORS, names: SHIRT_COLOR_NAMES },
  ],
  extras: [
    { kind: 'shapes', part: 'extra', label: 'Extra', names: EXTRAS },
    { kind: 'colors', part: 'background', label: 'Background', colors: BACKGROUNDS, names: BACKGROUND_NAMES },
  ],
};

/**
 * The avatar options: ready-made looks, then one tab per body area. The preview lives in
 * AvatarHero so the page can place it. Night canvas only (student screens).
 */
export function AvatarBuilder({
  value,
  onChange,
  presetColumns = 'scroll',
}: {
  value: string;
  onChange: (code: string) => void;
  /** `scroll`: a 2-row horizontal snap scroller (phones). `grid`: an 8-column grid (wide screens). */
  presetColumns?: 'scroll' | 'grid';
  /** Legacy prop, ignored: the builder is always drawn for the night canvas. */
  dark?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('looks');
  const parts = decodeAvatar(value);

  return (
    <div className="space-y-4">
      <UnderlineTabs label="Avatar options" layoutId="avatar-tabs" value={tab} onChange={setTab} options={TABS} tone="night" as="tablist" />

      <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label} className="space-y-5">
        {tab === 'looks' ? (
          <div
            className={cn(
              presetColumns === 'scroll'
                ? '-mx-1 grid snap-x snap-mandatory auto-cols-[4.25rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] lg:mx-0 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-8 lg:grid-rows-none lg:overflow-visible lg:px-0'
                : 'grid grid-cols-6 gap-2 lg:grid-cols-8',
            )}
          >
            {AVATAR_PRESETS.map((preset) => {
              const selected = value === preset.code;
              return (
                <button
                  key={preset.code}
                  type="button"
                  onClick={() => onChange(preset.code)}
                  aria-label={preset.name}
                  aria-pressed={selected}
                  className="relative snap-start rounded-full p-1 transition-transform duration-[var(--dur-instant)] active:scale-95"
                >
                  {selected && (
                    <m.span layoutId="preset-frame" aria-hidden className="absolute inset-0 rounded-full ring-[3px] ring-night-text" transition={spring.layout} />
                  )}
                  <Avatar code={preset.code} className="w-full rounded-full" />
                </button>
              );
            })}
          </div>
        ) : (
          SECTIONS[tab].map((section) => (
            <fieldset key={section.part}>
              <legend className="type-kicker mb-2">{section.label}</legend>
              {section.kind === 'colors' ? (
                <div className="flex flex-wrap gap-1.5">
                  {section.colors.map((color, i) => {
                    const selected = parts[section.part] === i;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onChange(withPart(value, section.part, i))}
                        aria-label={`${section.label}, ${section.names[i] ?? i + 1}`}
                        aria-pressed={selected}
                        className="grid size-11 place-items-center rounded-full transition-transform duration-[var(--dur-instant)] active:scale-90"
                      >
                        <span
                          className={cn(
                            'block size-9 rounded-full border',
                            selected ? 'border-night-950 ring-[3px] ring-night-text' : 'border-night-line',
                          )}
                          style={{ backgroundColor: color }}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {section.names.map((name, i) => {
                    const preview = withPart(value, section.part, i);
                    const selected = parts[section.part] === i;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => onChange(preview)}
                        aria-pressed={selected}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-md p-1.5 text-caption transition-colors duration-[var(--dur-fast)]',
                          selected ? 'bg-night-800 text-night-text ring-2 ring-night-text' : 'text-night-muted hover:bg-night-900 hover:text-night-text',
                        )}
                      >
                        <Avatar code={preview} className="w-full rounded-full" />
                        <span className="w-full truncate">{name}</span>
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
