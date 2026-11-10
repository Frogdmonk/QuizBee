import { memo } from 'react';
import '@/styles/camp.css';

/**
 * The lobby as a camp before the battle (projector only): two tents, a campfire and a few rocks,
 * drawn behind the players in the playground's 1000×700 world. Static SVG plus a CSS flame.
 */
export const CampScenery = memo(function CampScenery({ lurker = false }: { lurker?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 1000 700" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="camp-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Before a boss battle: the monster waits on the horizon, one eye glowing. */}
        {lurker && (
          <g transform="translate(790 -4) scale(1.3)">
            <path
              d="M18 108 C 10 70 22 34 60 34 C 98 34 110 70 102 108 Z M34 40 C 24 22 26 8 36 2 C 36 18 44 28 52 34 Z M86 40 C 96 22 94 8 84 2 C 84 18 76 28 68 34 Z"
              fill="#2a2147"
              stroke="#b91c1c"
              strokeOpacity="0.55"
              strokeWidth="2.5"
            />
            <ellipse className="world-lurker-eye" cx="60" cy="62" rx="10" ry="8" fill="#facc15" />
          </g>
        )}
        {/* The firelight on the ground. */}
        <ellipse className="camp-light" cx="500" cy="640" rx="320" ry="90" fill="url(#camp-glow)" />
        {/* Tents */}
        <g opacity="0.85">
          <path d="M40 640 L140 470 L240 640 Z" fill="#3b2f6b" stroke="#1b1733" strokeWidth="5" strokeLinejoin="round" />
          <path d="M140 470 L118 640 L162 640 Z" fill="#1b1733" />
          <path d="M760 640 L860 480 L960 640 Z" fill="#7c2d12" stroke="#2a0f0c" strokeWidth="5" strokeLinejoin="round" />
          <path d="M860 480 L840 640 L880 640 Z" fill="#2a0f0c" />
          <path d="M860 480 L862 446 L892 458 L862 470" fill="#facc15" />
        </g>
        {/* Rocks */}
        <ellipse cx="300" cy="660" rx="34" ry="16" fill="#2c2546" />
        <ellipse cx="690" cy="668" rx="26" ry="13" fill="#2c2546" />
        {/* Logs */}
        <rect x="462" y="648" width="76" height="14" rx="7" fill="#7c4a12" transform="rotate(-12 500 655)" />
        <rect x="462" y="648" width="76" height="14" rx="7" fill="#5c3610" transform="rotate(12 500 655)" />
      </svg>
      <span className="camp-fire absolute" style={{ left: '50%', top: `${(640 / 700) * 100}%` }} />
    </div>
  );
});
