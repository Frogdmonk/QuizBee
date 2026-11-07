import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { sessionTopic } from '@/lib/session-rules';
import { emoteByKey, type Emote } from '@/lib/emotes';
import { useSessionChannel } from '@/hooks/useSessionChannel';

export type LiveReaction = {
  id: string;
  participantId: string;
  nickname: string;
  avatar: string;
  emote: Emote;
  /** Local time it arrived (ms). */
  at: number;
};

export type ReactionBurst = { id: string; emote: Emote; count: number; at: number };

const EVENTS = ['reaction'] as const;
/** Events older than this when they arrive (a reconnect replay, a very slow network) are skipped. */
const MAX_AGE_MS = 6000;
const MAX_VISIBLE = 30;
/** Same emote from this many different players inside the window = a class-wide burst. */
const BURST = { players: 3, windowMs: 2500, cooldownMs: 3000 } as const;

export function parseReaction(payload: unknown, nowServerMs: number): Omit<LiveReaction, 'at'> | null {
  const p = payload as { id?: unknown; pid?: unknown; n?: unknown; a?: unknown; e?: unknown; at?: unknown } | null;
  if (!p || typeof p.id !== 'string' || typeof p.pid !== 'string' || typeof p.n !== 'string' || typeof p.a !== 'string') return null;
  const emote = emoteByKey(p.e);
  if (!emote) return null;
  if (typeof p.at === 'string') {
    const sent = new Date(p.at).getTime();
    if (Number.isFinite(sent) && nowServerMs - sent > MAX_AGE_MS) return null;
  }
  return { id: p.id, participantId: p.pid, nickname: p.n, avatar: p.a, emote };
}

/**
 * Reactions from the whole class, live. Duplicates are dropped by id, late events are skipped,
 * each reaction leaves after `durationMs`, and arrivals are batched (one render per ~80 ms) so a
 * busy classroom never floods React.
 */
export function useReactions(client: AppSupabaseClient | null, sessionId: string | undefined, offsetMs: number, durationMs = 4000) {
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const pending = useRef<LiveReaction[]>([]);
  const flushTimer = useRef<number | null>(null);
  const recent = useRef<LiveReaction[]>([]);
  const lastBurst = useRef<Map<string, number>>(new Map());
  const offset = useRef(offsetMs);
  useEffect(() => {
    offset.current = offsetMs;
  }, [offsetMs]);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const batch = pending.current;
    pending.current = [];
    if (batch.length === 0) return;
    const now = Date.now();
    setReactions((list) => [...list.filter((r) => now - r.at < durationMs), ...batch].slice(-MAX_VISIBLE));

    // Bursts: same emote from several different players in a short window.
    recent.current = [...recent.current.filter((r) => now - r.at < BURST.windowMs), ...batch];
    const found: ReactionBurst[] = [];
    for (const r of batch) {
      const players = new Set(recent.current.filter((x) => x.emote.key === r.emote.key).map((x) => x.participantId));
      const last = lastBurst.current.get(r.emote.key) ?? 0;
      if (players.size >= BURST.players && now - last > BURST.cooldownMs) {
        lastBurst.current.set(r.emote.key, now);
        found.push({ id: `${r.emote.key}-${now}`, emote: r.emote, count: players.size, at: now });
      }
    }
    if (found.length) setBursts((list) => [...list.filter((b) => now - b.at < 2500), ...found]);
  }, [durationMs]);

  useSessionChannel({
    client,
    topic: client && sessionId ? sessionTopic(sessionId, 'game') : null,
    events: EVENTS,
    onEvent: (_event, payload) => {
      const parsed = parseReaction(payload, Date.now() + offset.current);
      if (!parsed || seen.current.has(parsed.id)) return;
      seen.current.add(parsed.id);
      if (seen.current.size > 500) seen.current = new Set([...seen.current].slice(-250));
      pending.current.push({ ...parsed, at: Date.now() });
      if (flushTimer.current === null) flushTimer.current = window.setTimeout(flush, 80);
    },
  });

  // Expiry sweep.
  const count = reactions.length + bursts.length;
  useEffect(() => {
    if (count === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setReactions((list) => {
        const next = list.filter((r) => now - r.at < durationMs);
        return next.length === list.length ? list : next;
      });
      setBursts((list) => {
        const next = list.filter((b) => now - b.at < 2500);
        return next.length === list.length ? list : next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [count, durationMs]);

  useEffect(
    () => () => {
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    },
    [],
  );

  return { reactions, bursts };
}
