import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { sessionTopic } from '@/lib/session-rules';
import { applyBroadcast, withAnswer } from '@/lib/game-sync';
import { mediaUrl } from '@/lib/media-url';
import { advanceIfDue, getGameState } from '@/services/game';
import { useSessionChannel, type ChannelStatus } from '@/hooks/useSessionChannel';
import { useServerClock } from '@/hooks/useServerClock';
import type { GameState } from '@/types/game';

export type VoteTally = { voteId: string; round: number; counts: Record<string, number>; total: number };

const GAME_EVENTS = ['state', 'removed'] as const;
const HOST_EVENTS = ['answer_count', 'vote_tally'] as const;
/** Safety-net polling: slow while the live channel is healthy, quick when it is not. */
const POLL_LIVE_MS = 30_000;
const POLL_OFFLINE_MS = 8_000;

export type GameLoad = 'loading' | 'ready' | 'not_found' | 'error';

/**
 * Live game state, shared by every game screen.
 *
 * The 'state' broadcast carries the whole shared state, so a screen updates from the message
 * itself: no follow-up request, and 100 phones never stampede the database at the same moment.
 * get_game_state() is only used to load initially, after a reconnect, and as a slow safety net.
 * Anything not newer than what is on screen is dropped, so duplicate or out-of-order messages can
 * never move the screen backwards.
 *
 * Mount this EARLY (in the lobby): it measures the clock offset and loads the state before the
 * game starts, so the first question appears without any setup work.
 */
export function useGameState(client: AppSupabaseClient | null, sessionId: string | undefined, options: { listenHost?: boolean } = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [load, setLoad] = useState<GameLoad>('loading');
  const [liveAnswerCount, setLiveAnswerCount] = useState<{ questionId: string; count: number } | null>(null);
  // Live weapon-vote tallies (host and projector only).
  const [voteTally, setVoteTally] = useState<VoteTally | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const inFlight = useRef(false);
  const again = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const offset = useServerClock(client);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!client || !sessionId) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const next = await getGameState(client, sessionId);
      const current = stateRef.current;
      if (!current || next.session.stateVersion >= current.session.stateVersion) commit(next);
      setLoad('ready');
    } catch (error) {
      const code = (error as { code?: string }).code;
      setLoad((current) => (code === 'P0002' ? 'not_found' : current === 'ready' ? current : 'error'));
    } finally {
      inFlight.current = false;
      if (again.current) {
        again.current = false;
        void refreshRef.current();
      }
    }
  }, [client, sessionId, commit]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const load = () => void refresh();
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const channel: ChannelStatus = useSessionChannel({
    client,
    topic: client && sessionId ? sessionTopic(sessionId, 'game') : null,
    events: GAME_EVENTS,
    onEvent: (event, payload) => {
      if (event !== 'state') {
        void refresh();
        return;
      }
      const next = applyBroadcast(stateRef.current, payload);
      if (next === null) void refresh();
      else if (next !== stateRef.current) commit(next);
    },
    // Messages sent while this screen was disconnected are lost: reload once on every (re)connect.
    onSubscribed: () => void refresh(),
  });

  // Safety net, with jitter so a classroom of phones never polls in lockstep.
  useEffect(() => {
    const base = channel === 'live' ? POLL_LIVE_MS : POLL_OFFLINE_MS;
    const timer = window.setInterval(() => void refresh(), base + Math.random() * base * 0.25);
    return () => window.clearInterval(timer);
  }, [refresh, channel]);

  useSessionChannel({
    client: options.listenHost ? client : null,
    topic: options.listenHost && sessionId ? sessionTopic(sessionId, 'host') : null,
    events: HOST_EVENTS,
    onEvent: (event, payload) => {
      if (event === 'vote_tally') {
        const t = payload as { vote_id?: string; round?: number; counts?: Record<string, number>; total?: number };
        if (t.vote_id && typeof t.round === 'number' && t.counts && typeof t.total === 'number') {
          const tally: VoteTally = { voteId: t.vote_id, round: t.round, counts: t.counts, total: t.total };
          // Keep the highest total: messages can arrive out of order.
          setVoteTally((prev) => (prev && prev.voteId === tally.voteId && prev.round === tally.round && prev.total > tally.total ? prev : tally));
        }
        return;
      }
      const p = payload as { session_question_id?: string; answer_count?: number };
      if (p.session_question_id && typeof p.answer_count === 'number') {
        setLiveAnswerCount({ questionId: p.session_question_id, count: p.answer_count });
      }
    },
  });

  // Preload the question's pictures during the lead window so nothing pops in after the start.
  const questionId = state?.question?.id ?? null;
  useEffect(() => {
    const q = stateRef.current?.question;
    if (!q || q.id !== questionId) return;
    const paths = [q.imagePath, ...q.options.map((o) => o.imagePath)];
    for (const path of paths) {
      const url = mediaUrl(path);
      if (url) new Image().src = url;
    }
  }, [questionId]);

  /** Ask the server to close the question if it is due. Safe to call repeatedly. */
  const nudge = useCallback(async () => {
    if (!client || !sessionId) return;
    try {
      const version = await advanceIfDue(client, sessionId);
      const current = stateRef.current;
      if (!current || version > current.session.stateVersion) void refresh();
    } catch {
      // Not due, or offline: the next event or poll catches up.
    }
  }, [client, sessionId, refresh]);

  /** Remember the player's own accepted answer so a broadcast arriving first cannot erase it. */
  const markAnswered = useCallback(
    (questionIdValue: string, optionId: string) => {
      const current = stateRef.current;
      if (current) commit(withAnswer(current, questionIdValue, optionId));
    },
    [commit],
  );

  const answerCount =
    state?.question && liveAnswerCount?.questionId === state.question.id
      ? Math.max(liveAnswerCount.count, state.question.answerCount)
      : (state?.question?.answerCount ?? 0);

  return { state, load, channel, refresh, nudge, answerCount, offset, markAnswered, voteTally };
}

/** What every game screen receives from the page that owns the live connection. */
export type GameController = ReturnType<typeof useGameState>;
