/**
 * Rally's soundtrack, written as data for the synthesiser in engine.ts. Everything here is an
 * original composition; nothing is sampled, so there are no audio files to load or license.
 *
 * A section is a loop of 4/4 bars on a 16-step grid:
 *   - drum patterns are 16 characters per bar: '.' rest, 'x' normal hit, '1'–'9' velocity;
 *   - bass: 'r' root, 'f' fifth, 'o' octave, 's' flat seventh, '.' rest;
 *   - arp: '0'–'3' chord tone, '4' first tone an octave up, '.' rest;
 *   - stab: 'x' plays the whole chord short;
 *   - notes: free events [step, midi notes, length in steps, instrument] across the whole section.
 */

export type TrackName = 'lobby' | 'ready' | 'question' | 'reveal' | 'leaderboard' | 'podium';
export type Instrument = 'lead' | 'brass' | 'bell' | 'pluck';
export type NoteEvent = readonly [step: number, notes: readonly number[], length: number, instrument: Instrument];
export type Chord = { root: number; tones: readonly number[] };

export interface Section {
  bpm: number;
  bars: number;
  chords: readonly Chord[];
  kick?: string;
  snare?: string;
  hat?: string;
  /** Used instead of `hat` when the track is "hot" (last seconds of a question). */
  hatHot?: string;
  openHat?: string;
  bass?: string;
  arp?: string;
  stab?: string;
  notes?: readonly NoteEvent[];
  /** Melody only on every other pass, so a loop doesn't wear out as quickly. */
  notesEvery?: 1 | 2;
  pad?: boolean;
  /** Crash cymbal on the very first step. */
  crash?: boolean;
  /** Overall level of this section, 0..1. */
  level?: number;
}

export interface Track {
  intro?: Section;
  /** null: silence once the intro is over. */
  loop: Section | null;
  /** How much faster the loop runs when hot. */
  hotTempo?: number;
}

const ch = (root: number, ...tones: number[]): Chord => ({ root, tones });

// --- Lobby: a sunny, bouncy walk (C major, 112 bpm) ------------------------------------------
const LOBBY: Track = {
  loop: {
    bpm: 112,
    bars: 4,
    chords: [ch(36, 60, 64, 67, 71), ch(33, 57, 60, 64, 67), ch(38, 62, 65, 69, 72), ch(31, 59, 62, 65, 67)],
    kick: 'x.......x.x.....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: 'r..r..o.r..f..o.',
    arp: '0.1.2.3.4.3.2.1.',
    pad: true,
    notesEvery: 2,
    notes: [
      [0, [72], 2, 'lead'], [3, [76], 1, 'lead'], [4, [79], 2, 'lead'], [8, [76], 2, 'lead'], [12, [74], 3, 'lead'],
      [16, [72], 2, 'lead'], [19, [69], 1, 'lead'], [20, [72], 2, 'lead'], [24, [76], 4, 'lead'], [30, [74], 2, 'lead'],
      [32, [74], 2, 'lead'], [35, [77], 1, 'lead'], [36, [81], 2, 'lead'], [40, [79], 2, 'lead'], [44, [77], 2, 'lead'], [46, [76], 2, 'lead'],
      [48, [74], 3, 'lead'], [52, [71], 2, 'lead'], [54, [74], 2, 'lead'], [56, [79], 6, 'lead'],
    ],
    level: 0.8,
  },
};

// --- Get ready: a pulse that builds (A, 120 bpm) ---------------------------------------------
const READY: Track = {
  loop: {
    bpm: 120,
    bars: 1,
    chords: [ch(33, 57, 64, 69, 76)],
    kick: 'x...x...x...x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bass: 'r.r.r.r.r.r.r.r.',
    arp: '0.2.1.3.0.2.1.3.',
    level: 0.75,
  },
};

// --- Question: tense, driving "thinking" groove (A minor, 124 bpm) ---------------------------
const QUESTION: Track = {
  hotTempo: 1.12,
  loop: {
    bpm: 124,
    bars: 4,
    chords: [ch(33, 57, 60, 64, 69), ch(29, 57, 60, 65, 69), ch(36, 55, 60, 64, 67), ch(28, 56, 59, 64, 68)],
    kick: 'x.....x...x.....',
    snare: '....4.......4...',
    hat: 'x.x.x.x.x.x.x.x.',
    hatHot: 'x2x2x2x2x2x2x2x2',
    bass: 'r.r.r.r.r.r.o.r.',
    arp: '0.2.1.2.0.2.1.3.',
    notesEvery: 2,
    notes: [
      [0, [81], 6, 'bell'], [8, [76], 6, 'bell'],
      [16, [77], 6, 'bell'], [24, [72], 6, 'bell'],
      [32, [76], 6, 'bell'], [40, [79], 6, 'bell'],
      [48, [80], 12, 'bell'],
    ],
    level: 0.62,
  },
};

// --- Reveal: a "ta-da" sting, then a soft bed until the leaderboard --------------------------
const REVEAL: Track = {
  intro: {
    bpm: 110,
    bars: 2,
    chords: [ch(36, 60, 64, 67, 72)],
    kick: 'x...............',
    crash: true,
    notes: [
      [0, [60, 64, 67, 72], 6, 'brass'],
      [0, [72], 1, 'bell'], [1, [76], 1, 'bell'], [2, [79], 1, 'bell'], [3, [84], 4, 'bell'],
    ],
    pad: true,
    level: 0.85,
  },
  loop: {
    bpm: 110,
    bars: 2,
    chords: [ch(36, 60, 64, 67, 72), ch(41, 60, 65, 69, 72)],
    hat: '....x.......x...',
    pad: true,
    level: 0.5,
  },
};

// --- Leaderboard: drumroll, then a disco strut (F major, 118 bpm) ----------------------------
const LEADERBOARD: Track = {
  intro: {
    bpm: 118,
    bars: 1,
    chords: [ch(36, 60, 64, 67, 72)],
    snare: '2233445566778899',
    level: 0.8,
  },
  loop: {
    bpm: 118,
    bars: 4,
    chords: [ch(41, 65, 69, 72, 77), ch(38, 62, 65, 69, 74), ch(34, 58, 62, 65, 70), ch(36, 60, 64, 67, 72)],
    crash: true,
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    openHat: '..............x.',
    bass: 'r.o.r.o.r.o.r.o.',
    stab: '..x...x...x...x.',
    notesEvery: 2,
    notes: [
      [0, [77], 2, 'lead'], [2, [79], 2, 'lead'], [4, [81], 4, 'lead'], [10, [79], 2, 'lead'], [12, [77], 4, 'lead'],
      [16, [74], 2, 'lead'], [18, [77], 2, 'lead'], [20, [81], 4, 'lead'], [26, [79], 2, 'lead'], [28, [77], 2, 'lead'], [30, [74], 2, 'lead'],
      [32, [74], 2, 'lead'], [34, [77], 2, 'lead'], [36, [82], 4, 'lead'], [42, [81], 2, 'lead'], [44, [79], 4, 'lead'],
      [48, [79], 2, 'lead'], [50, [81], 2, 'lead'], [52, [79], 2, 'lead'], [54, [76], 2, 'lead'], [56, [72], 8, 'lead'],
    ],
    level: 0.72,
  },
};

// --- Podium: a fanfare, then a victory lap (C major, 126 bpm) --------------------------------
const PODIUM: Track = {
  intro: {
    bpm: 104,
    bars: 2,
    chords: [ch(31, 55, 59, 62, 67), ch(36, 60, 64, 67, 72)],
    snare: '..............88',
    notes: [
      [0, [55, 59, 62, 67], 1, 'brass'], [2, [55, 59, 62, 67], 1, 'brass'], [4, [55, 59, 62, 67], 1, 'brass'],
      [6, [60, 64, 67, 72], 9, 'brass'],
      [16, [65, 69, 72, 77], 2, 'brass'], [19, [67, 71, 74, 79], 2, 'brass'], [22, [72, 76, 79, 84], 10, 'brass'],
    ],
    crash: true,
    level: 0.9,
  },
  loop: {
    bpm: 126,
    bars: 4,
    chords: [ch(36, 60, 64, 67, 72), ch(41, 60, 65, 69, 72), ch(33, 57, 60, 64, 69), ch(31, 55, 59, 62, 67)],
    crash: true,
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    openHat: '..x...x...x...x.',
    bass: 'r.o.r.o.r.o.f.o.',
    arp: '0.1.2.4.0.1.2.4.',
    pad: true,
    notes: [
      [0, [79], 3, 'lead'], [4, [84], 3, 'lead'], [8, [83], 2, 'lead'], [10, [81], 2, 'lead'], [12, [79], 4, 'lead'],
      [16, [77], 3, 'lead'], [20, [81], 3, 'lead'], [24, [79], 2, 'lead'], [26, [77], 2, 'lead'], [28, [76], 4, 'lead'],
      [32, [76], 3, 'lead'], [36, [79], 3, 'lead'], [40, [84], 4, 'lead'], [44, [81], 4, 'lead'],
      [48, [79], 3, 'lead'], [52, [77], 2, 'lead'], [54, [74], 2, 'lead'], [56, [79], 8, 'lead'],
    ],
    level: 0.75,
  },
};

export const TRACKS: Record<TrackName, Track> = {
  lobby: LOBBY,
  ready: READY,
  question: QUESTION,
  reveal: REVEAL,
  leaderboard: LEADERBOARD,
  podium: PODIUM,
};

/** Which track fits the projector right now. Pure, so it is easy to test. */
export function soundtrackFor(view: {
  phase: string | null | undefined;
  /** The question is waiting for its synchronised start (the "get ready" screen). */
  gettingReady?: boolean;
}): TrackName | null {
  switch (view.phase) {
    case 'lobby':
      return 'lobby';
    case 'question':
      return view.gettingReady ? 'ready' : 'question';
    case 'reveal':
      return 'reveal';
    case 'leaderboard':
      return 'leaderboard';
    case 'podium':
      return 'podium';
    default:
      return null;
  }
}
