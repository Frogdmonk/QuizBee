import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { PlaygroundSim, WORLD, radiusFor, staticLayout, type SimAct } from '@/lib/playground/sim';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Avatar, type AvatarMood } from '@/components/avatar/Avatar';
import { CampScenery } from './CampScenery';
import type { LiveReaction } from '@/hooks/useReactions';

export type PlaygroundPlayer = { id: string; nickname: string; avatar: string };

/** How long a character acts out its player's emote. */
const EMOTE_ACT_MS = 2400;

type Variant = 'stage' | 'panel' | 'phone';

/**
 * The lively lobby: every player's character walks around, bumps into others and reacts, and acts
 * out the emotes its player sends. Movement comes from PlaygroundSim on the shared server clock, so
 * the projector, the teacher's laptop and the phones show the same scene; only joins, leaves and
 * emotes travel over the network.
 *
 * Rendering: React renders each character once. A requestAnimationFrame loop then writes positions
 * and animation names straight to the DOM (no React work per frame). Browsers pause the loop in a
 * hidden tab; on return the scene is simply computed for "now". Under reduced motion the
 * characters stand still in a tidy grid and emotes appear without movement.
 */
export function Playground({
  seed,
  players,
  offsetMs,
  reactions = [],
  highlightId,
  lurker = false,
  onInteraction,
  variant = 'stage',
  className,
  label = 'Players in the lobby',
}: {
  seed: string;
  players: readonly PlaygroundPlayer[];
  offsetMs: number;
  reactions?: readonly LiveReaction[];
  highlightId?: string | null;
  /** The camp (stage): show the monster waiting on the horizon. */
  lurker?: boolean;
  /** Called when two characters bump into each other and react (for sound). */
  onInteraction?: () => void;
  variant?: Variant;
  className?: string;
  label?: string;
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [sim] = useState(() => new PlaygroundSim(seed));
  const frameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, WalkerNodes>());
  const [moods, setMoods] = useState<Record<string, AvatarMood | null>>({});
  const moodsRef = useRef(moods);
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const idsKey = ids.join(',');
  const radius = radiusFor(ids.length);

  // Leaving players shrink away instead of vanishing.
  const [gone, setGone] = useState<PlaygroundPlayer[]>([]);
  const [prevPlayers, setPrevPlayers] = useState(players);
  if (players !== prevPlayers) {
    const now = new Set(ids);
    const removed = prevPlayers.filter((p) => !now.has(p.id));
    setGone((g) => [...g.filter((x) => !now.has(x.id) && !removed.some((r) => r.id === x.id)), ...removed]);
    setPrevPlayers(players);
  }
  useEffect(() => {
    if (gone.length === 0) return;
    const timer = window.setTimeout(() => setGone([]), 500);
    return () => window.clearTimeout(timer);
  }, [gone]);

  useEffect(() => {
    sim.setWalkers(idsKey ? idsKey.split(',') : []);
  }, [sim, idsKey]);

  // Latest emote per player.
  const latest = useMemo(() => {
    const map = new Map<string, LiveReaction>();
    for (const r of reactions) map.set(r.participantId, r);
    return map;
  }, [reactions]);
  const latestRef = useRef(latest);
  useEffect(() => {
    latestRef.current = latest;
  }, [latest]);
  const onInteractionRef = useRef(onInteraction);
  useEffect(() => {
    onInteractionRef.current = onInteraction;
  }, [onInteraction]);

  // Fit the 1000×700 world into whatever box the page gives us.
  useEffect(() => {
    const frame = frameRef.current;
    const world = worldRef.current;
    if (!frame || !world) return;
    const fit = () => {
      const { width, height } = frame.getBoundingClientRect();
      const scale = Math.min(width / WORLD.width, height / WORLD.height) || 0;
      world.style.transform = `translate(${(width - WORLD.width * scale) / 2}px, ${(height - WORLD.height * scale) / 2}px) scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // The animation loop.
  useEffect(() => {
    let raf = 0;
    const shownEmote = new Map<string, string>();
    const step = () => {
      const now = Date.now();
      const t = now + offsetMs;
      const frame = reduced ? null : sim.frame(t);
      const fixed = reduced ? staticLayout(idsKey ? idsKey.split(',') : []) : null;
      const r = sim.radius;
      let moodChanged = false;
      const nextMoods: Record<string, AvatarMood | null> = {};

      for (const [id, n] of nodes.current) {
        if (id.startsWith('gone:')) continue;
        const f = frame?.get(id);
        const pos = f ?? fixed?.get(id);
        if (!pos) continue;
        n.root.style.transform = `translate(${pos.x - r}px, ${pos.y - r}px)`;
        n.root.style.zIndex = String(Math.round(pos.y));

        let act: SimAct | string = f?.act ?? 'idle';
        let mood: AvatarMood | null = f?.mood ?? null;
        let bubble = f?.bubble ?? null;
        let bubbleKind: 'interaction' | 'emote' = 'interaction';
        const emote = latestRef.current.get(id);
        if (emote && now - emote.at < EMOTE_ACT_MS) {
          act = emote.emote.action;
          mood = emote.emote.mood ?? mood;
          bubble = emote.emote.glyph;
          bubbleKind = 'emote';
        }
        if (reduced) act = 'idle';
        if (n.body.dataset.act !== act) n.body.dataset.act = act;
        n.body.style.rotate = f ? `${f.tilt}deg` : '0deg';

        // Bubbles restart their animation only when their content changes.
        const bubbleKey = bubbleKind === 'emote' ? `e:${emote!.id}` : bubble ? `i:${bubble}:${act}` : '';
        if (bubbleKey !== (shownEmote.get(id) ?? '')) {
          shownEmote.set(id, bubbleKey);
          if (bubble) {
            n.bubble.textContent = bubble;
            n.bubble.dataset.show = '';
            void n.bubble.offsetWidth; // restart the CSS animation
            n.bubble.dataset.show = reduced ? 'static' : bubbleKind;
            n.bubble.style.fontSize = `${bubbleKind === 'emote' ? r * 1.15 : r * 0.8}px`;
            if (bubbleKind === 'interaction' && !reduced) onInteractionRef.current?.();
          } else if (reduced || n.bubble.dataset.show === 'static') {
            n.bubble.dataset.show = '';
          }
        }

        nextMoods[id] = mood;
        if ((moodsRef.current[id] ?? null) !== mood) moodChanged = true;
      }
      if (moodChanged) {
        moodsRef.current = nextMoods;
        setMoods(nextMoods);
      }
      if (!reduced) raf = requestAnimationFrame(step);
    };
    step();
    // Reduced motion: no frame loop; refresh a few times a second for emotes only.
    const slow = reduced ? window.setInterval(step, 250) : null;
    return () => {
      cancelAnimationFrame(raf);
      if (slow !== null) window.clearInterval(slow);
    };
  }, [sim, offsetMs, reduced, idsKey]);

  const size = radius * 2;
  const showNames = variant !== 'phone';

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={`${label}: ${players.length}`}
      className={cn('relative overflow-hidden', className)}
    >
      <div ref={worldRef} className="absolute top-0 left-0 origin-top-left" style={{ width: WORLD.width, height: WORLD.height }}>
        {variant === 'stage' && <CampScenery lurker={lurker} />}
        {[...players.map((p) => ({ p, leaving: false })), ...gone.map((p) => ({ p, leaving: true }))].map(({ p, leaving }) => (
          <Walker
            key={(leaving ? 'gone:' : '') + p.id}
            player={p}
            size={size}
            mood={leaving ? null : (moods[p.id] ?? null)}
            leaving={leaving}
            own={highlightId === p.id}
            showName={showNames || highlightId === p.id}
            variant={variant}
            register={(n) => {
              const key = (leaving ? 'gone:' : '') + p.id;
              if (n) nodes.current.set(key, n);
              else nodes.current.delete(key);
            }}
          />
        ))}
      </div>
      <ul className="sr-only">
        {players.map((p) => (
          <li key={p.id}>{p.nickname}</li>
        ))}
      </ul>
    </div>
  );
}

type WalkerNodes = { root: HTMLDivElement; body: HTMLDivElement; bubble: HTMLSpanElement };

const Walker = memo(function Walker({
  player,
  size,
  mood,
  leaving,
  own,
  showName,
  variant,
  register,
}: {
  player: PlaygroundPlayer;
  size: number;
  mood: AvatarMood | null;
  leaving: boolean;
  own: boolean;
  showName: boolean;
  variant: Variant;
  register: (nodes: WalkerNodes | null) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const registerRef = useRef(register);
  useEffect(() => {
    registerRef.current = register;
  });
  useEffect(() => {
    if (root.current && body.current && bubble.current) registerRef.current({ root: root.current, body: body.current, bubble: bubble.current });
    return () => registerRef.current(null);
  }, []);

  const nameSize = variant === 'stage' ? Math.max(15, size * 0.24) : Math.max(14, size * 0.26);
  return (
    <div ref={root} className="pg-walker" style={{ width: size, height: size }} aria-hidden>
      <div className="pg-pop size-full" data-leaving={leaving ? 'true' : undefined}>
        <div ref={body} className="pg-body relative size-full" data-act="idle">
          <span className="pg-shadow" />
          <Avatar code={player.avatar} mood={mood} className={cn('relative size-full rounded-full', own && 'ring-[4px] ring-volt-400')} />
        </div>
        <span ref={bubble} className="pg-bubble" />
        {showName && (
          <span
            className={cn(
              'absolute top-full left-1/2 mt-1 max-w-[180%] -translate-x-1/2 truncate rounded-xs px-1.5 py-0.5 text-center font-bold whitespace-nowrap',
              own ? 'bg-volt-400 text-night-950' : 'bg-night-950/70 text-night-text',
            )}
            style={{ fontSize: nameSize }}
          >
            {player.nickname}
          </span>
        )}
      </div>
    </div>
  );
});
