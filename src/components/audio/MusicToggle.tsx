import { Music, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMusic } from '@/hooks/useMusic';

/**
 * Music on/off (and volume) for the classroom screen. Browsers keep a page silent until someone
 * clicks it, so while that is the case the button says so; any click on the page starts the music.
 */
export function MusicToggle({ className }: { className?: string }) {
  const { status, volume, setEnabled, setVolume } = useMusic();
  if (status === 'unsupported') return null;
  const on = status !== 'off';
  const blocked = status === 'blocked';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {status === 'playing' && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Music volume"
          className="hidden w-24 accent-signal-400 md:block"
        />
      )}
      <button
        type="button"
        onClick={() => setEnabled(!on || blocked)}
        aria-pressed={on && !blocked}
        aria-label={blocked ? 'Start the music' : on ? 'Turn music off' : 'Turn music on'}
        title={blocked ? 'Click to start the music' : on ? 'Music on' : 'Music off'}
        className={cn(
          'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-sm border px-3 text-night-muted transition-colors hover:bg-night-900 hover:text-night-text',
          blocked ? 'animate-pulse border-signal-400 text-night-text' : 'border-night-line',
          status === 'playing' && 'text-night-text',
        )}
      >
        {on ? <Music className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
        {blocked && <span className="text-caption font-bold whitespace-nowrap">Click for music</span>}
      </button>
    </div>
  );
}
