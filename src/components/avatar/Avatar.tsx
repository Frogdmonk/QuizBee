import { memo, useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  BACKGROUNDS,
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  decodeAvatar,
} from '@/lib/avatar';

const INK = '#1f1a17';

type AvatarProps = {
  code: string;
  className?: string;
  /** Accessible name; omit for decorative avatars next to a visible name. */
  title?: string;
  /** `own`: the 3px night-text ring marking the player's own avatar. */
  ring?: 'own';
  /** A passing expression (lobby reactions). Overrides the eyes and mouth from the code. */
  mood?: AvatarMood | null;
};

export type AvatarMood = 'happy' | 'laugh' | 'surprised' | 'angry' | 'dizzy' | 'sad' | 'confused';

/** [eyes, mouth] from the regular part lists; 'dizzy' and 'sad' draw their own on top. */
const MOOD_FACE: Record<AvatarMood, [number, number]> = {
  happy: [1, 0],
  laugh: [1, 1],
  surprised: [2, 2],
  angry: [0, 5],
  dizzy: [-1, 4],
  sad: [4, -1],
  confused: [3, 3],
};

/**
 * Original layered character drawn as inline SVG (120×120). Pure and memoised:
 * a projector renders up to 100 of these.
 */
export const Avatar = memo(function Avatar({ code, className, title, ring, mood }: AvatarProps) {
  const p = decodeAvatar(code);
  const uid = useId().replace(/:/g, '');
  const clip = `av-clip-${uid}`;
  const shirtClip = `av-shirt-${uid}`;
  const [skin, skinShade] = SKIN_TONES[p.skin];
  const hair = HAIR_COLORS[p.hairColor];
  const shirt = SHIRT_COLORS[p.shirtColor];
  const lightShirt = p.shirtColor === 8;
  const [eyes, mouth] = mood ? MOOD_FACE[mood] : [p.eyes, p.mouth];

  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('block aspect-square shrink-0', ring === 'own' && 'rounded-full ring-[3px] ring-night-text', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
        <clipPath id={shirtClip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="120" height="120" fill={BACKGROUNDS[p.background]} />
        <HairBack style={p.hairStyle} color={hair} />
        {/* neck */}
        <rect x="51" y="70" width="18" height="24" rx="7" fill={skinShade} />
        <Shirt style={p.shirtStyle} color={shirt} skin={skin} skinShade={skinShade} clipId={shirtClip} light={lightShirt} />
        {/* ears */}
        <circle cx="35" cy="57" r="5.5" fill={skinShade} />
        <circle cx="85" cy="57" r="5.5" fill={skinShade} />
        {/* head */}
        <ellipse cx="60" cy="54" rx="25" ry="27" fill={skin} />
        <Extra extra={p.extra} phase="under" skinShade={skinShade} />
        {eyes >= 0 ? <Eyes eyes={eyes} /> : <DizzyEyes />}
        {mouth >= 0 ? <Mouth mouth={mouth} /> : <path d="M52 71 Q60 64 68 71" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />}
        {mood === 'angry' && (
          <g stroke={INK} strokeWidth={3} strokeLinecap="round">
            <path d="M43 46 L55 50" />
            <path d="M77 46 L65 50" />
          </g>
        )}
        {mood === 'sad' && <path d="M73 60 q2 4 0 6 q-2 -2 0 -6 Z" fill="#6fb6ff" />}
        <HairFront style={p.hairStyle} color={hair} />
        <Extra extra={p.extra} phase="over" skinShade={skinShade} />
      </g>
    </svg>
  );
});

const BODY = 'M14 122 C14 101 33 89 60 89 C87 89 106 101 106 122 Z';

function HairBack({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 4: // long
      return <path d="M32 52 C30 22 90 22 88 52 L92 96 C78 102 42 102 28 96 Z" fill={color} />;
    case 5: // bun
      return <circle cx="60" cy="23" r="11" fill={color} />;
    case 6: // bob
      return <path d="M31 54 C30 22 90 22 89 54 L89 78 C80 82 40 82 31 78 Z" fill={color} />;
    case 7: // puff
      return (
        <g fill={color}>
          <circle cx="60" cy="40" r="32" />
          <circle cx="34" cy="52" r="14" />
          <circle cx="86" cy="52" r="14" />
        </g>
      );
    default:
      return null;
  }
}

function HairFront({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 0: // buzz
      return <path d="M35 49 C35 27 85 27 85 49 C78 40 42 40 35 49 Z" fill={color} opacity="0.85" />;
    case 1: // short
      return <path d="M34 51 C31 23 89 21 86 51 C81 39 71 34 60 36 C49 34 40 38 34 51 Z" fill={color} />;
    case 2: // spiky
      return (
        <path
          d="M34 51 L35 31 L44 36 L47 21 L56 31 L62 18 L68 31 L76 21 L78 35 L86 30 L86 51 C76 39 44 39 34 51 Z"
          fill={color}
          strokeLinejoin="round"
        />
      );
    case 3: // curly
      return (
        <g fill={color}>
          {[37, 45, 53, 61, 69, 77, 84].map((cx, i) => (
            <circle key={cx} cx={cx} cy={i % 2 ? 31 : 35} r="9" />
          ))}
          <circle cx="34" cy="45" r="6.5" />
          <circle cx="86" cy="45" r="6.5" />
        </g>
      );
    case 4: // long: side-swept fringe
      return <path d="M34 55 C31 25 89 25 86 55 C80 40 66 34 61 34 C56 41 45 45 34 55 Z" fill={color} />;
    case 5: // bun: slicked back
      return <path d="M35 50 C34 28 86 28 85 50 C76 38 44 38 35 50 Z" fill={color} />;
    case 6: // bob: straight bangs
      return <path d="M32 55 C31 23 89 23 88 55 C87 45 83 41 77 41 L43 41 C37 41 33 45 32 55 Z" fill={color} />;
    case 7: // puff: hairline
      return <path d="M34 49 C34 31 86 31 86 49 C76 41 44 41 34 49 Z" fill={color} />;
    case 8: // swoop
      return (
        <path d="M34 53 C29 21 91 19 86 53 C84 41 77 33 51 36 C44 37 38 44 34 53 Z" fill={color} />
      );
    case 9: // beanie
      return (
        <g>
          <path d="M33 49 C33 19 87 19 87 49 Z" fill={color} />
          <rect x="31" y="42" width="58" height="10" rx="5" fill={color} />
          <rect x="31" y="42" width="58" height="10" rx="5" fill="#000" opacity="0.18" />
          <circle cx="60" cy="19" r="6" fill={color} />
          <circle cx="60" cy="19" r="6" fill="#fff" opacity="0.25" />
        </g>
      );
    default:
      return null;
  }
}

function DizzyEyes() {
  return (
    <g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
      <path d="M46 51 L54 59 M54 51 L46 59" />
      <path d="M66 51 L74 59 M74 51 L66 59" />
    </g>
  );
}

function Eyes({ eyes }: { eyes: number }) {
  const stroke = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };
  switch (eyes) {
    case 1: // happy
      return (
        <g {...stroke}>
          <path d="M45 57 Q50 51 55 57" />
          <path d="M65 57 Q70 51 75 57" />
        </g>
      );
    case 2: // wide
      return (
        <g>
          <circle cx="50" cy="55" r="5.5" fill="#fff" />
          <circle cx="70" cy="55" r="5.5" fill="#fff" />
          <circle cx="51" cy="56" r="2.8" fill={INK} />
          <circle cx="71" cy="56" r="2.8" fill={INK} />
        </g>
      );
    case 3: // wink
      return (
        <g>
          <circle cx="50" cy="55" r="3.2" fill={INK} />
          <path d="M65 56 Q70 51 75 56" {...stroke} />
        </g>
      );
    case 4: // sleepy
      return (
        <g {...stroke}>
          <path d="M45 55 Q50 59 55 55" />
          <path d="M65 55 Q70 59 75 55" />
        </g>
      );
    case 5: // sparkle
      return (
        <g fill={INK}>
          <path d="M50 49 L51.6 53.4 L56 55 L51.6 56.6 L50 61 L48.4 56.6 L44 55 L48.4 53.4 Z" />
          <path d="M70 49 L71.6 53.4 L76 55 L71.6 56.6 L70 61 L68.4 56.6 L64 55 L68.4 53.4 Z" />
        </g>
      );
    default: // dots
      return (
        <g fill={INK}>
          <circle cx="50" cy="55" r="3.2" />
          <circle cx="70" cy="55" r="3.2" />
        </g>
      );
  }
}

function Mouth({ mouth }: { mouth: number }) {
  const stroke = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mouth) {
    case 1: // grin
      return (
        <g>
          <path d="M49 65 Q60 80 71 65 Z" fill={INK} />
          <path d="M51 66 L69 66 L67.5 69 L52.5 69 Z" fill="#fff" />
        </g>
      );
    case 2: // surprised
      return <ellipse cx="60" cy="69" rx="3.6" ry="4.6" fill={INK} />;
    case 3: // smirk
      return <path d="M53 69 Q62 72 68 65" {...stroke} />;
    case 4: // silly
      return (
        <g>
          <path d="M50 65 Q60 77 70 65 Z" fill={INK} />
          <path d="M55 70 Q60 79 65 70 Z" fill="#f06a8a" />
        </g>
      );
    case 5: // calm
      return <path d="M54 69 L66 69" {...stroke} />;
    default: // smile
      return <path d="M51 66 Q60 74 69 66" {...stroke} />;
  }
}

function Shirt({
  style,
  color,
  skin,
  skinShade,
  clipId,
  light,
}: {
  style: number;
  color: string;
  skin: string;
  skinShade: string;
  clipId: string;
  light: boolean;
}) {
  const trim = light ? '#c9c4b8' : '#000';
  let detail: ReactNode;
  switch (style) {
    case 1: // hoodie
      detail = (
        <g>
          <path d="M40 92 C44 82 76 82 80 92 C74 100 46 100 40 92 Z" fill={trim} opacity="0.2" />
          <path d="M53 96 L52 110 M67 96 L68 110" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        </g>
      );
      break;
    case 2: // collar
      detail = (
        <g fill="#fff">
          <path d="M60 92 L46 88 L50 101 Z" />
          <path d="M60 92 L74 88 L70 101 Z" />
          <circle cx="60" cy="104" r="1.6" fill={trim} opacity="0.35" />
          <circle cx="60" cy="112" r="1.6" fill={trim} opacity="0.35" />
        </g>
      );
      break;
    case 3: // stripes
      detail = (
        <g clipPath={`url(#${clipId})`} fill="#fff" opacity={light ? 1 : 0.85}>
          {[97, 106, 115].map((y) => (
            <rect key={y} x="0" y={y} width="120" height="4" fill={light ? '#3456e0' : '#fff'} />
          ))}
        </g>
      );
      break;
    case 4: // v-neck
      detail = <path d="M51 89 L60 102 L69 89 Z" fill={skinShade} />;
      break;
    case 5: // overalls
      detail = (
        <g clipPath={`url(#${clipId})`}>
          <path d="M40 102 L80 102 L84 122 L36 122 Z" fill="#3e5c9a" />
          <path d="M42 102 L46 90 M78 102 L74 90" stroke="#3e5c9a" strokeWidth="5" strokeLinecap="round" />
          <circle cx="45" cy="104" r="1.8" fill="#e3b866" />
          <circle cx="75" cy="104" r="1.8" fill="#e3b866" />
        </g>
      );
      break;
    default:
      detail = null;
  }
  return (
    <g>
      <path d={BODY} fill={color} />
      {/* neckline */}
      {style !== 4 && style !== 1 && <path d="M51 89 Q60 97 69 89 Z" fill={skin} />}
      {detail}
    </g>
  );
}

function Extra({ extra, phase, skinShade }: { extra: number; phase: 'under' | 'over'; skinShade: string }) {
  if (phase === 'under') {
    if (extra === 3) {
      return (
        <g fill={skinShade}>
          {[
            [44, 63],
            [48, 65],
            [43, 66.5],
            [72, 63],
            [76, 65],
            [77, 61.5],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />
          ))}
        </g>
      );
    }
    if (extra === 4) {
      return (
        <g fill="#f06a8a" opacity="0.45">
          <ellipse cx="44" cy="64" rx="5" ry="3" />
          <ellipse cx="76" cy="64" rx="5" ry="3" />
        </g>
      );
    }
    return null;
  }
  switch (extra) {
    case 1: // glasses
      return (
        <g fill="none" stroke={INK} strokeWidth="2.2">
          <circle cx="50" cy="55" r="7.5" />
          <circle cx="70" cy="55" r="7.5" />
          <path d="M57.5 55 L62.5 55 M42.5 54 L36 52 M77.5 54 L84 52" />
        </g>
      );
    case 2: // shades
      return (
        <g>
          <rect x="41" y="49" width="17" height="11" rx="4" fill={INK} />
          <rect x="62" y="49" width="17" height="11" rx="4" fill={INK} />
          <path d="M58 53 L62 53 M41 52 L35 50 M79 52 L85 50" stroke={INK} strokeWidth="2.2" />
          <path d="M44 52 L49 52" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case 5: // headphones
      return (
        <g>
          <path d="M32 56 C30 18 90 18 88 56" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          <rect x="26" y="49" width="11" height="17" rx="5" fill="#f0532b" />
          <rect x="83" y="49" width="11" height="17" rx="5" fill="#f0532b" />
        </g>
      );
    default:
      return null;
  }
}

