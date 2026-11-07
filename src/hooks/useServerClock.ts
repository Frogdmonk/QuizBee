import { useEffect, useState } from 'react';
import type { AppSupabaseClient } from '@/lib/supabase';
import { serverNow } from '@/services/game';

const SAMPLES = 8;
const RESYNC_SAMPLES = 5;
const RESYNC_MS = 30_000;

/** Median of the offsets from the fastest round trips (fast trips are the least asymmetric). */
export function bestOffset(samples: { rtt: number; offset: number }[]): number | null {
  if (samples.length === 0) return null;
  const fastest = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
  const offsets = fastest.map((s) => s.offset).sort((a, b) => a - b);
  return Math.round(offsets[Math.floor(offsets.length / 2)]);
}

async function measure(client: AppSupabaseClient, count: number): Promise<number | null> {
  const samples: { rtt: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const t0 = Date.now();
      const server = await serverNow(client);
      const t1 = Date.now();
      const rtt = t1 - t0;
      samples.push({ rtt, offset: server - (t0 + rtt / 2) });
    } catch {
      // Skip a failed sample; the rest still give an estimate.
    }
  }
  return bestOffset(samples);
}

/**
 * Estimated (server time − local time) in ms. Measured as soon as the screen mounts (in the lobby,
 * long before a question) and re-checked every 30 s, so a countdown started later never begins
 * with an unmeasured clock. Countdowns and the scheduled start run on the server deadline plus this
 * offset, which is what makes every screen change at the same moment. Scoring uses the database
 * clock, so a wrong offset can only affect what is shown, never points.
 */
export function useServerClock(client: AppSupabaseClient | null): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const run = async (count: number) => {
      const next = await measure(client, count);
      if (!cancelled && next !== null) setOffset(next);
    };
    void run(SAMPLES);
    const timer = window.setInterval(() => void run(RESYNC_SAMPLES), RESYNC_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client]);
  return offset;
}
