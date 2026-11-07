import { useEffect, useState } from 'react';

/**
 * Milliseconds left until `targetAt` on the server clock (local clock + offset).
 *
 * Used for both the scheduled start and the answering deadline. It re-renders four times a second
 * for the seconds display, and also fires once at the exact target moment, so a screen flips from
 * "get ready" to the question at the same instant as every other screen instead of up to a quarter
 * of a second late.
 */
export function useCountdown(targetAt: string | null, offsetMs: number, running: boolean): number {
  const target = targetAt ? new Date(targetAt).getTime() : null;
  const compute = () => (target === null ? 0 : Math.max(0, target - (Date.now() + offsetMs)));
  const [left, setLeft] = useState(compute);

  useEffect(() => {
    const tick = () => setLeft(target === null ? 0 : Math.max(0, target - (Date.now() + offsetMs)));
    tick();
    if (!running || target === null) return;
    const interval = window.setInterval(tick, 250);
    const remaining = target - (Date.now() + offsetMs);
    // A hair past the target, so the recomputed value is 0 rather than 1 ms.
    const exact = remaining > 0 ? window.setTimeout(tick, remaining + 2) : null;
    return () => {
      window.clearInterval(interval);
      if (exact !== null) window.clearTimeout(exact);
    };
  }, [target, offsetMs, running]);

  return left;
}
