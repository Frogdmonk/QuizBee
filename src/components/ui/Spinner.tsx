import { cn } from '@/lib/cn';

/**
 * Loading indicator: the three LogoMark bars as a level meter. Marked `.motion-essential`, so under
 * reduced motion it switches to a stepped opacity cycle instead of freezing (loading is never silent).
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('motion-essential level-meter inline-flex size-5 items-end justify-center gap-[12%]', className)}
    >
      <span className="motion-essential h-[55%] w-[22%] rounded-[1px] bg-current" />
      <span className="motion-essential h-full w-[22%] rounded-[1px] bg-current" />
      <span className="motion-essential h-[75%] w-[22%] rounded-[1px] bg-current" />
    </span>
  );
}
