import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Shuffle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dur, spring } from '@/lib/motion';
import { randomAvatar } from '@/lib/avatar';
import { LowerThird } from '@/components/ui/LowerThird';
import { Avatar } from './Avatar';

/**
 * The big avatar preview: the character on a night-800 disc (it "lands" whenever the look
 * changes), a round "Surprise me" button, and a live name tag exactly as the projector shows it.
 */
export function AvatarHero({
  value,
  onChange,
  nickname,
  size = 168,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  nickname: string;
  /** Disc diameter in px. */
  size?: number;
  className?: string;
}) {
  const [spins, setSpins] = useState(0);
  const name = nickname.trim();
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-night-800">
          <AnimatePresence initial={false} mode="popLayout">
            <m.div
              key={value}
              className="absolute inset-0"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: spring.land }}
              exit={{ scale: 0.92, opacity: 0, transition: { duration: dur.fast } }}
            >
              <Avatar code={value} className="size-full rounded-full" title="Your avatar" />
            </m.div>
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => {
            setSpins((n) => n + 1);
            onChange(randomAvatar());
          }}
          aria-label="Surprise me: random avatar"
          className="absolute -right-1 -bottom-1 grid size-12 place-items-center rounded-full border border-night-line bg-night-900 text-night-text transition-colors hover:bg-night-800"
        >
          <m.span animate={{ rotate: spins * 270 }} transition={spring.press} className="grid place-items-center">
            <Shuffle className="size-5" />
          </m.span>
        </button>
      </div>
      <LowerThird surface="night" tab="bg-night-text" className="mt-4 max-w-[16rem]">
        <span className={cn('truncate text-[1.0625rem] font-bold', !name && 'text-night-muted')}>{name || 'Your name here'}</span>
      </LowerThird>
    </div>
  );
}
