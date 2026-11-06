import { useEffect, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { serverNow } from '@/services/game';

/**
 * Estimated (server time − local time) in ms: best of three round trips. Countdowns run from the
 * server's deadline corrected by this offset, so every screen counts down together. Scoring itself
 * uses the database clock, so a wrong offset can only affect what is shown, never points.
 */
export function useServerClock(client: AppSupabaseClient | null): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void (async () => {
      let best: { rtt: number; offset: number } | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          const t0 = Date.now();
          const server = await serverNow(client);
          const t1 = Date.now();
          const rtt = t1 - t0;
          const estimate = server - (t0 + rtt / 2);
          if (!best || rtt < best.rtt) best = { rtt, offset: estimate };
        } catch {
          // Keep the best estimate so far (0 if none).
        }
      }
      if (!cancelled && best) setOffset(Math.round(best.offset));
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);
  return offset;
}
