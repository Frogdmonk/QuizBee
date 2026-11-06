import { useEffect, useState } from 'react';

/**
 * Milliseconds left until `deadlineAt` on the server clock (local clock + offset). Updates four
 * times a second, which is plenty for a seconds display and keeps re-renders cheap.
 */
export function useCountdown(deadlineAt: string | null, offsetMs: number, running: boolean): number {
  const deadline = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const compute = () => (deadline === null ? 0 : Math.max(0, deadline - (Date.now() + offsetMs)));
  const [left, setLeft] = useState(compute);

  useEffect(() => {
    const tick = () => setLeft(deadline === null ? 0 : Math.max(0, deadline - (Date.now() + offsetMs)));
    tick();
    if (!running || deadline === null) return;
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [deadline, offsetMs, running]);

  return left;
}
