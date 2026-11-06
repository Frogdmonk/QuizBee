/**
 * Layered player avatars.
 *
 * An avatar is a 9-digit code, one digit per part, in this order:
 *   skin · hair style · hair colour · eyes · mouth · shirt style · shirt colour · extra · background
 * The database validates the same shape (see private.clean_avatar in the
 * Phase 3 migration), so keep the option counts below in sync with that regex:
 *   ^[0-7][0-9][0-7][0-5][0-5][0-5][0-9][0-5][0-7]$
 * 8 × 10 × 8 × 6 × 6 × 6 × 10 × 6 × 8 = 66,355,200 combinations.
 */

export type AvatarParts = {
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyes: number;
  mouth: number;
  shirtStyle: number;
  shirtColor: number;
  extra: number;
  background: number;
};

export type AvatarPartKey = keyof AvatarParts;

export const PART_ORDER: AvatarPartKey[] = [
  'skin',
  'hairStyle',
  'hairColor',
  'eyes',
  'mouth',
  'shirtStyle',
  'shirtColor',
  'extra',
  'background',
];

/** [base, shade] pairs. */
export const SKIN_TONES: readonly (readonly [string, string])[] = [
  ['#fde4d4', '#f1c7ae'],
  ['#f6cdaf', '#e5b08e'],
  ['#ebb68e', '#d69a6f'],
  ['#d99b6c', '#c18053'],
  ['#c08055', '#a5683f'],
  ['#9c6441', '#83502f'],
  ['#7a4b2f', '#633a22'],
  ['#5a3521', '#462817'],
];

export const HAIR_COLORS = ['#1f1a17', '#4a2e1d', '#7b4a25', '#b9692f', '#e3b866', '#c9c3ba', '#d9467a', '#3e7be0'] as const;

export const SHIRT_COLORS = [
  '#3456e0',
  '#0e9f9a',
  '#d23e7f',
  '#e09a00',
  '#f0532b',
  '#22b07d',
  '#7a5af8',
  '#2a2840',
  '#ece9e2',
  '#e5484d',
] as const;

export const BACKGROUNDS = ['#ffe1d5', '#dce6ff', '#d3f1ec', '#fbdbea', '#fff0c2', '#e4dafe', '#d9f2e6', '#2a2840'] as const;

export const HAIR_STYLES = ['Buzz', 'Short', 'Spiky', 'Curly', 'Long', 'Bun', 'Bob', 'Puff', 'Swoop', 'Beanie'] as const;
export const EYES = ['Dots', 'Happy', 'Wide', 'Wink', 'Sleepy', 'Sparkle'] as const;
export const MOUTHS = ['Smile', 'Grin', 'Surprised', 'Smirk', 'Silly', 'Calm'] as const;
export const SHIRT_STYLES = ['T-shirt', 'Hoodie', 'Collar', 'Stripes', 'V-neck', 'Overalls'] as const;
export const EXTRAS = ['None', 'Glasses', 'Shades', 'Freckles', 'Blush', 'Headphones'] as const;

export const PART_COUNTS: Record<AvatarPartKey, number> = {
  skin: SKIN_TONES.length,
  hairStyle: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  eyes: EYES.length,
  mouth: MOUTHS.length,
  shirtStyle: SHIRT_STYLES.length,
  shirtColor: SHIRT_COLORS.length,
  extra: EXTRAS.length,
  background: BACKGROUNDS.length,
};

export const AVATAR_PATTERN = /^[0-7][0-9][0-7][0-5][0-5][0-5][0-9][0-5][0-7]$/;

export function isAvatarCode(code: unknown): code is string {
  return typeof code === 'string' && AVATAR_PATTERN.test(code);
}

export function encodeAvatar(parts: AvatarParts): string {
  return PART_ORDER.map((key) => {
    const value = Math.trunc(parts[key]);
    if (!(value >= 0 && value < PART_COUNTS[key])) throw new RangeError(`Avatar ${key} out of range: ${value}`);
    return String(value);
  }).join('');
}

/** Decodes an avatar code. Invalid codes fall back to the first preset. */
export function decodeAvatar(code: string): AvatarParts {
  const safe = isAvatarCode(code) ? code : AVATAR_PRESETS[0].code;
  const parts = {} as AvatarParts;
  PART_ORDER.forEach((key, i) => {
    parts[key] = Number(safe[i]);
  });
  return parts;
}

export function withPart(code: string, key: AvatarPartKey, value: number): string {
  return encodeAvatar({ ...decodeAvatar(code), [key]: value });
}

export function randomAvatar(random: () => number = Math.random): string {
  const parts = {} as AvatarParts;
  for (const key of PART_ORDER) parts[key] = Math.floor(random() * PART_COUNTS[key]);
  return encodeAvatar(parts);
}

/** Ready-made looks shown first in the picker. Every code is a valid avatar. */
export const AVATAR_PRESETS: readonly { name: string; code: string }[] = [
  { name: 'Comet', code: '110100001' },
  { name: 'Pixel', code: '322223112' },
  { name: 'Maple', code: '434015453' },
  { name: 'Nova', code: '556131204' },
  { name: 'Echo', code: '613542015' },
  { name: 'Juniper', code: '741351516' },
  { name: 'Zephyr', code: '287402320' },
  { name: 'Biscuit', code: '053250731' },
  { name: 'Orbit', code: '190313912' },
  { name: 'Clover', code: '264420553' },
  { name: 'Sprout', code: '305034504' },
  { name: 'Mango', code: '476103345' },
  { name: 'Quill', code: '581545106' },
  { name: 'Rocket', code: '621352627' },
  { name: 'Willow', code: '742201810' },
  { name: 'Ziggy', code: '063412924' },
  { name: 'Pebble', code: '152230232' },
  { name: 'Saffron', code: '233151343' },
  { name: 'Indigo', code: '365004605' },
  { name: 'Marble', code: '410333026' },
  { name: 'Tango', code: '527125432' },
  { name: 'Koala', code: '691440151' },
  { name: 'Lumen', code: '784214917' },
  { name: 'Fable', code: '044522704' },
  { name: 'Hazel', code: '130031423' },
  { name: 'Cosmo', code: '297413506' },
  { name: 'Puddle', code: '343255012' },
  { name: 'Ripple', code: '465100221' },
  { name: 'Sable', code: '571344835' },
  { name: 'Topaz', code: '651000143' },
  { name: 'Waffle', code: '726523054' },
  { name: 'Yonder', code: '016234506' },
];
