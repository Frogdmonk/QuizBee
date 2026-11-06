import { Copy, Eye, Pencil } from 'lucide-react';
import { ACCESS_LABELS } from '@/lib/workspace-rules';
import { cn } from '@/lib/cn';
import type { QuizAccess } from '@/types/workspace';

const ICONS = { view: Eye, copy: Copy, edit: Pencil } as const;
// Solid backgrounds: the badge often sits on a quiz cover image or colour.
const TONES = {
  view: 'bg-ink-100 text-ink-700',
  copy: 'bg-sun-300 text-ink-900',
  edit: 'bg-flame-100 text-flame-700',
} as const;

export function AccessBadge({ access, className }: { access: QuizAccess; className?: string }) {
  const Icon = ICONS[access];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap',
        TONES[access],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ACCESS_LABELS[access]}
    </span>
  );
}
