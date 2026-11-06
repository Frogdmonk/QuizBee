import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { LeaderboardEngine } from '@/lib/leaderboard/engine';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DEFAULT_LEADERBOARD_CONFIG, type LeaderboardConfig } from '@/lib/leaderboard/config';
import type { LeaderboardPlan, LeaderboardSnapshot, ThemeId } from '@/lib/leaderboard/types';

export type PlaybackStage = 'hold' | 'scores' | 'characters' | 'rows' | 'highlight' | 'settled';

const STAGE_ORDER: PlaybackStage[] = ['hold', 'scores', 'characters', 'rows', 'highlight', 'settled'];

export function stageAtLeast(stage: PlaybackStage, target: PlaybackStage): boolean {
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(target);
}

/**
 * Runs the leaderboard timeline for each new authoritative snapshot:
 * hold (previous board) → scores roll → characters animate → rows move → highlight → settled.
 *
 * A newer snapshot interrupts the current one: its timers are cleared and the new plan starts
 * from the server's previous ranks, which are exactly the last plan's final state. Under reduced
 * motion the board goes straight to the settled state. The final order always equals the
 * snapshot's order (the engine never reorders).
 */
export function useLeaderboardPlayback(snapshot: LeaderboardSnapshot | null, config: LeaderboardConfig = DEFAULT_LEADERBOARD_CONFIG) {
  // One engine per mounted leaderboard (keeps each student's theme history).
  const [engine] = useState(() => new LeaderboardEngine(config));
  const planRef = useRef<LeaderboardPlan | null>(null);
  // Motion caches the OS setting; also read the media query live so a change applies at once.
  const motionReduce = useReducedMotion();
  const mediaReduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduce = Boolean(motionReduce) || mediaReduce;
  const [playback, setPlayback] = useState<{ plan: LeaderboardPlan | null; stage: PlaybackStage }>({ plan: null, stage: 'settled' });

  const updateId = snapshot?.updateId ?? null;

  useEffect(() => {
    if (!snapshot) return;
    const result = engine.apply(snapshot);
    // Duplicates re-use the plan already made for this update (e.g. a remount), never re-plan.
    const plan = result.plan ?? (planRef.current?.updateId === snapshot.updateId ? planRef.current : null);
    if (!plan) return;
    planRef.current = plan;

    const t = config.timeline;
    const steps: [number, PlaybackStage][] = reduce
      ? [[0, 'settled']]
      : [
          [0, 'hold'],
          [t.scoresAtMs, 'scores'],
          [t.charactersAtMs, 'characters'],
          [t.rowsAtMs, 'rows'],
          [t.highlightAtMs, 'highlight'],
          [t.totalMs, 'settled'],
        ];
    const timers = steps.map(([at, stage]) => window.setTimeout(() => setPlayback({ plan, stage }), at));
    return () => timers.forEach((id) => window.clearTimeout(id));
    // The snapshot object changes on every poll; only a new update id starts a new timeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateId, reduce]);

  const reportThemeFailure = useCallback((theme: ThemeId) => engine.reportThemeFailure(theme), [engine]);

  return { plan: playback.plan, stage: playback.stage, reportThemeFailure, reducedMotion: reduce };
}
