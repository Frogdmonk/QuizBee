import { useState } from 'react';
import '@/styles/transitions.css';
import type { WipeKind } from '@/lib/world';

/**
 * A short cinematic wipe on the projector whenever the game moves to a new phase:
 *   question     an ink-brush sweep across the screen
 *   reveal       a bright slash
 *   leaderboard  dust rising from the ground
 *   podium       a burst of light
 * It plays over the screen change for well under a second and never blocks clicks. Nothing plays on
 * the first screen, and reduced motion turns it off (the CSS has no animation then).
 */
export function PhaseWipe({ sceneKey, kind }: { sceneKey: string; kind: WipeKind | null }) {
  // Remember the first scene so its arrival does not play a wipe; replay on every later change.
  const [first] = useState(sceneKey);
  if (!kind || sceneKey === first) return null;
  return <div key={sceneKey} className="phase-wipe pointer-events-none fixed inset-0 z-[60]" data-kind={kind} aria-hidden />;
}
