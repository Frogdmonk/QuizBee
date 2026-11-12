import { Eye, RageAura, Shadow, Stars, type RigProps } from '../shared';

type Head = { x: number; y: number; base: number };

const LAYOUT: Record<number, readonly Head[]> = {
  1: [{ x: 200, y: 112, base: 200 }],
  3: [
    { x: 104, y: 160, base: 170 },
    { x: 200, y: 96, base: 200 },
    { x: 296, y: 160, base: 230 },
  ],
  5: [
    { x: 64, y: 200, base: 160 },
    { x: 126, y: 128, base: 180 },
    { x: 200, y: 84, base: 200 },
    { x: 274, y: 128, base: 220 },
    { x: 336, y: 200, base: 240 },
  ],
};

/** Hydras, basilisks and sea monsters: coils with one or many necks and swaying heads. */
export function SerpentRig({ spec, stage }: RigProps) {
  const { heads, crest, coil } = spec.parts;
  const defeated = stage === 'defeated';
  const count = Number(heads) in LAYOUT ? Number(heads) : 1;
  const drop = coil === 'low' ? 40 : 0;
  const size = count === 1 ? 1.5 : count === 3 ? 1.05 : 0.8;
  const neck = count === 1 ? 70 : count === 3 ? 34 : 26;
  const watery = spec.element === 'water' || spec.archetype === 'leviathan';
  const basilisk = spec.archetype === 'basilisk';
  return (
    <>
      <Shadow rx={170} />
      <g className="mon-body">
        {/* Necks rising from the coils */}
        {LAYOUT[count].map((h, i) => {
          // One neck rises in an S curve; several fan out from the coils.
          const d =
            count === 1
              ? `M200 344 C 96 310 300 236 200 ${h.y + drop + 24}`
              : `M${h.base} 340 C ${h.base} 280 ${h.x + (h.x - 200) * 0.2} ${h.y + drop + 120} ${h.x} ${h.y + drop + 20}`;
          return (
            <g key={`n${i}`}>
              <path d={d} fill="none" stroke="var(--m-dark)" strokeWidth={neck + 10} strokeLinecap="round" />
              <path d={d} fill="none" stroke="var(--m-main)" strokeWidth={neck} strokeLinecap="round" />
              <path d={d} fill="none" stroke="var(--m-second)" strokeWidth={neck * 0.34} strokeLinecap="round" opacity="0.8" strokeDasharray="10 8" />
            </g>
          );
        })}

        {/* Coils */}
        {coil === 'high' && <path className="rg-main" d="M100 330 C 100 280 150 262 200 268 C 250 262 300 280 300 330 Z" />}
        <path className="rg-main" d="M50 392 C 46 326 120 300 200 308 C 280 300 354 326 350 392 Z" />
        <path className="rg-second" opacity="0.85" d="M84 386 C 90 350 140 336 200 340 C 260 336 310 350 316 386 Z" />
        <path className="rg-line-soft" d="M110 372 Q 200 350 290 372 M126 356 Q 200 336 274 356" />

        {/* Heads */}
        {LAYOUT[count].map((h, i) => (
          <g key={`h${i}`} transform={`translate(${h.x} ${h.y + drop}) scale(${size})`}>
            <g className="rg-sway">
              {crest === 'hood' && <path className="rg-membrane" d="M-44 10 C -60 -30 -30 -56 0 -56 C 30 -56 60 -30 44 10 C 30 30 -30 30 -44 10 Z" />}
              {crest === 'fins' && (
                <>
                  <path className="rg-membrane" d="M-30 -4 L -62 -26 L -54 4 L -66 16 L -32 12 Z" />
                  <path className="rg-membrane" d="M30 -4 L 62 -26 L 54 4 L 66 16 L 32 12 Z" />
                </>
              )}
              {crest === 'horns' && <path className="rg-horn" d="M-18 -22 L -30 -54 L -6 -28 Z M18 -22 L 30 -54 L 6 -28 Z" />}
              {crest === 'spines' && <path className="rg-dark" d="M-14 -24 l-4 -18 l12 12 Z M0 -28 l0 -20 l8 18 Z M14 -24 l4 -18 l-12 12 Z" />}
              {crest === 'crown' && <path className="rg-glow" d="M-24 -20 L -26 -48 L -12 -32 L 0 -56 L 12 -32 L 26 -48 L 24 -20 Z" />}
              <path className="rg-main" d="M-32 0 C -32 -30 32 -30 32 0 C 32 22 18 38 0 42 C -18 38 -32 22 -32 0 Z" />
              <path className="rg-light" d="M-16 18 C -10 10 10 10 16 18 C 12 32 4 38 0 38 C -4 38 -12 32 -16 18 Z" />
              <Eye cx={-14} cy={-4} r={basilisk ? 10 : 8} slit glow defeated={defeated} />
              <Eye cx={14} cy={-4} r={basilisk ? 10 : 8} slit glow defeated={defeated} />
              <path className="rg-brow" d="M-26 -16 L -6 -10 M26 -16 L 6 -10" style={{ strokeWidth: 5 }} />
              <path className="rg-bone" d="M-8 34 l2 10 l4 -8 Z M8 34 l-2 10 l-4 -8 Z" />
            </g>
          </g>
        ))}

        {/* Water around a sea creature */}
        {watery && (
          <g className="rg-wave">
            <path className="rg-water" d="M20 398 C 50 372 80 392 110 378 C 140 364 170 392 200 380 C 230 368 260 392 290 378 C 320 364 350 390 380 376 L 380 410 L 20 410 Z" />
            <path className="rg-foam" d="M40 384 C 60 374 80 388 100 380 M180 380 C 200 370 220 388 240 380 M300 380 C 320 370 340 386 360 378" />
          </g>
        )}

        <RageAura points={[[60, 260], [340, 250], [120, 60], [280, 56], [30, 330], [370, 320]]} />
        <Stars y={60 + drop} />
      </g>
    </>
  );
}
