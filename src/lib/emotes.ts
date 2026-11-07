import type { AvatarMood } from '@/components/avatar/Avatar';

/**
 * The only reactions students can send. The server keeps the same list (private.emote_keys in the
 * Phase 5 migration) and refuses anything else, so no free text or images ever reach the projector.
 */
export type EmoteGroup = 'emoji' | 'feelings' | 'moves';
/** What a character does in the lobby when its player sends the emote. */
export type AvatarAction = 'wave' | 'dance' | 'jump' | 'celebrate' | 'shake' | 'spin' | 'pop';

export type Emote = {
  key: string;
  glyph: string;
  label: string;
  group: EmoteGroup;
  action: AvatarAction;
  mood?: AvatarMood;
};

export const EMOTES: readonly Emote[] = [
  { key: 'laugh', glyph: '😂', label: 'Laughing', group: 'emoji', action: 'shake', mood: 'laugh' },
  { key: 'fire', glyph: '🔥', label: 'Fire', group: 'emoji', action: 'jump', mood: 'happy' },
  { key: 'heart', glyph: '❤️', label: 'Love', group: 'emoji', action: 'pop', mood: 'happy' },
  { key: 'eyes', glyph: '👀', label: 'Watching', group: 'emoji', action: 'pop', mood: 'surprised' },
  { key: 'cool', glyph: '😎', label: 'Cool', group: 'emoji', action: 'dance' },
  { key: 'party', glyph: '🎉', label: 'Party', group: 'emoji', action: 'celebrate', mood: 'laugh' },
  { key: 'skull', glyph: '💀', label: 'Dead', group: 'emoji', action: 'spin', mood: 'dizzy' },
  { key: 'mindblown', glyph: '🤯', label: 'Mind blown', group: 'emoji', action: 'shake', mood: 'surprised' },
  { key: 'clap', glyph: '👏', label: 'Clap', group: 'emoji', action: 'jump', mood: 'happy' },
  { key: 'hundred', glyph: '💯', label: 'Hundred', group: 'emoji', action: 'pop', mood: 'happy' },
  { key: 'shocked', glyph: '😱', label: 'Shocked', group: 'feelings', action: 'shake', mood: 'surprised' },
  { key: 'confused', glyph: '😕', label: 'Confused', group: 'feelings', action: 'pop', mood: 'confused' },
  { key: 'angry', glyph: '😠', label: 'Angry', group: 'feelings', action: 'shake', mood: 'angry' },
  { key: 'cry', glyph: '😭', label: 'Crying', group: 'feelings', action: 'pop', mood: 'sad' },
  { key: 'thinking', glyph: '🤔', label: 'Thinking', group: 'feelings', action: 'pop', mood: 'confused' },
  { key: 'celebrate', glyph: '🥳', label: 'Celebrating', group: 'feelings', action: 'celebrate', mood: 'laugh' },
  { key: 'wave', glyph: '👋', label: 'Wave', group: 'moves', action: 'wave', mood: 'happy' },
  { key: 'dance', glyph: '💃', label: 'Dance', group: 'moves', action: 'dance', mood: 'happy' },
  { key: 'hype', glyph: '🙌', label: 'Hype jump', group: 'moves', action: 'jump', mood: 'laugh' },
  { key: 'gg', glyph: '🤝', label: 'Good game', group: 'moves', action: 'wave', mood: 'happy' },
];

export const EMOTE_GROUPS: readonly { key: EmoteGroup; label: string }[] = [
  { key: 'emoji', label: 'Emoji' },
  { key: 'feelings', label: 'Feelings' },
  { key: 'moves', label: 'Moves' },
];

const BY_KEY = new Map(EMOTES.map((e) => [e.key, e]));

export function emoteByKey(key: unknown): Emote | null {
  return typeof key === 'string' ? (BY_KEY.get(key) ?? null) : null;
}

/** Mirrors the server limit (5 per 8 s) so the phone can say "wait" before asking. */
export const REACTION_LIMIT = { count: 5, windowMs: 8000 } as const;
