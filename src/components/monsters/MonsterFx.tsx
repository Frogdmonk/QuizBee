import type { CSSProperties } from 'react';
import type { FxKind } from '@/lib/monsters/motion';
import type { RigId } from '@/lib/monsters/types';

/** Where effects start on each body (viewBox 0 0 400 420). The class stands to the left. */
type Anchors = { mouth: [number, number]; core: [number, number]; hands: [number, number]; top: number; ground: number };

const ANCHORS: Record<RigId, Anchors> = {
  blob: { mouth: [200, 280], core: [200, 250], hands: [60, 300], top: 60, ground: 396 },
  dragon: { mouth: [200, 162], core: [200, 252], hands: [118, 300], top: 30, ground: 396 },
  caster: { mouth: [200, 160], core: [82, 246], hands: [82, 246], top: 60, ground: 392 },
  golem: { mouth: [200, 150], core: [200, 252], hands: [70, 320], top: 100, ground: 396 },
  brute: { mouth: [200, 160], core: [200, 260], hands: [334, 300], top: 76, ground: 396 },
  undead: { mouth: [200, 130], core: [200, 200], hands: [200, 214], top: 80, ground: 396 },
  wraith: { mouth: [200, 186], core: [200, 160], hands: [120, 250], top: 80, ground: 392 },
  serpent: { mouth: [200, 150], core: [200, 140], hands: [200, 150], top: 90, ground: 396 },
  beast: { mouth: [200, 172], core: [200, 250], hands: [200, 172], top: 100, ground: 396 },
  phoenix: { mouth: [200, 142], core: [200, 240], hands: [200, 240], top: 60, ground: 380 },
};

const v = (props: Record<string, string | number>) => props as CSSProperties;

/**
 * The effect that goes with the monster's current motion: breath, a spell, a shock ring, a slash,
 * a gaze, a shield, healing, charging energy, runes, debris, feathers, smoke, pebbles, dust, sparks
 * or the sweat of a tired monster. Drawn in the monster's glow colour; pure SVG + CSS.
 */
export function MonsterFx({ fx, rig }: { fx: FxKind | null; rig: RigId }) {
  if (!fx) return null;
  const a = ANCHORS[rig];
  const [mx, my] = a.mouth;
  const [cx, cy] = a.core;
  const [hx, hy] = a.hands;
  switch (fx) {
    case 'breath':
      return (
        <g className="fx fx-breath" style={v({ transformOrigin: `${mx}px ${my}px` })}>
          <path d={`M${mx} ${my} L ${mx - 300} ${my + 30} Q ${mx - 330} ${my + 110} ${mx - 300} ${my + 200} Z`} className="fx-glow" opacity="0.55" />
          <path d={`M${mx} ${my} L ${mx - 260} ${my + 70} Q ${mx - 280} ${my + 110} ${mx - 260} ${my + 150} Z`} className="fx-hot" />
        </g>
      );
    case 'bolt':
      return (
        <g className="fx">
          <circle className="fx-glow fx-bolt" cx={hx} cy={hy} r="20" />
          <circle className="fx-hot fx-bolt" cx={hx} cy={hy} r="9" />
        </g>
      );
    case 'ring':
      return (
        <g className="fx">
          {[0, 1].map((i) => (
            <ellipse key={i} className="fx-ring" cx="200" cy={a.ground} rx="150" ry="26" style={v({ animationDelay: `${i * 220}ms` })} />
          ))}
        </g>
      );
    case 'slash':
      return <path className="fx fx-slash" d={`M${cx - 30} ${cy - 150} Q ${cx - 230} ${cy} ${cx - 30} ${cy + 140}`} pathLength={1} />;
    case 'beam':
      return (
        <g className="fx">
          <rect className="fx-glow fx-beam" x={mx - 340} y={a.top + 50} width="340" height="18" rx="9" style={v({ transformOrigin: `${mx}px ${a.top + 59}px` })} />
        </g>
      );
    case 'shield':
      return (
        <g className="fx fx-shield">
          <path className="fx-shield-fill" d={`M120 ${a.top + 10} Q 10 220 120 ${a.ground - 10} L 140 ${a.ground - 20} Q 44 220 140 ${a.top + 20} Z`} />
          <path className="fx-shield-line" d={`M120 ${a.top + 10} Q 10 220 120 ${a.ground - 10}`} />
          <path className="fx-shield-line" d={`M140 ${a.top + 40} Q 60 220 140 ${a.ground - 40}`} opacity="0.5" />
        </g>
      );
    case 'heal':
      return (
        <g className="fx">
          {[
            [-70, 10],
            [-30, -40],
            [20, 0],
            [60, -30],
            [90, 20],
          ].map(([dx, dy], i) => (
            <path key={i} className="fx-heal" d={`M${cx + dx - 7} ${cy + dy} h14 M${cx + dx} ${cy + dy - 7} v14`} style={v({ animationDelay: `${i * 160}ms` })} />
          ))}
        </g>
      );
    case 'charge':
      return (
        <g className="fx">
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <circle
                key={i}
                className="fx-glow fx-converge"
                cx={cx}
                cy={cy}
                r="6"
                style={v({ '--dx': `${Math.round(Math.cos(angle) * 120)}px`, '--dy': `${Math.round(Math.sin(angle) * 120)}px`, animationDelay: `${(i % 4) * 120}ms` })}
              />
            );
          })}
        </g>
      );
    case 'runes':
      return (
        <g className="fx fx-runes" style={v({ transformOrigin: `${cx}px ${cy}px` })}>
          <circle className="fx-rune-line" cx={cx} cy={cy} r="46" strokeDasharray="12 10" />
          <circle className="fx-rune-line" cx={cx} cy={cy} r="30" strokeDasharray="4 8" />
        </g>
      );
    case 'chips':
    case 'feathers':
      return (
        <g className="fx">
          {[
            [70, -60],
            [110, -10],
            [90, 50],
            [40, -90],
            [130, -50],
            [60, 80],
          ].map(([dx, dy], i) =>
            fx === 'chips' ? (
              <path key={i} className="fx-chip" d={`M${cx} ${cy} l10 -6 l6 10 l-12 4 Z`} style={v({ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${i * 30}ms` })} />
            ) : (
              <ellipse key={i} className="fx-feather" cx={cx} cy={cy} rx="5" ry="14" style={v({ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${i * 40}ms` })} />
            ),
          )}
        </g>
      );
    case 'smoke':
      return (
        <g className="fx">
          {[0, 1, 2].map((i) => (
            <circle key={i} className="fx-smoke" cx={mx + (i - 1) * 10} cy={my - 10} r={8 + i * 2} style={v({ animationDelay: `${i * 0.7}s` })} />
          ))}
        </g>
      );
    case 'pebbles':
      return (
        <g className="fx">
          {[
            [110, 170],
            [292, 176],
            [138, 160],
          ].map(([x, y], i) => (
            <path key={i} className="fx-pebble" d={`M${x} ${y} l7 -3 l4 7 l-7 4 Z`} style={v({ '--fall': `${a.ground - y - 6}px`, animationDelay: `${i * 1.3}s` })} />
          ))}
        </g>
      );
    case 'dust':
      return (
        <g className="fx">
          {[-130, -70, 0, 70, 130].map((dx, i) => (
            <circle key={i} className="fx-dust" cx={200 + dx} cy={a.ground - 10} r={26 - Math.abs(dx) / 10} style={v({ animationDelay: `${300 + i * 60}ms` })} />
          ))}
        </g>
      );
    case 'sparks':
      return (
        <g className="fx">
          {[
            [-120, -20],
            [110, -40],
            [-80, -110],
            [70, -120],
            [0, -150],
          ].map(([dx, dy], i) => (
            <path key={i} className="fx-glow fx-spark" d={`M${200 + dx} ${a.top + 120 + dy} l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 Z`} style={v({ animationDelay: `${i * 0.27}s` })} />
          ))}
        </g>
      );
    case 'drip':
      return (
        <g className="fx">
          {[
            [168, a.top + 30],
            [236, a.top + 40],
          ].map(([x, y], i) => (
            <path key={i} className="fx-drip" d={`M${x} ${y} q 6 10 0 14 q -6 -4 0 -14 Z`} style={v({ animationDelay: `${i * 1.1}s` })} />
          ))}
        </g>
      );
  }
}
