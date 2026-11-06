import { Spinner } from './Spinner';
import { LogoMark } from './Logo';

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <div className="flex flex-col items-center gap-4 text-ink-500">
        <LogoMark className="size-10" />
        <Spinner className="size-5" label={label} />
      </div>
    </div>
  );
}
