import { Cracks, Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

/** A front-facing dragon: wings spread, horns, belly plates, a glowing chest that charges its breath. */
export function DragonRig({ spec, stage }: RigProps) {
  const { wings, horns, tail, crest } = spec.parts;
  const defeated = stage === 'defeated';
  return (
    <>
      <Shadow rx={160} />
      <g className="mon-body">
        {/* Wings (behind everything) */}
        <Mirror>
          <g className="rg-wing">
            {wings === 'torn' ? (
              <path
                className="rg-membrane"
                d="M168 210 C 140 160 100 100 40 70 C 50 100 46 128 30 150 L 44 154 L 16 186 C 40 182 56 190 64 206 L 78 198 L 72 222 C 92 208 104 214 112 232 L 126 224 L 122 248 C 136 232 152 236 166 252 Z"
              />
            ) : (
              <path
                className="rg-membrane"
                d="M168 210 C 140 160 100 100 40 70 C 52 110 40 150 14 186 C 44 184 62 196 70 220 C 92 208 112 220 120 248 C 136 232 152 236 166 252 Z"
              />
            )}
            <path className="rg-bone-line" d="M168 210 C 140 160 100 100 40 70" />
            <path className={wings === 'ribbed' ? 'rg-rib rg-rib-strong' : 'rg-rib'} d="M98 112 L 18 184 M106 124 L 70 218 M120 150 L 120 244" />
          </g>
        </Mirror>

        {/* Tail */}
        <path className="rg-main" d="M240 330 C 300 380 360 360 376 300 C 384 268 372 246 356 248 C 368 270 360 318 316 336 C 290 346 262 340 246 312 Z" />
        {tail === 'spade' && <path className="rg-dark" d="M356 250 L 336 226 L 362 228 L 368 202 L 380 234 Z" />}
        {tail === 'spiked' && <path className="rg-dark" d="M300 352 l6 -18 l8 16 Z M330 340 l8 -18 l6 18 Z M356 318 l12 -14 l2 18 Z" />}

        {/* Legs and claws */}
        <Mirror>
          <path className="rg-main" d="M120 330 C 96 350 96 384 120 396 L 170 396 C 176 372 164 344 150 330 Z" />
          <path className="rg-bone" d="M120 396 l6 10 l6 -10 Z M138 396 l6 10 l6 -10 Z M156 396 l6 10 l6 -10 Z" />
        </Mirror>

        {/* Neck (behind the body), body, belly plates and the breath glow */}
        <path className="rg-main" d="M162 186 C 158 154 170 130 184 120 L 216 120 C 230 130 242 154 238 186 Z" />
        <path className="rg-main" d="M200 150 C 262 150 296 214 292 292 C 288 352 252 386 200 386 C 148 386 112 352 108 292 C 104 214 138 150 200 150 Z" />
        <path className="rg-second" d="M200 196 C 240 196 258 250 256 300 C 254 348 232 374 200 374 C 168 374 146 348 144 300 C 142 250 160 196 200 196 Z" />
        <path className="rg-line-soft" d="M154 232 Q 200 244 246 232 M148 266 Q 200 280 252 266 M146 300 Q 200 314 254 300 M150 334 Q 200 348 250 334" />
        <circle className="rg-core" cx="200" cy="252" r="30" />
        <Cracks d={['M150 220 l16 22 l-8 16 l18 20', 'M252 214 l-14 26 l12 14 l-12 22']} />

        {/* Arms */}
        <Mirror>
          <path className="rg-main" d="M140 232 C 112 250 102 286 116 306 C 128 310 138 296 142 280 Z" />
          <path className="rg-bone" d="M112 304 l-4 12 l10 -6 Z M122 308 l2 12 l6 -10 Z" />
        </Mirror>

        {/* Spines down the neck */}
        {crest === 'spines' && <path className="rg-dark" d="M200 100 l-8 -12 l16 0 Z M200 124 l-8 -12 l16 0 Z M200 148 l-8 -12 l16 0 Z" />}

        {/* Horns */}
        <Mirror>
          {horns === 'curved' && <path className="rg-horn" d="M166 50 C 148 32 130 16 122 -10 C 142 4 164 16 182 36 Z" />}
          {horns === 'swept' && <path className="rg-horn" d="M154 72 C 120 66 94 50 80 28 C 106 40 132 44 162 54 Z" />}
          {horns === 'crown' && <path className="rg-horn" d="M152 64 l-14 -26 l24 16 Z M168 50 l-6 -32 l18 26 Z M186 44 l2 -30 l12 28 Z" />}
        </Mirror>
        {crest === 'fin' && <path className="rg-membrane" d="M200 40 C 184 22 190 2 200 -10 C 210 2 216 22 200 40 Z" />}

        {/* Head: a dragon skull with cheek frills and a long, narrow muzzle */}
        <Mirror>
          <path className="rg-dark" d="M154 92 L 116 102 L 150 112 Z M158 112 L 126 132 L 162 128 Z" />
        </Mirror>
        <path className="rg-main" d="M150 80 C 150 46 176 30 200 30 C 224 30 250 46 250 80 C 250 98 242 110 234 118 L 228 150 C 222 166 212 174 200 174 C 188 174 178 166 172 150 L 166 118 C 158 110 150 98 150 80 Z" />
        <path className="rg-light" d="M178 106 C 184 98 216 98 222 106 L 226 146 C 222 162 212 170 200 170 C 188 170 178 162 174 146 Z" />
        <path className="rg-line-soft" d="M200 108 L 200 136" />
        <path className="rg-dark" d="M186 150 q 4 -7 8 0 q -4 3 -8 0 Z M206 150 q 4 -7 8 0 q -4 3 -8 0 Z" />
        <path className="rg-mouth-line" d="M174 156 Q 200 176 226 156" />
        <path className="rg-bone" d="M180 157 l3 12 l6 -9 Z M211 160 l6 9 l3 -12 Z" />
        <Eye cx={176} cy={80} r={12} slit glow defeated={defeated} />
        <Eye cx={224} cy={80} r={12} slit glow defeated={defeated} />
        <path className="rg-brow" d="M156 62 L 192 72 M244 62 L 208 72" />

        <RageAura points={[[110, 120], [300, 110], [80, 250], [330, 240], [150, 30], [262, 26]]} />
        <Stars y={10} />
      </g>
    </>
  );
}
