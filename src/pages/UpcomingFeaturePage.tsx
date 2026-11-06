import { useMatches } from 'react-router';
import { Construction, Check } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { UPCOMING, type UpcomingKey } from './upcoming-features';

/** Reads which feature to describe from the route's `handle: { upcoming }`. */
export default function UpcomingFeaturePage() {
  const matches = useMatches();
  const key = (matches.at(-1)?.handle as { upcoming?: UpcomingKey } | undefined)?.upcoming ?? 'sessions';
  const feature = UPCOMING[key];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{feature.title}</h1>
        <Badge tone="sun">Phase {feature.phase}</Badge>
      </div>
      <p className="mt-2 text-ink-600">{feature.summary}</p>

      <Card className="mt-8">
        <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sun-300/30 text-ink-800">
            <Construction className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Not built yet</h2>
            <p className="mt-1 text-ink-600">
              This page becomes functional in development phase {feature.phase}. Nothing here is simulated. It
              will connect to your real data once that phase ships.
            </p>
            <ul className="mt-5 space-y-2.5">
              {feature.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-ink-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-ink-400" />
                  {item}
                </li>
              ))}
            </ul>
            <ButtonLink to="/teacher/dashboard" variant="secondary" className="mt-6">
              Back to dashboard
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
