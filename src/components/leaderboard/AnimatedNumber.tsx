import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * A number that counts from its previous value to the new one (ease-out, rAF, writes the text
 * node directly so the row does not re-render 60 times a second). Jumps under reduced motion.
 */
export function AnimatedNumber({ value, durationMs = 600, className }: { value: number; durationMs?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    if (reduce || from === value) {
      shown.current = value;
      el.textContent = value.toLocaleString();
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      const current = Math.round(from + (value - from) * eased);
      shown.current = current;
      el.textContent = current.toLocaleString();
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      shown.current = value;
      el.textContent = value.toLocaleString();
    };
  }, [value, durationMs, reduce]);

  return (
    <span ref={ref} className={className} aria-label={value.toLocaleString()}>
      {value.toLocaleString()}
    </span>
  );
}
