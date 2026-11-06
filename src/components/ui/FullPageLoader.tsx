import { cn } from '@/lib/cn';
import { isNightPath } from '@/lib/ground';
import { Spinner } from './Spinner';
import { LogoMark } from './Logo';

/** Full-screen loading state on the right ground for the route (no paper flash on student screens). */
export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  const night = typeof window !== 'undefined' && isNightPath(window.location.pathname);
  return (
    <div className={cn('grid min-h-dvh place-items-center', night ? 'bg-night-950 text-night-muted' : 'bg-paper text-ink-500')}>
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-10" tone={night ? 'night' : 'paper'} />
        <Spinner className="size-5" label={label} />
      </div>
    </div>
  );
}
