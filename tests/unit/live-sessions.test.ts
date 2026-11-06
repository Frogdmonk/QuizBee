import { describe, expect, it } from 'vitest';
import {
  AVATAR_PATTERN,
  AVATAR_PRESETS,
  PART_COUNTS,
  PART_ORDER,
  decodeAvatar,
  encodeAvatar,
  isAvatarCode,
  randomAvatar,
  withPart,
} from '@/lib/avatar';
import { cleanNickname, nicknameIssue, nicknameKey } from '@/lib/nickname-rules';
import { formatPin, isValidPin, sanitizePin, sessionTopic } from '@/lib/session-rules';
import { applyHostEvent } from '@/services/live';
import type { SessionLobby } from '@/types/session';

describe('avatar codes', () => {
  it('has at least 30 distinct, valid presets', () => {
    expect(AVATAR_PRESETS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(AVATAR_PRESETS.map((p) => p.code)).size).toBe(AVATAR_PRESETS.length);
    expect(new Set(AVATAR_PRESETS.map((p) => p.name)).size).toBe(AVATAR_PRESETS.length);
    for (const preset of AVATAR_PRESETS) expect(isAvatarCode(preset.code)).toBe(true);
  });

  it('matches the database pattern exactly (one digit per part, within range)', () => {
    // The regex in the migration is derived from these counts.
    const derived = new RegExp(`^${PART_ORDER.map((k) => `[0-${PART_COUNTS[k] - 1}]`).join('')}$`);
    expect(derived.source).toBe(AVATAR_PATTERN.source);
    const combinations = PART_ORDER.reduce((n, k) => n * PART_COUNTS[k], 1);
    expect(combinations).toBeGreaterThan(1_000_000);
  });

  it('round-trips encode/decode and changes one part at a time', () => {
    const code = '791555957';
    expect(encodeAvatar(decodeAvatar(code))).toBe(code);
    const changed = withPart(code, 'hairStyle', 2);
    expect(changed).toBe('721555957');
    expect(() => withPart(code, 'eyes', 6)).toThrow(RangeError);
  });

  it('random avatars are always valid', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 500; i++) expect(isAvatarCode(randomAvatar(rng))).toBe(true);
    expect(randomAvatar(() => 0.9999)).toBe('797555957');
  });

  it('falls back to the first preset for invalid codes', () => {
    expect(encodeAvatar(decodeAvatar('nonsense'))).toBe(AVATAR_PRESETS[0].code);
  });
});

describe('nickname rules (mirror the SQL)', () => {
  it('cleans spacing and normalises look-alike characters', () => {
    expect(cleanNickname('  Ada   Lovelace ')).toBe('Ada Lovelace');
    expect(cleanNickname('Ｓａｍ')).toBe('Sam'); // full-width → NFKC
  });

  it('builds a duplicate key that ignores case, spaces and punctuation', () => {
    expect(nicknameKey('Sam Lee')).toBe(nicknameKey('sam-lee!'));
    expect(nicknameKey('SAMLEE')).toBe('samlee');
    expect(nicknameKey('Sam Leo')).not.toBe(nicknameKey('Sam Lee'));
  });

  it.each([
    ['A', /at least 2/],
    ['Seventeen chars!!', /up to 16/],
    ['<script>', /simple punctuation/],
    ['hi@there', /simple punctuation/],
    [`ab${String.fromCharCode(0x200b)}cd`, /simple punctuation/],
    ['...', /at least one letter/],
    ['Sh1tty', /different nickname/],
    ['fuuuuck', /different nickname/],
    ['B.i.t.c.h', /different nickname/],
  ])('rejects %j', (name, message) => {
    expect(nicknameIssue(name)).toMatch(message);
  });

  it.each(['Zoë', '李小龙', 'Classic Cass', "O'Brien", 'Sam R', 'Robin 2'])('accepts %j', (name) => {
    expect(nicknameIssue(name)).toBeNull();
  });
});

describe('PIN helpers', () => {
  it('keeps digits only, at most 6', () => {
    expect(sanitizePin('12a 34-567')).toBe('123456');
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(formatPin('482913')).toBe('482 913');
  });

  it('names the realtime topics the database authorises', () => {
    expect(sessionTopic('abc', 'host')).toBe('session:abc:host');
    expect(sessionTopic('abc', 'game')).toBe('session:abc:game');
  });
});

describe('applyHostEvent', () => {
  const base: SessionLobby = {
    id: 's1',
    role: 'host',
    quizId: 'q1',
    quizTitle: 'Planets',
    questionCount: 3,
    pin: '123456',
    status: 'lobby',
    phase: 'lobby',
    stateVersion: 2,
    isLocked: false,
    maxParticipants: 100,
    participantCount: 0,
    hasPresenterLink: false,
    createdAt: '2026-11-09T09:00:00Z',
    participants: [],
  };
  const raw = (id: string, nickname: string) => ({
    id,
    nickname,
    avatar: '000000000',
    status: 'active',
    joined_at: '2026-11-09T09:00:00Z',
    last_seen_at: '2026-11-09T09:00:00Z',
  });

  it('adds, updates and removes players without duplicates', () => {
    let lobby = applyHostEvent(base, 'participant_joined', { participant: raw('p1', 'Ada'), participant_count: 1 });
    lobby = applyHostEvent(lobby, 'participant_joined', { participant: raw('p1', 'Ada'), participant_count: 1 });
    lobby = applyHostEvent(lobby, 'participant_joined', { participant: raw('p2', 'Kim'), participant_count: 2 });
    expect(lobby.participants.map((p) => p.nickname)).toEqual(['Ada', 'Kim']);
    expect(lobby.participantCount).toBe(2);

    lobby = applyHostEvent(lobby, 'participant_updated', { participant: raw('p1', 'Ada L') });
    expect(lobby.participants[0].nickname).toBe('Ada L');

    lobby = applyHostEvent(lobby, 'participant_removed', { id: 'p1', participant_count: 1 });
    lobby = applyHostEvent(lobby, 'participant_left', { id: 'p2', participant_count: 0 });
    expect(lobby.participants).toEqual([]);
    expect(lobby.participantCount).toBe(0);
  });

  it('applies session updates but ignores stale versions', () => {
    const locked = applyHostEvent(base, 'session', {
      status: 'lobby',
      phase: 'lobby',
      is_locked: true,
      state_version: 3,
      participant_count: 0,
    });
    expect(locked.isLocked).toBe(true);
    const stale = applyHostEvent(locked, 'session', {
      status: 'lobby',
      phase: 'lobby',
      is_locked: false,
      state_version: 2,
      participant_count: 0,
    });
    expect(stale).toBe(locked);
    expect(applyHostEvent(base, 'unknown', {})).toBe(base);
  });
});
