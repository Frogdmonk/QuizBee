import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { cn } from '@/lib/cn';
import type { AppSupabaseClient } from '@/lib/supabase';
import { EMOTES, EMOTE_GROUPS, REACTION_LIMIT, type Emote, type EmoteGroup } from '@/lib/emotes';
import { sendReaction } from '@/services/reactions';
import { friendlyError } from '@/utils/errors';

const clock = () => Date.now();

/**
 * The student's emote tray: three small tabs, one tap sends. The server checks the rules (lobby or
 * after answering, rate limit, teacher switch); the phone mirrors the rate limit so it can say
 * "wait" without asking. It never sits on top of the answer buttons: it is only rendered in the
 * lobby and after the player has answered.
 */
export function EmotePanel({
  client,
  sessionId,
  enabled,
  tone = 'night',
  className,
}: {
  client: AppSupabaseClient;
  sessionId: string;
  enabled: boolean;
  tone?: 'night' | 'paper';
  className?: string;
}) {
  const [group, setGroup] = useState<EmoteGroup>('emoji');
  const [sent, setSent] = useState<{ id: number; emote: Emote } | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(clock);
  const history = useRef<number[]>([]);
  const counter = useRef(0);
  const night = tone === 'night';

  const waiting = blockedUntil > now;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(clock()), 250);
    return () => window.clearInterval(timer);
  }, [waiting]);
  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(null), 1100);
    return () => window.clearTimeout(timer);
  }, [sent]);

  async function send(emote: Emote) {
    const t = clock();
    setNow(t);
    if (blockedUntil > t) return;
    history.current = history.current.filter((x) => t - x < REACTION_LIMIT.windowMs);
    if (history.current.length >= REACTION_LIMIT.count) {
      setBlockedUntil(history.current[0] + REACTION_LIMIT.windowMs);
      return;
    }
    history.current.push(t);
    counter.current += 1;
    setSent({ id: counter.current, emote });
    setMessage(null);
    try {
      const result = await sendReaction(client, sessionId, emote.key);
      if (result.status === 'rate_limited') setBlockedUntil(clock() + result.retryMs);
      else if (result.status === 'not_now') setMessage('Reactions open again after you answer.');
      else if (result.status === 'disabled') setMessage('Your teacher has turned reactions off.');
    } catch (error) {
      setMessage(friendlyError(error));
    }
  }

  if (!enabled) {
    return (
      <p className={cn('text-body-sm', night ? 'text-night-muted' : 'text-ink-500', className)}>Reactions are turned off by your teacher.</p>
    );
  }

  const seconds = Math.ceil((blockedUntil - now) / 1000);
  return (
    <section aria-label="Send a reaction" className={cn('relative', className)}>
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Reaction type" className="flex gap-1">
          {EMOTE_GROUPS.map((g) => (
            <button
              key={g.key}
              role="tab"
              type="button"
              aria-selected={group === g.key}
              onClick={() => setGroup(g.key)}
              className={cn(
                'touch-target rounded-xs px-2.5 py-1 text-caption font-bold tracking-[0.04em] uppercase transition-colors',
                group === g.key
                  ? night
                    ? 'bg-night-text text-night-950'
                    : 'bg-ink-900 text-paper'
                  : night
                    ? 'text-night-muted hover:text-night-text'
                    : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span aria-live="polite" className={cn('text-caption font-semibold', night ? 'text-night-muted' : 'text-ink-500')}>
          {waiting ? `Wait ${seconds}s` : sent ? 'Sent!' : ''}
        </span>
      </div>

      <div role="tabpanel" className="mt-2 grid grid-cols-5 gap-1.5">
        {EMOTES.filter((e) => e.group === group).map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => void send(e)}
            disabled={waiting}
            aria-label={e.label}
            title={e.label}
            className={cn(
              'grid aspect-square min-h-11 place-items-center rounded-sm text-[1.75rem] leading-none transition-transform active:scale-90 disabled:opacity-40',
              night ? 'bg-night-900 hover:bg-night-800' : 'border border-line bg-surface hover:bg-paper-sunk',
            )}
          >
            <span aria-hidden>{e.glyph}</span>
          </button>
        ))}
      </div>

      {message && (
        <p role="status" className={cn('mt-2 text-caption', night ? 'text-night-muted' : 'text-ink-500')}>
          {message}
        </p>
      )}

      {/* Instant feedback on the phone; the class sees it on the projector. */}
      <AnimatePresence>
        {sent && (
          <m.span
            key={sent.id}
            aria-hidden
            initial={{ opacity: 0, y: 10, scale: 0.5 }}
            animate={{ opacity: 1, y: -40, scale: 1.4 }}
            exit={{ opacity: 0, y: -70 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute top-0 right-4 text-[2.5rem]"
          >
            {sent.emote.glyph}
          </m.span>
        )}
      </AnimatePresence>
    </section>
  );
}
