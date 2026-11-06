import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { sessionTopic } from '@/lib/session-rules';
import { advanceIfDue, getGameState } from '@/services/game';
import { useSessionChannel, type ChannelStatus } from '@/hooks/useSessionChannel';
import type { GameState } from '@/types/game';

const GAME_EVENTS = ['state', 'removed'] as const;
const HOST_EVENTS = ['answer_count'] as const;
const POLL_MS = 10_000;

export type GameLoad = 'loading' | 'ready' | 'not_found' | 'error';

/**
 * Live game state. The database is the source of truth: broadcasts only say "version N is out",
 * and this hook reloads get_game_state(). Responses older than what is on screen are dropped, so
 * out-of-order or duplicate events can never move the screen backwards.
 */
export function useGameState(client: AppSupabaseClient | null, sessionId: string | undefined, options: { listenHost?: boolean } = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [load, setLoad] = useState<GameLoad>('loading');
  const [liveAnswerCount, setLiveAnswerCount] = useState<{ questionId: string; count: number } | null>(null);
  const versionRef = useRef(-1);
  const inFlight = useRef(false);
  const again = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    if (!client || !sessionId) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const next = await getGameState(client, sessionId);
      if (next.session.stateVersion >= versionRef.current) {
        versionRef.current = next.session.stateVersion;
        setState(next);
      }
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
  }, [client, sessionId]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const tick = () => void refresh();
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const channel: ChannelStatus = useSessionChannel({
    client,
    topic: client && sessionId ? sessionTopic(sessionId, 'game') : null,
    events: GAME_EVENTS,
    onEvent: (event, payload) => {
      if (event === 'state') {
        const version = Number((payload as { state_version?: number }).state_version);
        if (!Number.isFinite(version) || version > versionRef.current) void refresh();
      } else {
        void refresh();
      }
    },
    onSubscribed: () => void refresh(),
  });

  useSessionChannel({
    client: options.listenHost ? client : null,
    topic: options.listenHost && sessionId ? sessionTopic(sessionId, 'host') : null,
    events: HOST_EVENTS,
    onEvent: (_event, payload) => {
      const p = payload as { session_question_id?: string; answer_count?: number };
      if (p.session_question_id && typeof p.answer_count === 'number') {
        setLiveAnswerCount({ questionId: p.session_question_id, count: p.answer_count });
      }
    },
  });

  /** Ask the server to close the question if it is due. Safe to call repeatedly. */
  const nudge = useCallback(async () => {
    if (!client || !sessionId) return;
    try {
      const version = await advanceIfDue(client, sessionId);
      if (version > versionRef.current) void refresh();
    } catch {
      // Not due, or offline: the next poll or event catches up.
    }
  }, [client, sessionId, refresh]);

  const answerCount =
    state?.question && liveAnswerCount?.questionId === state.question.id
      ? Math.max(liveAnswerCount.count, state.question.answerCount)
      : (state?.question?.answerCount ?? 0);

  return { state, load, channel, refresh, nudge, answerCount };
}
