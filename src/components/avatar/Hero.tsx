import { memo, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { SHIRT_COLORS, SKIN_TONES, decodeAvatar } from '@/lib/avatar';
import { Avatar, type AvatarMood } from './Avatar';
import { WeaponIcon } from '@/components/battle/WeaponIcon';
import '@/styles/hero.css';

/**
 * A student's full figure: their avatar head on a small body in their own skin tone and shirt
 * colour, so a class on the projector looks like a team, not a sheet of stickers. Poses are CSS:
 *   idle    breathing, arms swaying
 *   attack  an overhead swing (with the class weapon in hand)
 *   cheer   both arms up, bouncing
 *   brace   arms up to shield from the counter-attack
 *   climb   alternating arms, reaching up
 *   fall    arms flailing
 * The box is `size` wide and 1.5 × `size` tall; the feet are at the bottom edge.
 */
export type HeroPose = 'idle' | 'attack' | 'cheer' | 'brace' | 'climb' | 'fall';

const PANTS = '#2b2f3a';
const SHOES = '#151021';

export const Hero = memo(function Hero({
  code,
  size,
  pose = 'idle',
  mood = null,
  weapon = null,
  equipping = false,
  delayMs = 0,
  className,
  ring,
  headScale = 0.86,
}: {
  code: string;
  size: number;
  pose?: HeroPose;
  mood?: AvatarMood | null;
  /** The class weapon in the right hand. */
  weapon?: string | null;
  /** The weapon pops into the hand (just equipped). */
  equipping?: boolean;
  /** Pose animation delay (an attack swing in time with its projectile). */
  delayMs?: number;
  className?: string;
  /** Outline colour around the head (e.g. the top three). */
  ring?: string;
  /** Head width as a share of the figure's width (big, friendly heads read at a distance). */
  headScale?: number;
}) {
  const p = decodeAvatar(code);
  const [skin] = SKIN_TONES[p.skin] ?? SKIN_TONES[0];
  const shirt = SHIRT_COLORS[p.shirtColor] ?? SHIRT_COLORS[0];
  const style = { width: size, height: size * 1.5, '--hd': `${delayMs}ms` } as CSSProperties;
  return (
    <div className={cn('hero relative', className)} data-pose={pose} style={style}>
      <svg viewBox="0 0 100 150" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <ellipse cx="50" cy="146" rx="28" ry="5" fill="rgb(0 0 0 / 0.35)" />
        <g className="hero-body">
          <rect className="hero-leg hero-leg-l" x="35" y="106" width="13" height="34" rx="5" fill={PANTS} />
          <rect className="hero-leg hero-leg-r" x="52" y="106" width="13" height="34" rx="5" fill={PANTS} />
          <ellipse cx="41" cy="142" rx="9" ry="5" fill={SHOES} />
          <ellipse cx="59" cy="142" rx="9" ry="5" fill={SHOES} />
          <path d="M28 82 Q30 70 42 70 L58 70 Q70 70 72 82 L74 112 Q50 118 26 112 Z" fill={shirt} stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.5" />
          <g className="hero-arm hero-arm-l">
            <rect x="19" y="74" width="12" height="32" rx="6" fill={shirt} stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.5" />
            <circle cx="25" cy="108" r="6" fill={skin} />
          </g>
          <g className="hero-arm hero-arm-r">
            <rect x="69" y="74" width="12" height="32" rx="6" fill={shirt} stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.5" />
            <circle cx="75" cy="108" r="6" fill={skin} />
            {weapon && (
              <foreignObject x="58" y="70" width="44" height="44" className={cn('hero-weapon', equipping && 'hero-weapon-in')}>
                <WeaponIcon weapon={weapon} className="size-full" />
              </foreignObject>
            )}
          </g>
        </g>
      </svg>
      <div className="hero-head absolute left-1/2 -translate-x-1/2" style={{ width: size * headScale, height: size * headScale, top: size * (0.74 - headScale) }}>
        <Avatar code={code} mood={mood} className="size-full rounded-full" />
        {ring && <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 ${Math.max(3, size * 0.04)}px ${ring}` }} />}
      </div>
    </div>
  );
});
