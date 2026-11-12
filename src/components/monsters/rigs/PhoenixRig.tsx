import { Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

/** A corrupted firebird: wide wings of layered feathers, a crest, and a long fanned tail. */
export function PhoenixRig({ spec, stage }: RigProps) {
  const { tail, crest, wings } = spec.parts;
  const defeated = stage === 'defeated';
  const swept = wings === 'swept';
  return (
    <>
      <Shadow rx={120} float />
      <g className="mon-body">
        <g className="rg-float">
          {/* Tail */}
          {tail === 'plumes' ? (
            <>
              {[-40, -20, 0, 20, 40].map((angle) => (
                <g key={angle} transform={`rotate(${angle} 200 320)`}>
                  <path className="rg-second" d="M200 320 C 186 350 184 380 200 404 C 216 380 214 350 200 320 Z" />
                  <circle className="rg-glow" cx="200" cy="388" r="7" />
                </g>
              ))}
            </>
          ) : (
            <g className="rg-wave">
              <path className="rg-accent-line" d="M186 320 C 160 360 190 380 160 410 M200 324 C 200 364 216 384 200 414 M214 320 C 240 360 210 380 240 410" style={{ strokeWidth: 9 }} />
            </g>
          )}

          {/* Wings: layered feathers with glowing tips */}
          <Mirror>
            <g className="rg-wing-bird">
              <path
                className="rg-main"
                d={
                  swept
                    ? 'M178 196 C 150 140 110 80 50 30 C 62 70 48 92 30 110 C 64 112 60 138 42 156 C 76 156 80 182 66 202 C 100 196 120 214 120 236 C 146 222 162 222 174 230 Z'
                    : 'M178 196 C 140 150 80 120 18 122 C 38 142 28 162 12 178 C 44 178 40 198 24 216 C 58 212 64 232 54 252 C 88 242 108 254 112 272 C 140 256 160 252 172 256 Z'
                }
              />
              <path
                className="rg-second"
                d={
                  swept
                    ? 'M176 204 C 154 160 124 120 88 92 C 96 124 86 140 72 150 C 98 154 98 172 86 186 C 112 186 124 202 128 220 C 146 212 160 214 172 222 Z'
                    : 'M176 204 C 146 172 104 156 64 156 C 76 170 70 184 58 194 C 82 196 82 212 72 226 C 98 222 108 236 106 250 C 132 240 152 240 170 246 Z'
                }
              />
              <path
                className="rg-accent-line"
                d={swept ? 'M50 30 L 64 52 M30 110 L 52 114 M42 156 L 62 152 M66 202 L 84 194' : 'M18 122 L 40 132 M12 178 L 36 176 M24 216 L 46 208 M54 252 L 72 238'} style={{ strokeWidth: 6 }} />
            </g>
          </Mirror>

          {/* Talons */}
          <Mirror>
            <path className="rg-gold" d="M182 326 L 178 366 L 190 366 L 192 326 Z" />
            <path className="rg-bone" d="M170 366 l-6 12 l12 -4 Z M182 368 l0 13 l8 -10 Z M192 366 l8 10 l2 -12 Z" />
          </Mirror>

          {/* Body with feather scallops */}
          <path className="rg-main" d="M200 140 C 250 140 270 200 264 260 C 258 310 230 336 200 336 C 170 336 142 310 136 260 C 130 200 150 140 200 140 Z" />
          <path className="rg-second" d="M200 186 C 230 186 244 226 240 266 C 236 300 220 320 200 320 C 180 320 164 300 160 266 C 156 226 170 186 200 186 Z" />
          <path className="rg-line-soft" d="M172 224 q 14 12 28 0 q 14 12 28 0 M168 256 q 16 12 32 0 q 16 12 32 0 M174 288 q 13 11 26 0 q 13 11 26 0" />
          <circle className="rg-core" cx="200" cy="240" r="30" />

          {/* Crest */}
          {crest === 'flame' && <path className="rg-glow rg-flicker" d="M200 72 C 180 50 186 26 176 6 C 198 20 204 4 200 -10 C 222 12 222 40 212 58 C 226 46 236 30 232 14 C 250 40 236 64 216 78 Z" />}
          {crest === 'crown' && <path className="rg-second" d="M170 80 L 160 40 L 182 66 L 190 28 L 200 64 L 210 28 L 218 66 L 240 40 L 230 80 Z" />}
          {crest === 'spikes' && <path className="rg-dark" d="M176 76 l-10 -34 l20 24 Z M200 70 l0 -40 l12 36 Z M224 76 l10 -34 l-20 24 Z" />}

          {/* Head and hooked beak */}
          <circle className="rg-main" cx="200" cy="106" r="42" />
          <path className="rg-gold" d="M186 112 C 190 104 210 104 214 112 L 204 144 C 202 150 198 150 196 144 Z" />
          <Eye cx={180} cy={98} r={9} slit glow defeated={defeated} />
          <Eye cx={220} cy={98} r={9} slit glow defeated={defeated} />
          <path className="rg-brow" d="M164 84 L 190 92 M236 84 L 210 92" style={{ strokeWidth: 6 }} />

          {/* Falling embers */}
          {[
            [110, 300],
            [292, 296],
            [140, 360],
            [262, 356],
          ].map(([x, y], i) => (
            <circle key={i} className="rg-glow rg-bob" cx={x} cy={y} r={4} />
          ))}

          <RageAura points={[[90, 150], [310, 140], [70, 260], [330, 250], [160, 40], [240, 36]]} />
          <Stars y={30} />
        </g>
      </g>
    </>
  );
}
