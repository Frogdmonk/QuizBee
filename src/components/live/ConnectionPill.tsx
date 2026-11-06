import { cn } from '@/lib/cn';
import type { ChannelStatus } from '@/hooks/useSessionChannel';
import { Badge } from '@/components/ui/Badge';

const LABELS: Record<ChannelStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  offline: 'Reconnecting…',
};

/**
 * Realtime connection status. `quiet`: when healthy it is only an 8px dot (with screen-reader
 * text); when connecting or offline it expands to a labelled badge.
 */
export function ConnectionPill({
  status,
  dark = false,
  quiet = false,
  surface,
}: {
  status: ChannelStatus;
  /** Legacy: same as surface="night". */
  dark?: boolean;
  quiet?: boolean;
  surface?: 'paper' | 'night';
}) {
  const s = surface ?? (dark ? 'night' : 'paper');
  if (quiet && status === 'live') {
    return (
      <span role="status" className="inline-flex size-11 items-center justify-center" title="Live">
        <span aria-hidden className="size-2 rounded-full bg-success-400" />
        <span className="sr-only">Live</span>
      </span>
    );
  }
  return (
    <span role="status" className="inline-flex">
      <Badge
        surface={s}
        tone={status === 'live' ? 'success' : status === 'offline' ? 'error' : 'warning'}
        dot
        className={cn(status === 'connecting' && '[&>span:first-child]:animate-pulse')}
      >
        {LABELS[status]}
      </Badge>
    </span>
  );
}
