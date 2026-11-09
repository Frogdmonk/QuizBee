import { memo } from 'react';
import { cn } from '@/lib/cn';

/**
 * The six class weapons, drawn in SVG (original designs). Each has its own silhouette so it reads
 * at avatar-badge size on a projector, not just a different colour.
 */
export const WeaponIcon = memo(function WeaponIcon({ weapon, className, title }: { weapon: string; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('overflow-visible', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {ART[weapon] ?? ART.thunder}
    </svg>
  );
});

const OUTLINE = { stroke: '#151021', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const ART: Record<string, React.ReactNode> = {
  // A broad blade with a lightning fuller and a gold guard.
  thunder: (
    <g {...OUTLINE}>
      <path d="M40 6 L50 14 L26 42 L20 38 Z" fill="#e5e7eb" />
      <path d="M43 12 L36 22 L41 22 L33 32" fill="none" stroke="#facc15" strokeWidth={3.5} />
      <path d="M14 34 L30 50 L26 54 L10 38 Z" fill="#facc15" />
      <path d="M20 46 L10 56" strokeWidth={6} stroke="#7c4a12" />
      <circle cx="8.5" cy="57.5" r="4" fill="#facc15" />
    </g>
  ),
  // A crooked staff holding a flame.
  inferno: (
    <g {...OUTLINE}>
      <path d="M14 58 L38 22" strokeWidth={6} stroke="#7c4a12" />
      <path d="M36 24 C 30 22, 30 14, 36 12 C 38 16, 42 16, 44 12 C 50 18, 46 26, 40 27 Z" fill="#a16207" />
      <path d="M44 4 C 56 12, 54 26, 44 28 C 36 28, 32 20, 38 12 C 40 16, 42 16, 42 12 C 42 9, 43 7, 44 4 Z" fill="#f97316" />
      <path d="M44 14 C 49 18, 48 24, 44 25 C 41 25, 39 22, 41 18 C 42 20, 43 19, 44 14 Z" fill="#fde047" strokeWidth={2} />
    </g>
  ),
  // A heavy hammer with an ice head.
  frost: (
    <g {...OUTLINE}>
      <path d="M30 30 L10 56" strokeWidth={6} stroke="#7c4a12" />
      <path d="M22 12 L46 6 L54 28 L30 34 Z" fill="#a5f3fc" />
      <path d="M30 14 L34 26 M38 11 L42 24 M46 10 L49 20" stroke="#0891b2" strokeWidth={2.5} />
      <path d="M22 12 L18 4 M54 28 L60 34" stroke="#e0f2fe" strokeWidth={2.5} />
    </g>
  ),
  // A recurve bow with a nocked arrow.
  shadow: (
    <g {...OUTLINE}>
      <path d="M14 6 C 40 10, 54 24, 58 50 C 46 44, 34 40, 22 40 C 22 28, 20 16, 14 6 Z" fill="none" stroke="#151021" strokeWidth={7} />
      <path d="M14 6 C 40 10, 54 24, 58 50" fill="none" stroke="#a78bfa" strokeWidth={4} />
      <path d="M14 6 L58 50" stroke="#e5e7eb" strokeWidth={1.5} />
      <path d="M8 56 L44 20" stroke="#c4b5fd" strokeWidth={3} />
      <path d="M44 20 L50 18 L46 26 Z" fill="#c4b5fd" />
    </g>
  ),
  // A long spear with a faceted crystal point.
  crystal: (
    <g {...OUTLINE}>
      <path d="M8 58 L40 26" strokeWidth={5} stroke="#7c4a12" />
      <path d="M38 22 L52 4 L60 12 L42 26 L36 28 Z" fill="#5eead4" />
      <path d="M44 18 L56 8" stroke="#ccfbf1" strokeWidth={2} />
      <path d="M32 26 L38 32" stroke="#facc15" strokeWidth={4} />
    </g>
  ),
  // A slim wand with a heart-shaped gem.
  healing: (
    <g {...OUTLINE}>
      <path d="M12 56 L38 30" strokeWidth={5} stroke="#e5e7eb" />
      <path d="M44 32 C 34 26, 32 16, 38 12 C 42 10, 45 12, 46 15 C 48 11, 52 10, 55 12 C 60 17, 54 27, 44 32 Z" fill="#86efac" />
      <path d="M8 40 l3 0 M9.5 38.5 l0 3 M52 44 l3 0 M53.5 42.5 l0 3" stroke="#bbf7d0" strokeWidth={2} />
    </g>
  ),
};
