import { useEffect, useRef } from 'react';

/**
 * Scales a fixed-size world (e.g. 1600×900) to fit, centred, in the frame element: returns refs for
 * the frame and the world. One ResizeObserver; no React re-renders on resize.
 */
export function useFitWorld(width: number, height: number) {
  const frameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = frameRef.current;
    const world = worldRef.current;
    if (!frame || !world) return;
    const fit = () => {
      const r = frame.getBoundingClientRect();
      const scale = Math.min(r.width / width, r.height / height) || 0;
      world.style.transform = `translate(${(r.width - width * scale) / 2}px, ${(r.height - height * scale) / 2}px) scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [width, height]);
  return { frameRef, worldRef };
}
