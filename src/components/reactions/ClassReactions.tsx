import { AnimatePresence, m } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { Avatar } from '@/components/avatar/Avatar';
import type { LiveReaction } from '@/hooks/useReactions';

/** A small live row of classmates' reactions on a phone (the projector shows them big). */
export function ClassReactions({ reactions, meId, className }: { reactions: readonly LiveReaction[]; meId?: string | null; className?: string }) {
  const others = reactions.filter((r) => r.participantId !== meId).slice(-5);
  return (
    <div aria-hidden className={cn('flex h-10 items-center justify-center gap-2', className)}>
      <AnimatePresence initial={false}>
        {others.map((r) => (
          <m.span
            key={r.id}
            layout
            initial={{ opacity: 0, scale: 0.4, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -10 }}
            transition={spring.pop}
            className="relative"
            title={r.nickname}
          >
            <Avatar code={r.avatar} mood={r.emote.mood ?? null} className="size-9 rounded-full" />
            <span className="absolute -top-2 -right-2 text-[1.25rem] leading-none">{r.emote.glyph}</span>
          </m.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
