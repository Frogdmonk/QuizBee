import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppSupabaseClient } from '@/lib/supabase';

export type ChannelStatus = 'connecting' | 'live' | 'offline';

type Listener = {
  events: ReadonlySet<string>;
  onEvent: (event: string, payload: unknown) => void;
  onStatus: (status: ChannelStatus) => void;
  onSubscribed: () => void;
};

type Entry = {
  channel: RealtimeChannel | null;
  status: ChannelStatus;
  listeners: Set<Listener>;
  /** Pending removal; a new subscriber waits for it so the topic is never joined twice. */
  removing: Promise<unknown> | null;
  closeTimer: number | null;
};

/*
 * One Realtime channel per (client, topic), shared by every component that needs it. supabase-js
 * returns the existing channel for a topic, so two independent subscriptions would collide; this
 * registry reference-counts listeners and fans events out to them.
 */
const registry = new WeakMap<AppSupabaseClient, Map<string, Entry>>();
const CLOSE_GRACE_MS = 1500;

function entriesFor(client: AppSupabaseClient): Map<string, Entry> {
  let map = registry.get(client);
  if (!map) {
    map = new Map();
    registry.set(client, map);
  }
  return map;
}

function setStatus(entry: Entry, status: ChannelStatus) {
  entry.status = status;
  entry.listeners.forEach((l) => {
    l.onStatus(status);
    if (status === 'live') l.onSubscribed();
  });
}

async function open(client: AppSupabaseClient, topic: string, entry: Entry) {
  if (entry.removing) await entry.removing.catch(() => undefined);
  // Private channels need the user's JWT on the socket.
  await client.realtime.setAuth();
  if (entry.listeners.size === 0) return;
  const channel = client.channel(topic, { config: { private: true } });
  entry.channel = channel;
  channel.on('broadcast', { event: '*' }, (message) => {
    const event = String(message.event);
    entry.listeners.forEach((l) => {
      if (l.events.has(event)) l.onEvent(event, message.payload);
    });
  });
  channel.subscribe((state) => {
    if (entry.channel !== channel) return;
    if (state === 'SUBSCRIBED') setStatus(entry, 'live');
    else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') setStatus(entry, 'offline');
  });
}

function join(client: AppSupabaseClient, topic: string, listener: Listener): () => void {
  const map = entriesFor(client);
  let entry = map.get(topic);
  if (!entry) {
    entry = { channel: null, status: 'connecting', listeners: new Set(), removing: null, closeTimer: null };
    map.set(topic, entry);
  }
  const e = entry;
  if (e.closeTimer !== null) {
    window.clearTimeout(e.closeTimer);
    e.closeTimer = null;
  }
  e.listeners.add(listener);
  if (!e.channel) {
    if (e.listeners.size === 1) void open(client, topic, e);
  } else {
    listener.onStatus(e.status);
    if (e.status === 'live') listener.onSubscribed();
  }

  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size > 0) return;
    // Short grace period: a screen swap (lobby → game) re-uses the same subscription.
    e.closeTimer = window.setTimeout(() => {
      e.closeTimer = null;
      if (e.listeners.size > 0) return;
      const channel = e.channel;
      e.channel = null;
      e.status = 'connecting';
      if (channel) e.removing = client.removeChannel(channel).finally(() => (e.removing = null));
    }, CLOSE_GRACE_MS);
  };
}

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
 * cannot send on these channels. Several components may listen to the same topic.
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
    let active = true;
    const leave = join(client, topic, {
      events: new Set(eventKey.split('|')),
      onEvent: (event, payload) => active && onEventRef.current(event, payload),
      onStatus: (status) => active && setState({ topic, status }),
      onSubscribed: () => active && onSubscribedRef.current?.(),
    });
    return () => {
      active = false;
      leave();
    };
  }, [client, topic, eventKey]);

  return state.topic === topic ? state.status : 'connecting';
}
