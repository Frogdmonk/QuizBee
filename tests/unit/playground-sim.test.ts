import { describe, expect, it } from 'vitest';
import { PlaygroundSim, WORLD, interactionFor, radiusFor, staticLayout } from '@/lib/playground/sim';

const IDS = Array.from({ length: 10 }, (_, i) => `player-${String(i).padStart(2, '0')}`);
const T0 = Date.UTC(2026, 10, 11, 10, 0, 0);

describe('lobby playground simulation', () => {
  it('two screens agree exactly, whenever they opened and in whatever order they list players', () => {
    const projector = new PlaygroundSim('session-1');
    projector.setWalkers(IDS);
    // The projector has been running for a while…
    for (let t = T0; t < T0 + 20_000; t += 16) projector.frame(t);
    // …the teacher's laptop opens later, with the players in another order.
    const laptop = new PlaygroundSim('session-1');
    laptop.setWalkers([...IDS].reverse());
    for (let t = T0 + 20_000; t < T0 + 40_000; t += 250) {
      expect(laptop.frame(t)).toEqual(projector.frame(t));
    }
  });

  it('a different session gives a different scene', () => {
    const a = new PlaygroundSim('session-1');
    const b = new PlaygroundSim('session-2');
    a.setWalkers(IDS);
    b.setWalkers(IDS);
    expect(a.frame(T0)).not.toEqual(b.frame(T0));
  });

  it('characters stay inside the play area and never sit on top of each other', () => {
    const sim = new PlaygroundSim('bounds');
    sim.setWalkers(IDS);
    const r = sim.radius;
    let closest = Infinity;
    for (let t = T0; t < T0 + 60_000; t += 100) {
      const frame = [...sim.frame(t).values()];
      for (const f of frame) {
        expect(f.x).toBeGreaterThanOrEqual(r);
        expect(f.x).toBeLessThanOrEqual(WORLD.width - r);
        expect(f.y).toBeGreaterThanOrEqual(r);
        expect(f.y).toBeLessThanOrEqual(WORLD.height - r);
      }
      for (let i = 0; i < frame.length; i++)
        for (let j = i + 1; j < frame.length; j++) closest = Math.min(closest, Math.hypot(frame[i].x - frame[j].x, frame[i].y - frame[j].y));
    }
    expect(closest).toBeGreaterThan(r * 1.2); // the soft push keeps a gap even in a crowded moment
  });

  it('they move independently: not everyone walks or idles in lockstep', () => {
    const sim = new PlaygroundSim('lively');
    sim.setWalkers(IDS);
    const acts = new Set<string>();
    for (let t = T0; t < T0 + 30_000; t += 500) {
      const frame = [...sim.frame(t).values()];
      const walking = frame.filter((f) => f.act === 'walk' || f.act === 'run').length;
      expect(walking).toBeLessThan(IDS.length); // never all at once
      frame.forEach((f) => acts.add(f.act));
    }
    expect(acts).toContain('walk');
    expect([...acts].some((a) => ['look', 'jump', 'dance', 'stretch', 'wave'].includes(a))).toBe(true);
  });

  it('collisions happen and trigger reactions with faces and bubbles', () => {
    const sim = new PlaygroundSim('crowded');
    sim.setWalkers(IDS);
    const kinds = new Set<string>();
    let reacting = 0;
    for (let t = T0; t < T0 + 180_000; t += 200) {
      sim.interactions(t).forEach((e) => kinds.add(e.kind));
      reacting += [...sim.frame(t).values()].filter((f) => f.mood !== null && f.bubble !== null).length;
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(reacting).toBeGreaterThan(0);
  });

  it('a pair that keeps colliding gets angry; otherwise the reaction is a mix', () => {
    const repeats = Array.from({ length: 200 }, (_, i) => interactionFor(123, i, true));
    expect(repeats.filter((k) => k === 'angry').length).toBeGreaterThan(80); // usually, not always
    const kinds = new Set(Array.from({ length: 400 }, (_, i) => interactionFor(987, i, false)));
    expect([...kinds].sort()).toEqual(['bump', 'dance', 'funny', 'giggle', 'highfive', 'wave']);
  });

  it('characters shrink as the room fills, and reduced motion gets a tidy fixed layout', () => {
    expect(radiusFor(5)).toBeGreaterThan(radiusFor(40));
    expect(radiusFor(100)).toBeGreaterThanOrEqual(20);
    const layout = staticLayout(IDS);
    expect(layout.size).toBe(10);
    const xs = [...layout.values()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
    expect(new Set(xs).size).toBe(10);
  });

  it('100 players stay fast enough for a projector frame', () => {
    const sim = new PlaygroundSim('big');
    sim.setWalkers(Array.from({ length: 100 }, (_, i) => `p${i}`));
    sim.frame(T0); // backfill
    const startedAt = performance.now();
    for (let i = 1; i <= 60; i++) sim.frame(T0 + i * 16);
    expect((performance.now() - startedAt) / 60).toBeLessThan(8);
  });
});
