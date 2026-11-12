import { Mirror, RageAura, Shadow, Stars, type RigProps } from '../shared';

const EYES: Record<string, readonly (readonly [number, number, number])[]> = {
  one: [[200, 150, 20]],
  two: [[178, 150, 12], [222, 150, 12]],
  three: [[176, 156, 11], [224, 156, 11], [200, 130, 9]],
  many: [[172, 156, 10], [228, 156, 10], [200, 132, 9], [154, 130, 6], [246, 130, 6], [186, 108, 5], [214, 108, 5]],
};

/** Shadow creatures and spirits: a floating, smoky form with glowing eyes. */
export function WraithRig({ spec, stage }: RigProps) {
  const { eyes, form, crown } = spec.parts;
  const defeated = stage === 'defeated';
  const spirit = spec.archetype === 'spirit';
  return (
    <>
      <Shadow rx={100} float />
      <g className="mon-body">
        <g className="rg-float">
          {/* A haze around the body */}
          <path className="rg-ghost rg-flicker" d="M200 60 C 290 60 326 150 318 236 C 312 300 330 340 352 372 C 310 366 290 392 200 392 C 110 392 90 366 48 372 C 70 340 88 300 82 236 C 74 150 110 60 200 60 Z" />

          {form === 'tendrils' && (
            <g className="rg-wave">
              <path className="rg-line" d="M150 340 C 140 370 160 380 146 404 M200 350 C 190 380 210 390 198 414 M250 340 C 260 370 240 380 254 404" style={{ strokeWidth: 10, stroke: 'var(--m-main)' }} />
            </g>
          )}

          {/* The body: a teardrop with a ragged, drifting hem */}
          <path
            className="rg-main"
            d="M200 80 C 270 80 300 150 296 230 C 292 290 300 330 320 360 C 290 350 280 370 260 380 C 250 360 230 360 222 384 C 210 366 190 366 178 384 C 170 360 150 360 140 380 C 120 370 110 350 80 360 C 100 330 108 290 104 230 C 100 150 130 80 200 80 Z"
          />
          {form === 'cloak' && <path className="rg-second" d="M200 82 C 140 84 112 140 110 210 C 140 160 170 140 200 140 C 230 140 260 160 290 210 C 288 140 260 84 200 82 Z" />}
          {form === 'smoke' && (
            <Mirror>
              <path className="rg-membrane rg-flicker" d="M108 250 C 70 240 66 200 92 190 C 80 216 96 230 116 226 Z" />
            </Mirror>
          )}
          {form === 'leaves' && (
            <Mirror>
              <path className="rg-leaf" d="M104 220 C 76 210 70 186 86 172 C 104 186 108 204 104 220 Z M110 288 C 80 288 68 264 80 248 C 100 258 110 272 110 288 Z M120 340 C 96 348 80 330 86 312 C 106 316 118 326 120 340 Z" />
            </Mirror>
          )}
          {form === 'mist' && <path className="rg-ghost rg-wave" d="M60 380 C 90 350 130 372 160 360 C 190 350 220 374 250 360 C 280 348 320 368 346 380 Z" />}

          {/* Face: a pale mask for a spirit, darkness for a shade */}
          {spirit ? (
            <path className="rg-light" d="M164 132 C 164 104 236 104 236 132 C 236 170 222 190 200 194 C 178 190 164 170 164 132 Z" />
          ) : (
            <path className="rg-void" opacity="0.75" d="M150 140 C 150 104 250 104 250 140 C 250 186 228 210 200 212 C 172 210 150 186 150 140 Z" />
          )}
          {(EYES[eyes] ?? EYES.two).map(([x, y, r], i) =>
            defeated ? (
              <path key={i} className="rg-x" d={`M${x - r * 0.7} ${y - r * 0.7} L${x + r * 0.7} ${y + r * 0.7} M${x + r * 0.7} ${y - r * 0.7} L${x - r * 0.7} ${y + r * 0.7}`} />
            ) : (
              <ellipse key={i} className={spirit ? 'rg-eye rg-eye-glow' : 'rg-glow'} cx={x} cy={y} rx={r} ry={r * 0.8} />
            ),
          )}
          {spirit && !defeated && <path className="rg-mouth-line" d="M188 176 Q 200 182 212 176" style={{ strokeWidth: 4 }} />}
          {!spirit && <path className="rg-glow" opacity="0.8" d="M170 186 L 182 178 L 192 188 L 200 178 L 208 188 L 218 178 L 230 186 L 220 194 L 180 194 Z" />}

          {/* Crown */}
          {crown === 'thorns' && <path className="rg-dark" d="M150 104 L 160 70 L 172 96 L 186 62 L 196 92 L 208 58 L 218 92 L 232 64 L 240 98 L 252 72 L 254 110 C 220 92 180 92 150 104 Z" />}
          {crown === 'halo' && <ellipse className="rg-accent-line rg-flicker" cx="200" cy="64" rx="56" ry="14" style={{ strokeWidth: 7 }} />}
          {crown === 'antlers' && (
            <Mirror>
              <path className="rg-line" d="M176 96 C 160 66 140 52 112 44 M150 62 L 146 30 M132 52 L 104 34" style={{ strokeWidth: 10 }} />
              <path className="rg-line" d="M176 96 C 160 66 140 52 112 44 M150 62 L 146 30 M132 52 L 104 34" style={{ strokeWidth: 5, stroke: 'var(--m-bone)' }} />
            </Mirror>
          )}

          {/* Motes drifting around it */}
          {[
            [92, 120],
            [318, 104],
            [70, 250],
            [334, 236],
          ].map(([x, y], i) => (
            <circle key={i} className="rg-glow rg-bob" cx={x} cy={y} r={5} />
          ))}

          <RageAura points={[[120, 120], [280, 110], [100, 280], [300, 270], [170, 60], [230, 52]]} />
          <Stars y={44} />
        </g>
      </g>
    </>
  );
}
