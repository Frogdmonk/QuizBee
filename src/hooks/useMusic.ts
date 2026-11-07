import { useEffect, useRef, useSyncExternalStore } from 'react';
import { music, type SfxName } from '@/lib/audio/engine';
import type { TrackName } from '@/lib/audio/tracks';
import type { LiveReaction, ReactionBurst } from '@/hooks/useReactions';

/** The music setting and whether the browser is letting it play yet. */
export function useMusic() {
  const snap = useSyncExternalStore(music.subscribe, music.getSnapshot, music.getSnapshot);
  return { ...snap, setEnabled: music.setEnabled, setVolume: music.setVolume };
}

/**
 * Plays `track` while the calling screen is shown (cross-fading when it changes) and stops when the
 * screen goes away. `hot` speeds the track up and adds energy (the last seconds of a question).
 * Render it from one place at a time per screen.
 */
export function useSoundtrack(track: TrackName | null, hot = false): void {
  useEffect(() => {
    music.setTrack(track);
    return () => music.setTrack(null);
  }, [track]);
  useEffect(() => {
    music.setHot(hot);
    return () => music.setHot(false);
  }, [hot]);
}

/** Plays a sound effect whenever `key` changes to a non-null value (not on first render). */
export function useSfxOn(key: string | number | null, sfx: SfxName | null): void {
  const prev = useRef(key);
  useEffect(() => {
    if (key !== prev.current && key !== null && sfx) music.sfx(sfx);
    prev.current = key;
  }, [key, sfx]);
}

/** A soft pop for each new reaction and a sparkle for each burst. */
export function useReactionSounds(reactions: readonly LiveReaction[], bursts: readonly ReactionBurst[] = []): void {
  const seen = useRef<Set<string> | null>(null);
  const seenBursts = useRef<Set<string> | null>(null);
  useEffect(() => {
    const first = seen.current === null;
    const next = new Set(reactions.map((r) => r.id));
    if (!first) for (const id of next) if (!seen.current!.has(id)) music.sfx('pop');
    seen.current = next;
  }, [reactions]);
  useEffect(() => {
    const first = seenBursts.current === null;
    const next = new Set(bursts.map((b) => b.id));
    if (!first) for (const id of next) if (!seenBursts.current!.has(id)) music.sfx('burst');
    seenBursts.current = next;
  }, [bursts]);
}

export { music };
