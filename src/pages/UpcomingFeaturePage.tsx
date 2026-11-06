import { useMatches } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/SectionHead';
import { UPCOMING, type UpcomingKey } from './upcoming-features';

/** Reads which feature to describe from the route's `handle: { upcoming }`. Nothing here is simulated. */
export default function UpcomingFeaturePage() {
  const matches = useMatches();
  const key = (matches.at(-1)?.handle as { upcoming?: UpcomingKey } | undefined)?.upcoming ?? 'history';
  const feature = UPCOMING[key];

  return (
    <div className="max-w-2xl">
      <p className="type-kicker">Coming next</p>
      <h1 className="type-display mt-2 text-display-lg">{feature.title}</h1>
      <p className="mt-3 text-body text-ink-700">{feature.summary} Arrives after live games launch.</p>

      <section aria-labelledby="planned-heading" className="mt-10">
        <SectionHead id="planned-heading" kicker="Planned" />
        <ul className="divide-y divide-line">
          {feature.items.map((item) => (
            <li key={item} className="flex min-h-12 items-center gap-3 text-body text-ink-900">
              <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-line-strong" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* A wireframe of the results table, deliberately without values. */}
      <figure aria-label="Planned results table, no data yet" className="mt-10 rounded-md border border-line p-4">
        <figcaption className="type-kicker">Planned · results table</figcaption>
        <div aria-hidden className="mt-4 space-y-0">
          <div className="grid grid-cols-[3rem_1fr_5rem] gap-4 border-b border-line-strong pb-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 rounded-full bg-paper-sunk" />
            ))}
          </div>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className={`grid grid-cols-[3rem_1fr_5rem] gap-4 border-b border-line py-4 ${row > 2 ? 'hidden sm:grid' : ''}`}>
              <span className="h-2 rounded-full bg-paper-sunk" />
              <span className="h-2 w-2/3 rounded-full bg-paper-sunk" />
              <span className="h-2 rounded-full bg-paper-sunk" />
            </div>
          ))}
        </div>
      </figure>

      <ButtonLink to="/teacher/sessions" variant="secondary" className="mt-8">
        Go to Live sessions
      </ButtonLink>
    </div>
  );
}
