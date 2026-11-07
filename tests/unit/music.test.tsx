import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TRACKS, soundtrackFor, type Section } from '@/lib/audio/tracks';
import { MusicToggle } from '@/components/audio/MusicToggle';

const sections = Object.entries(TRACKS).flatMap(([name, t]) =>
  [t.intro && { name: `${name} intro`, s: t.intro }, t.loop && { name: `${name} loop`, s: t.loop }].filter(Boolean) as { name: string; s: Section }[],
);

describe('soundtrack', () => {
  it.each(sections)('$name is well-formed', ({ s }) => {
    expect(s.bpm).toBeGreaterThan(60);
    expect(s.chords.length).toBeGreaterThan(0);
    for (const key of ['kick', 'snare', 'hat', 'hatHot', 'openHat', 'bass', 'arp', 'stab'] as const) {
      const p = s[key];
      if (p !== undefined) expect(p, key).toHaveLength(16);
    }
    for (const c of s.kick ?? '') expect('.x123456789').toContain(c);
    for (const c of s.bass ?? '') expect('.rfos').toContain(c);
    for (const c of s.arp ?? '') expect('.01234').toContain(c);
    for (const chord of s.chords) {
      expect(chord.tones.length).toBeGreaterThanOrEqual(4); // the arp can reach tone 3
      for (const n of chord.tones) expect(n).toBeGreaterThan(40);
    }
    for (const [step, notes, len] of s.notes ?? []) {
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThan(s.bars * 16);
      expect(len).toBeGreaterThan(0);
      expect(notes.length).toBeGreaterThan(0);
    }
  });

  it('every game phase has its own music', () => {
    expect(soundtrackFor({ phase: 'lobby' })).toBe('lobby');
    expect(soundtrackFor({ phase: 'question', gettingReady: true })).toBe('ready');
    expect(soundtrackFor({ phase: 'question' })).toBe('question');
    expect(soundtrackFor({ phase: 'reveal' })).toBe('reveal');
    expect(soundtrackFor({ phase: 'leaderboard' })).toBe('leaderboard');
    expect(soundtrackFor({ phase: 'podium' })).toBe('podium');
    expect(soundtrackFor({ phase: undefined })).toBeNull();
  });

  it('the music button hides itself where the browser has no audio', () => {
    // jsdom has no Web Audio, like some very old browsers.
    const { container } = render(<MusicToggle />);
    expect(container).toBeEmptyDOMElement();
  });
});
