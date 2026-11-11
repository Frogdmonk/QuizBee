import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { applyHostEvent, getSessionLobby } from '@/services/live';
import { sessionTopic } from '@/lib/session-rules';
import { useSessionChannel, type ChannelStatus } from '@/hooks/useSessionChannel';
import type { SessionLobby } from '@/types/session';

// 'state' is the small marker the server sends on every transition. Once a game has started the
// server no longer sends 'session', so the marker is the only live sign that the lobby is stale.
const HOST_EVENTS = ['participant_joined', 'participant_updated', 'participant_left', 'participant_removed', 'session', 'state'] as const;
const RECONCILE_MS = 20_000;

export type LobbyLoad = 'loading' | 'ready' | 'not_found' | 'error';

/**
 * Live lobby for the host and projector screens: loads the lobby, applies
 * host-topic broadcasts, and reloads from the database after reconnecting,
 * when the tab becomes visible, and every 20 s as a safety net.
 */
export function useLobby(client: AppSupabaseClient | null, sessionId: string | undefined) {
  const [lobby, setLobby] = useState<SessionLobby | null>(null);
  const [load, setLoad] = useState<LobbyLoad>('loading');
  const inFlight = useRef(false);
  const lobbyRef = useRef(lobby);
  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  const refresh = useCallback(async () => {
    if (!client || !sessionId || inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await getSessionLobby(client, sessionId);
      setLobby(next);
      setLoad('ready');
    } catch (error) {
      const code = (error as { code?: string }).code;
      setLoad((current) => (code === 'P0002' ? 'not_found' : current === 'ready' ? current : 'error'));
    } finally {
      inFlight.current = false;
    }
  }, [client, sessionId]);

  useEffect(() => {
    const tick = () => void refresh();
    tick();
    const timer = window.setInterval(tick, RECONCILE_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const channel: ChannelStatus = useSessionChannel({
    client,
    topic: client && sessionId && load === 'ready' ? sessionTopic(sessionId, 'host') : null,
    events: HOST_EVENTS,
    onEvent: (event, payload) => {
      if (event === 'state') {
        // The game moved on (e.g. it started): reload the lobby's status if ours is older.
        const version = Number((payload as { state_version?: unknown } | null)?.state_version);
        const current = lobbyRef.current;
        if (current && Number.isFinite(version) && version > current.stateVersion && current.status === 'lobby') void refresh();
        return;
      }
      setLobby((current) => (current ? applyHostEvent(current, event, payload) : current));
    },
    onSubscribed: () => void refresh(),
  });

  return { lobby, setLobby, load, channel, refresh };
}
