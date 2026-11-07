import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseReaction } from '@/hooks/useReactions';
import { EMOTES, emoteByKey } from '@/lib/emotes';
import { ReactionLayer } from '@/components/reactions/ReactionLayer';

const NOW = Date.UTC(2026, 10, 11, 10, 0, 0);
const valid = { id: 'r1', pid: 'p1', n: 'Ada', a: '000000000', e: 'fire', at: new Date(NOW - 500).toISOString() };

describe('incoming reactions', () => {
  it('accepts a well-formed reaction and maps it to its emote', () => {
    expect(parseReaction(valid, NOW)).toMatchObject({ id: 'r1', participantId: 'p1', nickname: 'Ada', emote: { key: 'fire', glyph: '🔥' } });
  });

  it('drops unknown emotes, malformed payloads and stale (delayed) events', () => {
    expect(parseReaction({ ...valid, e: 'hello world' }, NOW)).toBeNull();
    expect(parseReaction({ ...valid, id: 5 }, NOW)).toBeNull();
    expect(parseReaction(null, NOW)).toBeNull();
    expect(parseReaction({ ...valid, at: new Date(NOW - 10_000).toISOString() }, NOW)).toBeNull();
  });

  it('the emote list matches the server list exactly', () => {
    // private.emote_keys() in supabase/migrations/20261112090000_phase5_reactions_autoboard.sql
    expect(EMOTES.map((e) => e.key)).toEqual([
      'laugh', 'fire', 'heart', 'eyes', 'cool', 'party', 'skull', 'mindblown', 'clap', 'hundred',
      'shocked', 'confused', 'angry', 'cry', 'thinking', 'celebrate',
      'wave', 'dance', 'hype', 'gg',
    ]);
    expect(emoteByKey('nope')).toBeNull();
  });

  it('the projector lane shows name and emoji, and keeps only the newest when busy', () => {
    const reactions = Array.from({ length: 20 }, (_, i) => ({
      id: `r${i}`, participantId: `p${i}`, nickname: `Player ${i}`, avatar: '000000000', emote: emoteByKey('party')!, at: NOW,
    }));
    render(<ReactionLayer reactions={reactions} bursts={[]} />);
    expect(screen.queryByText('Player 0')).not.toBeInTheDocument();
    expect(screen.getByText('Player 19')).toBeInTheDocument();
    expect(screen.getAllByText('🎉').length).toBe(14);
  });
});
