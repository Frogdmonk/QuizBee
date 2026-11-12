import { Cracks, Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

/** Undead knights and reapers: armour or a tattered robe, a helm or hood, and a great weapon. */
export function UndeadRig({ spec, stage }: RigProps) {
  const { helm, weapon, cape } = spec.parts;
  const defeated = stage === 'defeated';
  const floats = spec.movement === 'float';
  const hooded = helm === 'hood' || helm === 'skull-mask';
  const eyes = defeated ? 'rg-dark' : 'rg-glow';
  return (
    <>
      <Shadow rx={floats ? 110 : 140} float={floats} />
      <g className="mon-body">
        <g className={floats ? 'rg-float' : undefined}>
          {/* Cape */}
          {cape === 'ragged' && (
            <path className="rg-membrane" d="M140 150 C 108 222 98 320 92 392 L 118 378 L 134 396 L 160 380 L 200 398 L 240 380 L 266 396 L 282 378 L 308 392 C 302 320 292 222 260 150 Z" />
          )}
          {cape === 'long' && <path className="rg-membrane" d="M140 150 C 110 222 100 320 96 396 L 304 396 C 300 320 290 222 260 150 Z" />}

          {/* Scythe (behind the body, held diagonally) */}
          {weapon === 'scythe' && (
            <>
              <path className="rg-wood" d="M100 396 L 290 40 L 302 46 L 112 400 Z" />
              <path className="rg-metal" d="M296 44 C 240 10 160 20 118 70 C 170 50 230 50 282 76 Z" />
            </>
          )}

          {floats ? (
            /* A tattered robe instead of legs */
            <path
              className="rg-main"
              d="M200 146 C 254 152 278 230 290 350 L 272 340 L 262 370 L 240 344 L 222 376 L 200 350 L 178 376 L 160 344 L 138 370 L 128 340 L 110 350 C 122 230 146 152 200 146 Z"
            />
          ) : (
            <>
              <Mirror>
                <path className="rg-main" d="M158 284 L 152 376 L 188 376 L 192 284 Z" />
                <path className="rg-dark" d="M144 372 L 192 372 L 194 398 L 138 398 Z" />
              </Mirror>
              {/* Breastplate with seams, ribs showing through a crack */}
              <path className="rg-main" d="M144 158 L 256 158 L 264 262 C 240 290 160 290 136 262 Z" />
              <path className="rg-line-soft" d="M200 164 L 200 280 M150 210 Q 200 226 250 210" />
              <path className="rg-bone" d="M176 230 Q 200 238 224 230 L 222 240 Q 200 248 178 240 Z M180 250 Q 200 256 220 250 L 218 258 Q 200 264 182 258 Z" />
              <path className="rg-second" d="M136 262 L 264 262 L 262 282 L 138 282 Z" />
            </>
          )}
          <Cracks d={['M160 180 l14 18 l-6 14 l14 16', 'M240 176 l-12 20 l10 12 l-10 18']} />

          {/* Shoulders and arms */}
          <Mirror>
            {floats ? (
              <path className="rg-main" d="M150 166 C 122 180 108 214 104 250 L 128 256 C 132 228 144 206 164 192 Z" />
            ) : (
              <>
                <path className="rg-main" d="M144 166 C 116 178 104 214 108 252 L 136 256 C 136 226 146 204 166 192 Z" />
                <path className="rg-main" d="M106 196 C 100 156 128 138 160 148 L 162 176 C 138 172 120 182 112 204 Z" />
                <path className="rg-dark" d="M118 158 l-12 -22 l22 12 Z" />
              </>
            )}
          </Mirror>

          {/* Weapon in front */}
          {weapon === 'greatsword' && (
            <>
              <path className="rg-metal" d="M192 236 L 208 236 L 206 384 L 200 396 L 194 384 Z" />
              <path className="rg-line-soft" d="M200 244 L 200 380" />
              <rect className="rg-second" x="160" y="226" width="80" height="12" rx="4" />
              <rect className="rg-wood" x="194" y="192" width="12" height="36" rx="3" />
              <circle className="rg-glow" cx="200" cy="188" r="8" />
            </>
          )}
          {weapon === 'mace' && (
            <>
              <rect className="rg-wood" x="286" y="200" width="12" height="150" rx="4" transform="rotate(12 292 270)" />
              <circle className="rg-metal" cx="318" cy="190" r="28" />
              <path className="rg-dark" d="M318 154 l-6 -14 l12 0 Z M352 190 l14 -6 l0 12 Z M318 226 l-6 14 l12 0 Z M284 190 l-14 -6 l0 12 Z" />
            </>
          )}
          {/* Hands: gauntlets on the sword hilt, bones on the scythe, or at the sides */}
          {weapon === 'greatsword' ? (
            <path className="rg-main" d="M176 200 C 176 186 224 186 224 200 L 222 222 C 210 230 190 230 178 222 Z" />
          ) : weapon === 'scythe' ? (
            <>
              <circle className="rg-bone" cx="132" cy="352" r="12" />
              <circle className="rg-bone" cx="232" cy="164" r="12" />
            </>
          ) : (
            <>
              <circle className="rg-main" cx="116" cy="258" r="16" />
              <circle className="rg-main" cx="290" cy="250" r="16" />
            </>
          )}

          {/* Head */}
          {hooded ? (
            <>
              <path className="rg-main" d="M146 154 C 138 94 168 64 200 64 C 232 64 262 94 254 154 C 246 172 232 180 220 184 L 180 184 C 168 180 154 172 146 154 Z" />
              <ellipse className="rg-void" cx="200" cy="130" rx="34" ry="40" />
              {helm === 'skull-mask' && (
                <path className="rg-bone" d="M172 122 C 172 96 228 96 228 122 C 228 140 220 148 214 152 L 214 162 L 186 162 L 186 152 C 180 148 172 140 172 122 Z" />
              )}
              {defeated ? (
                <>
                  <Eye cx={188} cy={124} r={7} defeated />
                  <Eye cx={212} cy={124} r={7} defeated />
                </>
              ) : (
                <>
                  <circle className={eyes} cx="188" cy="124" r="6" />
                  <circle className={eyes} cx="212" cy="124" r="6" />
                </>
              )}
            </>
          ) : (
            <>
              {helm === 'horned' && (
                <Mirror>
                  <path className="rg-horn" d="M166 104 C 132 92 114 60 124 32 C 134 62 152 78 180 88 Z" />
                </Mirror>
              )}
              <path className="rg-main" d="M162 158 C 156 100 176 78 200 78 C 224 78 244 100 238 158 Z" />
              {helm === 'visor' ? (
                <rect className="rg-void" x="170" y="118" width="60" height="14" rx="5" />
              ) : (
                <path className="rg-void" d="M176 112 L 224 112 L 220 152 L 200 160 L 180 152 Z" />
              )}
              {helm === 'crowned' && <path className="rg-bone" d="M162 96 L 166 66 L 180 84 L 190 58 L 200 80 L 210 58 L 220 84 L 234 66 L 238 96 Z" />}
              {defeated ? (
                <>
                  <Eye cx={188} cy={126} r={7} defeated />
                  <Eye cx={212} cy={126} r={7} defeated />
                </>
              ) : (
                <>
                  <circle className={eyes} cx="188" cy={helm === 'visor' ? 125 : 126} r="5" />
                  <circle className={eyes} cx="212" cy={helm === 'visor' ? 125 : 126} r="5" />
                </>
              )}
            </>
          )}

          {/* Ghostly wisps */}
          <g className="rg-flicker">
            <path className="rg-accent-line" d="M120 120 C 110 100 126 90 118 70 M286 110 C 296 92 280 82 290 62" opacity="0.7" style={{ strokeWidth: 3 }} />
          </g>

          <RageAura points={[[110, 150], [290, 140], [90, 280], [310, 270], [160, 50], [240, 46]]} />
          <Stars y={46} />
        </g>
      </g>
    </>
  );
}
