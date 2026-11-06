import { extendTailwindMerge } from 'tailwind-merge';

type ClassValue = string | number | false | null | undefined | ClassValue[];

/**
 * tailwind-merge taught about Rally's custom theme keys, so `cn('h-9 text-body', 'h-11 text-title')`
 * keeps only the last class of each group. Without the `text` keys, `text-caption` etc. would be
 * mistaken for text colours and never conflict with `text-sm`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'caption',
        'body-sm',
        'body',
        'label',
        'title',
        'headline',
        'display-lg',
        'display-xl',
        'score-sm',
        'score-md',
        'score-xl',
        'stage-pin',
        'stage-title',
        'stage-url',
        'stage-label',
        'stage-name',
      ],
      shadow: ['pop', 'press', 'card', 'lift'],
      ease: ['wipe', 'snap', 'snappy'],
    },
  },
});

function join(values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = join(value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(' ');
}

/** Joins class names (nested arrays and falsy values allowed); later Tailwind classes win conflicts. */
export function cn(...values: ClassValue[]): string {
  return twMerge(join(values));
}
