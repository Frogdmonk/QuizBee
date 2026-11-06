import { DEFAULT_LEADERBOARD_CONFIG, type LeaderboardConfig } from './config';
import { detectEvents } from './events';
import { classifyMovement, previousOrder } from './movement';
import { selectTheme, type Rng } from './selection';
import type { LeaderboardPlan, LeaderboardSnapshot, RowPlan, ThemeId } from './types';

export type ApplyResult =
  | { status: 'planned'; plan: LeaderboardPlan }
  | { status: 'duplicate' | 'stale' | 'empty'; plan: null };

/**
 * The leaderboard animation engine. Pure and framework-free: it turns authoritative snapshots into
 * animation plans and remembers per-student theme history. It never changes scores or ranks.
 *
 *  - Duplicate (same updateId) and stale (older updateId) snapshots are ignored.
 *  - A newer snapshot always wins, so an update that arrives mid-animation supersedes the old plan.
 *  - Themes that fail to render are reported back and are not chosen again.
 */
export class LeaderboardEngine {
  private lastUpdateId: number | null = null;
  private lastFieldSize = 0;
  private history = new Map<string, ThemeId[]>();
  private failed = new Set<ThemeId>();
  readonly config: LeaderboardConfig;
  private readonly rng: Rng;

  constructor(config: LeaderboardConfig = DEFAULT_LEADERBOARD_CONFIG, rng: Rng = Math.random) {
    this.config = config;
    this.rng = rng;
  }

  get currentUpdateId(): number | null {
    return this.lastUpdateId;
  }

  apply(snapshot: LeaderboardSnapshot): ApplyResult {
    if (this.lastUpdateId !== null && snapshot.updateId === this.lastUpdateId) return { status: 'duplicate', plan: null };
    if (this.lastUpdateId !== null && snapshot.updateId < this.lastUpdateId) return { status: 'stale', plan: null };
    const entries = snapshot.entries.slice(0, this.config.visibleRows);
    const previousField = this.lastFieldSize || snapshot.fieldSize;
    this.lastUpdateId = snapshot.updateId;
    this.lastFieldSize = snapshot.fieldSize;
    if (entries.length === 0) return { status: 'empty', plan: null };

    const { staggerMs, timeline, historySize } = this.config;
    const rows: Record<string, RowPlan> = {};
    const fromOrder = previousOrder(entries);
    let delay = timeline.charactersAtMs;

    // Characters start in the order the audience reads the board (previous order, top first).
    for (const id of fromOrder) {
      const e = entries.find((x) => x.participantId === id)!;
      const movement = classifyMovement(e.previousRank, e.rank, this.config);
      const recent = this.history.get(id) ?? [];
      const theme = selectTheme(movement, recent, this.rng, this.failed);
      this.history.set(id, [...recent, theme].slice(-historySize));
      rows[id] = {
        participantId: id,
        movement,
        theme,
        delayMs: delay,
        previousScore: Math.max(0, e.score - e.lastPoints),
        score: e.score,
        fromRank: e.previousRank,
        rank: e.rank,
      };
      delay += staggerMs.min + Math.round(this.rng() * (staggerMs.max - staggerMs.min));
    }

    return {
      status: 'planned',
      plan: {
        updateId: snapshot.updateId,
        fromOrder,
        toOrder: entries.map((e) => e.participantId),
        rows,
        events: detectEvents(entries, this.config, previousField),
      },
    };
  }

  /** A theme threw or failed to load: never pick it again in this session. */
  reportThemeFailure(theme: ThemeId): void {
    if (theme !== 'fallback') this.failed.add(theme);
  }

  recentThemes(participantId: string): readonly ThemeId[] {
    return this.history.get(participantId) ?? [];
  }
}
