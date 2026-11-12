import { Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

/** A floating witch or warlock: tattered robe, headwear, a staff, and charms hovering around. */
export function CasterRig({ spec, stage }: RigProps) {
  const { headwear, staff, orbit } = spec.parts;
  const defeated = stage === 'defeated';
  const hooded = headwear === 'hood' || headwear === 'horned-hood';
  const charms: readonly (readonly [number, number])[] = [
    [86, 150],
    [128, 64],
    [336, 214],
  ];
  return (
    <>
      <Shadow rx={110} float />
      {/* Rune circle under the caster (Rage and Enraged) */}
      <g className="rg-circle">
        <ellipse cx="200" cy="396" rx="130" ry="20" className="rg-accent-line" />
        <ellipse cx="200" cy="396" rx="104" ry="14" className="rg-accent-line" strokeDasharray="10 12" />
      </g>
      <g className="mon-body">
        <g className="rg-float">
          {/* Robe with a tattered hem and its lining */}
          <path
            className="rg-main"
            d="M200 150 C 262 160 292 240 304 346 L 284 336 L 276 366 L 254 342 L 236 374 L 214 346 L 194 376 L 174 344 L 152 372 L 136 340 L 114 360 L 98 346 C 110 240 138 160 200 150 Z"
          />
          <path className="rg-second" d="M200 176 L 238 356 L 216 344 L 200 366 L 184 344 L 162 356 Z" />
          <path className="rg-line-soft" d="M200 196 L 200 340" />

          {/* Staff (held on the right) */}
          <rect className="rg-wood" x="295" y="118" width="11" height="262" rx="5" />
          {staff === 'crooked' && <path className="rg-wood" d="M300 122 C 300 90 330 84 334 106 C 338 124 318 130 312 118" style={{ strokeWidth: 9, fill: 'none', stroke: '#7a4f2a' }} />}
          {staff === 'crystal' && (
            <>
              <path className="rg-glow rg-flicker" d="M300 66 L 318 100 L 300 128 L 282 100 Z" />
              <path className="rg-line" d="M300 66 L 318 100 L 300 128 L 282 100 Z" />
            </>
          )}
          {staff === 'bone' && (
            <>
              <circle className="rg-bone" cx="300" cy="104" r="20" />
              <circle className="rg-void" cx="293" cy="102" r="5" />
              <circle className="rg-void" cx="307" cy="102" r="5" />
            </>
          )}

          {/* Sleeves: the left hand casts, the right holds the staff */}
          <path className="rg-main" d="M156 196 C 124 204 98 232 84 262 L 108 274 C 120 250 140 234 164 226 Z" />
          <circle className="rg-skin" cx="94" cy="270" r="13" />
          <circle className="rg-glow rg-flicker" cx="80" cy="246" r="16" />
          <path className="rg-main" d="M244 196 C 276 204 296 232 304 262 L 282 272 C 276 250 262 234 238 226 Z" />
          <circle className="rg-skin" cx="296" cy="270" r="13" />

          {/* Hair (when the face shows) */}
          {!hooded && (
            <Mirror>
              <path className="rg-membrane" d="M166 108 C 150 146 148 196 160 236 L 174 228 C 166 194 168 150 178 114 Z" />
            </Mirror>
          )}

          {/* Head */}
          {hooded ? (
            <>
              {headwear === 'horned-hood' && (
                <Mirror>
                  <path className="rg-horn" d="M160 92 C 134 76 124 46 134 26 C 144 50 160 62 178 72 Z" />
                </Mirror>
              )}
              <path className="rg-main" d="M144 156 C 136 92 168 62 200 62 C 232 62 264 92 256 156 C 248 176 232 184 220 188 L 180 188 C 168 184 152 176 144 156 Z" />
              <ellipse className="rg-void" cx="200" cy="132" rx="34" ry="40" />
              {defeated ? (
                <>
                  <Eye cx={186} cy={128} r={8} defeated />
                  <Eye cx={214} cy={128} r={8} defeated />
                </>
              ) : (
                <>
                  <ellipse className="rg-glow" cx="186" cy="128" rx="8" ry="5" />
                  <ellipse className="rg-glow" cx="214" cy="128" rx="8" ry="5" />
                </>
              )}
            </>
          ) : (
            <>
              <path className="rg-skin" d="M168 118 C 168 92 232 92 232 118 C 232 152 220 172 200 174 C 180 172 168 152 168 118 Z" />
              <Eye cx={186} cy={126} r={8} defeated={defeated} glow />
              <Eye cx={214} cy={126} r={8} defeated={defeated} glow />
              <path className="rg-line" d="M200 132 L 196 148 L 204 150" style={{ strokeWidth: 3 }} />
              <path className="rg-mouth-line" d="M186 158 Q 200 166 216 156" style={{ strokeWidth: 4 }} />
              <path className="rg-brow" d="M176 112 L 194 118 M224 112 L 206 118" style={{ strokeWidth: 5 }} />
              {headwear === 'peaked-hat' && (
                <>
                  <ellipse className="rg-main" cx="200" cy="104" rx="76" ry="15" />
                  <path className="rg-main" d="M160 102 C 170 62 192 22 240 -6 C 224 32 228 70 242 102 Z" />
                  <path className="rg-second" d="M166 90 C 186 96 216 96 236 90 L 238 100 C 216 106 186 106 164 100 Z" />
                </>
              )}
              {headwear === 'circlet' && (
                <>
                  <path className="rg-gold" d="M168 104 Q 200 94 232 104 L 232 112 Q 200 102 168 112 Z" />
                  <path className="rg-glow" d="M200 92 l7 10 l-7 10 l-7 -10 Z" />
                </>
              )}
              {headwear === 'antlers' && (
                <Mirror>
                  <path className="rg-line" d="M178 100 C 168 76 150 60 128 52 M156 66 L 150 40 M140 56 L 120 40" style={{ strokeWidth: 8 }} />
                  <path className="rg-wood" d="M178 100 C 168 76 150 60 128 52 M156 66 L 150 40 M140 56 L 120 40" style={{ strokeWidth: 4, fill: 'none', stroke: '#a8794a' }} />
                </Mirror>
              )}
            </>
          )}

          {/* Charms hovering around the caster */}
          {charms.map(([x, y], i) => (
            <g key={i} className="rg-bob" transform={`translate(${x} ${y})`}>
              {orbit === 'candles' && (
                <>
                  <rect className="rg-bone" x="-7" y="-4" width="14" height="26" rx="3" />
                  <path className="rg-glow rg-flicker" d="M0 -22 C 8 -12 6 -6 0 -4 C -6 -6 -8 -12 0 -22 Z" />
                </>
              )}
              {orbit === 'runes' && (
                <>
                  <circle className="rg-accent-line" r="16" />
                  <path className="rg-accent-line" d={['M-6 -8 L 6 8 M6 -8 L -6 0', 'M0 -9 L 0 9 M-7 -2 L 7 4', 'M-7 8 L 0 -8 L 7 8'][i % 3]} />
                </>
              )}
              {orbit === 'skulls' && (
                <>
                  <circle className="rg-bone" r="14" />
                  <rect className="rg-bone" x="-8" y="8" width="16" height="9" rx="2" />
                  <circle className="rg-void" cx="-5" cy="-1" r="4" />
                  <circle className="rg-void" cx="5" cy="-1" r="4" />
                </>
              )}
              {orbit === 'moths' && (
                <>
                  <path className="rg-second" d="M0 0 C -18 -18 -26 -2 -16 8 C -10 12 -4 8 0 0 C 4 8 10 12 16 8 C 26 -2 18 -18 0 0 Z" />
                  <circle className="rg-glow" cx="-12" cy="-2" r="3" />
                  <circle className="rg-glow" cx="12" cy="-2" r="3" />
                </>
              )}
              {orbit === 'orbs' && (
                <>
                  <circle className="rg-glow rg-flicker" r="13" />
                  <circle className="rg-shine" cx="-4" cy="-4" r="4" />
                </>
              )}
            </g>
          ))}

          <RageAura points={[[120, 210], [280, 180], [90, 330], [316, 320], [150, 70], [250, 60]]} />
          <Stars y={40} />
        </g>
      </g>
    </>
  );
}
