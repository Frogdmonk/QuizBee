import { Eye, Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

const SCALE: Record<string, number> = { huge: 1, large: 0.94, small: 0.72 };

/** Trolls, giants, warlords, goblin kings and demons: a hunched brute with long arms and a weapon. */
export function BruteRig({ spec, stage }: RigProps) {
  const { weapon, tusks, back, size } = spec.parts;
  const kind = spec.archetype;
  const defeated = stage === 'defeated';
  const s = SCALE[size] ?? 1;
  const demon = kind === 'demon';
  const goblin = kind === 'goblin-king';
  return (
    <>
      <Shadow rx={160 * s} />
      <g className="mon-body">
        <g transform={`translate(200 398) scale(${s}) translate(-200 -398)`}>
          {/* Behind the body: banner, sack, flames, tail */}
          {back === 'banner' && (
            <>
              <rect className="rg-wood" x="252" y="20" width="10" height="200" rx="4" />
              <path className="rg-second" d="M262 26 L 338 40 L 312 70 L 340 100 L 262 92 Z" />
            </>
          )}
          {back === 'sack' && <path className="rg-wood" d="M246 130 C 300 100 336 140 320 196 C 300 230 252 220 240 190 Z" />}
          {back === 'flames' && (
            <Mirror>
              <path className="rg-glow rg-flicker" d="M110 200 C 70 160 90 110 72 70 C 116 100 120 60 112 30 C 160 80 150 140 140 180 Z" />
            </Mirror>
          )}
          {demon && <path className="rg-main" d="M260 340 C 320 370 360 340 352 290 C 348 270 334 262 322 270 C 338 290 326 330 280 322 Z" />}

          {/* Legs */}
          <Mirror>
            <path className="rg-main" d="M138 318 C 118 348 116 378 126 396 L 180 396 C 182 368 176 342 170 318 Z" />
            <path className="rg-dark" d="M120 396 C 118 386 130 382 140 386 L 184 386 C 188 390 188 396 184 398 L 120 398 Z" />
          </Mirror>

          {/* Body */}
          <path className="rg-main" d="M200 146 C 282 146 322 208 320 280 C 318 342 272 374 200 374 C 128 374 82 342 80 280 C 78 208 118 146 200 146 Z" />
          {kind === 'warlord' ? (
            <>
              <path className="rg-metal" d="M136 190 C 170 176 230 176 264 190 L 270 280 C 240 300 160 300 130 280 Z" />
              <path className="rg-dark" d="M150 190 l-6 -18 l16 12 Z M250 190 l6 -18 l-16 12 Z M200 182 l-8 -18 l16 0 Z" />
            </>
          ) : (
            <path className="rg-second" opacity="0.8" d="M200 210 C 252 210 276 250 272 296 C 268 336 240 354 200 354 C 160 354 132 336 128 296 C 124 250 148 210 200 210 Z" />
          )}
          {!demon && <path className="rg-membrane" d="M146 328 L 254 328 L 242 384 L 200 370 L 158 384 Z" />}

          {/* The arm that hangs, and the arm with the weapon */}
          <path className="rg-main" d="M98 196 C 58 216 42 278 50 340 L 88 344 C 86 300 96 256 118 232 Z" />
          <circle className="rg-main" cx="68" cy="352" r="24" />
          <path className="rg-main" d="M302 196 C 340 212 356 248 352 292 L 314 292 C 318 262 308 238 284 228 Z" />

          {weapon === 'club' && <path className="rg-wood" d="M322 306 L 344 306 L 380 168 C 386 144 352 134 344 156 Z" />}
          {weapon === 'boulder' && <circle className="rg-second" cx="344" cy="244" r="44" />}
          {weapon === 'axe' && (
            <>
              <rect className="rg-wood" x="328" y="110" width="12" height="230" rx="5" />
              <path className="rg-metal" d="M340 120 C 392 110 404 168 386 202 C 372 182 356 178 340 180 Z" />
            </>
          )}
          {weapon === 'dagger' && <path className="rg-metal" d="M328 300 L 340 300 L 342 232 L 334 216 L 326 232 Z" />}
          {weapon === 'bombs' && (
            <>
              <circle className="rg-dark" cx="336" cy="262" r="24" />
              <path className="rg-line" d="M346 240 C 352 226 364 224 368 214" style={{ strokeWidth: 4 }} />
              <circle className="rg-glow rg-flicker" cx="370" cy="210" r="7" />
            </>
          )}
          {weapon === 'whip' && <path className="rg-accent-line rg-wave" d="M336 300 C 372 320 340 350 376 370 C 396 382 380 396 362 398" style={{ strokeWidth: 6 }} />}
          <circle className="rg-main" cx="334" cy="300" r={weapon === 'fists' ? 28 : 22} />

          {/* Shoulders */}
          <Mirror>
            {back === 'spikes' && <path className="rg-dark" d="M118 170 l-14 -34 l26 22 Z M140 160 l-4 -36 l18 30 Z" />}
            {back === 'fur' && <path className="rg-membrane" d="M96 196 C 96 160 130 146 160 152 L 150 166 L 140 160 L 130 174 L 118 168 L 110 184 Z" />}
            {back === 'moss' && <path className="rg-moss" d="M98 196 C 96 164 126 148 156 154 C 166 162 160 174 146 172 C 132 176 118 184 110 200 Z" />}
            {back === 'snowcap' && <path className="rg-snow" d="M94 196 C 94 160 128 144 162 152 C 158 166 142 164 132 176 C 120 172 108 182 104 198 Z" />}
          </Mirror>

          {/* Ears */}
          {(goblin || kind === 'troll' || kind === 'warlord') && (
            <Mirror>
              <path className="rg-main" d={goblin ? 'M164 112 L 104 88 L 160 136 Z' : 'M164 116 L 136 104 L 162 134 Z'} />
            </Mirror>
          )}

          {/* Head */}
          <path className="rg-main" d="M162 140 C 156 96 176 74 200 74 C 224 74 244 96 238 140 C 236 164 222 178 200 180 C 178 178 164 164 162 140 Z" />
          {demon && (
            <Mirror>
              <path className="rg-horn" d="M170 90 C 140 74 128 40 142 14 C 150 44 164 60 186 74 Z" />
            </Mirror>
          )}
          {back === 'horns' && !demon && (
            <Mirror>
              <path className="rg-horn" d="M170 90 C 146 80 136 56 146 38 C 152 58 164 68 184 76 Z" />
            </Mirror>
          )}
          {back === 'crown' && <path className="rg-gold" d="M172 82 L 176 56 L 188 72 L 200 50 L 212 72 L 224 56 L 228 82 Z" />}
          {back === 'snowcap' && <path className="rg-snow" d="M166 100 C 172 74 228 74 234 100 C 222 92 178 92 166 100 Z" />}
          {kind === 'giant' && <path className="rg-membrane" d="M166 146 C 164 196 184 222 200 228 C 216 222 236 196 234 146 C 220 160 180 160 166 146 Z" />}
          <Eye cx={184} cy={114} r={8} defeated={defeated} glow={demon} />
          <Eye cx={216} cy={114} r={8} defeated={defeated} glow={demon} />
          <path className="rg-brow" d="M172 102 L 194 108 M228 102 L 206 108" style={{ strokeWidth: 7 }} />
          {!demon && <ellipse className="rg-light" cx="200" cy={goblin ? 136 : 132} rx={goblin ? 14 : 12} ry={goblin ? 16 : 10} />}
          <path className={kind === 'giant' ? 'rg-mouth-line' : 'rg-mouth'} d="M174 152 Q 200 170 226 152 Q 200 160 174 152 Z" />
          {tusks === 'long' && (
            <Mirror>
              <path className="rg-bone" d="M178 156 L 168 126 L 186 152 Z" />
            </Mirror>
          )}
          {tusks === 'broken' && (
            <>
              <path className="rg-bone" d="M178 156 L 172 138 L 186 152 Z" />
              <path className="rg-bone" d="M222 156 L 230 124 L 214 152 Z" />
            </>
          )}
        </g>

        <RageAura points={[[90, 150], [320, 140], [50, 260], [350, 250], [150, 60], [250, 56]]} />
        <Stars y={56 + (1 - s) * 200} />
      </g>
    </>
  );
}
