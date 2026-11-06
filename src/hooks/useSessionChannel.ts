import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppSupabaseClient } from '@/lib/supabase';

export type ChannelStatus = 'connecting' | 'live' | 'offline';

type Options = {
  client: AppSupabaseClient | null;
  /** e.g. session:{id}:host. Null disables the subscription. */
  topic: string | null;
  /** Broadcast events to listen for. */
  events: readonly string[];
  onEvent: (event: string, payload: unknown) => void;
  /**
   * Called on every successful (re)subscription. Broadcasts sent while a client
   * was disconnected are lost, so screens reload state from the database here.
   */
  onSubscribed?: () => void;
};

/**
 * Receive-only subscription to a private session topic. Authorisation is
 * enforced by RLS on realtime.messages (see the Phase 3 migration); clients
 * cannot send on these channels.
 */
export function useSessionChannel({ client, topic, events, onEvent, onSubscribed }: Options): ChannelStatus {
  // Status is remembered per topic, so a new topic starts as "connecting" without an extra render.
  const [state, setState] = useState<{ topic: string | null; status: ChannelStatus }>({ topic: null, status: 'connecting' });
  const onEventRef = useRef(onEvent);
  const onSubscribedRef = useRef(onSubscribed);
  useEffect(() => {
    onEventRef.current = onEvent;
    onSubscribedRef.current = onSubscribed;
  });
  const eventKey = events.join('|');

  useEffect(() => {
    if (!client || !topic) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const setStatus = (status: ChannelStatus) => setState({ topic, status });

    void (async () => {
      // Private channels need the user's JWT on the socket.
      await client.realtime.setAuth();
      if (cancelled) return;
      channel = client.channel(topic, { config: { private: true } });
      for (const event of eventKey.split('|')) {
        channel.on('broadcast', { event }, (message) => onEventRef.current(event, message.payload));
      }
      channel.subscribe((state) => {
        if (cancelled) return;
        if (state === 'SUBSCRIBED') {
          setStatus('live');
          onSubscribedRef.current?.();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('offline');
        }
      });
    })();

    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [client, topic, eventKey]);

  return state.topic === topic ? state.status : 'connecting';
}
