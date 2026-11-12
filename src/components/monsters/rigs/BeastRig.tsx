import { Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

type HeadKind = 'dog' | 'lion' | 'goat';

function BeastHead({ kind, mane, defeated }: { kind: HeadKind; mane: string; defeated: boolean }) {
  return (
    <g className="rg-sway">
      {kind !== 'goat' && mane === 'flames' && <path className="rg-glow rg-flicker" d="M-58 0 C -76 -40 -50 -60 -40 -86 C -24 -60 0 -84 0 -96 C 12 -70 34 -66 40 -86 C 54 -60 78 -40 58 0 C 50 30 -50 30 -58 0 Z" />}
      {kind !== 'goat' && mane === 'spikes' && <path className="rg-dark" d="M-56 6 L -74 -20 L -50 -24 L -60 -54 L -30 -44 L -24 -76 L 0 -54 L 24 -76 L 30 -44 L 60 -54 L 50 -24 L 74 -20 L 56 6 Z" />}
      {(kind === 'lion' || (kind === 'dog' && mane === 'fur')) && <circle className="rg-membrane" cx="0" cy="-2" r={kind === 'lion' ? 60 : 50} />}
      {kind === 'dog' && (
        <Mirror>
          <path className="rg-main" d="M-34 -18 L -48 -60 L -12 -34 Z" />
        </Mirror>
      )}
      {kind === 'lion' && (
        <>
          <circle className="rg-main" cx="-30" cy="-30" r="12" />
          <circle className="rg-main" cx="30" cy="-30" r="12" />
        </>
      )}
      {kind === 'goat' && <path className="rg-horn" d="M-14 -30 C -50 -60 -70 -20 -44 -10 C -50 -30 -36 -40 -20 -24 Z M14 -30 C 50 -60 70 -20 44 -10 C 50 -30 36 -40 20 -24 Z" />}
      <path className="rg-main" d={kind === 'goat' ? 'M-30 -4 C -32 -40 32 -40 30 -4 C 30 30 14 50 0 54 C -14 50 -30 30 -30 -4 Z' : 'M-40 0 C -44 -40 44 -40 40 0 C 40 30 20 44 0 46 C -20 44 -40 30 -40 0 Z'} />
      <path className="rg-light" d={kind === 'goat' ? 'M-14 22 C -14 12 14 12 14 22 C 14 40 6 50 0 52 C -6 50 -14 40 -14 22 Z' : 'M-20 16 C -20 4 20 4 20 16 C 20 36 10 46 0 46 C -10 46 -20 36 -20 16 Z'} />
      {kind === 'goat' && <path className="rg-membrane" d="M-8 50 L 0 74 L 8 50 Z" />}
      <ellipse className="rg-dark" cx="0" cy={kind === 'goat' ? 22 : 12} rx="9" ry="6" />
      <Eye cx={-16} cy={-8} r={8} defeated={defeated} glow />
      <Eye cx={16} cy={-8} r={8} defeated={defeated} glow />
      <path className="rg-brow" d="M-28 -20 L -8 -14 M28 -20 L 8 -14" style={{ strokeWidth: 5 }} />
      {kind !== 'goat' && <path className="rg-bone" d="M-10 34 l3 10 l4 -9 Z M10 34 l-3 10 l-4 -9 Z" />}
    </g>
  );
}

/** Three-headed guardians and chimeras: a broad four-legged body with several heads. */
export function BeastRig({ spec, stage }: RigProps) {
  const { mane, tail } = spec.parts;
  const defeated = stage === 'defeated';
  const chimera = spec.archetype === 'chimera';
  const heads: { kind: HeadKind; x: number; y: number; s: number }[] = chimera
    ? [
        { kind: 'goat', x: 270, y: 118, s: 0.95 },
        { kind: 'lion', x: 170, y: 140, s: 1.15 },
      ]
    : [
        { kind: 'dog', x: 116, y: 170, s: 0.9 },
        { kind: 'dog', x: 284, y: 170, s: 0.9 },
        { kind: 'dog', x: 200, y: 124, s: 1.15 },
      ];
  return (
    <>
      <Shadow rx={170} />
      <g className="mon-body">
        {/* Tail */}
        <path className="rg-main" d="M290 320 C 350 330 380 290 366 240 C 360 220 344 212 336 222 C 350 246 344 296 296 300 Z" />
        {tail === 'spiked' && <path className="rg-dark" d="M352 228 l12 -16 l4 18 Z M368 262 l16 -8 l-4 18 Z" />}
        {tail === 'serpent' && (
          <g transform="translate(340 214)">
            <path className="rg-main" d="M-18 0 C -18 -22 18 -22 18 0 C 18 14 8 22 0 24 C -8 22 -18 14 -18 0 Z" />
            <Eye cx={-7} cy={-4} r={5} slit defeated={defeated} glow />
            <Eye cx={7} cy={-4} r={5} slit defeated={defeated} glow />
          </g>
        )}

        {/* Haunches, body, chest fur */}
        <Mirror>
          <ellipse className="rg-main" cx="96" cy="334" rx="48" ry="44" />
        </Mirror>
        <path className="rg-main" d="M200 170 C 280 170 320 230 316 300 C 312 350 280 372 250 372 L 150 372 C 120 372 88 350 84 300 C 80 230 120 170 200 170 Z" />
        <path className="rg-second" opacity="0.85" d="M200 210 C 236 210 254 250 248 292 L 236 280 L 228 304 L 214 286 L 200 312 L 186 286 L 172 304 L 164 280 L 152 292 C 146 250 164 210 200 210 Z" />

        {/* Front legs and paws */}
        <Mirror>
          <path className="rg-main" d="M150 296 L 140 384 L 184 384 L 188 296 Z" />
          <ellipse className="rg-main" cx="160" cy="388" rx="30" ry="12" />
          <path className="rg-bone" d="M138 392 l4 9 l5 -8 Z M154 394 l4 9 l5 -8 Z M170 394 l4 9 l5 -8 Z" />
        </Mirror>

        {/* Spiked collar (guardian hound) */}
        {!chimera && (
          <>
            <path className="rg-dark" d="M120 198 Q 200 228 280 198 L 284 214 Q 200 246 116 214 Z" />
            <path className="rg-metal" d="M140 210 l-4 14 l10 -8 Z M170 220 l-2 15 l9 -10 Z M200 224 l0 15 l7 -12 Z M230 220 l2 15 l-9 -10 Z M260 210 l4 14 l-10 -8 Z" />
          </>
        )}

        {/* Heads */}
        {heads.map((h, i) => (
          <g key={i} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
            <BeastHead kind={h.kind} mane={mane} defeated={defeated} />
          </g>
        ))}

        <RageAura points={[[60, 220], [340, 210], [40, 330], [360, 320], [140, 60], [260, 56]]} />
        <Stars y={56} />
      </g>
    </>
  );
}
