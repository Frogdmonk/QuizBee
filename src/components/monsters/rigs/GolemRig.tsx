import { Cracks, Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

/** A towering golem or ancient guardian: blocky body, huge fists, glowing cracks and a core. */
export function GolemRig({ spec, stage }: RigProps) {
  const { head, shoulders, core } = spec.parts;
  const defeated = stage === 'defeated';
  const eyes = defeated ? 'rg-dark' : 'rg-glow';
  return (
    <>
      <Shadow rx={170} />
      <g className="mon-body">
        {/* Legs */}
        <Mirror>
          <path className="rg-main" d="M130 318 L 124 380 L 184 380 L 180 318 Z" />
          <path className="rg-second" d="M112 376 L 192 376 L 196 398 L 106 398 Z" />
        </Mirror>

        {/* Torso, stone patches, the core and its cracks */}
        <path className="rg-main" d="M108 168 L 292 168 L 316 210 L 302 322 L 252 344 L 148 344 L 98 322 L 84 210 Z" />
        <path className="rg-second" opacity="0.55" d="M116 216 L 150 206 L 160 236 L 128 248 Z M246 290 L 286 280 L 290 312 L 254 318 Z M120 290 L 150 296 L 142 324 L 114 316 Z" />
        <Cracks always d={['M200 252 L 168 222 L 150 232 L 122 200', 'M200 252 L 236 226 L 262 236 L 284 204', 'M200 252 L 190 300 L 206 326', 'M200 252 L 248 280']} />
        {core === 'rune' && (
          <>
            <circle className="rg-core" cx="200" cy="252" r="36" />
            <circle className="rg-accent-line" cx="200" cy="252" r="28" />
            <path className="rg-accent-line" d="M188 238 L 212 266 M212 238 L 188 266 M200 232 L 200 272" />
          </>
        )}
        {core === 'gem' && (
          <>
            <circle className="rg-core" cx="200" cy="252" r="38" />
            <path className="rg-glow" d="M200 222 L 224 252 L 200 284 L 176 252 Z" />
            <path className="rg-line" d="M200 222 L 224 252 L 200 284 L 176 252 Z M176 252 L 224 252" style={{ strokeWidth: 3 }} />
          </>
        )}
        {core === 'furnace' && (
          <>
            <rect className="rg-dark" x="166" y="222" width="68" height="56" rx="8" />
            <rect className="rg-core" x="172" y="228" width="56" height="44" rx="6" />
            <path className="rg-metal" d="M170 238 L 230 238 L 230 244 L 170 244 Z M170 254 L 230 254 L 230 260 L 170 260 Z" />
          </>
        )}
        {core === 'heartwood' && (
          <>
            <circle className="rg-core" cx="200" cy="254" r="36" />
            <path className="rg-wood" d="M200 286 C 160 262 166 226 188 228 C 196 228 200 236 200 240 C 200 236 204 228 212 228 C 234 226 240 262 200 286 Z" />
            <path className="rg-accent-line" d="M200 248 L 200 274 M200 258 L 188 246 M200 262 L 212 250" style={{ strokeWidth: 3 }} />
          </>
        )}

        {/* Arms and fists */}
        <Mirror>
          <path className="rg-main" d="M100 184 C 62 196 44 240 48 290 L 94 296 C 94 258 102 228 122 210 Z" />
          <path className="rg-main" d="M30 284 L 108 284 L 112 336 C 94 354 50 354 32 336 Z" />
          <path className="rg-line-soft" d="M52 300 L 52 336 M72 300 L 72 342 M92 300 L 92 336" />
          <path className="rg-fist" d="M30 284 L 108 284 L 112 336 C 94 354 50 354 32 336 Z" />
        </Mirror>

        {/* Shoulders */}
        <Mirror>
          {shoulders === 'boulders' && (
            <>
              <circle className="rg-main" cx="96" cy="178" r="34" />
              <circle className="rg-second" cx="120" cy="156" r="20" />
            </>
          )}
          {shoulders === 'crystals' && (
            <>
              <path className="rg-glow" d="M78 184 L 70 120 L 98 170 Z M100 176 L 104 108 L 120 168 Z M118 172 L 136 128 L 136 176 Z" />
              <path className="rg-line" d="M78 184 L 70 120 L 98 170 Z M100 176 L 104 108 L 120 168 Z M118 172 L 136 128 L 136 176 Z" style={{ strokeWidth: 3 }} />
            </>
          )}
          {shoulders === 'plates' && <path className="rg-metal" d="M60 196 C 60 156 92 140 132 150 L 136 186 C 110 182 84 192 72 210 Z" />}
          {shoulders === 'roots' && (
            <path className="rg-wood" d="M70 196 C 60 160 80 140 112 150 C 100 120 120 110 136 126 L 140 170 C 120 168 98 176 84 204 Z" />
          )}
          {shoulders === 'moss' && <path className="rg-moss" d="M62 196 C 56 160 88 142 120 150 C 136 146 148 160 140 176 C 116 172 90 180 74 206 Z" />}
        </Mirror>

        {/* Head */}
        {head === 'dome' && <path className="rg-main" d="M156 172 C 156 108 244 108 244 172 Z" />}
        {(head === 'block' || head === 'antlered') && <path className="rg-main" d="M160 108 L 240 108 L 248 172 L 152 172 Z" />}
        {head === 'visor' && (
          <>
            <path className="rg-metal" d="M154 172 C 150 120 170 100 200 100 C 230 100 250 120 246 172 Z" />
            <rect className="rg-void" x="166" y="132" width="68" height="16" rx="6" />
          </>
        )}
        {head === 'mask' && <path className="rg-wood" d="M164 172 C 150 122 168 96 200 96 C 232 96 250 122 236 172 Z" />}
        {head === 'antlered' && (
          <Mirror>
            <path className="rg-line" d="M170 110 C 160 84 140 70 116 64 M150 78 L 146 50 M134 70 L 110 50" style={{ strokeWidth: 13 }} />
            <path className="rg-line" d="M170 110 C 160 84 140 70 116 64 M150 78 L 146 50 M134 70 L 110 50" style={{ strokeWidth: 7, stroke: '#8a5a2b' }} />
          </Mirror>
        )}
        {defeated ? (
          <>
            <Eye cx={182} cy={141} r={9} defeated />
            <Eye cx={218} cy={141} r={9} defeated />
          </>
        ) : head === 'visor' ? (
          <rect className={eyes} x="172" y="136" width="56" height="8" rx="4" />
        ) : (
          <>
            <path className={eyes} d="M172 136 L 192 140 L 190 148 L 172 146 Z" />
            <path className={eyes} d="M228 136 L 208 140 L 210 148 L 228 146 Z" />
          </>
        )}
        <path className="rg-brow" d="M168 128 L 192 134 M232 128 L 208 134" style={{ strokeWidth: 6 }} />

        <RageAura points={[[60, 160], [340, 150], [40, 260], [360, 250], [150, 90], [250, 84]]} />
        <Stars y={70} />
      </g>
    </>
  );
}
