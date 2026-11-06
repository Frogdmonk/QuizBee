import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

const loadFeatures = () => import('./motion-features').then((mod) => mod.default);

/**
 * - LazyMotion + `m` components: ships only the features we use, loaded after first paint.
 *   `strict` makes accidental use of the heavy `motion.*` components a dev error.
 * - reducedMotion="user": when the OS asks for reduced motion, Motion drops
 *   transform/layout animations and keeps only opacity changes.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
