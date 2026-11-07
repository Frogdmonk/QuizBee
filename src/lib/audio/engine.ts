import { TRACKS, type Instrument, type NoteEvent, type Section, type Track, type TrackName } from './tracks';

/**
 * A tiny synthesiser and step sequencer on the Web Audio API. All sound is generated in the
 * browser (oscillators and filtered noise): no audio files, no downloads, nothing to license.
 *
 * SoundEngine works on any BaseAudioContext, so it can also render offline (tests / QA).
 * `music` (bottom of the file) is the app's single live player with the user's settings.
 */

export type SfxName = 'join' | 'pop' | 'burst' | 'tick' | 'tickHigh' | 'go' | 'timeup' | 'boing';

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const BASS_OFFSET: Record<string, number> = { r: 0, f: 7, o: 12, s: 10 };
/** Minimum gap between two of the same sound effect, so a flood of reactions stays pleasant. */
const SFX_GAP: Partial<Record<SfxName, number>> = { pop: 0.07, boing: 0.25, burst: 0.4, join: 0.08 };
const POP_NOTES = [72, 74, 76, 79, 81, 84];

function velocity(pattern: string | undefined, i: number): number {
  const c = pattern?.[i];
  if (!c || c === '.') return 0;
  if (c === 'x') return 0.8;
  const n = Number(c);
  return Number.isFinite(n) ? n / 9 : 0;
}

const notesByStep = new WeakMap<Section, Map<number, NoteEvent[]>>();
function eventsAt(section: Section, step: number): NoteEvent[] | undefined {
  let map = notesByStep.get(section);
  if (!map) {
    map = new Map();
    for (const ev of section.notes ?? []) map.set(ev[0], [...(map.get(ev[0]) ?? []), ev]);
    notesByStep.set(section, map);
  }
  return map.get(step);
}

export class SoundEngine {
  readonly out: GainNode;
  private readonly musicBus: GainNode;
  private readonly sfxBus: GainNode;
  private readonly noise: AudioBuffer;
  private track: Track | null = null;
  private name: TrackName | null = null;
  private section: Section | null = null;
  private inIntro = false;
  private step = 0;
  private pass = 0;
  private nextTime = 0;
  private bus: GainNode | null = null;
  private readonly lastSfx = new Map<SfxName, number>();
  hot = false;

  constructor(readonly ctx: BaseAudioContext, destination: AudioNode) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    // A fast limiter last, so even full volume never clips the speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    comp.connect(limiter).connect(destination);
    this.out = this.gain(1, comp);
    this.musicBus = this.gain(1.4, this.out);
    this.sfxBus = this.gain(1.6, this.out);
    const length = Math.floor(ctx.sampleRate);
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  get current(): TrackName | null {
    return this.name;
  }

  /** Cross-fade to another track (or to silence). The new track starts from its beginning. */
  setTrack(name: TrackName | null, at = this.ctx.currentTime): void {
    if (name === this.name) return;
    if (this.bus) {
      const old = this.bus;
      old.gain.cancelScheduledValues(at);
      old.gain.setValueAtTime(old.gain.value, at);
      old.gain.linearRampToValueAtTime(0, at + 0.35);
      setTimeout(() => old.disconnect(), 1500);
      this.bus = null;
    }
    this.name = name;
    this.track = name ? TRACKS[name] : null;
    this.section = this.track ? (this.track.intro ?? this.track.loop) : null;
    this.inIntro = Boolean(this.track?.intro);
    this.step = 0;
    this.pass = 0;
    this.nextTime = at + 0.05;
    if (this.track) {
      this.bus = this.gain(0, this.musicBus);
      this.bus.gain.setValueAtTime(0, at);
      this.bus.gain.linearRampToValueAtTime(1, at + 0.06);
    }
  }

  /** Schedule every step that starts before `horizon` (seconds on the context clock). */
  pump(horizon: number): void {
    // After a stall (hidden tab, suspended context) skip ahead rather than play a pile-up.
    if (this.nextTime < this.ctx.currentTime - 0.05) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.section && this.bus && this.nextTime < horizon) {
      const s = this.section;
      this.playStep(s, this.bus, this.step, this.nextTime);
      const tempo = s.bpm * (this.hot && !this.inIntro ? (this.track?.hotTempo ?? 1) : 1);
      this.nextTime += 60 / tempo / 4;
      this.step++;
      if (this.step >= s.bars * 16) {
        this.step = 0;
        if (this.inIntro) {
          this.inIntro = false;
          this.section = this.track?.loop ?? null;
          this.pass = 0;
        } else {
          this.pass++;
        }
      }
    }
  }

  sfx(name: SfxName, at = this.ctx.currentTime): void {
    const gap = SFX_GAP[name] ?? 0;
    const last = this.lastSfx.get(name) ?? -Infinity;
    if (at - last < gap) return;
    this.lastSfx.set(name, at);
    const d = this.sfxBus;
    switch (name) {
      case 'tick':
      case 'tickHigh': {
        const o = this.osc('sine', name === 'tick' ? 1250 : 1700, at, 0.08);
        o.connect(this.env(at, name === 'tick' ? 0.5 : 0.65, 0.002, 0.05, d));
        break;
      }
      case 'go':
        this.brass(at, [60, 64, 67, 72], 0.45, 0.9, d);
        this.kick(at, 0.9, d);
        this.crash(at, 0.8, d);
        break;
      case 'timeup': {
        const f = this.filter('lowpass', 1600, d);
        this.osc('square', mtof(67), at, 0.2).connect(this.env(at, 0.12, 0.005, 0.16, f));
        this.osc('square', mtof(63), at + 0.18, 0.45).connect(this.env(at + 0.18, 0.12, 0.005, 0.32, f));
        break;
      }
      case 'join':
        this.osc('triangle', mtof(88), at, 0.12).connect(this.env(at, 0.2, 0.003, 0.08, d));
        this.osc('triangle', mtof(93), at + 0.07, 0.25).connect(this.env(at + 0.07, 0.35, 0.003, 0.16, d));
        break;
      case 'pop': {
        const f = mtof(POP_NOTES[Math.floor(Math.random() * POP_NOTES.length)]);
        const o = this.osc('sine', f, at, 0.18);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.06);
        o.connect(this.env(at, 0.35, 0.003, 0.12, d));
        break;
      }
      case 'burst':
        [72, 76, 79, 84, 88].forEach((n, i) => this.bell(at + i * 0.06, n, 0.5, 0.8, d));
        break;
      case 'boing': {
        const o = this.osc('sine', 180, at, 0.32);
        o.frequency.exponentialRampToValueAtTime(520, at + 0.07);
        o.frequency.exponentialRampToValueAtTime(300, at + 0.22);
        o.connect(this.env(at, 0.3, 0.005, 0.24, d));
        break;
      }
    }
  }

  // --- Sequencer -----------------------------------------------------------------------------

  private playStep(s: Section, dest: AudioNode, step: number, t: number): void {
    const i = step % 16;
    const chord = s.chords[Math.floor(step / 16) % s.chords.length];
    const lvl = s.level ?? 0.7;
    const stepDur = 60 / s.bpm / 4;

    if (s.crash && step === 0 && this.pass === 0) this.crash(t, lvl, dest);
    let v = velocity(s.kick, i);
    if (v) this.kick(t, v * lvl, dest);
    v = velocity(s.snare, i);
    if (v) this.snare(t, v * lvl, dest);
    v = velocity(this.hot && s.hatHot ? s.hatHot : s.hat, i);
    if (v) this.hat(t, v * lvl, false, dest);
    v = velocity(s.openHat, i);
    if (v) this.hat(t, v * lvl, true, dest);

    const b = s.bass?.[i];
    if (b && b in BASS_OFFSET) this.bass(t, chord.root + 12 + BASS_OFFSET[b], stepDur * 1.7, lvl, dest);
    const a = s.arp?.[i];
    if (a && a !== '.') {
      const note = a === '4' ? chord.tones[0] + 12 : chord.tones[Number(a)];
      if (note !== undefined) this.pluck(t, note + 12, lvl * (this.hot ? 1.15 : 1), dest);
    }
    if (s.stab?.[i] === 'x') chord.tones.forEach((n) => this.pluck(t, n, lvl * 0.7, dest));
    if (s.pad && i === 0) this.pad(t, chord.tones, stepDur * 16, lvl, dest);

    if (s.notes && (s.notesEvery !== 2 || this.inIntro || this.pass % 2 === 1)) {
      for (const [, notes, len, inst] of eventsAt(s, step) ?? []) this.play(inst, t, notes, len * stepDur, lvl, dest);
    }
  }

  private play(inst: Instrument, t: number, notes: readonly number[], dur: number, lvl: number, dest: AudioNode): void {
    if (inst === 'brass') this.brass(t, notes, dur, lvl, dest);
    else for (const n of notes) {
      if (inst === 'lead') this.lead(t, n, dur, lvl, dest);
      else if (inst === 'bell') this.bell(t, n, dur, lvl, dest);
      else this.pluck(t, n, lvl, dest);
    }
  }

  // --- Instruments ---------------------------------------------------------------------------

  private kick(t: number, v: number, dest: AudioNode): void {
    const o = this.osc('sine', 140, t, 0.45);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    o.connect(this.env(t, 0.95 * v, 0.002, 0.32, dest));
  }

  private snare(t: number, v: number, dest: AudioNode): void {
    this.noiseHit(t, 0.17, 'bandpass', 1900, 0.5 * v, dest);
    this.osc('triangle', 185, t, 0.12).connect(this.env(t, 0.3 * v, 0.002, 0.08, dest));
  }

  private hat(t: number, v: number, open: boolean, dest: AudioNode): void {
    this.noiseHit(t, open ? 0.22 : 0.035, 'highpass', 7500, (open ? 0.12 : 0.16) * v, dest);
  }

  private crash(t: number, v: number, dest: AudioNode): void {
    this.noiseHit(t, 1.4, 'highpass', 4200, 0.22 * v, dest);
  }

  private bass(t: number, midi: number, dur: number, lvl: number, dest: AudioNode): void {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.setValueAtTime(950, t);
    f.frequency.exponentialRampToValueAtTime(260, t + dur);
    f.connect(this.env(t, 0.3 * lvl, 0.005, dur, dest));
    this.osc('sawtooth', mtof(midi), t, dur + 0.1).connect(f);
  }

  private pluck(t: number, midi: number, lvl: number, dest: AudioNode): void {
    const f = this.filter('lowpass', 3200, dest);
    this.osc('triangle', mtof(midi), t, 0.35).connect(this.env(t, 0.12 * lvl, 0.004, 0.24, f));
  }

  private lead(t: number, midi: number, dur: number, lvl: number, dest: AudioNode): void {
    const f = this.filter('lowpass', 2600, dest);
    const g = this.sustain(t, 0.07 * lvl, 0.012, dur, 0.09, f);
    this.osc('square', mtof(midi), t, dur + 0.15).connect(g);
    const o2 = this.osc('sawtooth', mtof(midi), t, dur + 0.15);
    o2.detune.value = 8;
    o2.connect(g);
  }

  private bell(t: number, midi: number, dur: number, lvl: number, dest: AudioNode): void {
    const f = mtof(midi);
    const decay = Math.max(0.5, Math.min(1.6, dur * 1.5));
    this.osc('sine', f, t, decay + 0.1).connect(this.env(t, 0.12 * lvl, 0.003, decay, dest));
    this.osc('sine', f * 3.01, t, 0.5).connect(this.env(t, 0.035 * lvl, 0.002, 0.35, dest));
  }

  private brass(t: number, notes: readonly number[], dur: number, lvl: number, dest: AudioNode): void {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
    f.connect(this.sustain(t, 0.085 * lvl, 0.03, dur, 0.16, dest));
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const o = this.osc('sawtooth', mtof(n), t, dur + 0.25);
        o.detune.value = detune;
        o.connect(f);
      }
    }
  }

  private pad(t: number, notes: readonly number[], dur: number, lvl: number, dest: AudioNode): void {
    const f = this.filter('lowpass', 1100, dest);
    const g = this.sustain(t, 0.022 * lvl, 0.35, dur - 0.2, 0.5, f);
    for (const n of notes) {
      for (const detune of [-10, 10]) {
        const o = this.osc('sawtooth', mtof(n), t, dur + 0.6);
        o.detune.value = detune;
        o.connect(g);
      }
    }
  }

  // --- Building blocks -----------------------------------------------------------------------

  private gain(value: number, dest: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(dest);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, length: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + length);
    return o;
  }

  private filter(type: BiquadFilterType, freq: number, dest: AudioNode): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.connect(dest);
    return f;
  }

  /** Percussive envelope: quick attack, exponential decay. */
  private env(t: number, peak: number, attack: number, decay: number, dest: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  /** Held envelope: attack, hold until `dur`, release. */
  private sustain(t: number, peak: number, attack: number, dur: number, release: number, dest: AudioNode): GainNode {
    const g = this.ctx.createGain();
    const hold = Math.max(t + attack, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, hold);
    g.gain.linearRampToValueAtTime(0, hold + release);
    g.connect(dest);
    return g;
  }

  private noiseHit(t: number, decay: number, type: BiquadFilterType, freq: number, peak: number, dest: AudioNode): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.filter(type, freq, this.env(t, peak, 0.001, decay, dest));
    src.connect(f);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }
}

// --- The live player ------------------------------------------------------------------------

export type MusicStatus = 'unsupported' | 'off' | 'blocked' | 'playing';
export type MusicSnapshot = { status: MusicStatus; volume: number };

const STORAGE_KEY = 'rally.music';

function loadSettings(): { enabled: boolean; volume: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { enabled?: unknown; volume?: unknown } | null;
    return {
      enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
      volume: typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : 0.6,
    };
  } catch {
    return { enabled: true, volume: 0.6 };
  }
}

function audioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * The app's one music player. Browsers only allow sound after the person has clicked or pressed a
 * key on the page, so until then the status is 'blocked' and the first click anywhere starts it.
 */
class MusicPlayer {
  private ctx: AudioContext | null = null;
  private engine: SoundEngine | null = null;
  private readonly listeners = new Set<() => void>();
  private settings = loadSettings();
  private wanted: TrackName | null = null;
  private hot = false;
  private snap: MusicSnapshot = { status: audioContextClass() ? (this.settings.enabled ? 'blocked' : 'off') : 'unsupported', volume: this.settings.volume };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): MusicSnapshot => this.snap;

  setTrack = (name: TrackName | null): void => {
    this.wanted = name;
    if (!this.settings.enabled) return;
    if (name && !this.ensure()) return;
    this.engine?.setTrack(name);
  };

  setHot = (hot: boolean): void => {
    this.hot = hot;
    if (this.engine) this.engine.hot = hot;
  };

  sfx = (name: SfxName): void => {
    if (this.settings.enabled && this.engine && this.ctx?.state === 'running') this.engine.sfx(name);
  };

  setEnabled = (enabled: boolean): void => {
    this.settings = { ...this.settings, enabled };
    this.save();
    if (enabled) {
      if (this.ensure()) {
        void this.ctx?.resume();
        this.engine?.setTrack(this.wanted);
      }
    } else if (this.engine && this.ctx) {
      this.engine.setTrack(null);
      const ctx = this.ctx;
      setTimeout(() => {
        if (!this.settings.enabled) void ctx.suspend();
      }, 450);
    }
    this.emit();
  };

  setVolume = (volume: number): void => {
    this.settings = { ...this.settings, volume: Math.min(1, Math.max(0, volume)) };
    this.save();
    this.applyVolume();
    this.emit();
  };

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor = audioContextClass();
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor({ latencyHint: 'playback' });
    } catch {
      return false;
    }
    this.engine = new SoundEngine(this.ctx, this.ctx.destination);
    this.engine.hot = this.hot;
    this.applyVolume();
    this.ctx.addEventListener('statechange', () => this.emit());
    const unlock = () => {
      if (this.settings.enabled && this.ctx?.state !== 'running') void this.ctx?.resume();
    };
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlock, { capture: true, passive: true });
    setInterval(() => {
      if (this.ctx?.state === 'running') this.engine?.pump(this.ctx.currentTime + 0.15);
    }, 25);
    void this.ctx.resume().catch(() => undefined);
    return true;
  }

  private applyVolume(): void {
    if (!this.engine || !this.ctx) return;
    const v = this.settings.volume;
    this.engine.out.gain.setTargetAtTime(v ** 1.5, this.ctx.currentTime, 0.03);
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Private window or blocked storage: the setting simply lasts for this visit.
    }
  }

  private emit(): void {
    const status: MusicStatus = !audioContextClass()
      ? 'unsupported'
      : !this.settings.enabled
        ? 'off'
        : this.ctx?.state === 'running'
          ? 'playing'
          : 'blocked';
    if (status !== this.snap.status || this.settings.volume !== this.snap.volume) {
      this.snap = { status, volume: this.settings.volume };
      for (const fn of this.listeners) fn();
    }
  }
}

export const music = new MusicPlayer();

// Development builds only: lets automated browser checks inspect the live player.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __rallyMusic?: MusicPlayer }).__rallyMusic = music;
