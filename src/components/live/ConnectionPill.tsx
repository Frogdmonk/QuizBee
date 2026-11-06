import { cn } from '@/lib/cn';
import type { ChannelStatus } from '@/hooks/useSessionChannel';

const LABELS: Record<ChannelStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  offline: 'Reconnecting…',
};

export function ConnectionPill({ status, dark = false }: { status: ChannelStatus; dark?: boolean }) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        dark ? 'bg-white/10 text-white/80' : 'bg-ink-50 text-ink-600',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          status === 'live' ? 'bg-mint-400' : status === 'offline' ? 'bg-rose-400' : 'animate-pulse bg-sun-400',
        )}
      />
      {LABELS[status]}
    </span>
  );
}
