import { useEffect, useRef, useState } from 'react';
import type { LobbyParticipant } from '@/types/session';

const SHOW_MS = 1600;

/**
 * Turns real roster changes into a short-lived "ADA JOINED" ticker for the projector and host
 * screens. The first roster load is ignored (no fake "joined" burst on page load); when more
 * than 3 people arrive at once it collapses to "+N JOINED".
 */
export function useJoinTicker(participants: LobbyParticipant[] | undefined): string | null {
  const known = useRef<Set<string> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!participants) return;
    if (known.current === null) {
      known.current = new Set(participants.map((p) => p.id));
      return;
    }
    const fresh = participants.filter((p) => !known.current!.has(p.id));
    known.current = new Set(participants.map((p) => p.id));
    if (fresh.length === 0) return;
    const text = fresh.length > 3 ? `+${fresh.length} joined` : `${fresh.map((p) => p.nickname).join(', ')} joined`;
    const show = window.setTimeout(() => setMessage(text), 0);
    const hide = window.setTimeout(() => setMessage(null), SHOW_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [participants]);

  return message;
}
