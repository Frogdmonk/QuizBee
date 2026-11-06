/**
 * Nickname rules. Mirrors private.clean_nickname / private.nickname_blocked in
 * the Phase 3 migration. The server is authoritative; this gives instant
 * feedback on the phone before a request is sent.
 */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'niga', 'niger', 'fagot', 'slut', 'whore', 'pusy', 'porn', 'nazi',
  'hitler', 'bastard', 'wank', 'twat', 'retard', 'rapist', 'dildo', 'penis', 'vagina', 'ashole',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's' };

// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
const SYMBOLS = /[<>{}[\]\\/@#$%^&*=+|~`"]/;
const KEY_STRIP = /[\s._'!?,():;-]/g;

export function cleanNickname(raw: string): string {
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Comparison key: duplicates ignore case, spaces and simple punctuation. */
export function nicknameKey(name: string): string {
  return cleanNickname(name).replace(KEY_STRIP, '').toLowerCase();
}

function isBlocked(key: string): boolean {
  const folded = key
    .replace(/[0134578@$]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1+/g, '$1');
  return BLOCKED.some((word) => folded.includes(word));
}

/** The first problem with a nickname, or null when it is acceptable. */
export function nicknameIssue(raw: string): string | null {
  const name = cleanNickname(raw);
  const length = [...name].length;
  if (length < NICKNAME_MIN) return 'Nicknames need at least 2 characters.';
  if (length > NICKNAME_MAX) return 'Nicknames can be up to 16 characters.';
  if (INVISIBLE.test(name) || SYMBOLS.test(name)) return 'Use letters, numbers and simple punctuation only.';
  const key = nicknameKey(name);
  if (!key) return 'Nicknames need at least one letter or number.';
  if (isBlocked(key)) return 'Please choose a different nickname.';
  return null;
}
