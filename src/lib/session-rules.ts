import { getEnv } from '@/lib/env';

/** Mirrors create_session in the Phase 3 migration. */
export const SESSION_LIMITS = {
  minPlayers: 2,
  maxPlayers: 100,
  openSessionsPerHost: 5,
  lobbyLifetimeHours: 12,
} as const;

export const PIN_LENGTH = 6;

/** Keeps digits only, at most 6. */
export function sanitizePin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export function isValidPin(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
}

/** "482 913" — easier to read off a projector. */
export function formatPin(pin: string): string {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
}

/** Host part of the public site, e.g. "rally.pages.dev". */
export function joinHost(): string {
  try {
    return new URL(getEnv().siteUrl).host;
  } catch {
    return getEnv().siteUrl;
  }
}

/** Link encoded in the QR code: opens the join screen with the PIN filled in. */
export function joinUrl(pin?: string): string {
  return `${getEnv().siteUrl}/join${pin ? `/${pin}` : ''}`;
}

/** Projector link for another device. The key travels in the fragment, so it never reaches servers or logs. */
export function presenterUrl(sessionId: string, key: string): string {
  return `${getEnv().siteUrl}/presenter/${sessionId}#key=${encodeURIComponent(key)}`;
}

export type SessionTopic = 'host' | 'game' | 'lobby';

export function sessionTopic(sessionId: string, kind: SessionTopic): string {
  return `session:${sessionId}:${kind}`;
}
