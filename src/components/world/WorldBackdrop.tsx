import { memo, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { hashString } from '@/lib/playground/sim';
import '@/styles/world.css';

/**
 * The world behind every projector screen: one sky and landscape so the lobby, questions, the
 * battle, the leaderboard and the podium feel like one place. The weather follows the monster:
 *   calm     dusk-blue sky, stars and fireflies
 *   rage     a red sky with drifting embers
 *   enraged  a storm: dark crimson, embers and lightning flickers
 *   victory  dawn after the monster is defeated, with sparkles
 * Pure CSS (transforms and opacity only), so it is cheap on an old projector PC; reduced motion
 * keeps the colours and stops the movement. A dark veil keeps text readable on top.
 */
export type WorldMood = 'calm' | 'rage' | 'enraged' | 'victory';

const MOODS: WorldMood[] = ['calm', 'rage', 'enraged', 'victory'];
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const h = hashString(`p${i}`);
  return { left: h % 100, top: (h >> 7) % 70, delay: (h >> 3) % 6000, dur: 5000 + ((h >> 11) % 5000), size: 3 + ((h >> 5) % 4) };
});

export const WorldBackdrop = memo(function WorldBackdrop({ mood, className }: { mood: WorldMood; className?: string }) {
  return (
    <div aria-hidden className={cn('world pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)} data-mood={mood}>
      {/* Skies cross-fade between moods. */}
      {MOODS.map((m) => (
        <div key={m} className="world-sky absolute inset-0" data-sky={m} style={{ opacity: m === mood ? 1 : 0 }} />
      ))}
      {/* Particles: stars (calm), embers (rage / enraged), sparkles (victory). */}
      <div className="absolute inset-0">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="world-p absolute rounded-full"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, animationDelay: `-${p.delay}ms`, animationDuration: `${p.dur}ms` } as CSSProperties}
          />
        ))}
      </div>
      {/* Three layers of hills drifting at different speeds (parallax). */}
      <Hills className="world-hills world-far" d="M0 300 L120 220 L240 270 L380 190 L520 260 L660 200 L800 270 L940 210 L1080 260 L1220 190 L1360 250 L1500 200 L1600 240 L1600 400 L0 400 Z" />
      <Hills className="world-hills world-mid" d="M0 320 C 160 250 280 300 420 260 C 560 220 700 310 860 270 C 1020 230 1160 300 1320 260 C 1440 230 1540 270 1600 280 L1600 400 L0 400 Z" />
      <Hills className="world-hills world-near" d="M0 350 C 200 310 380 360 560 330 C 760 300 900 360 1100 340 C 1300 320 1460 360 1600 340 L1600 400 L0 400 Z" />
      <div className="world-flash absolute inset-0" />
      <div className="world-veil absolute inset-0" />
      <div className="world-orb absolute" />
    </div>
  );
});

function Hills({ d, className }: { d: string; className: string }) {
  // Two copies side by side so the drift loops seamlessly.
  return (
    <div className={cn('absolute inset-x-0 bottom-0 h-[42%]', className)}>
      <svg viewBox="0 0 3200 400" preserveAspectRatio="none" className="world-drift h-full w-[200%]">
        <path d={d} />
        <path d={d} transform="translate(1600 0)" />
      </svg>
    </div>
  );
}
